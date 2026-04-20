from __future__ import annotations

from typing import Any, Callable

from fallback.classifier.extract_facts import extract_repository_facts
from fallback.classifier.rules import apply_final_rules, apply_hard_rules
from fallback.classifier.scoring import build_candidate_decision
from fallback.schemas.enums import CandidateDecision, Decision, GenerationMode, TriggerReason
from fallback.schemas.request import FallbackRequest, UserIntentSummary
from fallback.schemas.repo import RepoFactSummary
from fallback.schemas.response import ClassifyResponse, EvaluationResult
from fallback.services.prompt_loader import load_prompt


def _matches_user_intent(user_intent_summary: dict, repo_fact_summary: dict) -> bool:
    target = user_intent_summary.get("target_app_type", "unknown")
    project_type = repo_fact_summary.get("detected_project_type_by_semantics") or repo_fact_summary.get("detected_project_type_by_rule")
    compatibility = {
        "backend_api": {"backend_api", "fullstack"},
        "frontend_web": {"frontend_web", "fullstack", "static_site"},
        "chatbot": {"backend_api", "frontend_web", "fullstack", "ml_service"},
        "dashboard": {"frontend_web", "fullstack"},
        "static_site": {"static_site", "frontend_web"},
        "automation_tool": {"backend_api", "cli_tool", "automation_tool"},
        "unknown": {"backend_api", "frontend_web", "fullstack", "static_site", "automation_tool", "mcp", "ml_service", "cli_tool", "library", "unknown"},
    }
    return project_type in compatibility.get(target, {project_type})


def _runtime_chain_closed(repo_fact_summary: dict) -> str:
    observations = repo_fact_summary.get("runtime_chain_observations", {})
    critical = [
        observations.get("start_script_points_to_existing_entry"),
        observations.get("entry_contains_runnable_object"),
        observations.get("dependencies_cover_detected_framework"),
        observations.get("port_detected"),
    ]
    critical = [value for value in critical if value is not None]
    if critical and all(value == "true" for value in critical):
        return "true"
    if any(value == "false" for value in critical):
        return "false"
    return "unknown"


def _heuristic_ai_review(user_intent_summary: dict, repo_fact_summary: dict, scoring_result: dict) -> dict:
    candidate_decision = scoring_result.get("candidate_decision", CandidateDecision.UNKNOWN.value)
    missing_information = list(scoring_result.get("decision_signals", {}).get("missing_information", []))
    missing_information.extend(
        point for point in repo_fact_summary.get("uncertain_points", []) if point not in missing_information
    )

    uses_original_repo_as_base = None
    if repo_fact_summary.get("has_real_code"):
        uses_original_repo_as_base = candidate_decision != CandidateDecision.C_CANDIDATE.value
    elif candidate_decision in {CandidateDecision.C_CANDIDATE.value, CandidateDecision.D_CANDIDATE.value}:
        uses_original_repo_as_base = False

    requires_repo_code_modification = None
    if candidate_decision == CandidateDecision.A_CANDIDATE.value:
        requires_repo_code_modification = False
    elif candidate_decision in {CandidateDecision.B_CANDIDATE.value, CandidateDecision.C_CANDIDATE.value}:
        requires_repo_code_modification = True

    repair_scope_limited = candidate_decision == CandidateDecision.B_CANDIDATE.value and len(
        repo_fact_summary.get("missing_components", [])
    ) <= 5
    repair_cost_close_to_rewrite = candidate_decision == CandidateDecision.C_CANDIDATE.value or repo_fact_summary.get(
        "repo_empty_or_near_empty"
    )

    return {
        "user_intent_clear": user_intent_summary.get("user_intent_state") != "unclear",
        "repo_purpose": repo_fact_summary.get("readme_summary") or repo_fact_summary.get("detected_project_type_by_rule", "unknown"),
        "repo_purpose_unknown": repo_fact_summary.get("detected_project_type_by_rule") == "unknown"
        and repo_fact_summary.get("detected_project_type_by_semantics") == "unknown",
        "repo_matches_user_intent": _matches_user_intent(user_intent_summary, repo_fact_summary),
        "uses_original_repo_as_base": uses_original_repo_as_base,
        "runtime_chain_closed": _runtime_chain_closed(repo_fact_summary),
        "requires_repo_code_modification": requires_repo_code_modification,
        "repair_scope_limited": repair_scope_limited,
        "repair_cost_close_to_rewrite": repair_cost_close_to_rewrite,
        "recommended_repair_targets": repo_fact_summary.get("missing_components", []),
        "missing_information": sorted(dict.fromkeys(missing_information)),
        "warnings": repo_fact_summary.get("warnings", []),
        "reasoning_summary": scoring_result.get("candidate_reason", "heuristic_review"),
        "confidence": 0.55,
    }


