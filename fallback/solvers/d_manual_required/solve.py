from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse

from .missing_info_builder import build_missing_information


def solve_manual_required(request: FallbackRequest, classify_response: ClassifyResponse) -> FallbackPlan:
    missing_information = build_missing_information(request, classify_response)
    return FallbackPlan(
        decision="D",
        generated_files=[],
        modified_files=[],
        docker_spec=None,
        env_vars=[],
        warnings=["Fallback generation skipped because the current evidence is not sufficient."],
        summary="Need additional user or repository information before generation can proceed reliably.",
        deploy_ready=False,
        next_action="MANUAL_REVIEW",
        missing_information=missing_information,
        source_repo_url=classify_response.repo_fact_summary.repo_url,
    )

