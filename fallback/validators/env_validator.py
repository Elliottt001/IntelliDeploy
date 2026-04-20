from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.validation import ValidationCheck, ValidationError


def validate_env_vars(
    plan: FallbackPlan,
    classify_response: ClassifyResponse | None = None,
) -> tuple[ValidationCheck, list[ValidationError]]:
    if not plan.env_vars:
        return ValidationCheck(name="env_vars", passed=True, details="No environment variables declared."), []

    detected = set()
    if classify_response:
        detected = set(classify_response.repo_fact_summary.detected_env_vars)

    errors: list[ValidationError] = []
    assumed_count = 0
    for env_var in plan.env_vars:
        if env_var.source == "ASSUMED":
            assumed_count += 1
            continue
        if detected and env_var.name not in detected:
            errors.append(
                ValidationError(
                    code="ENV_VAR_HALLUCINATION",
                    message=f"Environment variable `{env_var.name}` was marked DETECTED but is not in repository evidence.",
                )
            )

    details = f"validated={len(plan.env_vars) - assumed_count}, assumed={assumed_count}"
    return ValidationCheck(name="env_vars", passed=not errors, details=details), errors