def call_classification_ai_if_needed(
    user_intent_summary: dict,
    repo_fact_summary: dict,
    scoring_result: dict,
    *,
    classification_ai: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
) -> dict:
    heuristic = _heuristic_ai_review(user_intent_summary, repo_fact_summary, scoring_result)
    if not scoring_result.get("ai_review_required"):
        return heuristic

    if classification_ai is None:
        return heuristic

    ai_output = classification_ai(
        {
            "prompt": load_prompt("classify.md"),
            "user_intent_summary": user_intent_summary,
            "repo_fact_summary": repo_fact_summary,
            "candidate_decision": scoring_result.get("candidate_decision"),
            "decision_signals": scoring_result.get("decision_signals", {}),
        }
    )
    merged = dict(heuristic)
    merged.update({key: value for key, value in ai_output.items() if value is not None})
    merged["warnings"] = sorted(dict.fromkeys(heuristic.get("warnings", []) + ai_output.get("warnings", [])))
    merged["missing_information"] = sorted(
        dict.fromkeys(heuristic.get("missing_information", []) + ai_output.get("missing_information", []))
    )
    return merged


def build_evaluation_result(
    *,
    scoring_result: dict | None,
    final_rule_result: dict,
    hard_rule_triggered: bool = False,
) -> EvaluationResult:
    candidate_decision = CandidateDecision.UNKNOWN.value
    evaluation_score = None
    candidate_reason = "unknown"
    if scoring_result:
        candidate_decision = scoring_result.get("candidate_decision", candidate_decision)
        evaluation_score = scoring_result.get("evaluation_score")
        candidate_reason = scoring_result.get("candidate_reason", candidate_reason)

    if hard_rule_triggered and final_rule_result["decision"] == Decision.C.value:
        candidate_decision = CandidateDecision.C_CANDIDATE.value
        evaluation_score = None
    if hard_rule_triggered and final_rule_result["decision"] == Decision.D.value:
        candidate_decision = CandidateDecision.D_CANDIDATE.value
        evaluation_score = None

    reason = final_rule_result.get("reason") or candidate_reason or "unknown"

    return EvaluationResult(
        candidate_decision=candidate_decision,
        evaluation_score=evaluation_score,
        decision=final_rule_result["decision"],
        reason=reason,
        why_not_A=final_rule_result.get("why_not_A", []),
        repair_targets=final_rule_result.get("repair_targets", []),
        missing_information=final_rule_result.get("missing_information", []),
        requires_user_confirmation=final_rule_result.get("requires_user_confirmation", False),
    )


def _decide_generation_mode(user_intent_summary: dict, repo_fact_summary: dict) -> str:
    if repo_fact_summary.get("repo_empty_or_near_empty") or repo_fact_summary.get("only_docs_or_notes_or_template") or not repo_fact_summary.get("has_real_code"):
        return GenerationMode.VIBE.value
    if repo_fact_summary.get("has_real_code") and any(
        repo_fact_summary.get(key) for key in ("dependency_files", "config_files", "entry_candidates", "detected_frameworks")
    ):
        return GenerationMode.COMPONENT_REASSEMBLY.value
    return GenerationMode.AUTO.value


