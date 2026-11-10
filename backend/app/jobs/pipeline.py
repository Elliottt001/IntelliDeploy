from __future__ import annotations

import inspect
from dataclasses import dataclass
from typing import Any, Awaitable, Callable
from uuid import uuid4

from sqlalchemy import select

from app.apps.models import App, AppVersion, RequirementRecord
from app.core.types import (
    AppManifest,
    BrowserCheck,
    CandidateRuntime,
    Requirement,
    ValidationReport,
)
from app.database import SessionLocal
from app.jobs.models import Job, JobEvent
from app.jobs.store import LeaseLost, leased_job
from app.jobs.execution import WaitingForUser, UncertainModelCall
from app.billing.ledger import InsufficientQuota
from app.runtime.build import build_release, snapshot_release
from app.runtime.candidate import candidate_controller, start_candidate, stop_candidate
from app.runtime.check_plan import compile_browser_checks
from app.runtime.manifest import manifest_hash
from app.runtime.models import ResourceRecord
from app.runtime.releases import ReleaseFailed, publish_candidate
from app.runtime.validation import validate_application


class PipelineFailure(RuntimeError):
    pass


class TargetUnavailable(PipelineFailure):
    pass


class PauseQuota(PipelineFailure):
    pass


class PipelineCancelled(PipelineFailure):
    pass


class RepairableCandidateError(PipelineFailure):
    def __init__(self, message: str, report: ValidationReport | None = None):
        super().__init__(message)
        self.report = report


@dataclass(frozen=True)
class PipelinePolicy:
    max_attempts: int = 4

    def __post_init__(self):
        if not 1 <= self.max_attempts <= 4:
            raise ValueError("pipeline allows one initial attempt and at most three repairs")


@dataclass(frozen=True)
class CandidateDraft:
    workspace_id: str
    manifest: AppManifest
    source_tree: list[str]
    browser_checks: list[BrowserCheck] | None = None


@dataclass(frozen=True)
class PipelineCandidate:
    attempt_id: str
    workspace_id: str
    manifest: AppManifest
    manifest_hash: str
    browser_checks: list[BrowserCheck]


async def _unconfigured_generation(**kwargs):
    del kwargs
    raise TargetUnavailable("generation dependencies are not configured")


async def _default_build(workspace_id, manifest, operation_id):
    return await build_release(workspace_id, manifest, operation_id)


@dataclass
class PipelineDependencies:
    generate_candidate: Callable[..., Awaitable[CandidateDraft]] = _unconfigured_generation
    build_candidate: Callable[..., Awaitable[AppManifest]] = _default_build
    compile_checks: Callable[..., Awaitable[list[BrowserCheck]]] = compile_browser_checks
    start_candidate: Callable[..., Awaitable[CandidateRuntime]] = start_candidate
    stop_candidate: Callable[..., Awaitable[None]] = stop_candidate
    validate_candidate: Callable[..., Awaitable[ValidationReport]] = validate_application
    runtime_controller: Callable[[str], Any] = candidate_controller
    check_model: Any = None
    deployer: Callable[..., Any] | None = None
    migration_runner: Callable[..., Any] | None = None


async def _await(value):
    return await value if inspect.isawaitable(value) else value


def _event(session, job: Job, message: str) -> None:
    event = JobEvent(
        job_id=job.id,
        kind="pipeline",
        public_payload={
            "id": 0,
            "kind": "pipeline",
            "message": message,
            "status": job.status,
            "phase": job.phase,
            "usage_units": job.used_units,
        },
    )
    session.add(event)
    session.flush()
    event.public_payload = {**event.public_payload, "id": event.id}


def _job_for_update(session, job_id, worker_id=None, generation=None) -> Job:
    if worker_id is not None or generation is not None:
        if worker_id is None or generation is None:
            raise LeaseLost("worker and lease generation must be provided together")
        return leased_job(session, job_id, worker_id, generation)
    job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
    if job is None:
        raise PipelineFailure("job not found")
    return job


