from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest

from app.core.types import (
    AcceptanceItem,
    AppManifest,
    BrowserCheck,
    CandidateRuntime,
    CheckResult,
    DeploymentResult,
    Requirement,
    ServiceSpec,
    ValidationReport,
)
from app.runtime.manifest import manifest_hash


class CheckModel:
    def __init__(self, values):
        self.values = list(values)
        self.calls = 0

    async def compile_checks(self, requirement, source_tree, feedback=None):
        del requirement, source_tree, feedback
        self.calls += 1
        return self.values.pop(0)


@pytest.mark.asyncio
async def test_check_plan_retries_invalid_output_and_requires_behavior_assertions():
    from app.runtime.check_plan import compile_browser_checks

    requirement = Requirement(
        prompt="保存笔记",
        acceptance=[AcceptanceItem(id="save", action="保存", expected="刷新后存在")],
    )
    model = CheckModel(
        [
            [{"item_id": "other", "actor": "owner", "actions": [], "expected": "x"}],
            [
                {
                    "item_id": "save",
                    "actor": "owner",
                    "actions": [
                        {"type": "goto", "path": "/"},
                        {"type": "expect_text", "selector": "#note", "text": "unique-note"},
                    ],
                    "expected": "刷新后存在",
                }
            ],
        ]
    )

    checks = await compile_browser_checks(requirement, ["app.py"], model)

    assert checks[0].item_id == "save"
    assert model.calls == 2


@pytest.mark.asyncio
async def test_check_plan_fails_after_two_invalid_rounds():
    from app.runtime.check_plan import CheckPlanInvalid, compile_browser_checks

    requirement = Requirement(
        prompt="保存笔记",
        acceptance=[AcceptanceItem(id="save", action="保存", expected="刷新后存在")],
    )
    model = CheckModel([[], []])

    with pytest.raises(CheckPlanInvalid):
        await compile_browser_checks(requirement, ["app.py"], model)


class CandidateRunner:
    def __init__(self):
        self.restarts = []
        self.stops = []

    async def start(self, **kwargs):
        return {
            "id": kwargs["attempt_id"],
            "base_url": "https://candidate.test.invalid",
            "data_namespace": f"data-{kwargs['attempt_id']}",
            "identity_refs": {"owner": "owner-test", "other": "other-test"},
        }

    async def restart_service(self, runtime_id, service):
        self.restarts.append((runtime_id, service))

    async def stop(self, runtime_id, preserve_evidence):
        self.stops.append((runtime_id, preserve_evidence))


@pytest.mark.asyncio
async def test_candidate_controller_limits_restart_to_manifest_services():
    from app.runtime.candidate import candidate_controller, start_candidate, stop_candidate

    runner = CandidateRunner()
    manifest = AppManifest(
        web_service="web",
        services=[ServiceSpec(name="web", image="registry.test/web@sha256:" + "a" * 64, port=3000)],
    )
    requirement = Requirement(
        prompt="保存笔记",
        acceptance=[AcceptanceItem(id="save", action="保存", expected="成功")],
    )
    runtime = await start_candidate("job", "attempt", manifest, requirement, runner=runner)
    controller = candidate_controller(runtime.id)

    await controller.restart_service("web")
    with pytest.raises(ValueError, match="not part of the candidate"):
        await controller.restart_service("database")
    await stop_candidate(runtime.id, preserve_evidence=True)

    assert runner.restarts == [("attempt", "web")]
    assert runner.stops == [("attempt", True)]


@pytest.mark.asyncio
async def test_candidate_runner_must_be_explicitly_configured():
    from app.runtime.candidate import CandidateRuntimeUnavailable, start_candidate

    manifest = AppManifest(
        web_service="web",
        services=[ServiceSpec(name="web", image="registry.test/web@sha256:" + "a" * 64, port=3000)],
    )
    requirement = Requirement(
        prompt="保存笔记",
        acceptance=[AcceptanceItem(id="save", action="保存", expected="成功")],
    )

    with pytest.raises(CandidateRuntimeUnavailable, match="not configured"):
        await start_candidate("job", "attempt-unconfigured", manifest, requirement)


@dataclass
class PipelineContext:
    job_id: str
    app_id: str
    instance_id: str
    old_version_id: str
    manifest_one: AppManifest
    manifest_two: AppManifest
    workspaces: list[Path]


