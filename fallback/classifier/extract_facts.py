from __future__ import annotations

from typing import Any, Callable

from fallback.classifier.conflict_detector import detect_all_conflicts
from fallback.classifier.entrypoint_detector import analyze_entrypoints
from fallback.classifier.env_detector import detect_env_vars
from fallback.classifier.framework_detector import detect_framework
from fallback.classifier.package_manager_detector import detect_package_manager
from fallback.classifier.risk_detector import detect_all_risks
from fallback.schemas.repo import ExtractionSummary, RepoFactSummary
from fallback.schemas.request import FallbackRequest, UserIntentSummary
from fallback.services.prompt_loader import load_prompt
from fallback.validators.dockerfile_validator import validate_dockerfile


def _normalize_paths(file_tree: list[Any]) -> list[str]:
    output: list[str] = []

    def visit(node: Any) -> None:
        if isinstance(node, str):
            output.append(node.replace("\\", "/"))
            return
        if isinstance(node, dict):
            path = (node.get("path") or node.get("name") or "").replace("\\", "/")
            if path and node.get("type", "file") != "dir":
                output.append(path)
            for child in node.get("children", []):
                visit(child)

    for item in file_tree:
        visit(item)
    return output


def _read_first_matching(key_files: dict[str, str], *names: str) -> str:
    normalized = {path.replace("\\", "/").lower(): content for path, content in key_files.items()}
    for name in names:
        for path, content in normalized.items():
            if path.endswith(name.lower()):
                return content
    return ""


def _summarize_text(text: str, max_length: int = 200) -> str | None:
    normalized = " ".join(text.replace("#", " ").split())
    return normalized[:max_length] if normalized else None


def _detect_user_intent_state(raw_query: str, user_intent: dict) -> str:
    if user_intent.get("target_app_type") not in {None, "", "unknown"}:
        return "clear"
    if user_intent.get("expected_features") or user_intent.get("preferred_language") or user_intent.get("preferred_framework"):
        return "clear"
    query = (raw_query or "").strip().lower()
    partial_markers = ("网站", "后台", "接口", "api", "service", "项目", "deploy", "app", "工具")
    if query and any(marker in query for marker in partial_markers):
        return "partially_clear"
    return "unclear"


def _repo_material_state(has_real_code: bool, has_dependency_file: bool, has_entry_file: bool, has_config_file: bool, readme_summary: str | None) -> str:
    evidence_count = sum([has_real_code, has_dependency_file, has_entry_file, has_config_file, bool(readme_summary)])
    if has_real_code and evidence_count >= 3:
        return "sufficient"
    if evidence_count >= 2:
        return "partial"
    return "insufficient"


