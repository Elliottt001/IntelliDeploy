from __future__ import annotations

from datetime import datetime, timezone
from copy import deepcopy
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.types import (
    AcceptanceItem,
    AppManifest,
    CheckResult,
    DeploymentResult,
    Requirement,
    ServiceSpec,
    ValidationReport,
)
from app.runtime.manifest import manifest_hash
from app.runtime.releases import (
    ReleaseFailed,
    delete_instance,
    publish_candidate,
    stop_instance,
)


def passing_report(manifest: AppManifest, *, evidence="evidence/save") -> ValidationReport:
    return ValidationReport(
        checks=[CheckResult(id="save", status="PASS", evidence=evidence)],
        required_ids=["save"],
        requirement_revision=1,
        attempt_id="attempt-1",
        manifest_hash=manifest_hash(manifest),
    )


@pytest.fixture
def release_context(session_factory, tmp_path):
    from app.apps.models import App, AppVersion, Instance, RequirementRecord
    from app.capabilities.models import InstanceCredential, InstanceDataSpace
    from app.jobs.models import Job
    from app.models.user import User
    from app.runtime.models import DeploymentTarget

    manifest = AppManifest(
        web_service="web",
        services=[
            ServiceSpec(
                name="web",
                image="registry.test/web@sha256:" + "a" * 64,
                port=3000,
                volumes={"data": "/data"},
            )
        ],
    )
    artifact = tmp_path / "candidate.zip"
    artifact.write_bytes(b"immutable-source")
    requirement = Requirement(
        prompt="保存笔记",
        revision=1,
        acceptance=[AcceptanceItem(id="save", action="保存笔记", expected="刷新后仍存在")],
    )
    with session_factory() as session:
        owner = User(
            username=f"owner-{uuid4().hex}",
            email=f"{uuid4().hex}@test",
            hashed_password="test-only",
        )
        other = User(
            username=f"other-{uuid4().hex}",
            email=f"{uuid4().hex}@test",
            hashed_password="test-only",
        )
        session.add_all([owner, other])
        session.flush()
        target = DeploymentTarget(
            id=f"target-{uuid4().hex}",
            kind="LINUX",
            enabled=True,
            health="HEALTHY",
            architecture="amd64",
            capacity={},
            domain_suffix="apps.test.invalid",
            secret_ref="target-secret",
        )
        session.add(target)
        app = App(owner_id=owner.id, name="笔记", prompt=requirement.prompt)
        session.add(app)
        session.flush()
        old = AppVersion(
            app_id=app.id,
            requirement_revision=1,
            manifest=manifest.model_dump(mode="json"),
            validation=passing_report(manifest).model_dump(mode="json"),
            artifact_path=str(artifact),
        )
        candidate = AppVersion(
            app_id=app.id,
            requirement_revision=1,
            manifest=manifest.model_dump(mode="json"),
            validation=passing_report(manifest).model_dump(mode="json"),
            artifact_path=str(artifact),
            delivery={
                "summary": "可保存笔记",
                "features": ["保存笔记"],
                "browser_checks": [],
            },
        )
        session.add_all([old, candidate])
        session.flush()
        app.active_version_id = old.id
        app.candidate_version_id = candidate.id
        session.add(RequirementRecord(app_id=app.id, revision=1, requirement=requirement.model_dump(mode="json")))
        instance = Instance(
            owner_id=owner.id,
            app_id=app.id,
            version_id=old.id,
            target_id=target.id,
            status="RUNNING",
            url="https://old.apps.test.invalid",
            data_namespace=f"data-{uuid4().hex}",
            secret_ref="instance-secret",
        )
        session.add(instance)
        session.flush()
        session.add(
            InstanceDataSpace(
                instance_id=instance.id,
                database_name=f"db_{uuid4().hex}",
                role_name=f"role_{uuid4().hex}",
                secret_ref="database-secret",
            )
        )
        session.add(
            InstanceCredential(instance_id=instance.id, token_hash="token-hash")
        )
        job = Job(
            app_id=app.id,
            operation_id=f"job-{uuid4().hex}",
            kind="ADJUST",
            status="RUNNING",
            phase="releasing",
            requirement_revision=1,
            budget_units=100,
        )
        session.add(job)
        session.commit()
        return {
            "owner_id": owner.id,
            "other_id": other.id,
            "app_id": app.id,
            "old_id": old.id,
            "candidate_id": candidate.id,
            "instance_id": instance.id,
            "job_id": job.id,
            "manifest": manifest,
            "artifact": artifact,
        }


