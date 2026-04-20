from __future__ import annotations

import re
from typing import Any

from fallback.schemas.repo import EnvVarDetail


def _normalize_key_files(key_files: dict[str, str]) -> dict[str, str]:
    return {path.replace("\\", "/").lower(): content for path, content in key_files.items()}


def _read_first_matching(key_files: dict[str, str], *names: str) -> str:
    key_map = _normalize_key_files(key_files)
    for name in names:
        for path, content in key_map.items():
            if path.endswith(name.lower()):
                return content
    return ""


def detect_env_vars(
    key_files: dict[str, str],
    file_tree: list[Any],
    runtime_chain_observations: dict | None = None,
    readme_summary: str | None = None,
) -> dict:
    detected: dict[str, set[str]] = {}
    example_values: dict[str, str | None] = {}

    def remember(name: str, source: str, example: str | None = None) -> None:
        if not name:
            return
        detected.setdefault(name, set()).add(source)
        if example is not None and name not in example_values:
            example_values[name] = example

    source_blob = "\n".join(key_files.values())
    for match in re.findall(r"process\.env\.([A-Z0-9_]+)", source_blob):
        remember(match, "source:process.env")
    for match in re.findall(r"import\.meta\.env\.([A-Z0-9_]+)", source_blob):
        remember(match, "source:import.meta.env")
    for match in re.findall(r"os\.environ(?:\.get)?\(\s*[\"']([A-Z0-9_]+)[\"']", source_blob):
        remember(match, "source:os.environ")
    for match in re.findall(r"getenv\(\s*[\"']([A-Z0-9_]+)[\"']", source_blob):
        remember(match, "source:getenv")

    env_example = _read_first_matching(key_files, ".env.example", ".env")
    for line in env_example.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, value = stripped.split("=", 1)
        remember(name.strip(), "file:.env.example", value.strip() or None)

    compose = _read_first_matching(key_files, "docker-compose.yml", "compose.yml")
    for line in compose.splitlines():
        if ":" in line and "environment" not in line.lower():
            key, value = line.split(":", 1)
            if re.fullmatch(r"[A-Z][A-Z0-9_]+", key.strip()):
                remember(key.strip(), "file:docker-compose", value.strip() or None)
        for name, value in re.findall(r"-\s*([A-Z][A-Z0-9_]+)=(.+)", line):
            remember(name, "file:docker-compose", value.strip() or None)

    readme = _read_first_matching(key_files, "README", "README.md")
    readme_text = "\n".join(part for part in (readme, readme_summary or "") if part)
    for match in re.findall(r"`([A-Z][A-Z0-9_]{2,})`", readme_text):
        remember(match, "readme")
    for match in re.findall(r"export\s+([A-Z][A-Z0-9_]{2,})", readme_text):
        remember(match, "readme")

    env_var_details = build_env_var_details(detected, example_values)
    env_var_sources = {detail.name: ",".join(sorted(detected[detail.name])) for detail in env_var_details}
    env_warnings: list[str] = []

    if runtime_chain_observations:
        for name in runtime_chain_observations.get("env_vars_required", []):
            if name not in env_var_sources:
                env_warnings.append(f"runtime_env_without_source:{name}")

    return {
        "detected_env_vars": sorted(env_var_sources.keys()),
        "env_var_sources": env_var_sources,
        "env_var_details": env_var_details,
        "env_warnings": sorted(dict.fromkeys(env_warnings)),
    }


def build_env_var_details(
    detected: dict[str, set[str]],
    example_values: dict[str, str | None] | None = None,
) -> list[EnvVarDetail]:
    example_values = example_values or {}
    details: list[EnvVarDetail] = []
    for name in sorted(detected):
        details.append(
            EnvVarDetail(
                name=name,
                required=True,
                example_value=example_values.get(name),
                description=None,
                source="DETECTED",
            )
        )
    return details


def to_required_envs_payload(env_var_details: list[EnvVarDetail]) -> list[dict]:
    return [detail.model_dump() for detail in env_var_details]
