from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.validation import ValidationResult
from fallback.validators.validation_pipeline import validate_fallback_plan

from .patch_generate import generate_patch_plan


def run_repair_loop(
    request: FallbackRequest,
    classify_response: ClassifyResponse,
    *,
    missing_components: list[str],
    max_retries: int = 3,
) -> tuple[FallbackPlan, ValidationResult, bool]:
    last_plan: FallbackPlan | None = None
    last_validation: ValidationResult | None = None

    for _ in range(max_retries):
        last_plan = generate_patch_plan(request, classify_response, missing_components)
        last_validation = validate_fallback_plan(last_plan, classify_response=classify_response)
        if last_validation.passed:
            return last_plan, last_validation, False

    assert last_plan is not None and last_validation is not None
    last_plan.warnings.append("Repair retries exhausted; manual review or regeneration is recommended.")
    last_plan.deploy_ready = False
    last_plan.next_action = "MANUAL_REVIEW"
    return last_plan, last_validation, True

