from __future__ import annotations

import json
import re
import tomllib
from typing import Any


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


def _key_file_map(key_files: dict[str, str]) -> dict[str, str]:
    return {path.replace("\\", "/").lower(): content for path, content in key_files.items()}


def _read_first_matching(key_files: dict[str, str], *names: str) -> str:
    key_map = _key_file_map(key_files)
    for name in names:
        for path, content in key_map.items():
            if path.endswith(name.lower()):
                return content
    return ""


def _dependency_names(key_files: dict[str, str]) -> set[str]:
    names: set[str] = set()

    package_json = _read_first_matching(key_files, "package.json")
    if package_json:
        try:
            parsed = json.loads(package_json)
        except json.JSONDecodeError:
            parsed = {}
        for section in ("dependencies", "devDependencies", "peerDependencies"):
            names.update((parsed.get(section) or {}).keys())

    pyproject = _read_first_matching(key_files, "pyproject.toml")
    if pyproject:
        try:
            parsed = tomllib.loads(pyproject)
        except tomllib.TOMLDecodeError:
            parsed = {}
        project = parsed.get("project") or {}
        names.update(project.get("dependencies") or [])
        poetry = (((parsed.get("tool") or {}).get("poetry") or {}).get("dependencies") or {})
        names.update(poetry.keys())

    requirements = _read_first_matching(key_files, "requirements.txt")
    if requirements:
        for line in requirements.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            names.add(re.split(r"[<>=\[]", line, maxsplit=1)[0].strip())

    pom = _read_first_matching(key_files, "pom.xml")
    names.update(re.findall(r"<artifactId>([^<]+)</artifactId>", pom))

    go_mod = _read_first_matching(key_files, "go.mod")
    names.update(re.findall(r"^\s*require\s+([^\s]+)", go_mod, flags=re.MULTILINE))

    return {name.lower() for name in names if name}


def detect_language(file_tree: list[Any], key_files: dict[str, str]) -> str:
    paths = [path.lower() for path in _normalize_paths(file_tree)]
    key_map = _key_file_map(key_files)

    if any(path.endswith("package.json") for path in paths) or any(path.endswith("package.json") for path in key_map):
        ts_markers = {".ts", ".tsx"} & {path[path.rfind(".") :] for path in paths if "." in path}
        if ts_markers:
            return "typescript"
        package_json = _read_first_matching(key_files, "package.json")
        if package_json and "\"typescript\"" in package_json.lower():
            return "typescript"
        return "javascript"
    if any(path.endswith(("requirements.txt", "pyproject.toml")) for path in paths) or any(
        path.endswith(("requirements.txt", "pyproject.toml")) for path in key_map
    ):
        return "python"
    if any(path.endswith(("pom.xml", "build.gradle", "build.gradle.kts")) for path in paths) or any(
        path.endswith(("pom.xml", "build.gradle", "build.gradle.kts")) for path in key_map
    ):
        return "java"
    if any(path.endswith("go.mod") for path in paths) or any(path.endswith("go.mod") for path in key_map):
        return "go"
    if any(path.endswith("cargo.toml") for path in paths) or any(path.endswith("cargo.toml") for path in key_map):
        return "rust"
    if any(path.endswith("composer.json") for path in paths) or any(path.endswith("composer.json") for path in key_map):
        return "php"
    if any(path.endswith("gemfile") for path in paths) or any(path.endswith("gemfile") for path in key_map):
        return "ruby"
    return "unknown"


