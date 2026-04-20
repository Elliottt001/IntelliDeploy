from __future__ import annotations

import re

from fallback.schemas.plan import EnvVarSpec
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse


def _clean_command(command: str | None) -> str | None:
    if not command:
        return None
    return command.strip().strip("`").strip()


def resolve_template_family(classify_response: ClassifyResponse) -> str:
    preferred_framework = (classify_response.user_intent_summary.preferred_framework or "").lower()
    preferred_language = (classify_response.user_intent_summary.preferred_language or "").lower()
    detected_framework = (classify_response.repo_fact_summary.detected_framework or "").lower()
    target_app_type = classify_response.user_intent_summary.target_app_type

    marker = " ".join([preferred_framework, detected_framework, preferred_language, target_app_type]).lower()
    if "next" in marker:
        return "nextjs"
    if "react" in marker or "vite" in marker or target_app_type in {"frontend_web", "dashboard", "static_site"}:
        return "react_vite"
    if "flask" in marker:
        return "python_flask"
    if "express" in marker or preferred_language in {"javascript", "typescript", "node"}:
        return "node_express"
    return "python_fastapi"


def resolve_container_port(request: FallbackRequest, classify_response: ClassifyResponse) -> int:
    constraints = request.user_intent.constraints or {}
    target_port = constraints.get("target_port")
    if isinstance(target_port, int) and target_port > 0:
        return target_port
    if classify_response.repo_fact_summary.target_port_candidates:
        return classify_response.repo_fact_summary.target_port_candidates[0]
    if classify_response.repo_fact_summary.detected_ports:
        return classify_response.repo_fact_summary.detected_ports[0]
    if classify_response.user_intent_summary.target_app_type in {"frontend_web", "dashboard", "static_site"}:
        return 80
    return 8000


def _resolve_python_module(entry_candidates: list[str], fallback_name: str) -> str:
    for candidate in entry_candidates:
        if candidate.endswith(".py"):
            return candidate[:-3].replace("/", ".").replace("\\", ".")
    return fallback_name


def resolve_start_command(request: FallbackRequest, classify_response: ClassifyResponse, *, port: int) -> str:
    for command in classify_response.repo_fact_summary.detected_start_commands:
        cleaned = _clean_command(command)
        if cleaned:
            return cleaned

    template_family = resolve_template_family(classify_response)
    entry_candidates = classify_response.repo_fact_summary.entry_candidates
    if template_family == "python_fastapi":
        module_name = _resolve_python_module(entry_candidates, "main")
        return f"uvicorn {module_name}:app --host 0.0.0.0 --port {port}"
    if template_family == "python_flask":
        entry = next((candidate for candidate in entry_candidates if candidate.endswith(".py")), "app.py")
        return f"python {entry}"
    if template_family == "node_express":
        entry = next((candidate for candidate in entry_candidates if candidate.endswith(".js")), "server.js")
        return f"node {entry}"
    if template_family == "nextjs":
        return "npm run start"
    return 'nginx -g "daemon off;"'


def resolve_install_command(classify_response: ClassifyResponse) -> str | None:
    package_manager = classify_response.repo_fact_summary.package_manager
    if package_manager == "npm":
        return "npm ci"
    if package_manager == "pnpm":
        return "pnpm install --frozen-lockfile"
    if package_manager == "yarn":
        return "yarn install --frozen-lockfile"
    if package_manager == "poetry":
        return "poetry install --no-interaction --no-root"
    if package_manager == "uv":
        return "uv sync --frozen"
    if package_manager == "pip":
        return "pip install --no-cache-dir -r requirements.txt"

    template_family = resolve_template_family(classify_response)
    if template_family.startswith("python_"):
        return "pip install --no-cache-dir -r requirements.txt"
    if template_family in {"node_express", "nextjs", "react_vite"}:
        return "npm ci"
    return None


def resolve_base_image(classify_response: ClassifyResponse) -> str:
    template_family = resolve_template_family(classify_response)
    if template_family in {"python_fastapi", "python_flask"}:
        return "python:3.11-slim"
    if template_family == "react_vite":
        return "nginx:1.27-alpine"
    return "node:20-alpine"


def resolve_healthcheck_path(request: FallbackRequest, classify_response: ClassifyResponse) -> str | None:
    target_app_type = classify_response.user_intent_summary.target_app_type
    if target_app_type in {"backend_api", "chatbot", "automation_tool"}:
        return "/health"
    if resolve_template_family(classify_response) == "react_vite":
        return "/"
    return None


def build_env_specs(classify_response: ClassifyResponse, assumed_names: list[str] | None = None) -> list[EnvVarSpec]:
    env_specs = [
        EnvVarSpec(
            name=item.name,
            required=item.required,
            example_value=item.example_value,
            description=item.description,
            source=item.source,
        )
        for item in classify_response.repo_fact_summary.env_var_details
    ]

    existing = {item.name for item in env_specs}
    for name in assumed_names or []:
        if name in existing:
            continue
        env_specs.append(
            EnvVarSpec(
                name=name,
                required=True,
                example_value="replace-me",
                description="Generated from user intent during fallback scaffold.",
                source="ASSUMED",
            )
        )
    return env_specs


def render_env_example(env_specs: list[EnvVarSpec]) -> str:
    lines = []
    for env_var in env_specs:
        value = env_var.example_value or "replace-me"
        lines.append(f"{env_var.name}={value}")
    return "\n".join(lines).strip() + ("\n" if lines else "")


def infer_app_name(request: FallbackRequest, classify_response: ClassifyResponse) -> str:
    if classify_response.repo_fact_summary.description:
        return classify_response.repo_fact_summary.description.strip()
    query = re.sub(r"\s+", " ", request.raw_query or "").strip()
    return query[:60] if query else "Fallback App"

