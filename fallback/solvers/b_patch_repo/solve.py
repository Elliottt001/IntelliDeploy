from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.services.config import get_config

from .missing_component import collect_missing_components
from .repair_loop import run_repair_loop


def solve_patch_repo(request: FallbackRequest, classify_response: ClassifyResponse) -> FallbackPlan:
    missing_components = collect_missing_components(classify_response)
    config = get_config()
    plan, validation, exhausted = run_repair_loop(
        request,
        classify_response,
        missing_components=missing_components,
        max_retries=config.max_repair_retries,
    )
    if exhausted and not plan.summary:
        plan.summary = "Repository remains repairable in principle, but the automatic patch loop did not converge."
    if not validation.passed:
        plan.deploy_ready = False
        plan.next_action = "MANUAL_REVIEW"
    return plan

