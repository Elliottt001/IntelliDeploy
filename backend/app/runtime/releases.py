from __future__ import annotations

import inspect
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from sqlalchemy import select

from app.apps.models import App, AppVersion, Instance, RequirementRecord
from app.capabilities.models import InstanceCredential, InstanceDataSpace
from app.core.types import (
    AppManifest,
    DeliveryResult,
    DeploymentResult,
    Requirement,
    ValidationReport,
)
from app.jobs.models import Job, JobEvent
from app.runtime.manifest import manifest_hash, validate_release_manifest
from app.runtime.models import DeploymentTarget, ResourceRecord


class ReleaseFailed(RuntimeError):
    pass


class TargetActions(Protocol):
    def stop(self, instance: Instance) -> None: ...
    def delete(self, instance: Instance, *, delete_data: bool) -> None: ...


def _operation_id(job_id: str, version_id: str) -> str:
    return f"release:{job_id}:{version_id}"


def _attempt(session, operation_id: str) -> ResourceRecord | None:
    return session.scalar(
        select(ResourceRecord).where(
            ResourceRecord.type == "RELEASE_ATTEMPT",
            ResourceRecord.operation_id == operation_id,
        )
    )


def _public_event(session, job: Job, message: str) -> None:
    event = JobEvent(
        job_id=job.id,
        kind="release",
        public_payload={
            "id": 0,
            "kind": "release",
            "message": message,
            "status": job.status,
            "phase": job.phase,
            "usage_units": job.used_units,
        },
    )
    session.add(event)
    session.flush()
    event.public_payload = {**event.public_payload, "id": event.id}


def _fail_release(
    session,
    job: Job,
    attempt: ResourceRecord,
    *,
    code: str,
    message: str,
) -> None:
    attempt.state = "FAILED"
    attempt.metadata_json = {
        **(attempt.metadata_json or {}),
        "error": {"code": code, "message": message, "retryable": True},
    }
    job.status = "FAILED"
    job.phase = "release_failed"
    job.result = None
    job.error = {"code": code, "message": message, "retryable": True}
    job.lease_owner = None
    job.lease_until = None
    _public_event(session, job, message)
    session.commit()


def _load_release_context(session, job_id: str, candidate_version_id: str):
    job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
    if job is None:
        raise ReleaseFailed("release job not found")
    app = session.scalar(select(App).where(App.id == job.app_id).with_for_update())
    candidate = session.get(AppVersion, candidate_version_id)
    instance = session.scalar(
        select(Instance)
        .where(Instance.app_id == app.id, Instance.status != "DELETED")
        .order_by(Instance.created_at)
        .with_for_update()
    )
    requirement_record = session.scalar(
        select(RequirementRecord).where(
            RequirementRecord.app_id == app.id,
            RequirementRecord.revision == job.requirement_revision,
        )
    )
    if candidate is None or instance is None or requirement_record is None:
        raise ReleaseFailed("release candidate context is incomplete")
    return job, app, candidate, instance, requirement_record


def _validate_candidate(
    job: Job,
    app: App,
    candidate: AppVersion,
    requirement: Requirement,
) -> tuple[AppManifest, ValidationReport]:
    if candidate.app_id != app.id or app.candidate_version_id != candidate.id:
        raise ReleaseFailed("candidate is not the app pending version")
    if candidate.requirement_revision != job.requirement_revision:
        raise ReleaseFailed("candidate requirement revision does not match the job")
    if not candidate.immutable:
        raise ReleaseFailed("candidate version must be immutable")
    manifest = AppManifest.model_validate(candidate.manifest)
    try:
        validate_release_manifest(manifest)
    except ValueError as exc:
        raise ReleaseFailed("candidate images are not digest pinned") from exc
    report = ValidationReport.model_validate(candidate.validation)
    required_ids = [item.id for item in requirement.acceptance]
    if (
        not report.passed
        or report.required_ids != required_ids
        or report.requirement_revision != job.requirement_revision
        or report.manifest_hash != manifest_hash(manifest)
        or not report.attempt_id
    ):
        raise ReleaseFailed("candidate validation binding is invalid")
    artifact = Path(candidate.artifact_path or "")
    if not artifact.is_file() or artifact.suffix != ".zip":
        raise ReleaseFailed("candidate source artifact is missing")
    return manifest, report


