from uuid import uuid4
import json
import pytest
from unittest.mock import AsyncMock
from sqlalchemy import select

from app.apps.models import App, Message, RequirementRecord
from app.jobs.models import Job
from app.jobs.store import claim_job
from app.models.user import User
from app.core.types import ModelTurn
from test_capability_identity import identity_keys as identity_keys


@pytest.mark.asyncio
async def test_shadow_records_hybrid_evidence_but_returns_baseline_route():
    from app.agent.contracts import AlgorithmCheckpoint
    from app.agent.orchestrator import AlgorithmOrchestrator
    from app.core.types import Requirement, RoutePlan, RepoSource

    baseline = RoutePlan(
        route="GENERATE_APP",
        steps=["generate"],
        reason="baseline",
    )
    hybrid = RoutePlan(
        route="DEPLOY_EXISTING",
        sources=[
            RepoSource(
                url="https://github.com/example/notes",
                commit="a" * 40,
                role="complete application",
            )
        ],
        steps=["deploy"],
        reason="hybrid evidence",
    )

    class Execution:
        def __init__(self):
            self.saved = AlgorithmCheckpoint.empty(1, "shadow")
            self.select_sources_baseline = AsyncMock(return_value=baseline)

        def algorithm_checkpoint(self):
            return self.saved.model_copy(deep=True)

        def save_algorithm_checkpoint(self, checkpoint):
            self.saved = checkpoint.model_copy(deep=True)

    execution = Execution()
    hybrid_selector = AsyncMock(return_value=hybrid)
    orchestrator = AlgorithmOrchestrator(
        execution, hybrid_selector=hybrid_selector
    )

    result = await orchestrator.select_sources(
        Requirement(prompt="笔记", acceptance=[])
    )

    assert result == baseline
    checkpoint = execution.algorithm_checkpoint()
    assert checkpoint.shadow_route == hybrid
    assert checkpoint.route == baseline
    assert checkpoint.selected_sources == baseline.sources
    execution.select_sources_baseline.assert_awaited_once()
    hybrid_selector.assert_awaited_once()


@pytest.mark.asyncio
async def test_shadow_hybrid_failure_does_not_change_baseline_result():
    from app.agent.contracts import AlgorithmCheckpoint
    from app.agent.orchestrator import AlgorithmOrchestrator
    from app.core.types import Requirement, RoutePlan, RepoSource

    baseline = RoutePlan(
        route="MODIFY_EXISTING",
        sources=[
            RepoSource(
                url="https://github.com/example/baseline",
                commit="a" * 40,
                role="principal",
            )
        ],
        steps=["modify"],
        reason="baseline",
    )

    class Execution:
        def __init__(self):
            self.saved = AlgorithmCheckpoint.empty(1, "shadow")
            self.select_sources_baseline = AsyncMock(return_value=baseline)

        def algorithm_checkpoint(self):
            return self.saved.model_copy(deep=True)

        def save_algorithm_checkpoint(self, checkpoint):
            self.saved = checkpoint.model_copy(deep=True)

    async def fail_hybrid(requirement):
        raise ConnectionError("shadow github unavailable")

    execution = Execution()
    result = await AlgorithmOrchestrator(
        execution, hybrid_selector=fail_hybrid
    ).select_sources(Requirement(prompt="笔记", acceptance=[]))

    assert result == baseline
    checkpoint = execution.algorithm_checkpoint()
    assert checkpoint.route == baseline
    assert checkpoint.shadow_route is None
    assert checkpoint.selected_sources == baseline.sources


@pytest.mark.asyncio
async def test_shadow_evidence_uses_deterministic_query_without_model_or_runner(
    new_job, session_factory, monkeypatch, tmp_path
):
    from app.core.types import Requirement, RetrievalResult
    from app.jobs.execution import JobExecution
    from app.config import settings

    job_id, _, _, generation = new_job

    class ForbiddenModel:
        async def complete(self, *args, **kwargs):
            pytest.fail("shadow evidence called the model")

    class ForbiddenRunner:
        def __getattr__(self, name):
            pytest.fail(f"shadow evidence accessed runner.{name}")

    async def retrieve(*args, **kwargs):
        return RetrievalResult(
            queries=["private notes web app"],
            completed=True,
            candidates=[],
        )

    monkeypatch.setattr("app.agent.retrieval.retrieve_sources", retrieve)
    monkeypatch.setattr(settings, "REPOSITORY_INDEX_PATH", str(tmp_path / "index.json"))
    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
        model_client=ForbiddenModel(),
        runner=ForbiddenRunner(),
    )

    route = await execution.select_sources_hybrid(
        Requirement(prompt="私人笔记", acceptance=[],delivery_policy={'allow_generation':True})
    )

    assert route.route == "GENERATE_APP"
    checkpoint = execution.algorithm_checkpoint()
    assert checkpoint.query_plan.original == "私人笔记"
    assert checkpoint.retrieval.completed is True
    assert [stage.stage for stage in checkpoint.stages] == [
        "QUERY_PLAN",
        "RETRIEVAL",
        "PROFILE",
        "ROUTE",
    ]
    with session_factory() as session:
        assert session.get(Job, job_id).phase == "retrieving"