def check_lease_and_budget(
    session_factory,
    job_id: str,
    *,
    worker_id: str | None = None,
    generation: int | None = None,
) -> tuple[Job, Requirement]:
    with session_factory() as session:
        job = _job_for_update(session, job_id, worker_id, generation)
        if job.cancel_requested:
            raise PipelineCancelled("job cancellation requested")
        if job.used_units >= job.budget_units:
            raise PauseQuota("job budget is exhausted")
        record = session.scalar(
            select(RequirementRecord).where(
                RequirementRecord.app_id == job.app_id,
                RequirementRecord.revision == job.requirement_revision,
            )
        )
        if record is None:
            raise PipelineFailure("frozen requirement is missing")
        job.status = "RUNNING"
        job.phase = "generating"
        job.error = None
        session.commit()
        return job, Requirement.model_validate(record.requirement)


async def implement_and_build(
    job: Job,
    requirement: Requirement,
    attempt_index: int,
    repair_evidence: list[dict],
    dependencies: PipelineDependencies,
) -> PipelineCandidate:
    attempt_id = f"{job.id[:8]}-{attempt_index + 1}-{uuid4().hex[:8]}"
    draft = await _await(
        dependencies.generate_candidate(
            job_id=job.id,
            job=job,
            requirement=requirement,
            attempt_index=attempt_index,
            repair_evidence=repair_evidence,
        )
    )
    if not isinstance(draft, CandidateDraft):
        draft = CandidateDraft(**draft)
    built = await _await(
        dependencies.build_candidate(draft.workspace_id, draft.manifest, attempt_id)
    )
    built = AppManifest.model_validate(built)
    checks = draft.browser_checks
    if checks is None:
        checks = await _await(
            dependencies.compile_checks(
                requirement, draft.source_tree, dependencies.check_model
            )
        )
    return PipelineCandidate(
        attempt_id=attempt_id,
        workspace_id=draft.workspace_id,
        manifest=built,
        manifest_hash=manifest_hash(built),
        browser_checks=[BrowserCheck.model_validate(item) for item in checks],
    )


def persist_attempt(
    session_factory,
    job_id: str,
    candidate: PipelineCandidate,
    report: ValidationReport,
) -> ResourceRecord:
    operation_id = f"candidate:{job_id}:{candidate.attempt_id}"
    with session_factory() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise PipelineFailure("job not found")
        if (
            report.requirement_revision != job.requirement_revision
            or report.attempt_id != candidate.attempt_id
            or report.manifest_hash != candidate.manifest_hash
        ):
            raise RepairableCandidateError("candidate report binding is invalid", report)
        existing = session.scalar(
            select(ResourceRecord).where(
                ResourceRecord.type == "CANDIDATE_ATTEMPT",
                ResourceRecord.operation_id == operation_id,
            )
        )
        payload = {
            "attempt_id": candidate.attempt_id,
            "workspace_id": candidate.workspace_id,
            "manifest": candidate.manifest.model_dump(mode="json"),
            "manifest_hash": candidate.manifest_hash,
            "browser_checks": [item.model_dump(mode="json") for item in candidate.browser_checks],
            "report": report.model_dump(mode="json"),
        }
        if existing is not None:
            if existing.metadata_json != payload:
                raise PipelineFailure("candidate attempt was replayed with different evidence")
            return existing
        record = ResourceRecord(
            type="CANDIDATE_ATTEMPT",
            app_id=job.app_id,
            job_id=job.id,
            operation_id=operation_id,
            state="SUCCEEDED" if report.passed else "FAILED",
            reference=candidate.attempt_id,
            metadata_json=payload,
        )
        session.add(record)
        session.commit()
        return record


def append_repair_evidence(
    session_factory,
    job_id: str,
    report: ValidationReport | None,
    message: str,
) -> list[dict]:
    with session_factory() as session:
        job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
        checkpoint = dict(job.checkpoint or {})
        evidence = list(checkpoint.get("repair_evidence") or [])
        evidence.append(
            {
                "message": message[:500],
                "report": report.model_dump(mode="json") if report is not None else None,
            }
        )
        checkpoint["repair_evidence"] = evidence
        job.checkpoint = checkpoint
        job.phase = "repairing"
        job.status = "RUNNING"
        job.error = None
        _event(session, job, "候选验证未通过，正在根据必要诊断修复")
        session.commit()
        return evidence