def _detect_real_code(paths: list[str]) -> bool:
    code_suffixes = (".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".java", ".rs", ".php", ".rb")
    non_code = ("readme", ".md", ".txt", ".json", ".yaml", ".yml", ".toml", "dockerfile", ".lock")
    for path in paths:
        lower = path.lower()
        if lower.endswith(code_suffixes) and not lower.endswith(non_code):
            return True
    return False


def _detect_config_files(paths: list[str]) -> list[str]:
    config_names = (
        "vite.config.ts",
        "vite.config.js",
        "next.config.js",
        "next.config.ts",
        "Procfile",
        "docker-compose.yml",
        "compose.yml",
        "Makefile",
    )
    return sorted([path for path in paths if path.endswith(config_names)], key=lambda path: path.lower())


def _detect_missing_components(summary: RepoFactSummary) -> tuple[list[str], list[str]]:
    missing_items: list[str] = []
    missing_components: list[str] = []

    if not summary.has_dockerfile:
        missing_items.append("Dockerfile")
        missing_components.append("Dockerfile")
    if not summary.has_docker_compose:
        missing_items.append("docker_compose")
        missing_components.append("docker_compose")
    if not summary.has_start_script:
        missing_items.append("start_script")
        missing_components.append("start_script")
    if not summary.has_build_script and summary.detected_project_type_by_rule in {"frontend_web", "fullstack"}:
        missing_items.append("build_script")
        missing_components.append("build_script")
    if not summary.has_entry_file:
        missing_items.append("entry_file")
        missing_components.append("entry_file")
    if not summary.has_dependency_file:
        missing_items.append("dependency_file")
        missing_components.append("dependency_file")
    if ".env.example" not in "\n".join(summary.config_files).lower():
        missing_items.append("env_example")
        missing_components.append("env_example")
    if not any("health" in path.lower() for path in summary.config_files):
        missing_components.append("healthcheck")

    return sorted(dict.fromkeys(missing_items)), sorted(dict.fromkeys(missing_components))


def _preferred_stack(summary: RepoFactSummary) -> dict[str, str | None]:
    framework = summary.detected_framework
    frontend = None
    backend = None
    database = None
    runtime = None

    if framework in {"React", "Next.js", "Vue", "Vite"}:
        frontend = framework
    if framework in {"FastAPI", "Flask", "Django", "Express", "Spring Boot"}:
        backend = framework
    if framework == "MCP":
        backend = "MCP"

    blob = " ".join(summary.detected_env_vars + summary.conflict_items + summary.risk_items + summary.framework_evidence).lower()
    if any(token in blob for token in ("database_url", "postgres", "postgresql")):
        database = "PostgreSQL"
    elif "sqlite" in blob:
        database = "SQLite"
    elif "mongodb" in blob:
        database = "MongoDB"

    language = summary.detected_language
    if language == "python":
        runtime = "python"
    elif language == "javascript":
        runtime = "node"
    elif language == "typescript":
        runtime = "node"
    elif language != "unknown":
        runtime = language

    return {"frontend": frontend, "backend": backend, "database": database, "runtime": runtime}


def _requires_extraction_ai(user_intent_summary: UserIntentSummary, summary: RepoFactSummary, readme: str) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if len(readme) > 500:
        reasons.append("long_readme_requires_summary")
    if len(summary.dependency_files) > 1:
        reasons.append("multiple_dependency_files_require_summary")
    if len(summary.entry_candidates) > 1:
        reasons.append("multiple_entry_candidates_require_summary")
    if summary.detected_project_type_by_rule == "unknown":
        reasons.append("project_type_unknown")
    if summary.detected_framework == "unknown" and summary.has_real_code:
        reasons.append("framework_unknown_with_real_code")
    if summary.conflict_items:
        reasons.append("conflicts_require_semantic_review")
    if any(value == "unknown" for value in summary.runtime_chain_observations.model_dump().values() if isinstance(value, str)):
        reasons.append("runtime_chain_unknown")
    if summary.uncertain_points:
        reasons.append("uncertain_points_present")
    if user_intent_summary.user_intent_state == "partially_clear" and (summary.description or readme):
        reasons.append("partial_user_intent_requires_semantic_hint")
    return bool(reasons), sorted(dict.fromkeys(reasons))


def extract_repository_facts(
    payload: FallbackRequest | dict[str, Any],
    *,
    extraction_ai: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
) -> ExtractionSummary:
    request = payload if isinstance(payload, FallbackRequest) else FallbackRequest.model_validate(payload)
    user_intent_payload = request.user_intent.model_dump()
    user_intent_summary = UserIntentSummary(
        raw_query=request.raw_query,
        user_intent_state=_detect_user_intent_state(request.raw_query, user_intent_payload),
        **user_intent_payload,
    )

    summary = RepoFactSummary.from_repo_info(request.repo_info)
    paths = _normalize_paths(request.file_tree)
    readme = _read_first_matching(request.key_files, "README", "README.md")

    package_result = detect_package_manager(request.file_tree, request.key_files)
    framework_result = detect_framework(request.file_tree, request.key_files, package_result["dependency_files"])
    entry_result = analyze_entrypoints(request.file_tree, request.key_files, package_result, framework_result)
    env_result = detect_env_vars(
        request.key_files,
        request.file_tree,
        entry_result["runtime_chain_observations"],
        _summarize_text(readme),
    )

    summary.has_real_code = _detect_real_code(paths)
    summary.dependency_files = package_result["dependency_files"]
    summary.has_dependency_file = bool(summary.dependency_files)
    summary.package_manager = package_result["package_manager"]
    summary.lock_files = package_result["lock_files"]
    summary.package_manager_confidence = package_result["package_manager_confidence"]
    summary.detected_language = framework_result["detected_language"]
    summary.detected_framework = framework_result["detected_framework"]
    summary.detected_frameworks = framework_result.get("detected_frameworks", [])
    summary.framework_evidence = framework_result["framework_evidence"]
    summary.detected_project_type_by_rule = framework_result["detected_project_type_by_rule"]
    summary.detected_project_type_by_semantics = framework_result["detected_project_type_by_rule"]
    summary.has_entry_file = entry_result["has_entry_file"]
    summary.entry_candidates = entry_result["entry_candidates"]
    summary.entry_summary = entry_result["entry_summary"]
    summary.has_start_script = entry_result["has_start_script"]
    summary.detected_start_commands = entry_result["detected_start_commands"]
    summary.has_build_script = entry_result["has_build_script"]
    summary.detected_build_commands = entry_result["detected_build_commands"]
    summary.detected_ports = entry_result["detected_ports"]
    summary.target_port_candidates = entry_result["detected_ports"]
    summary.runtime_chain_observations = summary.runtime_chain_observations.model_validate(entry_result["runtime_chain_observations"])
    summary.detected_env_vars = env_result["detected_env_vars"]
    summary.env_var_sources = env_result["env_var_sources"]
    summary.env_var_details = env_result["env_var_details"]
    summary.env_warnings = env_result["env_warnings"]
    summary.detected_languages = [summary.detected_language] if summary.detected_language != "unknown" else []
    summary.readme_summary = _summarize_text(readme)
    summary.dependency_summary = _summarize_text(", ".join(summary.dependency_files), max_length=120)

    config_files = _detect_config_files(paths)
    summary.config_files = config_files
    summary.has_config_file = bool(config_files)
    summary.has_dockerfile = any(path.lower().endswith("dockerfile") for path in paths) or bool(
        _read_first_matching(request.key_files, "Dockerfile")
    )
    summary.has_docker_compose = any(path.lower().endswith(("docker-compose.yml", "compose.yml")) for path in paths)

    dockerfile_content = _read_first_matching(request.key_files, "Dockerfile")
    if dockerfile_content:
        docker_validation = validate_dockerfile(
            dockerfile_content,
            expected_language=summary.detected_language,
            entry_candidates=summary.entry_candidates,
        )
        summary.has_valid_dockerfile = docker_validation["is_valid"]
        summary.dockerfile_summary = docker_validation["summary"]
        summary.target_port_candidates = sorted(
            dict.fromkeys(summary.target_port_candidates + docker_validation["exposed_ports"])
        )
    summary.compose_summary = _summarize_text(_read_first_matching(request.key_files, "docker-compose.yml", "compose.yml"), max_length=120)

    summary.repo_empty_or_near_empty = not summary.has_real_code and len(paths) <= 3
    summary.only_docs_or_notes_or_template = not summary.has_real_code and all(
        path.lower().endswith((".md", ".txt")) or path.lower() in {"license", ".gitignore"} for path in paths
    )
    summary.preferred_stack = _preferred_stack(summary)
    summary.repo_material_state = _repo_material_state(
        summary.has_real_code,
        summary.has_dependency_file,
        summary.has_entry_file,
        summary.has_config_file,
        summary.readme_summary,
    )

    summary.missing_items, summary.missing_components = _detect_missing_components(summary)

    conflict_result = detect_all_conflicts(summary.model_dump(mode="json"), request.key_files)
    summary.conflict_items = conflict_result["conflict_items"]

    risk_result = detect_all_risks(request.repo_info.model_dump(mode="json"), summary.model_dump(mode="json"), request.key_files, request.file_tree)
    summary.risk_items = risk_result["risk_items"]

    warnings = (
        package_result["warnings"]
        + framework_result["warnings"]
        + entry_result["warnings"]
        + env_result["env_warnings"]
        + conflict_result["warnings"]
        + risk_result["warnings"]
    )
    uncertain_points = framework_result["uncertain_points"] + entry_result["uncertain_points"]
    summary.warnings = sorted(dict.fromkeys(warnings))
    summary.uncertain_points = sorted(dict.fromkeys(uncertain_points))

    summary.ai_extraction_required, summary.ai_extraction_reason = _requires_extraction_ai(user_intent_summary, summary, readme)

    if extraction_ai and summary.ai_extraction_required:
        ai_output = extraction_ai(
            {
                "prompt": load_prompt("extract_facts.md"),
                "raw_query": request.raw_query,
                "user_intent_summary": user_intent_summary.model_dump(mode="json"),
                "repo_fact_summary": summary.model_dump(mode="json"),
            }
        )
        summary.readme_summary = summary.readme_summary or ai_output.get("README_summary")
        summary.dependency_summary = summary.dependency_summary or ai_output.get("dependency_summary")
        summary.entry_summary = summary.entry_summary or ai_output.get("entry_summary")
        summary.dockerfile_summary = summary.dockerfile_summary or ai_output.get("dockerfile_summary")
        summary.compose_summary = summary.compose_summary or ai_output.get("compose_summary")
        if summary.detected_project_type_by_semantics == "unknown":
            summary.detected_project_type_by_semantics = ai_output.get("detected_project_type_by_semantics", "unknown")
        summary.conflict_items = sorted(dict.fromkeys(summary.conflict_items + ai_output.get("conflict_items", [])))
        summary.warnings = sorted(dict.fromkeys(summary.warnings + ai_output.get("warnings", [])))
        summary.uncertain_points = sorted(dict.fromkeys(summary.uncertain_points + ai_output.get("uncertain_points", [])))

    return ExtractionSummary(user_intent_summary=user_intent_summary.model_dump(mode="json"), repo_fact_summary=summary)
