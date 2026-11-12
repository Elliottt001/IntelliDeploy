from contextlib import contextmanager
from types import SimpleNamespace

import pytest

from app.agent.contracts import RepositoryProfile
from app.billing.ledger import InsufficientQuota
from app.core.types import (
    AcceptanceItem,
    CompatibilityReport,
    DemandFact,
    Requirement,
    RoutePlan,
)


def requirement_with(*facts: str) -> Requirement:
    acceptance = [
        AcceptanceItem(
            id=fact,
            action=fact,
            expected=fact,
            private_data=fact == "private_data",
        )
        for fact in facts
    ]
    return Requirement(
        prompt=" ".join(facts) or "simple notes",
        acceptance=acceptance,
        facts=[
            DemandFact(
                id=fact,
                source_message_id="message-1",
                quote=fact,
                kind="DATA" if fact in {"private_data", "migration"} else "FUNCTION",
                acceptance_ids=[fact],
            )
            for fact in facts
        ],
    )


def route_for(name: str, *, confidence: str = "HIGH") -> RoutePlan:
    return RoutePlan(
        route=name,
        sources=[],
        steps=["test"],
        reason="test",
        confidence=confidence,
    )


def profiles_for(name: str) -> list[RepositoryProfile]:
    if name == "GENERATE_APP":
        return []
    return [
        RepositoryProfile(
            repo_url="https://github.com/example/app",
            commit="a" * 40,
            project_type="web_app",
            compatibility=CompatibilityReport(status="SUPPORTED"),
            license_status="ALLOWED",
        )
    ]


@pytest.mark.parametrize(
    ("route_name", "facts", "expected"),
    [
        ("DEPLOY_EXISTING", (), ("LOW", "LOW", False, False)),
        ("MODIFY_EXISTING", (), ("MEDIUM", "MEDIUM", True, False)),
        ("COMPOSE_COMPONENTS", (), ("HIGH", "HIGH", True, True)),
        ("GENERATE_APP", ("private_data",), ("MEDIUM", "HIGH", True, True)),
        ("GENERATE_APP", ("payment",), ("HIGH", "HIGH", True, True)),
    ],
)
def test_dynamic_policy(route_name, facts, expected):
    from app.agent.policy import decide_orchestration

    decision = decide_orchestration(
        requirement_with(*facts), route_for(route_name), profiles_for(route_name), []
    )

    assert (
        decision.complexity,
        decision.risk,
        decision.require_llm_review,
        decision.require_security_llm,
    ) == expected
    assert decision.max_build_attempts == 4
    assert decision.max_route_switches == 2
    assert decision.max_parallel_candidates <= 2


@pytest.mark.parametrize("fact", ["migration", "file_upload"])
def test_migration_and_file_upload_are_high_risk_and_never_parallel(fact):
    from app.agent.policy import decide_orchestration

    decision = decide_orchestration(
        requirement_with(fact), route_for("GENERATE_APP"), [], []
    )

    assert (decision.complexity, decision.risk) == ("HIGH", "HIGH")
    assert decision.require_llm_review is True
    assert decision.require_security_llm is True
    assert decision.allow_parallel_healing is False
    assert decision.max_parallel_candidates == 1
    assert fact in decision.reasons


def test_first_build_failure_enables_at_most_two_parallel_candidates():
    from app.agent.policy import decide_orchestration

    decision = decide_orchestration(
        requirement_with(),
        route_for("DEPLOY_EXISTING"),
        profiles_for("DEPLOY_EXISTING"),
        [{"kind": "BUILD", "code": "COMPILE_FAILED"}],
    )

    assert decision.complexity == "MEDIUM"
    assert decision.allow_parallel_healing is True
    assert decision.max_parallel_candidates == 2
    assert "prior_build_failure" in decision.reasons


def test_target_failure_never_spends_model_review_or_parallel_budget():
    from app.agent.policy import decide_orchestration

    decision = decide_orchestration(
        requirement_with("payment"),
        route_for("GENERATE_APP"),
        [],
        [{"kind": "TARGET", "code": "TARGET_UNAVAILABLE"}],
    )

    assert decision.require_llm_review is False
    assert decision.require_security_llm is False
    assert decision.allow_parallel_healing is False
    assert decision.max_parallel_candidates == 1
    assert "target_unavailable" in decision.reasons


def test_low_confidence_route_requires_high_review():
    from app.agent.policy import decide_orchestration

    decision = decide_orchestration(
        requirement_with(), route_for("GENERATE_APP", confidence="LOW"), [], []
    )

    assert (decision.complexity, decision.risk) == ("HIGH", "HIGH")
    assert decision.require_llm_review is True
    assert decision.require_security_llm is True
    assert "low_route_confidence" in decision.reasons


def test_stage_budget_policy_uses_all_parent_percentage_caps():
    from app.agent.policy import StageBudgetPolicy

    policy = StageBudgetPolicy(parent_max_units=10_000)

    assert policy.limit("QUERY_PLAN") == 500
    assert policy.limit("RETRIEVAL") == 1_000
    assert policy.limit("BUILDER") == 4_500
    assert policy.limit("REVIEW") == 1_000
    assert policy.limit("BUILD") == 2_500
    assert policy.limit("HEALING") == 500
    assert policy.allows("REVIEW", used_units=0, estimated_upper_units=1_000)
    assert not policy.allows("REVIEW", used_units=0, estimated_upper_units=1_001)
    assert not policy.allows("REVIEW", used_units=900, estimated_upper_units=101)


def test_job_execution_admission_checks_stage_and_parent_limits():
    from app.jobs.execution import JobExecution

    parent = SimpleNamespace(max_units=10_000, used_units=8_900, status="OPEN")
    job = SimpleNamespace(checkpoint={"algorithm": {"stages": []}})

    @contextmanager
    def sessions():
        yield object()

    execution = JobExecution("job", "worker", 1, session_factory=sessions)
    execution.job = lambda session: job
    execution.reservation = lambda session, current: parent

    execution.admit_stage("REVIEW", 1_000)
    with pytest.raises(InsufficientQuota):
        execution.admit_stage("REVIEW", 1_001)
    with pytest.raises(InsufficientQuota):
        execution.admit_stage("BUILD", 1_101)