@pytest.mark.asyncio
async def test_hybrid_selection_uses_durable_model_query_overlay(
    new_job, session_factory, monkeypatch, tmp_path
):
    from app.core.types import Requirement, RetrievalResult, RoutePlan
    from app.jobs.execution import JobExecution
    from app.config import settings

    job_id, _, _, generation = new_job
    with session_factory() as session:
        job = session.get(Job, job_id)
        checkpoint = json.loads(json.dumps(job.checkpoint))
        checkpoint["algorithm"]["mode"] = "hybrid"
        job.checkpoint = checkpoint
        session.commit()

    class QueryModel:
        def __init__(self):
            self.calls = 0

        async def complete(self, messages, tools, model):
            del tools, model
            self.calls += 1
            assert "Return QueryPlan JSON" in messages[0]["content"]
            return ModelTurn(
                assistant_message={
                    "role": "assistant",
                    "content": json.dumps(
                        {
                            "original": "ignored replacement",
                            "github_queries": ["ancient text collation web app"],
                            "readme_queries": ["critical edition"],
                            "translated_terms": ["textual criticism"],
                            "categories": ["research"],
                            "required_capabilities": [],
                            "constraints": {},
                        }
                    ),
                },
                input_tokens=1,
                output_tokens=1,
            )

    captured = {}

    async def retrieve(requirement, query_plan, **kwargs):
        del requirement, kwargs
        captured["plan"] = query_plan
        return RetrievalResult(queries=query_plan.github_queries, completed=True)

    async def choose_route(*args, **kwargs):
        del args, kwargs
        return RoutePlan(
            route="GENERATE_APP",
            steps=["generate"],
            reason="no reusable source",
        )

    monkeypatch.setattr("app.agent.retrieval.retrieve_sources", retrieve)
    monkeypatch.setattr("app.agent.routing.choose_route", choose_route)
    monkeypatch.setattr(settings, "REPOSITORY_INDEX_PATH", str(tmp_path / "index.json"))
    model = QueryModel()
    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
        model_client=model,
    )

    await execution.select_sources_hybrid(
        Requirement(prompt="做一个古籍校勘工具", acceptance=[])
    )

    assert model.calls == 1
    assert "ancient text collation web app" in captured["plan"].github_queries
    assert captured["plan"].constraints["planning_mode"] == "deterministic+model"


@pytest.mark.asyncio
async def test_candidate_review_uses_orchestrator_policy_entrypoint(
    new_job, session_factory, monkeypatch
):
    from app.agent.orchestrator import AlgorithmOrchestrator
    from app.core.types import (
        AppManifest,
        Requirement,
        RoutePlan,
        ServiceSpec,
    )
    from app.jobs.execution import JobExecution
    from app.jobs.pipeline import CandidateDraft

    job_id, _, _, generation = new_job
    with session_factory() as session:
        job = session.get(Job, job_id)
        checkpoint = json.loads(json.dumps(job.checkpoint))
        checkpoint["algorithm"]["route"] = RoutePlan(
            route="DEPLOY_EXISTING",
            steps=["deploy"],
            reason="complete application",
            confidence="HIGH",
        ).model_dump(mode="json")
        job.checkpoint = checkpoint
        session.commit()

    calls = []
    original = AlgorithmOrchestrator.decide_orchestration

    def tracked(self, requirement, route, profiles, prior_failures):
        calls.append(list(prior_failures))
        return original(self, requirement, route, profiles, prior_failures)

    monkeypatch.setattr(AlgorithmOrchestrator, "decide_orchestration", tracked)
    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
    )
    manifest = AppManifest(
        web_service="web",
        services=[
            ServiceSpec(
                name="web",
                image="registry.test/web@sha256:" + "a" * 64,
                port=3000,
                health_path="/health",
            )
        ],
    )

    await execution.review_candidate(
        "attempt-policy",
        CandidateDraft(
            workspace_id="workspace",
            manifest=manifest,
            source_tree=["app.py"],
            browser_checks=[],
        ),
        Requirement(prompt="部署现成网站", acceptance=[]),
    )

    assert calls == [[]]


@pytest.fixture
def new_job(session_factory):
    from app.apps.service import create_app
    from app.billing.ledger import grant
    from app.billing.models import PriceRule

    with session_factory() as session:
        user = User(
            username="execution-" + uuid4().hex,
            email=uuid4().hex + "@test",
            hashed_password="test-only",
        )
        session.add(user)
        session.flush()
        grant(session, user.id, "execution", 1000000, "FREE")
        for kind in [
            "model.flash.input",
            "model.flash.cached_input",
            "model.flash.output",
            "execution.millis",
            "build.millis",
        ]:
            session.add(
                PriceRule(kind=kind, version="dev-v1", numerator=1, denominator=1000)
            )
        session.commit()
        app, job = create_app(session, user.id, "保存私有笔记", "once", 100000)
        leased = claim_job(session, "worker")
        return job.id, app.id, user.id, leased.lease_generation


class RequirementModel:
    def __init__(self, question=False):
        self.question = question
        self.calls = 0

    async def complete(self, messages, tools, model):
        self.calls += 1
        if "审阅draft" in messages[0]["content"]:
            content = {"missing": []}
        else:
            source = json.loads(messages[1]["content"])
            message = source["messages"][0]
            content = {
                "prompt": "保存私有笔记",
                "acceptance": [
                    {
                        "id": "save",
                        "action": "新增笔记",
                        "expected": "刷新后仍存在",
                        "private_data": True,
                    }
                ],
                "facts": [
                    {
                        "id": "note",
                        "source_message_id": message["id"],
                        "quote": "保存私有笔记",
                        "kind": "FUNCTION",
                        "acceptance_ids": ["save"],
                    }
                ],
                "questions": ["记录是否公开？"] if self.question else [],
            }
        return ModelTurn(
            assistant_message={
                "role": "assistant",
                "content": json.dumps(content, ensure_ascii=False),
            },
            input_tokens=1,
            output_tokens=1,
        )


@pytest.mark.asyncio
async def test_new_api_job_is_compiled_frozen_and_metered_before_generation(
    new_job, session_factory
):
    from app.jobs.execution import JobExecution
    from app.billing.models import UsageEntry

    job_id, app_id, owner, generation = new_job
    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
        model_client=RequirementModel(),
    )
    requirement = await execution.ensure_requirement()
    assert requirement.acceptance[0].id == "save"
    with session_factory() as session:
        job = session.get(Job, job_id)
        assert job.requirement_revision == 1
        assert (
            session.scalar(
                select(RequirementRecord).where(RequirementRecord.app_id == app_id)
            ).requirement["facts"][0]["quote"]
            == "保存私有笔记"
        )
        assert job.used_units == 4
        assert (
            len(
                list(
                    session.scalars(
                        select(UsageEntry).where(UsageEntry.payer_id == owner)
                    )
                )
            )
            == 4
        )


