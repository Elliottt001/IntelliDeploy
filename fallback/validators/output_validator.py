from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.validation import ValidationCheck, ValidationError


def validate_output_plan(plan: FallbackPlan) -> tuple[ValidationCheck, list[ValidationError]]:
    errors: list[ValidationError] = []
    allowed_artifact_types = {"TEMPLATE_PROJECT", "STITCHED_PROJECT"}

    generated_paths = [file.path for file in plan.generated_files]
    modified_paths = [file.path for file in plan.modified_files]
    duplicate_paths = {path for path in generated_paths + modified_paths if (generated_paths + modified_paths).count(path) > 1}
    if duplicate_paths:
        errors.append(
            ValidationError(
                code="DUPLICATE_OUTPUT_PATH",
                message=f"Duplicate output paths detected: {sorted(duplicate_paths)}",
            )
        )

    if plan.decision != "D" and not plan.docker_spec:
        errors.append(
            ValidationError(
                code="DOCKER_SPEC_MISSING",
                message="Non-manual fallback plan must include docker_spec.",
            )
        )

    if plan.decision == "D" and not plan.missing_information:
        errors.append(
            ValidationError(
                code="MISSING_INFORMATION_EMPTY",
                message="Manual-required plan must explain what information is missing.",
            )
        )
    if plan.decision == "D" and (plan.generated_files or plan.modified_files or plan.artifact_type):
        errors.append(
            ValidationError(
                code="MANUAL_PLAN_HAS_ARTIFACT_OUTPUT",
                message="Manual-required plan must not declare artifact outputs.",
            )
        )

    if plan.docker_spec:
        if not plan.docker_spec.start_command:
            errors.append(ValidationError(code="START_COMMAND_EMPTY", message="docker_spec.start_command is required."))
        if plan.docker_spec.exposed_port <= 0:
            errors.append(ValidationError(code="PORT_INVALID", message="docker_spec.exposed_port must be positive."))
    if plan.decision in {"A", "B", "C"} and plan.artifact_type not in allowed_artifact_types:
        errors.append(
            ValidationError(
                code="ARTIFACT_TYPE_INVALID",
                message=f"artifact_type must be one of {sorted(allowed_artifact_types)} for deployable plans.",
            )
        )

    return ValidationCheck(name="output_plan", passed=not errors, details=f"errors={len(errors)}"), errors

