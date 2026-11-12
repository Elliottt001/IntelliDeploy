import asyncio

import pytest

from app.billing.ledger import InsufficientQuota
from test_candidate_pipeline import (
    pipeline_context as _pipeline_context_fixture,
    pipeline_dependencies,
)


@pytest.fixture
def race_pipeline_context(session_factory, tmp_path):
    return _pipeline_context_fixture.__wrapped__(session_factory, tmp_path)


def candidate_spec(name, *, failure_class="BUILD", units=100):
    from app.runtime.candidate_race import CandidateSpec

    return CandidateSpec(
        id=name,
        strategy=f"repair-{name}",
        failure_class=failure_class,
        estimated_upper_units=units,
    )


def outcome(name, *, passed, usage=10):
    from app.runtime.candidate_race import CandidateOutcome

    return CandidateOutcome(
        id=name,
        status="SUCCEEDED" if passed else "FAILED",
        validated=passed,
        usage_units=usage,
        cleanup_state="PRESERVED",
    )


@pytest.mark.asyncio
async def test_race_ignores_first_failure_and_returns_first_success():
    from app.runtime.candidate_race import race_candidates

    async def run(spec):
        await asyncio.sleep(0.01 if spec.id == "fast-fail" else 0.02)
        return outcome(spec.id, passed=spec.id == "slow-pass")

    stopped = []
    result = await race_candidates(
        [candidate_spec("fast-fail"), candidate_spec("slow-pass")],
        run=run,
        stop=lambda candidate_id, preserve: stopped.append(
            (candidate_id, preserve)
        ),
        reconcile=lambda candidate_id: "STOPPED",
        remaining_budget=1_000,
    )

    assert result.winner.id == "slow-pass"
    assert result.status == "SUCCEEDED"
    assert {item.id for item in result.outcomes} == {"fast-fail", "slow-pass"}
    assert stopped == [("fast-fail", True)]


@pytest.mark.asyncio
async def test_first_success_cancels_and_records_slow_loser():
    from app.runtime.candidate_race import race_candidates

    async def run(spec):
        if spec.id == "winner":
            await asyncio.sleep(0.01)
            return outcome(spec.id, passed=True)
        await asyncio.sleep(60)

    stopped = []

    async def stop(candidate_id, preserve):
        stopped.append((candidate_id, preserve))

    result = await race_candidates(
        [candidate_spec("winner"), candidate_spec("loser")],
        run=run,
        stop=stop,
        reconcile=lambda candidate_id: "STOPPED",
        remaining_budget=1_000,
    )

    loser = next(item for item in result.outcomes if item.id == "loser")
    assert stopped == [("loser", True)]
    assert loser.status == "CANCELLED"
    assert loser.cleanup_state == "STOPPED"


@pytest.mark.asyncio
async def test_both_failed_returns_all_usage_without_winner():
    from app.runtime.candidate_race import race_candidates

    async def run(spec):
        return outcome(spec.id, passed=False, usage=25)

    result = await race_candidates(
        [candidate_spec("one"), candidate_spec("two")],
        run=run,
        stop=lambda *_: None,
        reconcile=lambda candidate_id: "STOPPED",
        remaining_budget=1_000,
    )

    assert result.status == "FAILED"
    assert result.winner is None
    assert sum(item.usage_units for item in result.outcomes) == 50


@pytest.mark.asyncio
async def test_unknown_loser_cancellation_makes_race_unknown():
    from app.runtime.candidate_race import race_candidates

    async def run(spec):
        if spec.id == "winner":
            return outcome(spec.id, passed=True)
        await asyncio.sleep(60)

    async def stop(candidate_id, preserve):
        raise ConnectionError(candidate_id)

    result = await race_candidates(
        [candidate_spec("winner"), candidate_spec("loser")],
        run=run,
        stop=stop,
        reconcile=lambda candidate_id: "UNKNOWN",
        remaining_budget=1_000,
    )

    assert result.status == "UNKNOWN"
    assert next(item for item in result.outcomes if item.id == "loser").cleanup_state == "UNKNOWN"


@pytest.mark.asyncio
async def test_worker_interruption_reconciles_unknown_candidates_before_retry():
    from app.runtime.candidate_race import (
        CandidateOutcome,
        CandidateRaceResult,
        resume_candidate_race,
    )

    saved = CandidateRaceResult(
        status="RUNNING",
        winner=None,
        outcomes=[
            CandidateOutcome(id="one", status="RUNNING", cleanup_state="PENDING"),
            CandidateOutcome(id="two", status="UNKNOWN", cleanup_state="UNKNOWN"),
        ],
        started_new_candidates=2,
    )
    states = {"one": "RUNNING", "two": "UNKNOWN"}

    result = await resume_candidate_race(saved, lambda item: states[item])

    assert result.status == "UNKNOWN"
    assert result.started_new_candidates == 0


