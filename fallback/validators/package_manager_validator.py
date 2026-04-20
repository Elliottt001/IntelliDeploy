from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.validation import ValidationCheck, ValidationError


def validate_package_manager(
    plan: FallbackPlan,
    classify_response: ClassifyResponse | None = None,
) -> tuple[ValidationCheck, list[ValidationError]]:
    package_manager = None
    install_command = None
    if plan.docker_spec:
        package_manager = plan.docker_spec.package_manager
        install_command = plan.docker_spec.install_command or ""

    if not package_manager and classify_response:
        package_manager = classify_response.repo_fact_summary.package_manager

    if not package_manager or package_manager == "unknown":
        return ValidationCheck(name="package_manager", passed=True, details="No package manager validation needed."), []

    command_expectations = {
        "npm": ("npm ci", "npm install"),
        "pnpm": ("pnpm install",),
        "yarn": ("yarn install",),
        "pip": ("pip install",),
        "poetry": ("poetry install",),
        "uv": ("uv sync", "uv pip install"),
    }
    valid_fragments = command_expectations.get(package_manager, ())
    if install_command and valid_fragments and not any(fragment in install_command for fragment in valid_fragments):
        return (
            ValidationCheck(name="package_manager", passed=False, details=f"Install command mismatches {package_manager}."),
            [
                ValidationError(
                    code="PACKAGE_MANAGER_MISMATCH",
                    message=f"Install command `{install_command}` does not match package manager `{package_manager}`.",
                )
            ],
        )

    return (
        ValidationCheck(name="package_manager", passed=True, details=f"Validated package manager: {package_manager}."),
        [],
    )

