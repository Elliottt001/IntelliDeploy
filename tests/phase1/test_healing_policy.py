import pytest

from app.agent.contracts import OrchestrationDecision


def failure(**values):
    from app.agent.healing import FailureEvidence

    return FailureEvidence(**values)


def medium_policy(*, parallel=True, candidates=2):
    return OrchestrationDecision(
        complexity="MEDIUM",
        risk="MEDIUM",
        require_llm_review=True,
        require_security_llm=False,
        allow_parallel_healing=parallel,
        max_build_attempts=4,
        max_route_switches=2,
        max_parallel_candidates=candidates,
        reasons=["test"],
    )


@pytest.mark.parametrize(
    ("evidence", "failure_class", "strategy"),
    [
        ({"stage": "install", "code": "LOCKFILE_CONFLICT"}, "DEPENDENCY", "REPAIR_PARALLEL"),
        ({"stage": "build", "code": "COMPILE_FAILED"}, "BUILD", "REPAIR_PARALLEL"),
        ({"stage": "startup", "code": "PORT_NOT_READY"}, "STARTUP", "REPAIR_PARALLEL"),
        ({"stage": "browser", "code": "CORE_CHECK_FAILED"}, "BUSINESS", "REPAIR_SERIAL"),
        ({"stage": "identity", "code": "CROSS_USER_ACCESS"}, "ACCESS", "REPAIR_SERIAL"),
        ({"stage": "migration", "code": "DATA_PROOF_FAILED"}, "DATA", "REPAIR_SERIAL"),
        ({"stage": "deploy", "code": "TARGET_UNAVAILABLE"}, "TARGET", "STOP"),
        ({"stage": "model", "code": "UPSTREAM_UNAVAILABLE"}, "UPSTREAM", "STOP"),
    ],
)
def test_failure_policy(evidence, failure_class, strategy):
    from app.agent.healing import classify_failure, choose_healing

    classified = classify_failure(failure(**evidence))
    decision = choose_healing(
        classified,
        medium_policy(),
        remaining_budget=5_000,
        runner_capacity=2,
    )

    assert classified.kind == failure_class
    assert decision.failure_class == failure_class
    assert decision.strategy == strategy


def test_bound_code_overrides_untrusted_explanation():
    from app.agent.healing import classify_failure

    classified = classify_failure(
        failure(
            stage="build",
            code="TARGET_UNAVAILABLE",
            message="LLM says this is a compile error",
            explanation="BUILD",
        )
    )

    assert classified.kind == "TARGET"


def test_parallel_repair_downgrades_for_budget_capacity_and_policy():
    from app.agent.healing import classify_failure, choose_healing

    classified = classify_failure(failure(stage="build", code="COMPILE_FAILED"))

    assert choose_healing(
        classified, medium_policy(), remaining_budget=1_999, runner_capacity=2
    ).strategy == "REPAIR_SERIAL"
    assert choose_healing(
        classified, medium_policy(), remaining_budget=5_000, runner_capacity=1
    ).strategy == "REPAIR_SERIAL"
    assert choose_healing(
        classified,
        medium_policy(parallel=False),
        remaining_budget=5_000,
        runner_capacity=2,
    ).strategy == "REPAIR_SERIAL"


def test_parallel_candidates_never_exceed_two_and_migration_never_races():
    from app.agent.healing import classify_failure, choose_healing

    build = choose_healing(
        classify_failure(failure(stage="build", code="COMPILE_FAILED")),
        medium_policy(candidates=2),
        remaining_budget=10_000,
        runner_capacity=20,
    )
    migration = choose_healing(
        classify_failure(failure(stage="migration", code="DATA_PROOF_FAILED")),
        medium_policy(),
        remaining_budget=10_000,
        runner_capacity=20,
    )

    assert build.candidate_count == 2
    assert migration.strategy == "REPAIR_SERIAL"
    assert migration.candidate_count == 1


@pytest.mark.parametrize(
    "evidence",
    [
        {"stage": "build", "code": "COMPILE_FAILED", "stalled_rounds": 3},
        {"stage": "source", "code": "SOURCE_INVALID", "route_switches": 2},
    ],
)
def test_stalled_rounds_and_route_switch_limit_stop(evidence):
    from app.agent.healing import classify_failure, choose_healing

    decision = choose_healing(
        classify_failure(failure(**evidence)),
        medium_policy(),
        remaining_budget=10_000,
        runner_capacity=2,
    )

    assert decision.strategy == "STOP"
    assert decision.candidate_count == 0
