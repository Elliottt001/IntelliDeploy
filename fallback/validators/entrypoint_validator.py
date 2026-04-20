from __future__ import annotations

import re

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.validation import ValidationCheck, ValidationError


def _extract_referenced_entry(command: str | None) -> str | None:
    if not command:
        return None
    uvicorn_match = re.search(r"uvicorn\s+([a-zA-Z0-9_./-]+):", command)
    if uvicorn_match:
        return f"{uvicorn_match.group(1).replace('.', '/')}.py"
    gunicorn_match = re.search(r"gunicorn\s+([a-zA-Z0-9_./-]+):", command)
    if gunicorn_match:
        return f"{gunicorn_match.group(1).replace('.', '/')}.py"
    python_match = re.search(r"python\s+([^\s]+\.py)", command)
    if python_match:
        return python_match.group(1)
    node_match = re.search(r"node\s+([^\s]+\.js)", command)
    if node_match:
        return node_match.group(1)
    streamlit_match = re.search(r"streamlit\s+run\s+([^\s]+\.py)", command)
    if streamlit_match:
        return streamlit_match.group(1)
    return None


def validate_entrypoint(
    plan: FallbackPlan,
    classify_response: ClassifyResponse | None = None,
) -> tuple[ValidationCheck, list[ValidationError]]:
    if not plan.docker_spec:
        return ValidationCheck(name="entrypoint", passed=True, details="No docker runtime to validate."), []

    referenced_entry = _extract_referenced_entry(plan.docker_spec.start_command)
    if referenced_entry is None:
        return ValidationCheck(name="entrypoint", passed=True, details="No file-based entrypoint to validate."), []

    known_paths = {file.path for file in plan.generated_files}
    if classify_response:
        known_paths.update(classify_response.repo_fact_summary.entry_candidates)

    if referenced_entry not in known_paths:
        return (
            ValidationCheck(name="entrypoint", passed=False, details=f"Missing entrypoint {referenced_entry}."),
            [
                ValidationError(
                    code="ENTRYPOINT_MISSING",
                    message=f"Run command references `{referenced_entry}`, but that file is not present.",
                )
            ],
        )

    return ValidationCheck(name="entrypoint", passed=True, details=f"Validated entrypoint {referenced_entry}."), []