def test_race_requires_budget_and_parallel_safe_failure_class():
    from app.runtime.candidate_race import validate_candidate_race

    with pytest.raises(InsufficientQuota):
        validate_candidate_race(
            [candidate_spec("one", units=600), candidate_spec("two", units=600)],
            remaining_budget=1_000,
        )
    for failure_class in ("BUSINESS", "ACCESS", "DATA"):
        with pytest.raises(ValueError, match="parallel repair"):
            validate_candidate_race(
                [candidate_spec("one", failure_class=failure_class)],
                remaining_budget=1_000,
            )
    with pytest.raises(ValueError, match="at most two"):
        validate_candidate_race(
            [candidate_spec("one"), candidate_spec("two"), candidate_spec("three")],
            remaining_budget=1_000,
        )


def test_execution_pre_admits_both_candidate_upper_bounds():
    from app.jobs.execution import JobExecution

    admitted = []
    execution = type(
        "Execution",
        (),
        {"admit_stage": lambda self, stage, units: admitted.append((stage, units))},
    )()

    JobExecution.admit_candidate_race(
        execution, [candidate_spec("one", units=400), candidate_spec("two", units=600)]
    )

    assert admitted == [("BUILD", 1_000)]


@pytest.mark.asyncio
async def test_parallel_loser_without_registered_runtime_stays_unknown(
    session_factory, race_pipeline_context
):
    from sqlalchemy import select

    from app.jobs.pipeline import _stop_parallel_candidate
    from app.runtime.models import ResourceRecord

    dependencies = pipeline_dependencies(
        race_pipeline_context, candidate_results=[], live_results=[]
    )
    candidate_id = f"{race_pipeline_context.job_id}-unregistered"

    with session_factory() as session:
        from app.runtime.cleanup import register_candidate_race_resource

        register_candidate_race_resource(
            session,
            job_id=race_pipeline_context.job_id,
            app_id=race_pipeline_context.app_id,
            candidate_id=candidate_id,
            ttl_seconds=3600,
        )
        session.commit()

    with pytest.raises(RuntimeError, match="runtime is not registered"):
        await _stop_parallel_candidate(
            candidate_id,
            runtimes={},
            dependencies=dependencies,
            session_factory=session_factory,
        )

    with session_factory() as session:
        resource = session.scalar(
            select(ResourceRecord).where(ResourceRecord.reference == candidate_id)
        )
        assert resource.metadata_json["cleanup_state"] == "PENDING"


@pytest.mark.asyncio
async def test_pipeline_parallel_repair_records_both_outcomes(
    session_factory, race_pipeline_context
):
    from sqlalchemy import select

    from app.agent.contracts import HealingDecision
    from app.apps.models import RequirementRecord
    from app.jobs.models import Job
    from app.jobs.pipeline import _run_parallel_repair
    from app.runtime.models import ResourceRecord
    dependencies = pipeline_dependencies(
        race_pipeline_context, candidate_results=[False, True], live_results=[]
    )
    with session_factory() as session:
        job = session.get(Job, race_pipeline_context.job_id)
        record = session.scalar(
            select(RequirementRecord).where(
                RequirementRecord.app_id == job.app_id,
                RequirementRecord.revision == job.requirement_revision,
            )
        )
        from app.core.types import Requirement

        requirement = Requirement.model_validate(record.requirement)

    candidate, report, runtime = await _run_parallel_repair(
        job,
        requirement,
        0,
        [{"message": "build failed"}],
        dependencies,
        session_factory,
        None,
        HealingDecision(
            failure_class="BUILD",
            strategy="REPAIR_PARALLEL",
            candidate_count=2,
            reasons=["test"],
        ),
    )

    assert report.passed is True
    assert candidate.attempt_id == runtime.id
    with session_factory() as session:
        resources = list(
            session.scalars(
                select(ResourceRecord).where(
                    ResourceRecord.job_id == job.id,
                    ResourceRecord.type == "CANDIDATE_RUNTIME",
                )
            )
        )
        assert len(resources) == 2
        assert {item.metadata_json["outcome_state"] for item in resources} == {
            "FAILED",
            "SUCCEEDED",
        }