@pytest.mark.asyncio
async def test_compiled_requirement_must_match_frozen_algorithm_revision(
    new_job, session_factory
):
    from app.jobs.execution import JobExecution

    job_id, _, _, generation = new_job
    with session_factory() as session:
        job = session.get(Job, job_id)
        checkpoint = json.loads(json.dumps(job.checkpoint))
        checkpoint["algorithm"]["requirement_revision"] = 2
        job.checkpoint = checkpoint
        session.commit()

    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
        model_client=RequirementModel(),
    )
    with pytest.raises(
        ValueError,
        match="compiled requirement revision differs from algorithm checkpoint",
    ):
        await execution.ensure_requirement()


@pytest.mark.asyncio
async def test_replayed_frozen_requirement_must_match_algorithm_revision(
    new_job, session_factory
):
    from app.jobs.execution import JobExecution

    job_id, _, _, generation = new_job
    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
        model_client=RequirementModel(),
    )
    await execution.ensure_requirement()
    with session_factory() as session:
        job = session.get(Job, job_id)
        checkpoint = json.loads(json.dumps(job.checkpoint))
        checkpoint["algorithm"]["requirement_revision"] = 2
        job.checkpoint = checkpoint
        session.commit()

    with pytest.raises(
        ValueError,
        match="frozen requirement revision differs from algorithm checkpoint",
    ):
        await execution.ensure_requirement()


@pytest.mark.asyncio
async def test_business_question_and_reply_continue_one_job(new_job, session_factory):
    from app.jobs.execution import JobExecution, WaitingForUser
    from app.apps.service import add_message

    job_id, app_id, owner, generation = new_job
    with pytest.raises(WaitingForUser):
        await JobExecution(
            job_id,
            "worker",
            generation,
            session_factory=session_factory,
            model_client=RequirementModel(question=True),
        ).ensure_requirement()
    with session_factory() as session:
        job = session.get(Job, job_id)
        assert job.status == "WAITING_USER" and job.question == "记录是否公开？"
        ref = add_message(session, app_id, owner, "保持私有", "answer")
        assert ref.job_id == job_id
        job = claim_job(session, "next-worker")
    requirement = await JobExecution(
        job_id,
        "next-worker",
        job.lease_generation,
        session_factory=session_factory,
        model_client=RequirementModel(),
    ).ensure_requirement()
    assert requirement.revision == 1
    with session_factory() as session:
        assert session.get(Job, job_id).requirement_revision == 1
        assert (
            len(
                list(
                    session.scalars(
                        select(Message).where(
                            Message.app_id == app_id, Message.role == "assistant"
                        )
                    )
                )
            )
            == 1
        )


@pytest.mark.asyncio
async def test_saved_model_turn_replays_without_call_or_charge(
    new_job, session_factory
):
    from app.jobs.execution import JobExecution

    job_id, _, _, generation = new_job
    model = RequirementModel()
    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
        model_client=model,
    )
    first = execution.model("test")
    messages = [
        {"role": "system", "content": "审阅draft"},
        {"role": "user", "content": "{}"},
    ]
    one = await first.complete(messages, [], "hint")
    two = await execution.model("test").complete(messages, [], "hint")
    assert one == two and model.calls == 1
    with session_factory() as session:
        assert session.get(Job, job_id).used_units == 2


@pytest.mark.asyncio
async def test_uncertain_model_effect_is_not_replayed(new_job, session_factory):
    from app.jobs.execution import JobExecution, UncertainModelCall

    job_id, _, _, generation = new_job

    class Uncertain:
        calls = 0

        async def complete(self, *args):
            self.calls += 1
            raise ConnectionError("connection ended after request")

    model = Uncertain()
    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
        model_client=model,
    )
    for _ in range(2):
        with pytest.raises(UncertainModelCall):
            await execution.model("uncertain").complete(
                [{"role": "user", "content": "hello"}], [], "hint"
            )
    assert model.calls == 1


@pytest.mark.asyncio
async def test_unknown_review_usage_is_persisted_and_not_replayed(
    new_job, session_factory
):
    from app.jobs.execution import JobExecution, UncertainModelCall

    job_id, _, _, generation = new_job

    class UnknownUsageModel:
        calls = 0

        async def complete(self, *args):
            self.calls += 1
            return ModelTurn(
                assistant_message={"role": "assistant", "content": "{}"},
                usage_known=False,
            )

    model = UnknownUsageModel()
    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
        model_client=model,
    )
    for _ in range(2):
        with pytest.raises(UncertainModelCall):
            await execution.model("review:attempt:manifest").complete(
                [{"role": "user", "content": "review"}], [], "hint"
            )
    assert model.calls == 1


@pytest.mark.asyncio
async def test_default_worker_missing_configuration_reaches_clear_terminal_state(
    new_job, session_factory, monkeypatch
):
    from app.jobs.pipeline import run_pipeline
    from app.config import settings

    monkeypatch.setattr(settings, "DEEPSEEK_API_KEY", "")
    job_id, _, _, generation = new_job
    await run_pipeline(
        job_id,
        worker_id="worker",
        generation=generation,
        session_factory=session_factory,
    )
    with session_factory() as session:
        job = session.get(Job, job_id)
        assert job.status == "FAILED" and job.result is None
        assert job.error["code"] == "TARGET_UNAVAILABLE", job.error


