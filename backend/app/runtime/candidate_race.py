from __future__ import annotations

import asyncio
import inspect
from dataclasses import dataclass, field, replace
from typing import Any, Literal

from app.billing.ledger import InsufficientQuota


RaceState = Literal[
    "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED", "UNKNOWN"
]


@dataclass(frozen=True)
class CandidateSpec:
    id: str
    strategy: str
    failure_class: str
    estimated_upper_units: int

    def __post_init__(self):
        if not self.id or self.estimated_upper_units <= 0:
            raise ValueError("candidate identity and upper bound are required")


@dataclass(frozen=True)
class CandidateOutcome:
    id: str
    status: RaceState
    validated: bool = False
    usage_units: int | None = None
    cleanup_state: Literal["PENDING", "PRESERVED", "STOPPED", "UNKNOWN"] = (
        "PENDING"
    )
    result: Any = None
    error_code: str | None = None


@dataclass(frozen=True)
class CandidateRaceResult:
    status: RaceState
    winner: CandidateOutcome | None
    outcomes: list[CandidateOutcome] = field(default_factory=list)
    started_new_candidates: int = 0


async def _await(value):
    return await value if inspect.isawaitable(value) else value


def validate_candidate_race(
    specs: list[CandidateSpec], *, remaining_budget: int | None = None
) -> None:
    if not specs or len(specs) > 2:
        raise ValueError("candidate race requires one or at most two candidates")
    if len({item.id for item in specs}) != len(specs):
        raise ValueError("candidate race IDs must be unique")
    if any(
        item.failure_class not in {"DEPENDENCY", "BUILD", "STARTUP"}
        for item in specs
    ):
        raise ValueError("parallel repair only supports dependency/build/startup")
    if remaining_budget is not None and sum(
        item.estimated_upper_units for item in specs
    ) > remaining_budget:
        raise InsufficientQuota()


def _coerce_outcome(spec: CandidateSpec, value: object) -> CandidateOutcome:
    if isinstance(value, CandidateOutcome):
        if value.id != spec.id:
            raise ValueError("candidate outcome identity changed")
        return value
    if isinstance(value, dict):
        return CandidateOutcome(id=spec.id, **value)
    raise ValueError("candidate runner returned an invalid outcome")


async def race_candidates(
    specs: list[CandidateSpec],
    run,
    stop,
    reconcile,
    *,
    remaining_budget: int | None = None,
) -> CandidateRaceResult:
    validate_candidate_race(specs, remaining_budget=remaining_budget)
    tasks = {asyncio.create_task(run(spec)): spec for spec in specs}
    outcomes: dict[str, CandidateOutcome] = {}
    winner: CandidateOutcome | None = None
    pending = set(tasks)
    while pending and winner is None:
        completed, pending = await asyncio.wait(
            pending, return_when=asyncio.FIRST_COMPLETED
        )
        for task in completed:
            spec = tasks[task]
            try:
                result = _coerce_outcome(spec, task.result())
            except Exception as exc:
                result = CandidateOutcome(
                    id=spec.id,
                    status="FAILED",
                    validated=False,
                    cleanup_state="PRESERVED",
                    error_code=type(exc).__name__,
                )
            outcomes[spec.id] = result
            if winner is None and result.status == "SUCCEEDED" and result.validated:
                winner = result

    unknown_cleanup = False
    if winner is not None and pending:
        for task in pending:
            task.cancel()
        for task in pending:
            spec = tasks[task]
            cleanup_state = "STOPPED"
            try:
                await _await(stop(spec.id, True))
            except Exception:
                observed = await _await(reconcile(spec.id))
                cleanup_state = "STOPPED" if observed == "STOPPED" else "UNKNOWN"
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
            if cleanup_state == "UNKNOWN":
                unknown_cleanup = True
            outcomes[spec.id] = CandidateOutcome(
                id=spec.id,
                status="CANCELLED" if cleanup_state == "STOPPED" else "UNKNOWN",
                validated=False,
                cleanup_state=cleanup_state,
            )
    elif pending:
        completed = await asyncio.gather(*pending, return_exceptions=True)
        for task, value in zip(pending, completed):
            spec = tasks[task]
            if isinstance(value, Exception):
                outcomes[spec.id] = CandidateOutcome(
                    id=spec.id,
                    status="FAILED",
                    cleanup_state="PRESERVED",
                    error_code=type(value).__name__,
                )
            else:
                outcomes[spec.id] = _coerce_outcome(spec, value)

    if winner is not None:
        for spec in specs:
            current = outcomes.get(spec.id)
            if current is None or spec.id == winner.id or current.cleanup_state == "STOPPED":
                continue
            cleanup_state = "STOPPED"
            try:
                await _await(stop(spec.id, True))
            except Exception:
                observed = await _await(reconcile(spec.id))
                cleanup_state = "STOPPED" if observed == "STOPPED" else "UNKNOWN"
            if cleanup_state == "UNKNOWN":
                unknown_cleanup = True
            outcomes[spec.id] = replace(
                current,
                status="UNKNOWN" if cleanup_state == "UNKNOWN" else current.status,
                cleanup_state=cleanup_state,
            )

    ordered = [outcomes[item.id] for item in specs]
    if unknown_cleanup:
        status = "UNKNOWN"
    elif winner is not None:
        status = "SUCCEEDED"
    elif any(item.status == "UNKNOWN" for item in ordered):
        status = "UNKNOWN"
    else:
        status = "FAILED"
    return CandidateRaceResult(
        status=status,
        winner=winner,
        outcomes=ordered,
        started_new_candidates=len(specs),
    )


async def resume_candidate_race(saved: CandidateRaceResult, reconcile):
    outcomes = []
    for item in saved.outcomes:
        if item.status not in {"RUNNING", "UNKNOWN"}:
            outcomes.append(item)
            continue
        observed = await _await(reconcile(item.id))
        if observed == "STOPPED":
            outcomes.append(
                replace(item, status="CANCELLED", cleanup_state="STOPPED")
            )
        else:
            outcomes.append(
                replace(item, status="UNKNOWN", cleanup_state="UNKNOWN")
            )
    status = (
        "UNKNOWN"
        if any(item.status in {"RUNNING", "UNKNOWN"} for item in outcomes)
        else saved.status
    )
    return CandidateRaceResult(
        status=status,
        winner=saved.winner,
        outcomes=outcomes,
        started_new_candidates=0,
    )
