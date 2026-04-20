from __future__ import annotations

from fallback.schemas.enums import CandidateDecision
from fallback.schemas.score import DecisionSignals


def build_decision_signals(user_intent_summary: dict, repo_fact_summary: dict) -> DecisionSignals:
    signals = DecisionSignals()

    if repo_fact_summary.get("has_real_code"):
        signals.a_signals.append("has_real_code")
    if repo_fact_summary.get("has_dependency_file"):
        signals.a_signals.append("has_dependency_file")
    if repo_fact_summary.get("has_entry_file") or repo_fact_summary.get("has_start_script"):
        signals.a_signals.append("has_runtime_entry")
    if repo_fact_summary.get("has_valid_dockerfile"):
        signals.a_signals.append("has_valid_dockerfile")

    if repo_fact_summary.get("conflict_items"):
        signals.b_signals.append("has_conflicts")
        signals.repair_signals.extend(repo_fact_summary["conflict_items"])
    if repo_fact_summary.get("missing_components"):
        signals.b_signals.append("missing_components")
        signals.repair_signals.extend(repo_fact_summary["missing_components"])
    if any(value in {"false", "unknown"} for value in repo_fact_summary.get("runtime_chain_observations", {}).values() if isinstance(value, str)):
        signals.b_signals.append("runtime_chain_not_closed")

    if repo_fact_summary.get("repo_empty_or_near_empty"):
        signals.c_signals.append("repo_empty_or_near_empty")
    if repo_fact_summary.get("only_docs_or_notes_or_template"):
        signals.c_signals.append("only_docs_or_notes_or_template")
    if repo_fact_summary.get("detected_project_type_by_rule") == "library" and user_intent_summary.get("target_app_type") not in {"unknown", "automation_tool", "mcp"}:
        signals.c_signals.append("library_mismatch")

    if user_intent_summary.get("user_intent_state") == "unclear":
        signals.d_signals.append("user_intent_unclear")
    if repo_fact_summary.get("repo_material_state") in {"partial", "insufficient"}:
        signals.d_signals.append(f"repo_material_{repo_fact_summary['repo_material_state']}")
    if repo_fact_summary.get("uncertain_points"):
        signals.blocking_signals.extend(repo_fact_summary["uncertain_points"])
    if not repo_fact_summary.get("has_dependency_file"):
        signals.missing_information.append("dependency_file_missing")
    if not repo_fact_summary.get("has_entry_file") and not repo_fact_summary.get("has_start_script"):
        signals.missing_information.append("entry_or_start_missing")

    return signals


def _build_evaluation_score(repo_fact_summary: dict) -> int:
    score = 0
    if repo_fact_summary.get("has_real_code"):
        score += 15
    if repo_fact_summary.get("has_dependency_file"):
        score += 12
    if repo_fact_summary.get("has_entry_file") or repo_fact_summary.get("has_start_script"):
        score += 12
    if repo_fact_summary.get("detected_language") != "unknown":
        score += 10
    if repo_fact_summary.get("detected_framework") != "unknown":
        score += 10
    if repo_fact_summary.get("detected_project_type_by_rule") != "unknown" or repo_fact_summary.get("detected_project_type_by_semantics") != "unknown":
        score += 10
    if repo_fact_summary.get("has_valid_dockerfile"):
        score += 12
    elif repo_fact_summary.get("has_dockerfile"):
        score += 6
    if repo_fact_summary.get("target_port_candidates"):
        score += 5
    if repo_fact_summary.get("repo_material_state") == "sufficient":
        score += 8
    elif repo_fact_summary.get("repo_material_state") == "partial":
        score += 4

    score -= min(len(repo_fact_summary.get("conflict_items", [])) * 7, 21)
    score -= min(len(repo_fact_summary.get("risk_items", [])) * 4, 16)
    return max(0, min(score, 100))


def build_candidate_decision(user_intent_summary: dict, repo_fact_summary: dict) -> dict:
    signals = build_decision_signals(user_intent_summary, repo_fact_summary)
    evaluation_score = _build_evaluation_score(repo_fact_summary)

    if user_intent_summary.get("user_intent_state") == "unclear" and repo_fact_summary.get("repo_material_state") in {"partial", "insufficient"}:
        candidate = CandidateDecision.D_CANDIDATE
        reason = "user_intent_unclear_with_incomplete_repo"
    elif any(signal in signals.c_signals for signal in ("repo_empty_or_near_empty", "only_docs_or_notes_or_template", "library_mismatch")):
        candidate = CandidateDecision.C_CANDIDATE
        reason = "repo_unfit_as_primary_base"
    elif (
        repo_fact_summary.get("has_real_code")
        and repo_fact_summary.get("detected_language") != "unknown"
        and (
            repo_fact_summary.get("detected_project_type_by_rule") != "unknown"
            or repo_fact_summary.get("detected_project_type_by_semantics") != "unknown"
        )
        and repo_fact_summary.get("has_dependency_file")
        and (repo_fact_summary.get("has_entry_file") or repo_fact_summary.get("has_start_script"))
        and not repo_fact_summary.get("conflict_items")
        and set(repo_fact_summary.get("missing_items", [])).issubset(
            {"Dockerfile", "docker_compose", "env_example", "deployment_docs", "sealos_config"}
        )
    ):
        candidate = CandidateDecision.A_CANDIDATE
        reason = "repo_appears_deployable_with_packaging_only_gaps"
    elif repo_fact_summary.get("has_real_code"):
        candidate = CandidateDecision.B_CANDIDATE
        reason = "repo_appears_repairable"
    else:
        candidate = CandidateDecision.UNKNOWN
        reason = "insufficient_candidate_signals"

    ai_review_required = should_call_classification_ai(user_intent_summary, repo_fact_summary, candidate.value)
    return {
        "candidate_decision": candidate.value,
        "candidate_reason": reason,
        "decision_signals": signals.model_dump(),
        "evaluation_score": evaluation_score,
        "ai_review_required": ai_review_required,
        "ai_review_reason": [
            "semantic_review_required"
            for condition in [ai_review_required]
            if condition
        ],
    }


def should_call_classification_ai(user_intent_summary: dict, repo_fact_summary: dict, candidate_decision: str) -> bool:
    if repo_fact_summary.get("repo_material_state") == "partial":
        return True
    if user_intent_summary.get("user_intent_state") == "partially_clear" and not repo_fact_summary.get("repo_empty_or_near_empty"):
        return True
    if candidate_decision in {
        CandidateDecision.A_CANDIDATE.value,
        CandidateDecision.B_CANDIDATE.value,
        CandidateDecision.C_CANDIDATE.value,
        CandidateDecision.D_CANDIDATE.value,
        CandidateDecision.UNKNOWN.value,
    }:
        return True
    if repo_fact_summary.get("detected_project_type_by_rule") == "unknown":
        return True
    if repo_fact_summary.get("detected_framework") == "unknown" and repo_fact_summary.get("has_real_code"):
        return True
    if repo_fact_summary.get("uncertain_points") or repo_fact_summary.get("conflict_items"):
        return True
    runtime_observations = repo_fact_summary.get("runtime_chain_observations", {})
    if any(value in {"unknown", "false"} for value in runtime_observations.values() if isinstance(value, str)):
        return True
    return False