@pytest.mark.asyncio
@pytest.mark.parametrize("hybrid", [False, True])
async def test_default_generation_calls_existing_loop_on_a_prepared_scaffold(
    new_job, session_factory, tmp_path, monkeypatch, hybrid
):
    from app.jobs.execution import JobExecution
    from app.core.types import (
        ToolCall,
        AppManifest,
        ServiceSpec,
    )
    from app.config import settings
    from app.agent.tools import execute_tool
    from app.runtime.artifacts import unpack_source, source_archive

    monkeypatch.setattr(settings, "AGENT_WORKSPACE_ROOT", str(tmp_path / "control"))

    class Model(RequirementModel):
        async def complete(self, messages, tools, model):
            if tools and hybrid:
                initial = json.loads(messages[1]["content"])
                assert initial["gap_plan"]["requirement_revision"] == 1
                assert initial["packaging_plans"]
                assert "integration_contract" in initial
                assert "component_workspaces" in initial
            if not tools:
                return await super().complete(messages, tools, model)
            if not any(
                message.get("tool_call_id") == "write-page" for message in messages
            ):
                call = ToolCall(
                    id="write-page",
                    name="write_file",
                    arguments={
                        "path": "app/page.tsx",
                        "content": "export default function Page(){return <main>notes</main>}",
                    },
                )
            else:
                manifest = AppManifest(
                    web_service="web",
                    services=[
                        ServiceSpec(
                            name="web",
                            image="registry.test/app@sha256:" + "a" * 64,
                            port=3000,
                        )
                    ],
                )
                call = ToolCall(
                    id="finish",
                    name="finish_implementation",
                    arguments={"manifest": manifest.model_dump(mode="json")},
                )
            self.calls += 1
            return ModelTurn(
                assistant_message={
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": call.id,
                            "type": "function",
                            "function": {
                                "name": call.name,
                                "arguments": json.dumps(call.arguments),
                            },
                        }
                    ],
                },
                calls=[call],
                input_tokens=1,
                output_tokens=1,
            )

    class FilesRunner:
        async def upload(self, job, root, generation):
            self.root = tmp_path / "runner"
            self.root.mkdir()
            unpack_source(source_archive(root), self.root)

        async def tool(self, job, call, generation):
            return {
                "result": execute_tool(str(self.root), call).model_dump(mode="json"),
                "duration_ms": 1,
            }

        async def snapshot(self, job, root, generation):
            return unpack_source(source_archive(self.root), root)

    async def route(requirement, model):
        from app.core.types import RoutePlan

        return RoutePlan(
            route="GENERATE_APP",
            sources=[],
            steps=["实现笔记"],
            reason="test retrieval completed without reusable project",
        )

    monkeypatch.setattr(
        JobExecution,
        "choose_sources",
        lambda self, requirement: route(requirement, self.raw_model),
    )
    job_id, app_id, owner, generation = new_job
    if hybrid:
        with session_factory() as session:
            row = session.get(Job, job_id)
            saved = json.loads(json.dumps(row.checkpoint))
            saved["algorithm"]["mode"] = "hybrid"
            row.checkpoint = saved
            session.commit()
    execution = JobExecution(
        job_id,
        "worker",
        generation,
        session_factory=session_factory,
        model_client=Model(),
        runner=FilesRunner(),
    )
    requirement = await execution.ensure_requirement()
    with session_factory() as session:
        job = session.get(Job, job_id)
    candidate = await execution.generate_candidate(
        job_id=job_id,
        job=job,
        requirement=requirement,
        attempt_index=0,
        repair_evidence=[],
    )
    assert candidate.manifest.web_service == "web"
    assert (tmp_path / "runner/app/page.tsx").read_text().endswith("notes</main>}")
    with session_factory() as session:
        assert session.get(Job, job_id).status == "RUNNING"
        assert session.get(App, app_id).active_version_id is None


