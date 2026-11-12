from __future__ import annotations

import math
import re

from app.agent.contracts import RepositoryProfile
from app.core.types import CandidateEvaluation, Requirement


_WEB_TYPES = {
    "web_app",
    "fullstack",
    "frontend_web",
    "backend_api",
    "static_site",
}


def _coverage(profile: RepositoryProfile, requirement: Requirement) -> set[str]:
    evidence = " ".join(item.reference for item in profile.evidence_refs).lower()
    facts = " ".join(
        [
            profile.repo_url,
            profile.project_type,
            *profile.frameworks,
            *profile.identity_features,
            *profile.file_features,
            *profile.ai_features,
            *profile.search_features,
        ]
    ).lower()
    covered = set()
    for item in requirement.acceptance:
        if f"coverage:{item.id.lower()}" in evidence:
            covered.add(item.id)
            continue
        tokens = [
            token
            for token in re.findall(r"[a-z0-9_-]+|[\u4e00-\u9fff]{2,}", f"{item.action} {item.expected}".lower())
            if len(token) > 1
        ]
        if tokens and any(token in facts for token in tokens):
            covered.add(item.id)
    return covered


def rank_candidate(
    profile: RepositoryProfile, requirement: Requirement
) -> CandidateEvaluation:
    acceptance_ids = [item.id for item in requirement.acceptance]
    covered = _coverage(profile, requirement)
    missing = [item_id for item_id in acceptance_ids if item_id not in covered]
    coverage_ratio = len(covered) / max(1, len(acceptance_ids))
    match_score = round(100 * coverage_ratio, 2)
    if not acceptance_ids:
        match_score = 50 if profile.project_type != "unknown" else 0

    deploy_score = 0.0
    if profile.compatibility.status == "SUPPORTED":
        deploy_score += 40
    if profile.entrypoints:
        deploy_score += 20
    if profile.start_commands:
        deploy_score += 20
    if profile.dependency_files and profile.lock_files:
        deploy_score += 10
    if profile.dockerfile_valid or profile.build_commands:
        deploy_score += 10

    quality_score = 40.0
    quality_score += min(20, len(profile.evidence_refs) * 10)
    quality_score += 10 if profile.lock_files else 0
    quality_score += 10 if profile.build_commands else 0
    quality_score -= min(20, len(profile.conflicts) * 10)
    quality_score -= min(20, len(profile.risks) * 5)
    stars = 0
    for evidence in profile.evidence_refs:
        match = re.search(r"stars=(\d+)", evidence.reference)
        if match:
            stars = max(stars, int(match.group(1)))
    quality_score += min(10, math.log10(stars + 1) * 2)
    quality_score = round(max(0, min(100, quality_score)), 2)

    unknown = list(profile.unknowns)
    rejections = []
    if profile.license_status == "UNKNOWN":
        unknown.append("license")
    elif profile.license_status == "BLOCKED":
        rejections.append("license_blocked")
    if profile.compatibility.status == "UNKNOWN":
        unknown.append("runtime_compatibility")
    elif profile.compatibility.status == "UNSUPPORTED":
        rejections.append("runtime_unsupported")
    is_web_app = profile.project_type in _WEB_TYPES
    if not is_web_app:
        rejections.append("not_complete_application")
    if missing:
        rejections.append("missing_core_requirements")
    if not profile.evidence_refs:
        rejections.append("evidence_missing")

    change_cost = min(
        100,
        round(
            (1 - coverage_ratio) * 70
            + len(profile.conflicts) * 10
            + len(profile.risks) * 5
            + len(set(unknown)) * 5,
            2,
        ),
    )
    evidence_confidence = min(
        100,
        round(
            len(profile.evidence_refs) * 20
            + (15 if profile.lock_files else 0)
            + (15 if profile.entrypoints else 0)
            + (15 if profile.start_commands else 0)
            + (15 if profile.compatibility.evidence else 0),
            2,
        ),
    )
    roles = ["complete_application"] if is_web_app and not missing else []
    if profile.project_type in {"library", "backend_api", "frontend_web"}:
        roles.append("component")
    evidence = {
        "match": f"covered={sorted(covered)} missing={missing}",
        "deploy": (
            f"compatibility={profile.compatibility.status} "
            f"entrypoints={len(profile.entrypoints)} start={len(profile.start_commands)}"
        ),
        "quality": (
            f"evidence_refs={len(profile.evidence_refs)} "
            f"conflicts={len(profile.conflicts)} risks={len(profile.risks)}"
        ),
        "change_cost": f"missing={len(missing)} unknown={len(set(unknown))}",
        "evidence_confidence": f"profile_evidence={len(profile.evidence_refs)}",
    }
    return CandidateEvaluation(
        repo_url=profile.repo_url,
        match_score=match_score,
        deploy_score=min(100, deploy_score),
        quality_score=quality_score,
        is_web_app=is_web_app,
        missing_core=missing,
        unknown_fields=sorted(set(unknown)),
        evidence=evidence,
        compatibility=profile.compatibility.status,
        change_cost=change_cost,
        evidence_confidence=evidence_confidence,
        reuse_roles=list(dict.fromkeys(roles)),
        rejection_reasons=list(dict.fromkeys(rejections)),
    )
