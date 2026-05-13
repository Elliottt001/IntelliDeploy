from __future__ import annotations

import re

from fallback.validators.dockerfile_validator import validate_dockerfile

from .command_resolver import resolve_container_port, resolve_start_command
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse


DEV_COMMAND_MARKERS = (
    "npm run dev",
    "yarn dev",
    "pnpm dev",
    "vite --host",
    "vite",
    "next dev",
    "flask run --debug",
    "uvicorn --reload",
    "--reload",
)


def lint_existing_dockerfile_for_cloud(
    dockerfile_content: str,
    request: FallbackRequest,
    classify_response: ClassifyResponse,
) -> tuple[str, dict, list[str]]:
    """Normalize reusable Dockerfiles for cloud-native production deployment.

    This is a deterministic guardrail in front of the optional LLM review layer:
    it fixes the common hazards called out in the algorithm doc without relying
    on a model call for things code can decide safely.
    """
    warnings: list[str] = []
    lines = dockerfile_content.splitlines()
    port = resolve_container_port(request, classify_response)
    start_command = resolve_start_command(request, classify_response, port=port)
    port = _port_from_command(start_command) or port
    normalized_lines = _ensure_workdir(lines, warnings)
    normalized_lines = _ensure_expose(normalized_lines, port, warnings)
    normalized_lines = _normalize_command(normalized_lines, start_command, warnings)
    normalized = "\n".join(normalized_lines).strip() + "\n"

    report = validate_dockerfile(
        normalized,
        expected_language=classify_response.repo_fact_summary.detected_language,
        entry_candidates=classify_response.repo_fact_summary.entry_candidates,
    )
    if report["warnings"]:
        warnings.extend(f"dockerfile_lint:{item}" for item in report["warnings"])
    return normalized, report, sorted(dict.fromkeys(warnings))


def _ensure_workdir(lines: list[str], warnings: list[str]) -> list[str]:
    if any(line.strip().upper().startswith("WORKDIR ") for line in lines):
        return lines
    output: list[str] = []
    inserted = False
    for line in lines:
        output.append(line)
        if not inserted and line.strip().upper().startswith("FROM "):
            output.append("WORKDIR /app")
            inserted = True
            warnings.append("inserted_workdir")
    return output or ["WORKDIR /app"]


def _ensure_expose(lines: list[str], port: int, warnings: list[str]) -> list[str]:
    output: list[str] = []
    found = False
    for line in lines:
        if line.strip().upper().startswith("EXPOSE "):
            found = True
            existing = _first_port(line)
            if existing != port:
                output.append(f"EXPOSE {port}")
                warnings.append(f"normalized_expose_{existing or 'unknown'}_to_{port}")
            else:
                output.append(line)
            continue
        output.append(line)

    if not found:
        insert_at = _command_index(output)
        output.insert(insert_at, f"EXPOSE {port}")
        warnings.append("inserted_expose")
    return output


def _normalize_command(lines: list[str], start_command: str, warnings: list[str]) -> list[str]:
    output: list[str] = []
    replaced = False
    for line in lines:
        stripped = line.strip()
        if stripped.upper().startswith(("CMD ", "ENTRYPOINT ")):
            command_body = stripped.split(maxsplit=1)[1] if " " in stripped else ""
            if _looks_like_dev_command(command_body) or not _binds_to_all_interfaces(command_body):
                output.append(f"CMD {start_command}")
                replaced = True
                warnings.append("normalized_start_command_for_production")
            else:
                output.append(line)
            continue
        output.append(line)

    if not any(line.strip().upper().startswith(("CMD ", "ENTRYPOINT ")) for line in output):
        output.append(f"CMD {start_command}")
        warnings.append("inserted_start_command")
    elif replaced:
        output = _drop_duplicate_entrypoints(output)
    return output


def _drop_duplicate_entrypoints(lines: list[str]) -> list[str]:
    seen_command = False
    output: list[str] = []
    for line in reversed(lines):
        if line.strip().upper().startswith(("CMD ", "ENTRYPOINT ")):
            if seen_command:
                continue
            seen_command = True
        output.append(line)
    return list(reversed(output))


def _looks_like_dev_command(command_body: str) -> bool:
    lowered = command_body.lower()
    return any(marker in lowered for marker in DEV_COMMAND_MARKERS)


def _binds_to_all_interfaces(command_body: str) -> bool:
    lowered = command_body.lower()
    if any(server in lowered for server in ("uvicorn", "gunicorn", "flask run", "vite", "next", "node", "npm", "yarn", "pnpm")):
        return "0.0.0.0" in lowered or "--hostname 0.0.0.0" in lowered or "nginx" in lowered or "node" in lowered
    return True


def _first_port(line: str) -> int | None:
    match = re.search(r"(\d+)", line)
    return int(match.group(1)) if match else None


def _port_from_command(command: str) -> int | None:
    match = re.search(r"(?:--port|:-p|port=)\s*=?\s*(\d+)", command)
    if match:
        return int(match.group(1))
    bind_match = re.search(r"0\.0\.0\.0:(\d+)", command)
    return int(bind_match.group(1)) if bind_match else None


def _command_index(lines: list[str]) -> int:
    for index, line in enumerate(lines):
        if line.strip().upper().startswith(("CMD ", "ENTRYPOINT ")):
            return index
    return len(lines)