@pytest.fixture
def pipeline_context(session_factory, tmp_path):
    from app.apps.models import App, AppVersion, Instance, RequirementRecord
    from app.capabilities.models import InstanceDataSpace
    from app.jobs.models import Job
    from app.models.user import User
    from app.runtime.models import DeploymentTarget

    def manifest(digest):
        return AppManifest(
            web_service="web",
            services=[
                ServiceSpec(
                    name="web",
                    image="registry.test/web@sha256:" + digest * 64,
                    port=3000,
                    volumes={"data": "/data"},
                )
            ],
        )

    requirement = Requirement(
        prompt="保存笔记",
        acceptance=[AcceptanceItem(id="save", action="保存", expected="刷新后仍存在")],
    )
    workspaces = []
    for index in range(2):
        workspace = tmp_path / f"attempt-{index}"
        workspace.mkdir()
        (workspace / "app.py").write_text(f"ATTEMPT = {index}\n")
        workspaces.append(workspace)
    with session_factory() as session:
        owner = User(
            username=f"pipeline-{uuid4().hex}",
            email=f"{uuid4().hex}@test",
            hashed_password="test-only",
        )
        session.add(owner)
        session.flush()
        target = DeploymentTarget(
            id=f"target-{uuid4().hex}",
            kind="LINUX",
            enabled=True,
            health="HEALTHY",
            architecture="amd64",
            capacity={},
            domain_suffix="apps.test.invalid",
            secret_ref="not-used",
        )
        session.add(target)
        app = App(owner_id=owner.id, name="笔记", prompt=requirement.prompt)
        session.add(app)
        session.flush()
        old_manifest = manifest("0")
        old_artifact = tmp_path / "old.zip"
        old_artifact.write_bytes(b"old")
        old_report = ValidationReport(
            checks=[CheckResult(id="save", status="PASS", evidence="old")],
            required_ids=["save"],
            requirement_revision=1,
            attempt_id="old",
            manifest_hash=manifest_hash(old_manifest),
        )
        old = AppVersion(
            app_id=app.id,
            requirement_revision=1,
            manifest=old_manifest.model_dump(mode="json"),
            validation=old_report.model_dump(mode="json"),
            artifact_path=str(old_artifact),
        )
        session.add(old)
        session.flush()
        app.active_version_id = old.id
        session.add(
            RequirementRecord(
                app_id=app.id,
                revision=1,
                requirement=requirement.model_dump(mode="json"),
            )
        )
        instance = Instance(
            owner_id=owner.id,
            app_id=app.id,
            version_id=old.id,
            target_id=target.id,
            status="RUNNING",
            url="https://old.apps.test.invalid",
            data_namespace=f"data-{uuid4().hex}",
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
        job = Job(
            app_id=app.id,
            operation_id=f"pipeline-{uuid4().hex}",
            kind="ADJUST",
            status="RUNNING",
            phase="generating",
            requirement_revision=1,
            budget_units=100,
        )
        session.add(job)
        session.commit()
        return PipelineContext(
            job.id,
            app.id,
            instance.id,
            old.id,
            manifest("a"),
            manifest("b"),
            workspaces,
        )


def report(requirement, manifest, attempt_id, passed=True):
    return ValidationReport(
        checks=[
            CheckResult(
                id="save",
                status="PASS" if passed else "FAIL",
                evidence=f"evidence/{attempt_id}",
            )
        ],
        required_ids=["save"],
        requirement_revision=requirement.revision,
        attempt_id=attempt_id,
        manifest_hash=manifest_hash(manifest),
    )


def pipeline_dependencies(context, *, candidate_results, live_results):
    from app.jobs.pipeline import CandidateDraft, PipelineDependencies

    candidate_results = list(candidate_results)
    live_results = list(live_results)
    stopped = []

    async def generate(**kwargs):
        index = kwargs["attempt_index"]
        return CandidateDraft(
            workspace_id=str(context.workspaces[index]),
            manifest=[context.manifest_one, context.manifest_two][index],
            source_tree=["app.py"],
        )

    async def build(workspace_id, manifest, operation_id):
        del workspace_id, operation_id
        return manifest

    async def checks(requirement, source_tree, model_client):
        del requirement, source_tree, model_client
        return [
            BrowserCheck(
                item_id="save",
                actor="owner",
                actions=[
                    {"type": "goto", "path": "/"},
                    {"type": "expect_text", "selector": "#note", "text": "unique-note"},
                ],
                expected="刷新后仍存在",
            )
        ]

    async def start(job_id, attempt_id, manifest, requirement):
        del job_id, requirement
        return CandidateRuntime(
            id=attempt_id,
            base_url=f"https://{attempt_id}.candidate.test.invalid",
            manifest_hash=manifest_hash(manifest),
            data_namespace=f"candidate-{attempt_id}",
            identity_refs={"owner": "owner-test", "other": "other-test"},
        )

    async def stop(runtime_id, preserve_evidence=True):
        stopped.append((runtime_id, preserve_evidence))

    async def validate(base_url, requirement, browser_checks, runtime_controller=None, **kwargs):
        del base_url, browser_checks, runtime_controller
        passed = candidate_results.pop(0)
        return ValidationReport(
            checks=[
                CheckResult(
                    id="save",
                    status="PASS" if passed else "FAIL",
                    evidence=f"evidence/{kwargs['attempt_id']}",
                )
            ],
            required_ids=["save"],
            requirement_revision=requirement.revision,
            attempt_id=kwargs["attempt_id"],
            manifest_hash=kwargs["manifest_hash"],
        )

    async def deployer(**kwargs):
        passed = live_results.pop(0)
        return DeploymentResult(
            operation_id=kwargs["operation_id"],
            instance_id=kwargs["instance_id"],
            url="https://new.apps.test.invalid",
            report=report(
                kwargs["requirement"], kwargs["manifest"], kwargs["operation_id"], passed
            ),
        )

    dependencies = PipelineDependencies(
        generate_candidate=generate,
        build_candidate=build,
        compile_checks=checks,
        start_candidate=start,
        stop_candidate=stop,
        validate_candidate=validate,
        runtime_controller=lambda runtime_id: object(),
        deployer=deployer,
    )
    dependencies.stopped = stopped
    return dependencies


@pytest.mark.asyncio
async def test_pipeline_repairs_without_manual_start(session_factory, pipeline_context):
    from sqlalchemy import select

    from app.apps.models import App, AppVersion
    from app.jobs.models import Job
    from app.jobs.pipeline import PipelinePolicy, run_pipeline
    from app.runtime.models import ResourceRecord

    dependencies = pipeline_dependencies(
        pipeline_context, candidate_results=[False, True], live_results=[True]
    )
    await run_pipeline(
        pipeline_context.job_id,
        session_factory=session_factory,
        dependencies=dependencies,
        policy=PipelinePolicy(max_attempts=2),
    )

    with session_factory() as session:
        job = session.get(Job, pipeline_context.job_id)
        app = session.get(App, pipeline_context.app_id)
        active = session.get(AppVersion, app.active_version_id)
        attempts = list(
            session.scalars(
                select(ResourceRecord)
                .where(
                    ResourceRecord.job_id == job.id,
                    ResourceRecord.type == "CANDIDATE_ATTEMPT",
                )
                .order_by(ResourceRecord.created_at)
            )
        )
        assert job.status == "SUCCEEDED"
        assert len(attempts) == 2
        assert attempts[0].metadata_json["report"]["checks"][0]["status"] == "FAIL"
        assert attempts[1].metadata_json["report"]["checks"][0]["status"] == "PASS"
        assert active.manifest == pipeline_context.manifest_two.model_dump(mode="json")
        assert active.validation["manifest_hash"] == manifest_hash(pipeline_context.manifest_two)
    assert len(dependencies.stopped) == 2


def test_attempt_report_must_match_frozen_requirement_revision(
    session_factory, pipeline_context
):
    from app.core.types import BrowserCheck
    from app.jobs.pipeline import (
        PipelineCandidate,
        RepairableCandidateError,
        persist_attempt,
    )

    candidate = PipelineCandidate(
        attempt_id="wrong-revision",
        workspace_id=str(pipeline_context.workspaces[0]),
        manifest=pipeline_context.manifest_one,
        manifest_hash=manifest_hash(pipeline_context.manifest_one),
        browser_checks=[
            BrowserCheck(
                item_id="save",
                actor="owner",
                actions=[
                    {"type": "expect_text", "selector": "#note", "text": "unique-note"}
                ],
                expected="刷新后仍存在",
            )
        ],
    )
    wrong = ValidationReport(
        checks=[CheckResult(id="save", status="PASS", evidence="wrong")],
        required_ids=["save"],
        requirement_revision=2,
        attempt_id=candidate.attempt_id,
        manifest_hash=candidate.manifest_hash,
    )

    with pytest.raises(RepairableCandidateError, match="binding"):
        persist_attempt(session_factory, pipeline_context.job_id, candidate, wrong)


@pytest.mark.asyncio
async def test_cancelled_job_stops_before_candidate_effects(session_factory, pipeline_context):
    from app.jobs.models import Job
    from app.jobs.pipeline import PipelinePolicy, run_pipeline

    dependencies = pipeline_dependencies(
        pipeline_context, candidate_results=[True], live_results=[True]
    )
    with session_factory() as session:
        job = session.get(Job, pipeline_context.job_id)
        job.cancel_requested = True
        session.commit()

    await run_pipeline(
        pipeline_context.job_id,
        session_factory=session_factory,
        dependencies=dependencies,
        policy=PipelinePolicy(max_attempts=1),
    )

    with session_factory() as session:
        job = session.get(Job, pipeline_context.job_id)
        assert job.status == "CANCELLED"
        assert job.result is None
    assert dependencies.stopped == []


@pytest.mark.asyncio
async def test_replaced_worker_cannot_overwrite_job_state(session_factory, pipeline_context):
    from app.jobs.models import Job
    from app.jobs.pipeline import PipelinePolicy, run_pipeline
    from app.jobs.store import LeaseLost

    dependencies = pipeline_dependencies(
        pipeline_context, candidate_results=[True], live_results=[True]
    )
    with session_factory() as session:
        job = session.get(Job, pipeline_context.job_id)
        job.lease_owner = "new-worker"
        job.lease_generation = 2
        job.lease_until = datetime.now(timezone.utc) + timedelta(minutes=1)
        session.commit()

    with pytest.raises(LeaseLost):
        await run_pipeline(
            pipeline_context.job_id,
            worker_id="old-worker",
            generation=1,
            session_factory=session_factory,
            dependencies=dependencies,
            policy=PipelinePolicy(max_attempts=1),
        )

    with session_factory() as session:
        job = session.get(Job, pipeline_context.job_id)
        assert job.status == "RUNNING"
        assert job.lease_owner == "new-worker"
        assert job.lease_generation == 2