@pytest.mark.asyncio
async def test_default_pipeline_assembles_existing_modules_and_reaches_bound_release(
    new_job, session_factory, tmp_path, monkeypatch, identity_keys
):
    from app.jobs.execution import JobExecution
    from app.jobs.pipeline import run_pipeline
    from app.core.types import (
        ToolCall,
        AppManifest,
        ServiceSpec,
        RoutePlan,
        ValidationReport,
        CheckResult,
        DeploymentResult,
    )
    from app.config import settings
    from app.runner.client import RunnerClient
    from app.runtime.artifacts import source_archive, unpack_source
    from app.runtime.models import DeploymentTarget
    from app.runtime.manifest import manifest_hash
    import app.jobs.execution as execution_module
    import app.runtime.validation as validation_module
    import app.runtime.linux as linux_module

    for name, value in {
        "DEEPSEEK_API_KEY": "test-only-key",
        "PLATFORM_CAPABILITY_URL": "https://platform.test",
        "INSTANCE_POSTGRES_IMAGE": "postgres@sha256:" + "b" * 64,
        "AGENT_WORKSPACE_ROOT": str(tmp_path / "control"),
        "INSTANCE_SECRETS_ROOT": str(tmp_path / "secrets"),
    }.items():
        monkeypatch.setattr(settings, name, value)
    with session_factory() as session:
        session.add(
            DeploymentTarget(
                id="target",
                kind="LINUX",
                enabled=True,
                health="HEALTHY",
                architecture="amd64",
                capacity={
                    "memory_mb": 8192,
                    "cpu_millis": 8000,
                    "gateway_image": "gateway@sha256:" + "c" * 64,
                },
                domain_suffix="apps.test",
                secret_ref="test-only-target",
            )
        )
        session.commit()

    class Model(RequirementModel):
        async def complete(self, messages, tools, model):
            if tools:
                manifest = AppManifest(
                    web_service="web",
                    services=[
                        ServiceSpec(
                            name="web",
                            image="registry.test/app@sha256:" + "a" * 64,
                            port=3000,
                        )
                    ],
                )
                call = ToolCall(
                    id="finish",
                    name="finish_implementation",
                    arguments={"manifest": manifest.model_dump(mode="json")},
                )
                return ModelTurn(
                    assistant_message={
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "finish",
                                "type": "function",
                                "function": {
                                    "name": "finish_implementation",
                                    "arguments": json.dumps(call.arguments),
                                },
                            }
                        ],
                    },
                    calls=[call],
                    input_tokens=1,
                    output_tokens=1,
                )
            if "independent candidate reviewer" in messages[0]["content"].lower():
                return ModelTurn(
                    assistant_message={
                        "role": "assistant",
                        "content": json.dumps({"findings": []}),
                    },
                    input_tokens=1,
                    output_tokens=1,
                )
            if "independent security reviewer" in messages[0]["content"].lower():
                return ModelTurn(
                    assistant_message={
                        "role": "assistant",
                        "content": json.dumps({"findings": []}),
                    },
                    input_tokens=1,
                    output_tokens=1,
                )
            if messages[0]["content"].startswith("Return only"):
                return ModelTurn(
                    assistant_message={
                        "role": "assistant",
                        "content": json.dumps(
                            [
                                {
                                    "item_id": "save",
                                    "actor": "owner",
                                    "actions": [
                                        {"type": "goto", "path": "/"},
                                        {
                                            "type": "expect_text",
                                            "selector": "main",
                                            "text": "notes",
                                        },
                                    ],
                                    "expected": "刷新后仍存在",
                                }
                            ]
                        ),
                    },
                    input_tokens=1,
                    output_tokens=1,
                )
            return await super().complete(messages, tools, model)

    class Runner:
        async def health(self):
            return {
                "ready": True,
                "builder_ready": True,
                "runtimes_ready": True,
                "candidate_domain_suffix": "candidates.test",
            }

        async def upload(self, job, root, generation):
            self.root = tmp_path / "node"
            self.root.mkdir()
            unpack_source(source_archive(root), self.root)

        async def snapshot(self, job, root, generation):
            return unpack_source(source_archive(self.root), root)

        async def build(self, job, attempt, manifest, generation):
            return {"manifest": manifest.model_dump(mode="json"), "duration_ms": 1}

        async def start(self, **payload):
            return {
                "id": payload["instance_id"],
                "base_url": "https://" + payload["instance_id"] + ".candidates.test",
                "data_namespace": payload["data_namespace"],
            }

        async def stop(self, *args):
            pass

        async def close(self):
            pass

    runner = Runner()
    monkeypatch.setattr(RunnerClient, "from_settings", classmethod(lambda cls: runner))
    monkeypatch.setattr(execution_module, "DeepSeekClient", lambda: Model())

    async def route(self, requirement):
        return RoutePlan(
            route="GENERATE_APP",
            steps=["实现业务"],
            reason="fixture complete retrieval",
        )

    monkeypatch.setattr(JobExecution, "choose_sources", route)

    async def validate(base, req, checks, controller, **options):
        return ValidationReport(
            required_ids=["save"],
            checks=[
                CheckResult(id="save", status="PASS", evidence="fixture/application")
            ],
            requirement_revision=req.revision,
            attempt_id=options["attempt_id"],
            manifest_hash=options["manifest_hash"],
        )

    monkeypatch.setattr(validation_module, "validate_application", validate)

    async def deploy(**options):
        assert options["secret_values"]["platform_instance_token"]
        assert options["secret_values"]["database-url"].startswith("postgresql://")
        report = ValidationReport(
            required_ids=["save"],
            checks=[CheckResult(id="save", status="PASS", evidence="fixture/live")],
            requirement_revision=options["requirement"].revision,
            attempt_id=options["operation_id"],
            manifest_hash=manifest_hash(options["manifest"]),
        )
        return DeploymentResult(
            operation_id=options["operation_id"],
            instance_id=options["instance_id"],
            url="https://" + options["instance_id"] + ".apps.test",
            report=report,
        )

    monkeypatch.setattr(linux_module, "deploy_linux", deploy)
    job_id, app_id, owner, generation = new_job
    await run_pipeline(
        job_id,
        worker_id="worker",
        generation=generation,
        session_factory=session_factory,
    )
    with session_factory() as session:
        job = session.get(Job, job_id)
        assert job.status == "SUCCEEDED", job.error
        assert session.get(App, app_id).active_version_id == job.result["version_id"]
        from app.apps.models import Instance

        assert session.get(Instance, job.result["instance_id"]).kind == "PRODUCTION"


@pytest.mark.asyncio
async def test_hybrid_component_builder_consumes_contract_through_runner(
    new_job, session_factory, tmp_path, monkeypatch
):
    import httpx
    from app.config import settings
    from app.agent.contracts import ComponentWorkspace
    from app.agent.packaging import tree_digest
    from app.core.types import AppManifest, ServiceSpec, ToolCall
    from app.jobs.execution import JobExecution
    from app.runner.client import RunnerClient
    from app.runner.service import RunnerService, create_app
    from test_integration_contract import component_route, record_search_requirement, valid_contract_json
    from test_hybrid_routing import profile

    job_id, _, _, generation = new_job
    plan, req = component_route(), record_search_requirement()
    payload = valid_contract_json()
    payload["role_services"] = {"records": "web", "search": "web"}
    with session_factory() as session:
        job = session.get(Job, job_id)
        cp = json.loads(json.dumps(job.checkpoint))
        cp["algorithm"].update(mode="hybrid", route=plan.model_dump(mode="json"),
            profiles=[profile(s).model_dump(mode="json") for s in plan.sources], integration_contract=payload)
        job.checkpoint = cp
        session.commit()
    monkeypatch.setattr(settings, "AGENT_WORKSPACE_ROOT", str(tmp_path / "control"))
    async def choose(self, requirement):
        return plan
    monkeypatch.setattr(JobExecution, "choose_sources", choose)
    def prepare(root, route, profiles):
        root = __import__("pathlib").Path(root)
        components = []
        for source in route.sources:
            path = root / "components" / source.role
            path.mkdir(parents=True)
            (path / "source.txt").write_text(source.role)
            relative = f"components/{source.role}"
            components.append(ComponentWorkspace(role=source.role, source=source, relative_path=relative,
                read_only_source_path=relative, tree_digest=tree_digest(path)))
        (root / "app").mkdir()
        return components
    monkeypatch.setattr("app.agent.integration.prepare_component_workspaces", prepare)
    manifest = AppManifest(web_service="web", services=[ServiceSpec(
        name="web", image="registry.test/app@sha256:" + "a" * 64, port=3000)])
    class Model:
        calls = 0
        async def complete(self, messages, tools, model):
            assert tools
            initial = json.loads(messages[1]["content"])
            assert initial["integration_contract"]["role_services"] == {"records": "web", "search": "web"}
            assert len(initial["component_workspaces"]) == 2
            assert initial["gap_plan"]["requirement_revision"] == req.revision
            self.calls += 1
            if self.calls == 1:
                call = ToolCall(id="dockerfile", name="write_file", arguments={"path": "app/Dockerfile",
                    "content": 'FROM scratch\nCOPY server /server\nCMD ["/server"]\n'})
            else:
                call = ToolCall(id="finish", name="finish_implementation", arguments={"manifest": manifest.model_dump(mode="json")})
            return ModelTurn(assistant_message={"role": "assistant", "content": None,
                "tool_calls": [{"id": call.id, "type": "function", "function": {
                    "name": call.name, "arguments": json.dumps(call.arguments)}}]},
                calls=[call], input_tokens=1, output_tokens=1)
    runner_root = tmp_path / "runner"
    app = create_app(RunnerService(runner_root), "test-rpc-token")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://runner.test",
                                headers={"Authorization": "Bearer test-rpc-token"}) as http:
        execution = JobExecution(job_id, "worker", generation, session_factory=session_factory,
                                  model_client=Model(), runner=RunnerClient(http))
        with session_factory() as session:
            job = session.get(Job, job_id)
        candidate = await execution.generate_candidate(job_id=job_id, job=job, requirement=req,
                                                        attempt_index=0, repair_evidence=[])
        assert candidate.manifest == manifest
        assert (runner_root / job_id / "source/app/Dockerfile").is_file()
        assert (runner_root / job_id / "source/components/search/source.txt").read_text() == "search"
        with pytest.raises(ValueError, match="read-only"):
            await execution.execute_tool(ToolCall(id="forbidden", name="write_file",
                                                 arguments={"path": "components/search/source.txt", "content": "bad"}))


