from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.agent.contracts import OrchestrationDecision, RepositoryProfile
from app.core.types import Requirement, RoutePlan


_STAGE_PERCENT = {
    "QUERY_PLAN": 5,
    "RETRIEVAL": 10,
    "PROFILE": 10,
    "RANK": 10,
    "ROUTE": 10,
    "BUILDER": 45,
    "REVIEW": 10,
    "SECURITY": 10,
    "BUILD": 25,
    "CANDIDATE": 25,
    "VALIDATION": 25,
    "HEALING": 5,
}


@dataclass(frozen=True)
class StageBudgetPolicy:
    parent_max_units: int

    def __post_init__(self):
        if self.parent_max_units <= 0:
            raise ValueError("parent_max_units must be positive")

    def limit(self, stage: str) -> int:
        try:
            percent = _STAGE_PERCENT[stage]
        except KeyError as exc:
            raise ValueError(f"unknown algorithm stage: {stage}") from exc
        return self.parent_max_units * percent // 100

    def allows(
        self, stage: str, *, used_units: int, estimated_upper_units: int
    ) -> bool:
        if used_units < 0 or estimated_upper_units < 0:
            return False
        return used_units + estimated_upper_units <= self.limit(stage)


def _requirement_terms(requirement: Requirement) -> set[str]:
    values = [requirement.prompt]
    values.extend(fact.id for fact in requirement.facts)
    values.extend(fact.quote for fact in requirement.facts)
    for item in requirement.acceptance:
        values.extend((item.id, item.action, item.expected))
        if item.private_data:
            values.append("private_data")
    text = " ".join(values).lower()
    terms = {value.lower() for value in values}
    keyword_groups = {
        "private_data": ("private_data", "private", "私有", "隐私", "联系方式"),
        "payment": ("payment", "pay", "支付", "付款", "订单", "webhook"),
        "migration": ("migration", "migrate", "迁移", "数据升级"),
        "file_upload": ("file_upload", "upload", "上传", "附件"),
        "identity": ("identity", "login", "登录", "认证", "多用户"),
        "ai_or_search": ("ai", "search", "模型", "搜索"),
    }
    for name, keywords in keyword_groups.items():
        if any(keyword in text for keyword in keywords):
            terms.add(name)
    return terms


def _failure_kind(failure: object) -> str:
    if isinstance(failure, dict):
        return str(
            failure.get("kind")
            or failure.get("failure_class")
            or failure.get("stage")
            or ""
        ).upper()
    return str(
        getattr(failure, "kind", None)
        or getattr(failure, "failure_class", None)
        or getattr(failure, "stage", None)
        or failure
    ).upper()


def decide_orchestration(
    requirement: Requirement,
    route: RoutePlan,
    profiles: list[RepositoryProfile],
    prior_failures: Iterable[object],
) -> OrchestrationDecision:
    route_defaults = {
        "DEPLOY_EXISTING": ("LOW", "LOW", False, False, "route:A"),
        "MODIFY_EXISTING": ("MEDIUM", "MEDIUM", True, False, "route:B"),
        "COMPOSE_COMPONENTS": ("HIGH", "HIGH", True, True, "route:C"),
        "GENERATE_APP": ("LOW", "LOW", False, False, "route:D"),
    }
    complexity, risk, llm_review, security_llm, route_reason = route_defaults[
        route.route
    ]
    reasons = [route_reason]
    terms = _requirement_terms(requirement)
    prohibited_parallel = False

    if "private_data" in terms:
        complexity, risk = "MEDIUM", "HIGH"
        llm_review = security_llm = True
        prohibited_parallel = True
        reasons.append("private_data")
    if "identity" in terms:
        complexity = "MEDIUM" if complexity == "LOW" else complexity
        risk = "HIGH"
        llm_review = security_llm = True
        prohibited_parallel = True
        reasons.append("identity")
    if "ai_or_search" in terms:
        complexity = "MEDIUM" if complexity == "LOW" else complexity
        llm_review = True
        reasons.append("external_capability")
    for high_risk in ("payment", "migration", "file_upload"):
        if high_risk in terms:
            complexity = risk = "HIGH"
            llm_review = security_llm = True
            prohibited_parallel = True
            reasons.append(high_risk)

    if len(profiles) > 1 or any(len(profile.compose_services) > 1 for profile in profiles):
        complexity = "HIGH"
        reasons.append("multi_service")

    if route.confidence == "LOW":
        complexity = risk = "HIGH"
        llm_review = security_llm = True
        reasons.append("low_route_confidence")

    failures = {_failure_kind(item) for item in prior_failures}
    parallel_failure = bool(failures & {"DEPENDENCY", "BUILD", "STARTUP"})
    if parallel_failure:
        complexity = "MEDIUM" if complexity == "LOW" else complexity
        llm_review = True
        if "BUILD" in failures:
            reasons.append("prior_build_failure")
        elif "DEPENDENCY" in failures:
            reasons.append("prior_dependency_failure")
        else:
            reasons.append("prior_startup_failure")

    unavailable = bool(failures & {"TARGET", "UPSTREAM"})
    if "TARGET" in failures:
        reasons.append("target_unavailable")
    if "UPSTREAM" in failures:
        reasons.append("upstream_unavailable")
    if failures & {"DATA", "ACCESS", "BUSINESS"}:
        prohibited_parallel = True

    allow_parallel = parallel_failure and not prohibited_parallel and not unavailable
    if unavailable:
        llm_review = security_llm = False

    return OrchestrationDecision(
        complexity=complexity,
        risk=risk,
        require_llm_review=llm_review,
        require_security_llm=security_llm,
        allow_parallel_healing=allow_parallel,
        max_build_attempts=4,
        max_route_switches=2,
        max_parallel_candidates=2 if allow_parallel else 1,
        reasons=list(dict.fromkeys(reasons)),
    )


def budget_group(stage: str) -> str:
    if stage in {"RETRIEVAL", "PROFILE", "RANK", "ROUTE"}:
        return "RETRIEVAL"
    if stage in {"REVIEW", "SECURITY"}:
        return "REVIEW"
    if stage in {"BUILD", "CANDIDATE", "VALIDATION"}:
        return "BUILD"
    return stage