class Deployer:
    def __init__(self, report: ValidationReport):
        self.report = report
        self.calls = 0

    async def __call__(self, **kwargs):
        self.calls += 1
        return DeploymentResult(
            operation_id=kwargs["operation_id"],
            instance_id=kwargs["instance_id"],
            url="https://new.apps.test.invalid",
            report=self.report,
        )


class TargetActions:
    def __init__(self):
        self.stopped = []
        self.deleted = []

    def stop(self, instance):
        self.stopped.append(instance.id)

    def delete(self, instance, *, delete_data):
        self.deleted.append((instance.id, delete_data))


@pytest.mark.asyncio
async def test_failed_candidate_keeps_live_version_and_instance(
    session_factory, release_context
):
    failed = ValidationReport(
        checks=[CheckResult(id="save", status="FAIL", evidence="evidence/fail")],
        required_ids=["save"],
        requirement_revision=1,
        attempt_id="attempt-1",
        manifest_hash=manifest_hash(release_context["manifest"]),
    )
    with session_factory() as session:
        with pytest.raises(ReleaseFailed, match="verification"):
            await publish_candidate(
                session,
                release_context["job_id"],
                release_context["candidate_id"],
                deployer=Deployer(failed),
            )

    from app.apps.models import App, Instance
    from app.jobs.models import Job

    with session_factory() as session:
        app = session.get(App, release_context["app_id"])
        instance = session.get(Instance, release_context["instance_id"])
        job = session.get(Job, release_context["job_id"])
        assert app.active_version_id == release_context["old_id"]
        assert instance.version_id == release_context["old_id"]
        assert instance.status == "RUNNING"
        assert instance.url == "https://old.apps.test.invalid"
        assert job.status == "FAILED"


@pytest.mark.asyncio
async def test_verified_release_switches_state_once_and_is_idempotent(
    session_factory, release_context
):
    deployer = Deployer(passing_report(release_context["manifest"]))
    with session_factory() as session:
        first = await publish_candidate(
            session,
            release_context["job_id"],
            release_context["candidate_id"],
            deployer=deployer,
        )
    with session_factory() as session:
        second = await publish_candidate(
            session,
            release_context["job_id"],
            release_context["candidate_id"],
            deployer=deployer,
        )

    assert second == first
    assert deployer.calls == 1
    from app.apps.models import App, AppVersion, Instance
    from app.jobs.models import Job

    with session_factory() as session:
        app = session.get(App, release_context["app_id"])
        candidate = session.get(AppVersion, release_context["candidate_id"])
        instance = session.get(Instance, release_context["instance_id"])
        job = session.get(Job, release_context["job_id"])
        assert app.active_version_id == candidate.id
        assert app.candidate_version_id is None
        assert instance.version_id == candidate.id
        assert instance.status == "RUNNING"
        assert instance.url == first.url
        assert instance.desired_state == "RUNNING"
        assert instance.resource_spec["services"][0]["memory_mb"] == 512
        assert instance.resource_spec["storage_mb"] == 1024
        assert instance.price_version == "dev-v1"
        assert job.status == "SUCCEEDED"
        assert job.result["version_id"] == candidate.id
        assert candidate.delivery["url"] == first.url


@pytest.mark.asyncio
@pytest.mark.parametrize("change", ["revision", "manifest_hash", "image", "artifact"])
async def test_candidate_binding_failure_blocks_deployer(
    session_factory, release_context, change
):
    from app.apps.models import AppVersion

    with session_factory() as session:
        candidate = session.get(AppVersion, release_context["candidate_id"])
        if change == "revision":
            candidate.requirement_revision = 2
        elif change == "manifest_hash":
            candidate.validation = {**candidate.validation, "manifest_hash": "wrong"}
        elif change == "image":
            changed = deepcopy(candidate.manifest)
            changed["services"][0]["image"] = "registry.test/web:latest"
            candidate.manifest = changed
        else:
            candidate.artifact_path = str(release_context["artifact"].parent / "missing.zip")
        session.commit()

    deployer = Deployer(passing_report(release_context["manifest"]))
    with session_factory() as session:
        with pytest.raises(ReleaseFailed):
            await publish_candidate(
                session,
                release_context["job_id"],
                release_context["candidate_id"],
                deployer=deployer,
            )
    assert deployer.calls == 0