async def _await(value):
    return await value if inspect.isawaitable(value) else value


async def _default_deployer(**kwargs) -> DeploymentResult:
    target: DeploymentTarget = kwargs.pop("target")
    if target.kind == "LINUX":
        from app.runtime.linux import deploy_linux

        return await deploy_linux(target_id=target.id, **kwargs)
    if target.kind in {"KUBERNETES", "SEALOS"}:
        from app.runtime.kubernetes import deploy_kubernetes

        return await deploy_kubernetes(target_id=target.id, **kwargs)
    raise ReleaseFailed("deployment target kind is unsupported")


async def publish_candidate(
    session,
    job_id: str,
    candidate_version_id: str,
    *,
    deployer=None,
    migration_runner=None,
) -> DeploymentResult:
    operation_id = _operation_id(job_id, candidate_version_id)
    existing = _attempt(session, operation_id)
    if existing is not None and existing.state == "SUCCEEDED":
        return DeploymentResult.model_validate(existing.metadata_json["deployment"])
    if existing is not None and existing.state == "FAILED":
        raise ReleaseFailed("release attempt already failed")
    if existing is not None:
        raise ReleaseFailed("release attempt is still being reconciled")

    job, app, candidate, instance, requirement_record = _load_release_context(
        session, job_id, candidate_version_id
    )
    requirement = Requirement.model_validate(requirement_record.requirement)
    attempt = ResourceRecord(
        type="RELEASE_ATTEMPT",
        target_id=instance.target_id,
        app_id=app.id,
        job_id=job.id,
        version_id=candidate.id,
        operation_id=operation_id,
        state="PREPARING",
        reference=candidate.id,
        metadata_json={"previous_version_id": app.active_version_id},
    )
    session.add(attempt)
    try:
        manifest, _ = _validate_candidate(job, app, candidate, requirement)
    except ReleaseFailed as exc:
        session.flush()
        _fail_release(
            session,
            job,
            attempt,
            code="RELEASE_CANDIDATE_INVALID",
            message="候选版本与需求或验证证据不一致",
        )
        raise exc
    job.phase = "migrating" if manifest.migration else "deploying"
    session.commit()

    recovery = {}
    if manifest.migration:
        if migration_runner is None:
            with session.begin():
                current_job = session.get(Job, job_id)
                current_attempt = _attempt(session, operation_id)
                _fail_release(
                    session,
                    current_job,
                    current_attempt,
                    code="MIGRATION_UNAVAILABLE",
                    message="数据迁移执行器未配置",
                )
            raise ReleaseFailed("release migration runner is unavailable")
        try:
            recovery = await _await(
                migration_runner(
                    instance_id=instance.id,
                    migrations=manifest.migration,
                    operation_id=operation_id,
                    use_data_copy=True,
                )
            ) or {}
        except Exception as exc:
            current_job = session.get(Job, job_id)
            current_attempt = _attempt(session, operation_id)
            _fail_release(
                session,
                current_job,
                current_attempt,
                code="MIGRATION_FAILED",
                message="数据迁移验证失败，当前版本保持运行",
            )
            raise ReleaseFailed("release migration failed") from exc
        current_attempt = _attempt(session, operation_id)
        current_attempt.metadata_json = {
            **current_attempt.metadata_json,
            "migration_recovery": recovery,
        }
        session.commit()

    target = session.get(DeploymentTarget, instance.target_id)
    delivery_metadata = candidate.delivery or {}
    deploy = deployer or _default_deployer
    try:
        deployment = await _await(
            deploy(
                target=target,
                instance_id=instance.id,
                version_id=candidate.id,
                manifest=manifest,
                operation_id=operation_id.replace(":", "-")[:63],
                requirement=requirement,
                browser_checks=delivery_metadata.get("browser_checks", []),
            )
        )
        deployment = DeploymentResult.model_validate(deployment)
    except Exception as exc:
        current_job = session.get(Job, job_id)
        current_attempt = _attempt(session, operation_id)
        _fail_release(
            session,
            current_job,
            current_attempt,
            code="DEPLOYMENT_FAILED",
            message="候选版本发布失败，当前版本保持运行",
        )
        raise ReleaseFailed("release deployment failed") from exc
    if (
        not deployment.report.passed
        or deployment.report.required_ids != [item.id for item in requirement.acceptance]
        or deployment.report.requirement_revision != job.requirement_revision
        or deployment.report.manifest_hash != manifest_hash(manifest)
    ):
        current_job = session.get(Job, job_id)
        current_attempt = _attempt(session, operation_id)
        _fail_release(
            session,
            current_job,
            current_attempt,
            code="RELEASE_VERIFICATION_FAILED",
            message="发布后业务验证未通过，当前版本保持运行",
        )
        raise ReleaseFailed("release verification failed")

    job, app, candidate, instance, _ = _load_release_context(
        session, job_id, candidate_version_id
    )
    attempt = _attempt(session, operation_id)
    previous_version_id = attempt.metadata_json.get("previous_version_id")
    if app.active_version_id != previous_version_id:
        _fail_release(
            session,
            job,
            attempt,
            code="RELEASE_CONFLICT",
            message="应用版本已变化，需要重新核对发布结果",
        )
        raise ReleaseFailed("active version changed during release")
    now = datetime.now(timezone.utc)
    public_delivery = DeliveryResult(
        app_id=app.id,
        version_id=candidate.id,
        instance_id=instance.id,
        url=deployment.url,
        summary=delivery_metadata.get("summary") or app.name,
        features=list(delivery_metadata.get("features") or []),
        report_url=f"/api/jobs/{job.id}/report",
        artifact_url=f"/api/apps/{app.id}/versions/{candidate.id}/artifact",
        published_at=now,
    )
    app.active_version_id = candidate.id
    app.candidate_version_id = None
    instance.version_id = candidate.id
    instance.status = "RUNNING"
    instance.url = deployment.url
    candidate.validation = deployment.report.model_dump(mode="json")
    candidate.delivery = public_delivery.model_dump(mode="json")
    job.status = "SUCCEEDED"
    job.phase = "completed"
    job.error = None
    job.result = public_delivery.model_dump(mode="json")
    job.lease_owner = None
    job.lease_until = None
    attempt.state = "SUCCEEDED"
    attempt.metadata_json = {
        **attempt.metadata_json,
        "deployment": deployment.model_dump(mode="json"),
        "published_at": now.isoformat(),
    }
    _public_event(session, job, "应用已经完成验证并发布")
    session.commit()
    return deployment