def build_hu_generation_request(
    request: FallbackRequest,
    user_intent_summary: UserIntentSummary,
    repo_fact_summary: RepoFactSummary,
    evaluation_result: EvaluationResult,
) -> dict:
    if not request.project_id or not request.deployment_id:
        raise ValueError("project_id and deployment_id are required to build hu_generation_request")

    if request.force_fallback:
        trigger_reason = TriggerReason.FORCE_FALLBACK.value
    elif request.repair_exhausted:
        trigger_reason = TriggerReason.REPAIR_EXHAUSTED.value
    else:
        trigger_reason = TriggerReason.LOW_SCORE_ALL.value

    return {
        "project_id": request.project_id,
        "deployment_id": request.deployment_id,
        "request_id": request.request_id,
        "trigger_reason": trigger_reason,
        "original_prompt": request.raw_query,
        "generation_mode": _decide_generation_mode(user_intent_summary.model_dump(mode="json"), repo_fact_summary.model_dump(mode="json")),
        "evaluation_score": evaluation_result.evaluation_score,
        "missing_components": list(repo_fact_summary.missing_components),
        "preferred_stack": dict(repo_fact_summary.preferred_stack),
        "repo_profile": {
            "source_repo_url": repo_fact_summary.repo_url,
            "detected_languages": list(repo_fact_summary.detected_languages),
            "detected_frameworks": list(repo_fact_summary.detected_frameworks),
            "package_manager": repo_fact_summary.package_manager,
            "entrypoints": list(repo_fact_summary.entry_candidates),
            "dependency_files": list(repo_fact_summary.dependency_files),
            "has_valid_dockerfile": repo_fact_summary.has_valid_dockerfile,
            "readme_summary": repo_fact_summary.readme_summary,
        },
        "constraints": {
            "timeout_seconds": user_intent_summary.constraints.get("timeout_seconds"),
            "target_port": repo_fact_summary.target_port_candidates[0] if repo_fact_summary.target_port_candidates else None,
            "must_provide_dockerfile": True,
            "must_provide_healthcheck": True,
        },
    }


def classify_fallback_request(
    payload: FallbackRequest | dict[str, Any],
    *,
    extraction_ai: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
    classification_ai: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
) -> ClassifyResponse:
    request = payload if isinstance(payload, FallbackRequest) else FallbackRequest.model_validate(payload)

    extraction = extract_repository_facts(request, extraction_ai=extraction_ai)
    user_intent_summary = UserIntentSummary.model_validate(extraction.user_intent_summary)
    repo_fact_summary = extraction.repo_fact_summary

    hard_rule_result = apply_hard_rules(
        user_intent_summary.model_dump(mode="json"),
        repo_fact_summary.model_dump(mode="json"),
    )
    if hard_rule_result:
        evaluation_result = build_evaluation_result(
            scoring_result=None,
            final_rule_result=hard_rule_result,
            hard_rule_triggered=True,
        )
        hu_generation_request = (
            build_hu_generation_request(request, user_intent_summary, repo_fact_summary, evaluation_result)
            if evaluation_result.decision == Decision.C.value
            else None
        )
        return ClassifyResponse(
            user_intent_summary=user_intent_summary,
            repo_fact_summary=repo_fact_summary,
            evaluation_result=evaluation_result,
            hu_generation_request=hu_generation_request,
        )

    scoring_result = build_candidate_decision(
        user_intent_summary.model_dump(mode="json"),
        repo_fact_summary.model_dump(mode="json"),
    )
    ai_review = call_classification_ai_if_needed(
        user_intent_summary.model_dump(mode="json"),
        repo_fact_summary.model_dump(mode="json"),
        scoring_result,
        classification_ai=classification_ai,
    )
    final_rule_result = apply_final_rules(
        user_intent_summary.model_dump(mode="json"),
        repo_fact_summary.model_dump(mode="json"),
        scoring_result["candidate_decision"],
        ai_review,
    )
    evaluation_result = build_evaluation_result(scoring_result=scoring_result, final_rule_result=final_rule_result)

    hu_generation_request = None
    if evaluation_result.decision == Decision.C.value:
        hu_generation_request = build_hu_generation_request(request, user_intent_summary, repo_fact_summary, evaluation_result)
    elif evaluation_result.decision == Decision.B.value and (request.force_fallback or request.repair_exhausted):
        hu_generation_request = build_hu_generation_request(request, user_intent_summary, repo_fact_summary, evaluation_result)

    return ClassifyResponse(
        user_intent_summary=user_intent_summary,
        repo_fact_summary=repo_fact_summary,
        evaluation_result=evaluation_result,
        hu_generation_request=hu_generation_request,
    )
