from __future__ import annotations

from pathlib import Path

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.validation import ValidationCheck, ValidationError, ValidationResult
from fallback.schemas.workspace import WorkspaceContext


def _file_exists(root: Path, relative_path: str) -> bool:
    return (root / relative_path).exists()


def validate_workspace(
    *,
    workspace_context: WorkspaceContext,
    plan: FallbackPlan,
    classify_response: ClassifyResponse | None = None,
) -> ValidationResult:
    workspace_path = workspace_context.paths.workspace_path
    checks: list[ValidationCheck] = []
    errors: list[ValidationError] = []

    for generated in plan.generated_files:
        path_exists = _file_exists(workspace_path, generated.path)
        checks.append(
            ValidationCheck(
                name="workspace_generated_file",
                passed=path_exists,
                severity="blocking" if not path_exists else "info",
                details=f"generated file {generated.path}",
                file_path=generated.path,
                code="WORKSPACE_FILE_PRESENT" if path_exists else "WORKSPACE_FILE_MISSING",
            )
        )
        if not path_exists:
            errors.append(
                ValidationError(
                    code="WORKSPACE_FILE_MISSING",
                    message=f"Generated file `{generated.path}` is missing from the materialized workspace.",
                    file_path=generated.path,
                    severity="blocking",
                )
            )

    for modified in plan.modified_files:
        path_exists = _file_exists(workspace_path, modified.path)
        checks.append(
            ValidationCheck(
                name="workspace_modified_file",
                passed=path_exists,
                severity="blocking" if not path_exists else "info",
                details=f"modified file {modified.path}",
                file_path=modified.path,
                code="WORKSPACE_PATCH_TARGET_PRESENT" if path_exists else "WORKSPACE_PATCH_TARGET_MISSING",
            )
        )
        if not path_exists:
            errors.append(
                ValidationError(
                    code="WORKSPACE_PATCH_TARGET_MISSING",
                    message=f"Modified file target `{modified.path}` is missing from the materialized workspace.",
                    file_path=modified.path,
                    severity="blocking",
                )
            )

    if plan.docker_spec:
        dockerfile_exists = _file_exists(workspace_path, "Dockerfile")
        checks.append(
            ValidationCheck(
                name="workspace_dockerfile",
                passed=dockerfile_exists,
                severity="blocking" if not dockerfile_exists else "info",
                details="Dockerfile presence in workspace",
                file_path="Dockerfile",
                code="DOCKERFILE_PRESENT" if dockerfile_exists else "DOCKERFILE_MISSING",
            )
        )
        if not dockerfile_exists:
            errors.append(
                ValidationError(
                    code="DOCKERFILE_MISSING",
                    message="Dockerfile declared by plan is missing from workspace.",
                    file_path="Dockerfile",
                    severity="blocking",
                )
            )

    env_example_expected = bool(plan.env_vars)
    env_example_exists = _file_exists(workspace_path, ".env.example")
    checks.append(
        ValidationCheck(
            name="workspace_env_example",
            passed=(not env_example_expected) or env_example_exists,
            severity="warning" if env_example_expected and not env_example_exists else "info",
            details=".env.example presence for declared env vars",
            file_path=".env.example" if env_example_expected else None,
            code="ENV_EXAMPLE_PRESENT" if env_example_exists else "ENV_EXAMPLE_MISSING",
        )
    )
    if env_example_expected and not env_example_exists:
        errors.append(
            ValidationError(
                code="ENV_EXAMPLE_MISSING",
                message="Workspace is missing `.env.example` for declared environment variables.",
                file_path=".env.example",
                severity="warning",
            )
        )

    if plan.docker_spec and plan.docker_spec.healthcheck_path:
        checks.append(
            ValidationCheck(
                name="workspace_healthcheck",
                passed=True,
                severity="info",
                details=f"healthcheck path declared: {plan.docker_spec.healthcheck_path}",
                code="HEALTHCHECK_DECLARED",
            )
        )

    blocking_error_count = sum(1 for error in errors if error.severity == "blocking")
    warning_count = sum(1 for error in errors if error.severity == "warning")
    final_status = "FAIL" if blocking_error_count else ("WARN" if warning_count else "PASS")
    passed = blocking_error_count == 0
    summary = (
        "Workspace validation failed."
        if final_status == "FAIL"
        else "Workspace validation produced warnings."
        if final_status == "WARN"
        else "Workspace validation passed."
    )
    return ValidationResult(
        passed=passed,
        checks=checks,
        errors=errors,
        final_status=final_status,
        blocking_error_count=blocking_error_count,
        warning_count=warning_count,
        summary=summary,
        error_context={"workspace_path": str(workspace_path)},
    )