def _create_verified_version(
    session_factory,
    job_id: str,
    candidate: PipelineCandidate,
    report: ValidationReport,
) -> str:
    artifact_path = snapshot_release(candidate.workspace_id, candidate.manifest, report)
    with session_factory() as session:
        job = session.get(Job, job_id)
        app = session.scalar(select(App).where(App.id == job.app_id).with_for_update())
        requirement=session.scalar(select(RequirementRecord).where(RequirementRecord.app_id==app.id,RequirementRecord.revision==job.requirement_revision))
        version = AppVersion(
            app_id=app.id,
            requirement_revision=job.requirement_revision,
            sources=(session.get(AppVersion,app.source_version_id).sources if job.kind=='COPY' else job.checkpoint.get('sources',[])),
            template_version=(session.get(AppVersion,app.source_version_id).template_version if job.kind=='COPY' else job.checkpoint.get('template_version')),
            manifest=candidate.manifest.model_dump(mode="json"),
            validation=report.model_dump(mode="json"),
            artifact_path=artifact_path,
            immutable=True,
            delivery={
                "summary": app.name,
                "features": [item['action'] for item in requirement.requirement['acceptance']] if requirement else [],
                "browser_checks": [
                    item.model_dump(mode="json") for item in candidate.browser_checks
                ],
            },
        )
        session.add(version)
        session.flush()
        app.candidate_version_id = version.id
        session.commit()
        return version.id


async def publish_verified_candidate(
    session_factory,
    job_id: str,
    candidate: PipelineCandidate,
    report: ValidationReport,
    dependencies: PipelineDependencies,
) -> None:
    if not report.passed:
        raise RepairableCandidateError("core checks did not pass", report)
    version_id = _create_verified_version(session_factory, job_id, candidate, report)
    try:
        with session_factory() as session:
            await publish_candidate(
                session,
                job_id,
                version_id,
                deployer=dependencies.deployer,
                migration_runner=dependencies.migration_runner,
                repairable=True,
            )
    except ReleaseFailed as exc:
        cause = exc.__cause__
        while cause is not None:
            if type(cause).__name__ in {"TargetUnavailable", "KubernetesTargetUnavailable"}:
                raise TargetUnavailable(str(cause)) from exc
            cause = cause.__cause__
        raise RepairableCandidateError(
            "live release verification failed", getattr(exc, "report", None)
        ) from exc


def _finish_failure(session_factory, job_id: str, code: str, message: str) -> None:
    with session_factory() as session:
        job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
        if job.status == "SUCCEEDED":
            return
        job.status = "FAILED"
        job.phase = "failed"
        job.result = None
        job.error = {"code": code, "message": message, "retryable": True}
        job.lease_owner = None
        job.lease_until = None
        _event(session, job, message)
        session.commit()


def _finish_cancelled(session_factory, job_id: str) -> None:
    with session_factory() as session:
        job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
        if job.status == "SUCCEEDED":
            return
        job.status = "CANCELLED"
        job.phase = "cancelled"
        job.result = None
        job.error = None
        job.lease_owner = None
        job.lease_until = None
        _event(session, job, "任务已在安全点取消")
        session.commit()


