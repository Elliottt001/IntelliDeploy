from __future__ import annotations

from fallback.schemas.enums import Decision


def _result(
    decision: str,
    reason: str,
    *,
    why_not_a: list[str] | None = None,
    repair_targets: list[str] | None = None,
    missing_information: list[str] | None = None,
    requires_user_confirmation: bool = False,
) -> dict:
    return {
        "decision": decision,
        "reason": reason,
        "why_not_A": why_not_a or [],
        "repair_targets": repair_targets or [],
        "missing_information": missing_information or [],
        "requires_user_confirmation": requires_user_confirmation,
    }


def apply_hard_rules(user_intent_summary: dict, repo_fact_summary: dict) -> dict | None:
    if user_intent_summary.get("user_intent_state") == "unclear" and repo_fact_summary.get("repo_material_state") == "insufficient":
        return _result(
            Decision.D.value,
            "user_intent_unclear_and_repo_material_insufficient",
            missing_information=["user_intent_clarification_required", "repository_material_insufficient"],
        )

    if (
        user_intent_summary.get("user_intent_state") in {"clear", "partially_clear"}
        and repo_fact_summary.get("repo_material_state") == "insufficient"
        and not repo_fact_summary.get("has_real_code")
    ):
        return _result(
            Decision.C.value,
            "user_intent_clear_but_repo_lacks_usable_code",
            why_not_a=["repository_has_no_real_code"],
        )

    return None


def apply_final_rules(
    user_intent_summary: dict,
    repo_fact_summary: dict,
    candidate_decision: str,
    ai_review: dict,
) -> dict:
    user_intent_clear = ai_review.get("user_intent_clear", user_intent_summary.get("user_intent_state") != "unclear")
    repo_purpose_unknown = ai_review.get("repo_purpose_unknown", False)
    uses_original_repo_as_base = ai_review.get("uses_original_repo_as_base")
    runtime_chain_closed = ai_review.get("runtime_chain_closed", "unknown")
    requires_repo_code_modification = ai_review.get("requires_repo_code_modification")
    repo_matches_user_intent = ai_review.get("repo_matches_user_intent", False)
    repair_scope_limited = ai_review.get("repair_scope_limited", False)
    repair_cost_close_to_rewrite = ai_review.get("repair_cost_close_to_rewrite", False)
    missing_information = ai_review.get("missing_information", [])

    why_not_a: list[str] = []
    if not uses_original_repo_as_base:
        why_not_a.append("cannot_keep_original_repo_as_primary_base")
    if not repo_matches_user_intent:
        why_not_a.append("repo_does_not_match_user_intent")
    if runtime_chain_closed != "true":
        why_not_a.append("runtime_chain_not_closed")
    if requires_repo_code_modification is not False:
        why_not_a.append("repo_requires_code_modification")

    if not user_intent_clear and repo_purpose_unknown:
        return _result(
            Decision.D.value,
            "user_intent_or_repo_purpose_unclear",
            why_not_a=why_not_a,
            missing_information=missing_information or ["repo_purpose_unknown"],
        )

    if uses_original_repo_as_base is None:
        return _result(
            Decision.D.value,
            "cannot_determine_if_original_repo_can_be_primary_base",
            why_not_a=why_not_a,
            missing_information=missing_information or ["uses_original_repo_as_base_unknown"],
        )

    if runtime_chain_closed == "unknown" and requires_repo_code_modification is None:
        return _result(
            Decision.D.value,
            "runtime_or_modification_need_unknown",
            why_not_a=why_not_a,
            missing_information=missing_information or ["runtime_chain_closed_unknown", "requires_repo_code_modification_unknown"],
        )

    if missing_information:
        return _result(
            Decision.D.value,
            "missing_information_blocks_reliable_decision",
            why_not_a=why_not_a,
            missing_information=missing_information,
        )

    if not uses_original_repo_as_base and user_intent_clear:
        return _result(
            Decision.C.value,
            "original_repo_should_not_be_kept_as_primary_base",
            why_not_a=why_not_a,
        )

    if not repo_matches_user_intent and user_intent_clear:
        return _result(
            Decision.C.value,
            "repo_severely_mismatches_user_intent",
            why_not_a=why_not_a,
        )

    if uses_original_repo_as_base and requires_repo_code_modification and repair_cost_close_to_rewrite and user_intent_clear:
        return _result(
            Decision.C.value,
            "repair_cost_close_to_rewrite",
            why_not_a=why_not_a,
        )

    if uses_original_repo_as_base and repo_matches_user_intent and runtime_chain_closed == "true" and requires_repo_code_modification is False:
        return _result(Decision.A.value, "repo_can_be_deployed_with_packaging_only", why_not_a=[])

    if uses_original_repo_as_base and repo_matches_user_intent and requires_repo_code_modification and repair_scope_limited:
        return _result(
            Decision.B.value,
            "repo_can_be_repaired_without_rewrite",
            why_not_a=why_not_a,
            repair_targets=ai_review.get("recommended_repair_targets", []),
        )

    if candidate_decision == "C_candidate":
        return _result(Decision.C.value, "candidate_decision_prefers_regeneration", why_not_a=why_not_a)
    if candidate_decision == "B_candidate":
        return _result(
            Decision.B.value,
            "candidate_decision_prefers_repair",
            why_not_a=why_not_a,
            repair_targets=ai_review.get("recommended_repair_targets", []),
        )
    if candidate_decision == "A_candidate":
        return _result(Decision.A.value, "candidate_decision_prefers_direct_deploy", why_not_a=[])

    return _result(
        Decision.D.value,
        "decision_not_stable_after_review",
        why_not_a=why_not_a,
        missing_information=missing_information or ["decision_not_stable"],
    )
