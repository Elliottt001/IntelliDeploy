from __future__ import annotations

from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.solvers.a_direct_deploy.command_resolver import resolve_template_family


def route_scaffold_strategy(request: FallbackRequest, classify_response: ClassifyResponse) -> dict[str, str]:
    feature_count = len(classify_response.user_intent_summary.expected_features)
    target_app_type = classify_response.user_intent_summary.target_app_type
    template_family = resolve_template_family(classify_response)

    complex_target = target_app_type in {"chatbot", "dashboard"} or feature_count >= 3
    strategy = "component_reassembly" if complex_target else "scaffold_generate"
    artifact_type = "STITCHED_PROJECT" if strategy == "component_reassembly" else "TEMPLATE_PROJECT"
    return {
        "strategy": strategy,
        "template_family": template_family,
        "artifact_type": artifact_type,
    }

