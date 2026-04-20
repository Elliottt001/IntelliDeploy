import re


DOCKERFILE_REQUIRED_INSTRUCTIONS = ("FROM", "COPY", "RUN", "CMD")


def summarize_dockerfile(dockerfile_content: str) -> str | None:
    lines = [line.strip() for line in dockerfile_content.splitlines() if line.strip()]
    if not lines:
        return None

    summary_parts: list[str] = []
    base_image = next((line.split(maxsplit=1)[1] for line in lines if line.upper().startswith("FROM ")), None)
    if base_image:
        summary_parts.append(f"base={base_image}")
    exposed = [line.split(maxsplit=1)[1] for line in lines if line.upper().startswith("EXPOSE ")]
    if exposed:
        summary_parts.append(f"ports={','.join(exposed)}")
    command = next((line for line in lines if line.upper().startswith(("CMD ", "ENTRYPOINT "))), None)
    if command:
        summary_parts.append(f"command={command}")
    return "; ".join(summary_parts) if summary_parts else "dockerfile_present"


def validate_dockerfile(
    dockerfile_content: str,
    *,
    expected_language: str | None = None,
    entry_candidates: list[str] | None = None,
) -> dict:
    lines = [line.strip() for line in dockerfile_content.splitlines() if line.strip() and not line.strip().startswith("#")]
    instructions = {line.split(maxsplit=1)[0].upper() for line in lines if " " in line}
    missing = [instruction for instruction in DOCKERFILE_REQUIRED_INSTRUCTIONS if instruction not in instructions]
    warnings: list[str] = []
    errors: list[str] = []

    base_image = next((line.split(maxsplit=1)[1] for line in lines if line.upper().startswith("FROM ")), None)
    command = next((line.split(maxsplit=1)[1] for line in lines if line.upper().startswith(("CMD ", "ENTRYPOINT "))), None)
    exposed_ports = [
        int(match.group(1))
        for line in lines
        if line.upper().startswith("EXPOSE ")
        for match in [re.search(r"(\d+)", line)]
        if match
    ]

    if "WORKDIR" not in instructions:
        warnings.append("missing_workdir")
    if "EXPOSE" not in instructions:
        warnings.append("missing_expose")
    if missing:
        errors.extend(f"missing_{instruction.lower()}" for instruction in missing)

    language_lower = (expected_language or "").lower()
    if base_image and language_lower:
        base_lower = base_image.lower()
        if language_lower == "python" and "python" not in base_lower:
            errors.append("base_image_language_conflict")
        if language_lower in {"javascript", "typescript", "node"} and "node" not in base_lower and "nginx" not in base_lower:
            errors.append("base_image_language_conflict")

    if command and entry_candidates:
        if not any(candidate.replace("\\", "/") in command for candidate in entry_candidates):
            # Allow common server runners that do not name the file directly.
            relaxed_tokens = ("uvicorn", "gunicorn", "flask run", "npm start", "npm run build", "node ", "python ")
            if not any(token in command.lower() for token in relaxed_tokens):
                warnings.append("command_entry_uncertain")

    return {
        "is_valid": not errors,
        "errors": sorted(set(errors)),
        "warnings": sorted(set(warnings)),
        "base_image": base_image,
        "command": command,
        "exposed_ports": exposed_ports,
        "summary": summarize_dockerfile(dockerfile_content),
    }