@pytest.mark.asyncio
async def test_failed_baseline_retrieval_is_saved_before_stopping(new_job, session_factory, monkeypatch):
    from app.jobs.execution import JobExecution
    from app.core.types import Requirement, RetrievalResult
    from app.agent.retrieval import SearchUnavailable
    async def failed(*args, **kwargs):
        return RetrievalResult(queries=['notes'],completed=False,errors=['GitHub temporary error'])
    monkeypatch.setattr('app.agent.retrieval.retrieve_sources',failed)
    job_id,_,_,generation = new_job
    execution = JobExecution(job_id,'worker',generation,session_factory=session_factory)
    with pytest.raises(SearchUnavailable):
        await execution.select_sources_baseline(Requirement(prompt='notes',acceptance=[]))
    assert execution.algorithm_checkpoint().retrieval.errors == ['GitHub temporary error']


@pytest.mark.asyncio
async def test_unavailable_generation_capability_returns_feedback_without_runner(new_job, session_factory):
    from app.jobs.execution import JobExecution
    from app.core.types import ToolCall

    job_id, _, _, generation = new_job
    runner = AsyncMock()
    execution = JobExecution(job_id, 'worker', generation, session_factory=session_factory, runner=runner)
    result = await execution.execute_tool(ToolCall(id='legacy-search', name='web_search', arguments={'query':'platform identity'}))
    assert result.ok is False
    assert 'web_search' in result.content
    runner.tool.assert_not_awaited()


@pytest.mark.asyncio
async def test_invalid_command_arguments_are_feedback_before_runner_or_resource(new_job, session_factory):
    from app.jobs.execution import JobExecution
    from app.core.types import ToolCall
    from app.runtime.models import ResourceRecord

    job_id, _, _, generation = new_job
    runner = AsyncMock()
    execution = JobExecution(job_id, 'worker', generation, session_factory=session_factory, runner=runner)
    result = await execution.execute_tool(ToolCall(id='milliseconds', name='run_command', arguments={'argv':['npm','ci'],'timeout':300000}))
    assert result.ok is False
    assert 'timeout' in result.content
    runner.tool.assert_not_awaited()
    with session_factory() as session:
        assert session.scalar(select(ResourceRecord).where(ResourceRecord.job_id == job_id, ResourceRecord.type == 'EXECUTION_CONTAINER')) is None


@pytest.mark.asyncio
async def test_requirement_compilation_checkpoint_survives_failure(new_job, session_factory):
    from app.jobs.execution import JobExecution
    from app.agent.requirements import RequirementInvalid

    class MissingModel(RequirementModel):
        async def complete(self, messages, tools, model):
            if '审阅draft' in messages[0]['content']:
                return ModelTurn(assistant_message={'content': json.dumps({'missing': ['删除后重启仍需核对']})}, input_tokens=1, output_tokens=1)
            return await super().complete(messages, tools, model)

    job_id, _, _, generation = new_job
    execution = JobExecution(job_id, 'worker', generation, session_factory=session_factory, model_client=MissingModel())
    with pytest.raises(RequirementInvalid):
        await execution.ensure_requirement()
    with session_factory() as session:
        snapshot = session.get(Job, job_id).checkpoint['requirement_compilation']
        assert snapshot['status'] == 'FAILED'
        assert snapshot['attempt_count'] == 3
        assert snapshot['unresolved_issues'] == ['删除后重启仍需核对']
        assert len(snapshot['review_history']) == 3


@pytest.mark.asyncio
async def test_requirement_failure_has_specific_public_error(new_job, session_factory, monkeypatch):
    from types import SimpleNamespace
    from app.jobs.pipeline import run_pipeline
    from app.agent.requirements import RequirementInvalid

    job_id, _, _, generation = new_job
    async def fail():
        raise RequirementInvalid('internal-only', {'unresolved_issues': ['删除后重启仍需核对']})
    execution = SimpleNamespace(ensure_requirement=fail, close=AsyncMock())
    async def dependencies(*args):
        return None, execution
    monkeypatch.setattr('app.jobs.execution.build_default_dependencies', dependencies)
    await run_pipeline(job_id, worker_id='worker', generation=generation, session_factory=session_factory)
    with session_factory() as session:
        error = session.get(Job, job_id).error
        assert error['code'] == 'REQUIREMENT_INVALID'
        assert '1' in error['message']
        assert 'internal-only' not in error['message']


