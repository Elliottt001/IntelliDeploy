from __future__ import annotations

from app.agent.contracts import ReviewFinding, ReviewReport
from app.core.types import Requirement, RoutePlan
from app.runtime.manifest import digest_pinned, manifest_hash


def _finding(
    attempt_id: str,
    digest: str,
    finding_id: str,
    *,
    severity: str,
    category: str,
    message: str,
    acceptance_ids: list[str] | None = None,
) -> ReviewFinding:
    return ReviewFinding(
        id=finding_id,
        severity=severity,
        category=category,
        message=message,
        evidence_ref=f"review:{attempt_id}:{digest}:{finding_id}",
        acceptance_ids=acceptance_ids or [],
    )


def review_deterministic(
    attempt_id: str, draft, requirement: Requirement, route: RoutePlan
) -> ReviewReport:
    digest = manifest_hash(draft.manifest)
    findings: list[ReviewFinding] = []
    mapped = [item.item_id for item in (draft.browser_checks or [])]
    for item in requirement.acceptance:
        if item.id not in mapped:
            findings.append(
                _finding(
                    attempt_id,
                    digest,
                    f"missing:{item.id}",
                    severity="BLOCKING",
                    category="REQUIREMENT",
                    message="核心验收项尚未映射到候选检查",
                    acceptance_ids=[item.id],
                )
            )
    if len(mapped) != len(set(mapped)):
        findings.append(
            _finding(
                attempt_id,
                digest,
                "acceptance:duplicate-mapping",
                severity="BLOCKING",
                category="REQUIREMENT",
                message="候选检查包含重复验收映射",
            )
        )

    for service in draft.manifest.services:
        if not digest_pinned(service.image):
            findings.append(
                _finding(
                    attempt_id,
                    digest,
                    "manifest:unpinned-image",
                    severity="BLOCKING",
                    category="RUNTIME",
                    message="候选服务镜像未固定不可变 digest",
                )
            )
        if service.port is None and service.name == draft.manifest.web_service:
            findings.append(
                _finding(
                    attempt_id,
                    digest,
                    "manifest:web-port-missing",
                    severity="BLOCKING",
                    category="RUNTIME",
                    message="Web 入口服务缺少显式端口",
                )
            )
        if not service.health_path:
            findings.append(
                _finding(
                    attempt_id,
                    digest,
                    f"manifest:health-path:{service.name}",
                    severity="WARNING",
                    category="RUNTIME",
                    message="服务未声明专用健康检查路径",
                )
            )

    if route.route == "COMPOSE_COMPONENTS" and len(draft.manifest.services) < 2:
        findings.append(
            _finding(
                attempt_id,
                digest,
                "architecture:component-boundary-missing",
                severity="BLOCKING",
                category="ARCHITECTURE",
                message="组件组合路线未形成可核对的服务边界",
            )
        )

    return ReviewReport(
        attempt_id=attempt_id,
        requirement_revision=requirement.revision,
        manifest_hash=digest,
        reviewer_kind="DETERMINISTIC",
        findings=findings,
    )