@pytest.mark.asyncio
async def test_migration_failure_preserves_live_data_and_version(
    session_factory, release_context
):
    from app.apps.models import AppVersion, Instance
    from app.capabilities.models import InstanceDataSpace

    with session_factory() as session:
        candidate = session.get(AppVersion, release_context["candidate_id"])
        candidate.manifest = {**candidate.manifest, "migration": ["migrate"]}
        candidate.validation = passing_report(
            AppManifest.model_validate(candidate.manifest)
        ).model_dump(mode="json")
        session.commit()

    async def migration_runner(**kwargs):
        assert kwargs["use_data_copy"] is True
        raise RuntimeError("migration rejected existing row")

    with session_factory() as session:
        with pytest.raises(ReleaseFailed, match="migration"):
            await publish_candidate(
                session,
                release_context["job_id"],
                release_context["candidate_id"],
                deployer=Deployer(passing_report(release_context["manifest"])),
                migration_runner=migration_runner,
            )

    with session_factory() as session:
        instance = session.get(Instance, release_context["instance_id"])
        data = session.get(InstanceDataSpace, instance.id)
        assert instance.version_id == release_context["old_id"]
        assert data.destroyed_at is None


@pytest.mark.asyncio
async def test_missing_migration_runner_fails_release_cleanly(
    session_factory, release_context
):
    from app.apps.models import AppVersion
    from app.jobs.models import Job

    with session_factory() as session:
        candidate = session.get(AppVersion, release_context["candidate_id"])
        candidate.manifest = {**candidate.manifest, "migration": ["migrate"]}
        candidate.validation = passing_report(
            AppManifest.model_validate(candidate.manifest)
        ).model_dump(mode="json")
        session.commit()

    with session_factory() as session:
        with pytest.raises(ReleaseFailed, match="runner is unavailable"):
            await publish_candidate(
                session,
                release_context["job_id"],
                release_context["candidate_id"],
                deployer=Deployer(passing_report(release_context["manifest"])),
            )

    with session_factory() as session:
        job = session.get(Job, release_context["job_id"])
        assert job.status == "FAILED"
        assert job.error["code"] == "MIGRATION_UNAVAILABLE"


def test_stop_preserves_version_url_and_data(session_factory, release_context):
    from app.apps.models import Instance
    from app.capabilities.models import InstanceDataSpace

    actions = TargetActions()
    with session_factory() as session:
        result = stop_instance(
            session,
            release_context["instance_id"],
            release_context["owner_id"],
            target_actions=actions,
        )
        assert result.status == "STOPPED"
        assert result.desired_state == "STOPPED"
    with session_factory() as session:
        instance = session.get(Instance, release_context["instance_id"])
        data = session.get(InstanceDataSpace, instance.id)
        assert instance.version_id == release_context["old_id"]
        assert instance.url == "https://old.apps.test.invalid"
        assert data.destroyed_at is None
    assert actions.stopped == [release_context["instance_id"]]


def test_delete_requires_owner_confirmation_and_is_idempotent(
    session_factory, release_context
):
    from app.apps.models import Instance
    from app.capabilities.models import InstanceCredential, InstanceDataSpace

    actions = TargetActions()
    with session_factory() as session:
        with pytest.raises(ValueError, match="confirmation"):
            delete_instance(
                session,
                release_context["instance_id"],
                release_context["owner_id"],
                "delete",
                False,
                target_actions=actions,
            )
        with pytest.raises(LookupError):
            delete_instance(
                session,
                release_context["instance_id"],
                release_context["other_id"],
                "DELETE",
                False,
                target_actions=actions,
            )

    with session_factory() as session:
        first = delete_instance(
            session,
            release_context["instance_id"],
            release_context["owner_id"],
            "DELETE",
            False,
            target_actions=actions,
        )
    with session_factory() as session:
        second = delete_instance(
            session,
            release_context["instance_id"],
            release_context["owner_id"],
            "DELETE",
            False,
            target_actions=actions,
        )

    assert first.status == second.status == "DELETED"
    assert first.desired_state == second.desired_state == "DELETED"
    assert actions.deleted == [(release_context["instance_id"], False)]
    with session_factory() as session:
        instance = session.get(Instance, release_context["instance_id"])
        data = session.get(InstanceDataSpace, instance.id)
        credential = session.get(InstanceCredential, instance.id)
        assert instance.url is None
        assert data.destroyed_at is None
        assert credential.revoked_at is not None
