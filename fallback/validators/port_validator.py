from __future__ import annotations

import re

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.validation import ValidationCheck, ValidationError


_PORT_RE = re.compile(r"(?:--port|-p|\bPORT=)\s*=?\s*(\d{2,5})")


def _extract_port_from_command(command: str | None) -> int | None:
    if not command:
        return None
    match = _PORT_RE.search(command)
    return int(match.group(1)) if match else None


def validate_port_alignment(
    plan: FallbackPlan,
    classify_response: ClassifyResponse | None = None,
) -> tuple[ValidationCheck, list[ValidationError]]:
    if not plan.docker_spec:
        return ValidationCheck(name="port_alignment", passed=True, details="No docker runtime to validate."), []

    docker_port = plan.docker_spec.exposed_port
    command_port = _extract_port_from_command(plan.docker_spec.start_command)
    target_port = None
    if classify_response and classify_response.repo_fact_summary.target_port_candidates:
        target_port = classify_response.repo_fact_summary.target_port_candidates[0]

    errors: list[ValidationError] = []
    if command_port and command_port != docker_port:
        errors.append(
            ValidationError(
                code="PORT_MISMATCH",
                message=f"Start command port `{command_port}` does not match Docker EXPOSE `{docker_port}`.",
            )
        )
    if target_port and target_port != docker_port:
        errors.append(
            ValidationError(
                code="TARGET_PORT_MISMATCH",
                message=f"Target port `{target_port}` does not match Docker EXPOSE `{docker_port}`.",
            )
        )

    return ValidationCheck(name="port_alignment", passed=not errors, details=f"docker_port={docker_port}"), errors