def build_framework_evidence(
    dependency_names: set[str],
    key_files: dict[str, str],
    file_tree: list[Any],
    entry_candidates: list[str] | None = None,
) -> tuple[list[str], list[str]]:
    evidence: list[str] = []
    frameworks: list[str] = []
    key_map = _key_file_map(key_files)
    paths = [path.lower() for path in _normalize_paths(file_tree)]
    source_blob = "\n".join(key_map.values()).lower()
    entry_blob = "\n".join(key_files.get(path, "") for path in key_files if path.replace("\\", "/") in (entry_candidates or []))
    entry_blob = entry_blob.lower()

    def add(framework: str, marker: str) -> None:
        if framework not in frameworks:
            frameworks.append(framework)
        evidence.append(marker)

    if "next" in dependency_names or any(path.endswith(("next.config.js", "next.config.ts")) for path in paths):
        add("Next.js", "dependency:next")
    if "react" in dependency_names:
        add("React", "dependency:react")
    if "vite" in dependency_names or any(path.endswith(("vite.config.js", "vite.config.ts")) for path in paths):
        add("Vite", "config:vite")
    if "vue" in dependency_names:
        add("Vue", "dependency:vue")
    if "express" in dependency_names and ("express(" in entry_blob or "app.listen" in entry_blob or "express()" in source_blob):
        add("Express", "entry:express")
    if "fastapi" in dependency_names or "fastapi(" in source_blob:
        add("FastAPI", "entry:fastapi")
    if "flask" in dependency_names or "flask(" in source_blob:
        add("Flask", "entry:flask")
    if "django" in dependency_names or any(path.endswith("manage.py") for path in paths):
        add("Django", "tree:manage.py")
    if "spring-boot-starter" in source_blob:
        add("Spring Boot", "dependency:spring-boot-starter")
    if any(name.startswith("github.com/mark3labs/mcp-go") for name in dependency_names) or "model context protocol" in source_blob:
        add("MCP", "semantic:model-context-protocol")
    if "mcp server" in source_blob or any(token in source_blob for token in ("tools", "resources", "prompts")) and "mcp" in source_blob:
        add("MCP", "semantic:mcp-server")
    if "streamlit" in dependency_names:
        add("Streamlit", "dependency:streamlit")
    if "gradio" in dependency_names:
        add("Gradio", "dependency:gradio")

    return frameworks, evidence


def detect_framework(
    file_tree: list[Any],
    key_files: dict[str, str],
    dependency_files: list[str],
    entry_candidates: list[str] | None = None,
) -> dict:
    dependency_names = _dependency_names(key_files)
    frameworks, evidence = build_framework_evidence(dependency_names, key_files, file_tree, entry_candidates)
    warnings: list[str] = []
    uncertain_points: list[str] = []

    if len([framework for framework in frameworks if framework not in {"Vite"}]) > 1:
        uncertain_points.append("multi_framework_detected")

    detected_framework = frameworks[0] if frameworks else "unknown"
    if detected_framework == "unknown" and dependency_files:
        warnings.append("framework_not_detected")

    return {
        "detected_language": detect_language(file_tree, key_files),
        "detected_framework": detected_framework,
        "detected_project_type_by_rule": detect_project_type_by_rule(file_tree, key_files, detected_framework, frameworks),
        "framework_evidence": evidence,
        "warnings": sorted(dict.fromkeys(warnings)),
        "uncertain_points": sorted(dict.fromkeys(uncertain_points)),
        "detected_frameworks": frameworks,
    }


def detect_project_type_by_rule(
    file_tree: list[Any],
    key_files: dict[str, str],
    detected_framework: str,
    detected_frameworks: list[str] | None = None,
) -> str:
    paths = [path.lower() for path in _normalize_paths(file_tree)]
    source_blob = "\n".join(_key_file_map(key_files).values()).lower()
    frameworks = set(detected_frameworks or [])
    if detected_framework != "unknown":
        frameworks.add(detected_framework)

    if {"Next.js", "Django"} & frameworks:
        return "fullstack"
    if {"React", "Vue"} & frameworks and any(
        token in paths for token in ("src/main.tsx", "src/app.tsx", "app/page.tsx", "pages/index.tsx")
    ):
        return "frontend_web"
    if {"Express", "FastAPI", "Flask", "Spring Boot"} & frameworks:
        return "backend_api"
    if {"Streamlit", "Gradio"} & frameworks:
        return "ml_service"
    if "MCP" in frameworks:
        return "mcp"
    if any(path.endswith((".html", ".css")) for path in paths) and not any(
        framework in frameworks for framework in ("Express", "FastAPI", "Flask", "Spring Boot", "Django", "Next.js")
    ):
        return "static_site"
    if any(path.endswith(("cli.py", "main_cli.py")) for path in paths) or any(
        token in source_blob for token in ("argparse", "click.command", "commander")
    ):
        return "cli_tool"
    if any(token in source_blob for token in ("selenium", "playwright", "schedule", "celery")):
        return "automation_tool"
    if any(token in source_blob for token in ("listen(", "uvicorn", "gunicorn", "app = fastapi", "app = flask")):
        return "backend_api"
    if any(path.endswith(("src/index.js", "src/index.ts")) for path in paths):
        return "library"
    return "unknown"
