import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.agent.contracts import OrchestrationDecision, RepositoryProfile
from app.core.types import (
    AcceptanceItem,
    AppManifest,
    BrowserCheck,
    CompatibilityReport,
    ModelTurn,
    Requirement,
    RoutePlan,
    ServiceSpec,
)
from app.jobs.pipeline import CandidateDraft
from app.runtime.manifest import manifest_hash


def requirement() -> Requirement:
    return Requirement(
        prompt="保存私人笔记",
        acceptance=[
            AcceptanceItem(
                id="save",
                action="保存",
                expected="刷新后保留",
                private_data=True,
            )
        ],
    )


def route() -> RoutePlan:
    return RoutePlan(
        route="GENERATE_APP",
        steps=["generate"],
        reason="test",
        confidence="HIGH",
    )


def candidate(tmp_path: Path) -> CandidateDraft:
    (tmp_path / "app.py").write_text("print('safe')\n")
    return CandidateDraft(
        workspace_id=str(tmp_path),
        manifest=AppManifest(
            web_service="web",
            services=[
                ServiceSpec(
                    name="web",
                    image="registry.test/web@sha256:" + "a" * 64,
                    port=3000,
                    health_path="/health",
                )
            ],
        ),
        source_tree=["app.py"],
        browser_checks=[
            BrowserCheck(
                item_id="save",
                actor="owner",
                actions=[{"type": "expect_text", "selector": "#saved", "text": "yes"}],
                expected="刷新后保留",
            )
        ],
        requirement_revision=1,
    )


def profile() -> RepositoryProfile:
    return RepositoryProfile(
        repo_url="https://github.com/example/notes",
        commit="b" * 40,
        project_type="web_app",
        compatibility=CompatibilityReport(status="SUPPORTED"),
        license_status="ALLOWED",
    )


def policy(level: str) -> OrchestrationDecision:
    return OrchestrationDecision(
        complexity=level,
        risk=level,
        require_llm_review=level != "LOW",
        require_security_llm=level == "HIGH",
        allow_parallel_healing=False,
        max_build_attempts=4,
        max_route_switches=2,
        max_parallel_candidates=1,
        reasons=["test"],
    )


def response_payload(draft, *, finding_id="llm:ok", severity="INFO"):
    return {
        "findings": [
            {
                "id": finding_id,
                "severity": severity,
                "category": "SECURITY" if finding_id.startswith("security") else "REQUIREMENT",
                "message": "bounded finding",
                "evidence_ref": f"manifest:{manifest_hash(draft.manifest)}",
                "acceptance_ids": ["save"],
                "suggested_action": None,
            }
        ]
    }


class TimedFakeModel:
    def __init__(self, draft):
        self.draft = draft
        self.active = 0
        self.maximum_concurrent_calls = 0
        self.calls = 0

    async def complete(self, messages, tools, model):
        del tools, model
        self.calls += 1
        self.active += 1
        self.maximum_concurrent_calls = max(self.maximum_concurrent_calls, self.active)
        await asyncio.sleep(0.01)
        security = "security reviewer" in messages[0]["content"].lower()
        payload = response_payload(
            self.draft, finding_id="security:llm" if security else "llm:requirement"
        )
        self.active -= 1
        return ModelTurn(
            assistant_message={"role": "assistant", "content": json.dumps(payload)},
            input_tokens=1,
            output_tokens=1,
        )


class Execution:
    async def select_sources_hybrid(self, requirement):
        del requirement


@pytest.mark.asyncio
async def test_low_risk_candidate_never_calls_llm_reviewer(tmp_path):
    from app.agent.orchestrator import AlgorithmOrchestrator

    draft = candidate(tmp_path)
    model = AsyncMock()
    reports = await AlgorithmOrchestrator(Execution()).review_candidate(
        "attempt-1",
        draft,
        requirement(),
        route(),
        profile(),
        policy("LOW"),
        model=model,
    )

    model.complete.assert_not_awaited()
    assert {report.reviewer_kind for report in reports} == {
        "DETERMINISTIC",
        "SECURITY_RULES",
    }


@pytest.mark.asyncio
async def test_high_risk_candidate_calls_reviewers_in_parallel(tmp_path):
    from app.agent.orchestrator import AlgorithmOrchestrator

    draft = candidate(tmp_path)
    model = TimedFakeModel(draft)
    reports = await AlgorithmOrchestrator(Execution()).review_candidate(
        "attempt-1",
        draft,
        requirement(),
        route(),
        profile(),
        policy("HIGH"),
        model=model,
    )

    assert {report.reviewer_kind for report in reports} == {
        "DETERMINISTIC",
        "LLM",
        "SECURITY_RULES",
        "SECURITY_LLM",
    }
    assert model.maximum_concurrent_calls == 2


@pytest.mark.asyncio
async def test_model_review_rejects_extra_schema_and_unknown_evidence(tmp_path):
    from app.agent.review import review_with_model

    draft = candidate(tmp_path)
    invalid = response_payload(draft)
    invalid["unexpected"] = True
    model = AsyncMock(
        complete=AsyncMock(
            return_value=ModelTurn(
                assistant_message={"role": "assistant", "content": json.dumps(invalid)}
            )
        )
    )
    with pytest.raises(ValueError):
        await review_with_model("attempt-1", draft, requirement(), route(), model)

    unknown = response_payload(draft)
    unknown["findings"][0]["evidence_ref"] = "private:unknown"
    model.complete.return_value = ModelTurn(
        assistant_message={"role": "assistant", "content": json.dumps(unknown)}
    )
    with pytest.raises(ValueError, match="unknown evidence reference"):
        await review_with_model("attempt-1", draft, requirement(), route(), model)


@pytest.mark.asyncio
async def test_model_blocking_finding_remains_blocking(tmp_path):
    from app.agent.review import review_with_model

    draft = candidate(tmp_path)
    payload = response_payload(draft, finding_id="llm:block", severity="BLOCKING")
    model = AsyncMock()
    model.complete.return_value = ModelTurn(
        assistant_message={"role": "assistant", "content": json.dumps(payload)}
    )

    report = await review_with_model(
        "attempt-1", draft, requirement(), route(), model
    )

    assert report.findings[0].severity == "BLOCKING"
    assert report.reviewer_kind == "LLM"