@pytest.mark.asyncio
async def test_requirement_restart_replays_received_turns_without_duplicate_usage(new_job, session_factory):
    from app.jobs.execution import JobExecution
    from app.billing.models import UsageEntry

    class FirstReviewMissing(RequirementModel):
        async def complete(self, messages, tools, model):
            if '审阅draft' in messages[0]['content']:
                return ModelTurn(assistant_message={'content': '{"missing":["refresh verification"]}'}, input_tokens=1, output_tokens=1)
            return await super().complete(messages, tools, model)

    job_id, _, owner, generation = new_job
    first = JobExecution(job_id, 'worker', generation, session_factory=session_factory, model_client=FirstReviewMissing())
    original_save = first.save
    def interrupted_save(**values):
        original_save(**values)
        if values.get('requirement_compilation', {}).get('status') == 'CORRECTING':
            raise RuntimeError('simulated worker interruption after saved review')
    first.save = interrupted_save
    with pytest.raises(RuntimeError, match='simulated worker interruption'):
        await first.ensure_requirement()
    with session_factory() as session:
        before = len(list(session.scalars(select(UsageEntry).where(UsageEntry.payer_id == owner))))
    raw = RequirementModel()
    resumed = JobExecution(job_id, 'worker', generation, session_factory=session_factory, model_client=raw)
    result = await resumed.ensure_requirement()
    assert result.acceptance[0].id == 'save'
    assert raw.calls == 2
    with session_factory() as session:
        after = len(list(session.scalars(select(UsageEntry).where(UsageEntry.payer_id == owner))))
        assert after == before + 4
        assert session.get(Job, job_id).checkpoint['requirement_compilation']['attempt_count'] == 2


@pytest.mark.asyncio
async def test_received_protocol_failure_is_metered_once_without_replaying_provider(new_job, session_factory):
    from app.agent.deepseek import ModelProtocolError
    from app.jobs.execution import JobExecution
    from app.runtime.models import ResourceRecord
    from app.billing.models import UnknownUsage

    class TruncatedModel:
        calls = 0
        async def complete(self,*args):
            self.calls += 1
            error = ModelProtocolError('MODEL_OUTPUT_TRUNCATED')
            error.turn = ModelTurn(assistant_message={'content':''},input_tokens=10,output_tokens=5)
            raise error

    job_id, _, _, generation = new_job
    raw = TruncatedModel()
    execution = JobExecution(job_id,'worker',generation,session_factory=session_factory,model_client=raw)
    for _ in range(2):
        with pytest.raises(ModelProtocolError):
            await execution.model('protocol').complete([],[],'model')
    assert raw.calls == 1
    with session_factory() as session:
        record = session.scalar(select(ResourceRecord).where(ResourceRecord.job_id==job_id,ResourceRecord.type=='MODEL_CALL'))
        assert record.state == 'METERED'
        assert record.metadata_json['response']['output_tokens'] == 5
        assert session.get(Job,job_id).used_units == 2
        assert session.scalar(select(UnknownUsage).where(UnknownUsage.operation_id==record.operation_id)) is None


@pytest.mark.asyncio
async def test_cancelled_waiting_model_request_is_explicit_unknown(new_job, session_factory):
    import asyncio
    from app.jobs.execution import JobExecution
    from app.runtime.models import ResourceRecord
    from app.billing.models import UnknownUsage

    class CancelledModel:
        async def complete(self,*args):
            raise asyncio.CancelledError()
    job_id, _, _, generation = new_job
    execution = JobExecution(job_id,'worker',generation,session_factory=session_factory,model_client=CancelledModel())
    with pytest.raises(asyncio.CancelledError):
        await execution.model('cancel').complete([],[],'model')
    with session_factory() as session:
        record = session.scalar(select(ResourceRecord).where(ResourceRecord.job_id==job_id,ResourceRecord.type=='MODEL_CALL'))
        assert record.state == 'UNKNOWN'
        unknown = session.scalar(select(UnknownUsage).where(UnknownUsage.operation_id==record.operation_id))
        assert unknown is not None
        assert session.get(Job,job_id).used_units == 0


@pytest.mark.asyncio
async def test_requested_cancellation_prevents_new_paid_model_calls(new_job, session_factory):
    from app.jobs.execution import JobExecution
    from app.jobs.pipeline import PipelineCancelled
    from app.runtime.models import ResourceRecord

    job_id, _, _, generation = new_job
    with session_factory() as session:
        session.get(Job,job_id).cancel_requested = True
        session.commit()
    class ForbiddenModel:
        async def complete(self,*args):
            pytest.fail('cancelled job issued a new paid model request')
    execution = JobExecution(job_id,'worker',generation,session_factory=session_factory,model_client=ForbiddenModel())
    with pytest.raises(PipelineCancelled):
        await execution.model('cancel-guard').complete([],[],'model')
    with session_factory() as session:
        assert session.scalar(select(ResourceRecord).where(ResourceRecord.job_id==job_id,ResourceRecord.type=='MODEL_CALL')) is None
        assert session.get(Job,job_id).used_units == 0


@pytest.mark.parametrize('used,expected', [(3,31),(23,11),(39,0)])
def test_generation_round_budget_uses_remaining_job_calls_and_reserves_review(new_job,session_factory,used,expected):
    from app.jobs.execution import JobExecution
    from app.runtime.models import ResourceRecord
    job_id,app_id,_,generation=new_job
    with session_factory() as session:
        for i in range(used):
            operation=f'count:{job_id}:{i}'
            session.add(ResourceRecord(type='MODEL_CALL',job_id=job_id,app_id=app_id,operation_id=operation,state='METERED',reference=operation,metadata_json={}))
        session.commit()
    execution=JobExecution(job_id,'worker',generation,session_factory=session_factory)
    assert execution.generation_round_budget()==expected


