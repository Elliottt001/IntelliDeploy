from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.agent.contracts import EvidenceRef, HealingDecision, OrchestrationDecision


FailureKind = Literal[
    "SOURCE",
    "DEPENDENCY",
    "BUILD",
    "STARTUP",
    "BUSINESS",
    "ACCESS",
    "DATA",
    "TARGET",
    "UPSTREAM",
]


class FailureEvidence(BaseModel):
    stage: str
    code: str
    message: str = ""
    explanation: str | None = None
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    stalled_rounds: int = Field(default=0, ge=0)
    route_switches: int = Field(default=0, ge=0)


class FailureClassification(BaseModel):
    kind: FailureKind
    code: str
    stage: str
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    stalled_rounds: int = 0
    route_switches: int = 0


_CODE_KIND = {
    "LOCKFILE_CONFLICT": "DEPENDENCY",
    "DEPENDENCY_FAILED": "DEPENDENCY",
    "COMPILE_FAILED": "BUILD",
    "BUILD_FAILED": "BUILD",
    "PORT_NOT_READY": "STARTUP",
    "STARTUP_FAILED": "STARTUP",
    "CORE_CHECK_FAILED": "BUSINESS",
    "CORE_CHECKS_FAILED": "BUSINESS",
    "CROSS_USER_ACCESS": "ACCESS",
    "ACCESS_DENIED": "ACCESS",
    "DATA_PROOF_FAILED": "DATA",
    "MIGRATION_FAILED": "DATA",
    "TARGET_UNAVAILABLE": "TARGET",
    "REGISTRY_UNAVAILABLE": "TARGET",
    "UPSTREAM_UNAVAILABLE": "UPSTREAM",
    "MODEL_UNKNOWN": "UPSTREAM",
    "SOURCE_INVALID": "SOURCE",
    "LICENSE_BLOCKED": "SOURCE",
}

_STAGE_KIND = {
    "clone": "SOURCE",
    "source": "SOURCE",
    "license": "SOURCE",
    "install": "DEPENDENCY",
    "dependency": "DEPENDENCY",
    "build": "BUILD",
    "startup": "STARTUP",
    "browser": "BUSINESS",
    "business": "BUSINESS",
    "identity": "ACCESS",
    "access": "ACCESS",
    "migration": "DATA",
    "data": "DATA",
    "deploy": "TARGET",
    "target": "TARGET",
    "model": "UPSTREAM",
    "upstream": "UPSTREAM",
}


def classify_failure(evidence: FailureEvidence) -> FailureClassification:
    code = evidence.code.upper()
    kind = _CODE_KIND.get(code)
    if kind is None:
        kind = _STAGE_KIND.get(evidence.stage.lower(), "BUSINESS")
    return FailureClassification(
        kind=kind,
        code=code,
        stage=evidence.stage,
        evidence_refs=evidence.evidence_refs,
        stalled_rounds=evidence.stalled_rounds,
        route_switches=evidence.route_switches,
    )


def choose_healing(
    failure: FailureClassification,
    policy: OrchestrationDecision,
    remaining_budget: int,
    runner_capacity: int,
) -> HealingDecision:
    reasons = [f"failure:{failure.kind.lower()}", f"code:{failure.code.lower()}"]
    if remaining_budget <= 0:
        strategy, count = "STOP", 0
        reasons.append("budget_exhausted")
    elif failure.stalled_rounds >= 3:
        strategy, count = "STOP", 0
        reasons.append("three_stalled_rounds")
    elif failure.route_switches >= policy.max_route_switches:
        strategy, count = "STOP", 0
        reasons.append("route_switch_limit")
    elif failure.kind in {"TARGET", "UPSTREAM"}:
        strategy, count = "STOP", 0
    elif failure.kind == "SOURCE":
        strategy, count = "SWITCH_SOURCE", 1
    elif failure.kind in {"BUSINESS", "ACCESS", "DATA"}:
        strategy, count = "REPAIR_SERIAL", 1
    elif failure.kind in {"DEPENDENCY", "BUILD", "STARTUP"}:
        parallel = (
            policy.allow_parallel_healing
            and policy.max_parallel_candidates > 1
            and remaining_budget >= 2_000
            and runner_capacity >= 2
        )
        if parallel:
            strategy = "REPAIR_PARALLEL"
            count = min(2, policy.max_parallel_candidates, runner_capacity)
        else:
            strategy, count = "REPAIR_SERIAL", 1
            reasons.append("parallel_not_admitted")
    else:
        strategy, count = "STOP", 0
    return HealingDecision(
        failure_class=failure.kind,
        strategy=strategy,
        candidate_count=count,
        reasons=reasons,
        evidence_refs=failure.evidence_refs,
    )