async def run_pipeline(
    job_id: str,
    *,
    worker_id: str | None = None,
    generation: int | None = None,
    session_factory=SessionLocal,
    dependencies: PipelineDependencies | None = None,
    policy: PipelinePolicy | None = None,
) -> None:
    execution = None
    policy = policy or PipelinePolicy()
    repair_evidence: list[dict] = []
    last_message = "core checks did not pass"
    is_copy = _copy_job(session_factory,job_id)
    try:
        if dependencies is None:
            from app.jobs.execution import build_default_dependencies
            dependencies,execution=await build_default_dependencies(job_id,worker_id,generation,session_factory)
            await execution.ensure_requirement()
        for attempt_index in range(1 if is_copy else policy.max_attempts):
            runtime = None
            try:
                job, requirement = check_lease_and_budget(
                    session_factory,
                    job_id,
                    worker_id=worker_id,
                    generation=generation,
                )
                if job.kind=='COPY':
                    from app.community.service import prepare_copy_candidate
                    with session_factory() as session:
                        draft=prepare_copy_candidate(session,session.get(Job,job.id))
                    if execution:
                        draft=CandidateDraft(draft.workspace_id,execution.candidates.prepare_manifest(draft.manifest),draft.source_tree,draft.browser_checks)
                    attempt_id=f'{job.id[:8]}-copy-{attempt_index+1}'
                    candidate=PipelineCandidate(attempt_id,draft.workspace_id,draft.manifest,manifest_hash(draft.manifest),draft.browser_checks)
                else:
                    candidate = await implement_and_build(
                        job, requirement, attempt_index, repair_evidence, dependencies
                    )
                runtime = await _await(
                    dependencies.start_candidate(
                        job.id, candidate.attempt_id, candidate.manifest, requirement
                    )
                )
                if runtime.manifest_hash != candidate.manifest_hash:
                    raise RepairableCandidateError("candidate runtime digest changed")
                report = await _await(
                    dependencies.validate_candidate(
                        runtime.base_url,
                        requirement,
                        candidate.browser_checks,
                        dependencies.runtime_controller(runtime.id),
                        attempt_id=candidate.attempt_id,
                        manifest_hash=candidate.manifest_hash,
                    )
                )
                report = ValidationReport.model_validate(report)
                persist_attempt(session_factory, job.id, candidate, report)
                if not report.passed:
                    raise RepairableCandidateError("core checks did not pass", report)
                check_lease_and_budget(
                    session_factory,
                    job_id,
                    worker_id=worker_id,
                    generation=generation,
                )
                await publish_verified_candidate(
                    session_factory, job.id, candidate, report, dependencies
                )
                return
            except RepairableCandidateError as exc:
                last_message = str(exc)
                check_lease_and_budget(
                    session_factory,
                    job_id,
                    worker_id=worker_id,
                    generation=generation,
                )
                repair_evidence = append_repair_evidence(
                    session_factory, job_id, exc.report, last_message
                )
            finally:
                if runtime is not None:
                    await _await(dependencies.stop_candidate(runtime.id, preserve_evidence=True))
        _finish_failure(session_factory, job_id, "CORE_CHECKS_FAILED", last_message)
    except PipelineCancelled:
        _finish_cancelled(session_factory, job_id)
        return
    except (PauseQuota,InsufficientQuota):
        with session_factory() as session:
            job = session.get(Job, job_id)
            job.status = "PAUSED_QUOTA"
            job.phase = "paused_quota"
            job.result = None
            job.error = None
            job.lease_owner = None
            job.lease_until = None
            session.commit()
        return
    except LeaseLost:
        raise
    except WaitingForUser:
        return
    except UncertainModelCall:
        _finish_failure(session_factory,job_id,'UPSTREAM_UNAVAILABLE','模型请求结果或用量待核对，不能自动重放')
        return
    except TargetUnavailable as exc:
        _finish_failure(session_factory, job_id, "TARGET_UNAVAILABLE", str(exc))
        return
    except Exception as exc:
        _finish_failure(session_factory, job_id, "PIPELINE_FAILED", str(exc))
        return
    finally:
        if execution is not None:
            from app.billing.ledger import settle
            from app.billing.models import Reservation
            with session_factory() as session:
                current=session.get(Job,job_id)
                if current.status in {'SUCCEEDED','FAILED','CANCELLED','PAUSED_QUOTA'} and current.reservation_id:
                    parent=session.get(Reservation,current.reservation_id)
                    if parent and parent.status=='OPEN':settle(session,parent.operation_id);session.commit()
            await execution.close()
        if is_copy:
            from app.billing.ledger import settle
            with session_factory() as session:
                if session.get(Job,job_id).status in {'SUCCEEDED','FAILED','CANCELLED'}:
                    settle(session,f'job:{job_id}');session.commit()


def _copy_job(session_factory,job_id):
    with session_factory() as session:
        job=session.get(Job,job_id)
        return job is not None and job.kind=='COPY'

