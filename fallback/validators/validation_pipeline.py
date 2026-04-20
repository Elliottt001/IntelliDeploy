from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.validation import ValidationCheck, ValidationError, ValidationResult
from fallback.schemas.workspace import WorkspaceContext

from .dockerfile_validator import validate_dockerfile
from .entrypoint_validator import validate_entrypoint
from .env_validator import validate_env_vars
from .output_validator import validate_output_plan
from .package_manager_validator import validate_package_manager
from .port_validator import validate_port_alignment
from .workspace_validator import validate_workspace


def validate_fallback_plan(
    plan: FallbackPlan,
    *,
    workspace_context: WorkspaceContext | None = None,
    classify_response: ClassifyResponse | None = None,
) -> ValidationResult:
    checks: list[ValidationCheck] = []
    errors: list[ValidationError] = []

    output_check, output_errors = validate_output_plan(plan)
    checks.append(output_check)
    errors.extend(output_errors)

    package_check, package_errors = validate_package_manager(plan, classify_response)
    checks.append(package_check)
    errors.extend(package_errors)

    env_check, env_errors = validate_env_vars(plan, classify_response)
    checks.append(env_check)
    errors.extend(env_errors)

    port_check, port_errors = validate_port_alignment(plan, classify_response)
    checks.append(port_check)
    errors.extend(port_errors)

    entrypoint_check, entrypoint_errors = validate_entrypoint(plan, classify_response)
    checks.append(entrypoint_check)
    errors.extend(entrypoint_errors)

    if plan.docker_spec:
        docker_report = validate_dockerfile(plan.docker_spec.dockerfile_content)
        checks.append(
            ValidationCheck(
                name="dockerfile",
                passed=docker_report["is_valid"],
                details="; ".join(docker_report["warnings"] or ["dockerfile validated"]),
            )
        )
        errors.extend(
            ValidationError(code="DOCKERFILE_INVALID", message=issue)
            for issue in docker_report["errors"]
        )

    if workspace_context and plan.decision in {"A", "B", "C"}:
        workspace_result = validate_workspace(
            workspace_context=workspace_context,
            plan=plan,
            classify_response=classify_response,
        )
        checks.extend(workspace_result.checks)
        errors.extend(workspace_result.errors)

    blocking_error_count = sum(1 for error in errors if error.severity == "blocking")
    warning_count = sum(1 for error in errors if error.severity == "warning")
    failed_warning_checks = sum(1 for check in checks if not check.passed and check.severity == "warning")
    warning_count += failed_warning_checks
    final_status = "FAIL" if blocking_error_count else ("WARN" if warning_count else "PASS")
    passed = blocking_error_count == 0 and all(check.passed or check.severity == "warning" for check in checks)

    if final_status == "FAIL":
        summary = f"Validation failed with {blocking_error_count} blocking error(s)."
    elif final_status == "WARN":
        summary = f"Validation passed with {warning_count} warning(s)."
    else:
        summary = "Validation passed."

    error_context = {"decision": plan.decision}
    if workspace_context:
        error_context["workspace_path"] = str(workspace_context.paths.workspace_path)

    return ValidationResult(
        passed=passed,
        checks=checks,
        errors=errors,
        final_status=final_status,
        blocking_error_count=blocking_error_count,
        warning_count=warning_count,
        summary=summary,
        error_context=error_context,
    )