def _owned_instance(session, instance_id: str, owner_id: int) -> Instance:
    instance = session.scalar(
        select(Instance).where(
            Instance.id == instance_id, Instance.owner_id == owner_id
        ).with_for_update()
    )
    if instance is None:
        raise LookupError("instance not found")
    return instance


def stop_instance(
    session,
    instance_id: str,
    owner_id: int,
    *,
    target_actions: TargetActions | None = None,
) -> Instance:
    instance = _owned_instance(session, instance_id, owner_id)
    if instance.status == "STOPPED":
        return instance
    if instance.status in {"DELETED", "DELETING"}:
        raise ValueError("deleted instance cannot be stopped")
    if target_actions is None:
        raise RuntimeError("target stop adapter is not configured")
    target_actions.stop(instance)
    instance.status = "STOPPED"
    session.commit()
    return instance


def delete_instance(
    session,
    instance_id: str,
    owner_id: int,
    confirmation: str,
    delete_data: bool,
    *,
    target_actions: TargetActions | None = None,
) -> Instance:
    if confirmation != "DELETE":
        raise ValueError("explicit DELETE confirmation is required")
    instance = _owned_instance(session, instance_id, owner_id)
    if instance.status == "DELETED":
        return instance
    if target_actions is None:
        raise RuntimeError("target delete adapter is not configured")
    target_actions.delete(instance, delete_data=delete_data)
    credential = session.get(InstanceCredential, instance.id)
    if credential is not None and credential.revoked_at is None:
        credential.revoked_at = datetime.now(timezone.utc)
    data = session.get(InstanceDataSpace, instance.id)
    if delete_data and data is not None and data.destroyed_at is None:
        data.destroyed_at = datetime.now(timezone.utc)
        instance.data_namespace = None
    instance.status = "DELETED"
    instance.url = None
    instance.secret_ref = None
    session.commit()
    return instance