def test_builder_receives_runtime_alias_and_final_submission_contract(new_job,session_factory):
    from app.jobs.execution import JobExecution
    from app.core.types import Requirement,RoutePlan
    job_id,_,_,generation=new_job
    execution=JobExecution(job_id,'worker',generation,session_factory=session_factory)
    payload=execution.builder_payload(Requirement(prompt='私人笔记',acceptance=[]),RoutePlan(route='GENERATE_APP',steps=['实现'],reason='test'))
    contract=payload['platform_contract']
    assert contract['env_refs']['DATABASE_URL']=='database-url'
    assert contract['env_refs']['PLATFORM_INSTANCE_TOKEN']=='platform_instance_token'
    assert contract['final_submission']=='finish_implementation'
    assert contract['source_builds_require_buildspec'] is True


@pytest.mark.asyncio
async def test_runner_argument_rejection_is_feedback_without_execution_charge(new_job,session_factory):
    from app.runner.client import RunnerToolRejected
    from app.jobs.execution import JobExecution
    from app.core.types import ToolCall
    from unittest.mock import Mock
    job_id,_,_,generation=new_job
    runner=AsyncMock()
    runner.tool.side_effect=RunnerToolRejected('relative path required')
    execution=JobExecution(job_id,'worker',generation,session_factory=session_factory,runner=runner)
    execution.record_resource=Mock()
    result=await execution.execute_tool(ToolCall(id='absolute',name='list_files',arguments={'path':'/workspace'}))
    assert result.ok is False
    assert 'relative path' in result.content
    execution.record_resource.assert_not_called()


@pytest.mark.asyncio
async def test_runner_retries_once_when_reconciliation_confirms_tool_never_started(new_job,session_factory):
    from app.runner.client import RunnerUnavailable
    from app.jobs.execution import JobExecution
    from app.core.types import ToolCall
    from unittest.mock import Mock
    job_id,_,_,generation=new_job
    runner=AsyncMock()
    runner.tool.side_effect=[
        RunnerUnavailable('transport closed'),
        {'result':{'call_id':'write','ok':True,'content':'saved'},'duration_ms':7},
    ]
    runner.tool_result.return_value={'state':'NOT_STARTED'}
    execution=JobExecution(job_id,'worker',generation,session_factory=session_factory,runner=runner)
    execution.record_resource=Mock()
    result=await execution.execute_tool(ToolCall(id='write',name='write_file',arguments={'path':'app.py','content':'source'}))
    assert result.ok is True
    assert runner.tool.await_count==2
    runner.tool_result.assert_awaited_once_with(job_id,'write',generation)
    execution.record_resource.assert_called_once_with('tool:write','execution.millis',7)


@pytest.mark.asyncio
async def test_fetch_repository_accepts_algorithm_retrieval_and_rejects_other_commit(new_job, session_factory, tmp_path, monkeypatch):
    from app.jobs.execution import JobExecution
    from app.core.types import ToolCall, RetrievalResult, RetrievalCandidate
    from app.config import settings
    from pathlib import Path

    job_id, _, _, generation = new_job
    runner = AsyncMock()
    execution = JobExecution(job_id, 'worker', generation, session_factory=session_factory, runner=runner)
    checkpoint = execution.algorithm_checkpoint()
    url = 'https://github.com/example/editor'
    checkpoint.retrieval = RetrievalResult(queries=['editor'], completed=True, candidates=[
        RetrievalCandidate(repo_url=url, commit='a' * 40)])
    execution.save_algorithm_checkpoint(checkpoint)
    monkeypatch.setattr(settings, 'AGENT_WORKSPACE_ROOT', str(tmp_path))

    def prepare(destination, route):
        assert route.sources[0].commit == 'a' * 40
        Path(destination, 'README.md').write_text('fixed source')

    monkeypatch.setattr('app.agent.routing.prepare_sources', prepare)
    result = await execution.execute_tool(ToolCall(id='fetch', name='fetch_repository', arguments={
        'url': url, 'commit': 'a' * 40, 'destination': 'component'}))
    assert result.ok is True
    assert (tmp_path / job_id / 'component' / 'README.md').read_text() == 'fixed source'
    assert execution.checkpoint()['sources'][0]['commit'] == 'a' * 40
    with pytest.raises(ValueError, match='source was not retrieved at this commit'):
        await execution.execute_tool(ToolCall(id='wrong', name='fetch_repository', arguments={
            'url': url, 'commit': 'b' * 40, 'destination': 'other'}))
    assert not (tmp_path / job_id / 'other').exists()


def test_generation_budget_replays_uncheckpointed_received_turn(new_job,session_factory):
    from app.jobs.execution import JobExecution
    from app.runtime.models import ResourceRecord
    job_id,app_id,_,generation=new_job
    with session_factory() as session:
        for i in range(34):
            op=f'model:{job_id}:implementation:0' if i==0 else f'count:{job_id}:{i}'
            session.add(ResourceRecord(type='MODEL_CALL',job_id=job_id,app_id=app_id,operation_id=op,state='METERED',reference=op,metadata_json={}))
        session.commit()
    execution=JobExecution(job_id,'worker',generation,session_factory=session_factory,model_client=RequirementModel())
    assert execution.generation_round_budget(execution.model('implementation'))==1


@pytest.mark.asyncio
async def test_deployment_confirmation_after_freeze_resumes_same_job_revision(new_job,session_factory):
    from app.jobs.execution import JobExecution
    from app.jobs.pipeline import WaitingForUser
    from app.apps.service import add_message
    jid,aid,owner,generation=new_job
    execution=JobExecution(jid,'worker',generation,session_factory=session_factory,model_client=RequirementModel())
    assert (await execution.ensure_requirement()).revision==1
    with pytest.raises(WaitingForUser): execution.wait_for_user('是否部署独立实例？')
    with session_factory() as session:
        resumed=add_message(session,aid,owner,'同意','confirm-deployment')
        assert resumed.job_id==jid
        claimed=claim_job(session,'worker')
        generation=claimed.lease_generation
    execution=JobExecution(jid,'worker',generation,session_factory=session_factory,model_client=RequirementModel())
    requirement=await execution.ensure_requirement()
    assert requirement.revision==2
    assert requirement.delivery_policy.preference=='SELF_HOSTED'
    assert execution.algorithm_checkpoint().requirement_revision==2
