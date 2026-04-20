from __future__ import annotations

import json
import re
from typing import Any


ENTRY_CANDIDATE_NAMES = [
    "main.py",
    "app.py",
    "manage.py",
    "server.py",
    "src/main.py",
    "server.js",
    "index.js",
    "app.js",
    "src/main.ts",
    "src/main.tsx",
    "src/app.tsx",
    "src/App.tsx",
    "pages/index.tsx",
    "app/page.tsx",
    "main.go",
    "cmd/main.go",
]


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
    key_map = {path.replace("\\", "/").lower(): content for path, content in key_files.items()}
    for name in names:
        for path, content in key_map.items():
            if path.endswith(name.lower()):
                return content
    return ""


def detect_entry_candidates(file_tree: list[Any], key_files: dict[str, str]) -> list[str]:
    paths = _normalize_paths(file_tree)
    key_paths = [path.replace("\\", "/") for path in key_files]
    combined = paths + key_paths
    matches = [path for path in combined if path.lower().endswith(tuple(name.lower() for name in ENTRY_CANDIDATE_NAMES))]
    return sorted(dict.fromkeys(matches), key=lambda path: path.lower())


def detect_start_commands(key_files: dict[str, str]) -> list[str]:
    commands: list[str] = []
    package_json = _read_first_matching(key_files, "package.json")
    if package_json:
        try:
            parsed = json.loads(package_json)
        except json.JSONDecodeError:
            parsed = {}
        scripts = parsed.get("scripts") or {}
        for key in ("start", "dev", "serve"):
            if scripts.get(key):
                commands.append(str(scripts[key]).strip())

    procfile = _read_first_matching(key_files, "Procfile")
    for line in procfile.splitlines():
        if ":" in line:
            commands.append(line.split(":", 1)[1].strip())

    makefile = _read_first_matching(key_files, "Makefile")
    for line in makefile.splitlines():
        stripped = line.strip()
        if stripped.startswith(("run", "start")) and ":" in stripped:
            continue
        if any(token in stripped for token in ("uvicorn", "gunicorn", "flask", "python", "node", "npm start", "go run")):
            commands.append(stripped)

    dockerfile = _read_first_matching(key_files, "Dockerfile")
    for line in dockerfile.splitlines():
        upper = line.strip().upper()
        if upper.startswith(("CMD ", "ENTRYPOINT ")):
            commands.append(line.split(maxsplit=1)[1].strip())

    readme = _read_first_matching(key_files, "README", "README.md")
    for line in readme.splitlines():
        stripped = line.strip().strip("`")
        if stripped.startswith(("npm ", "pnpm ", "yarn ", "python ", "uvicorn ", "gunicorn ", "flask ", "node ", "go run")):
            commands.append(stripped)
        for inline_command in re.findall(r"`((?:npm|pnpm|yarn|python|uvicorn|gunicorn|flask|node|go run)[^`]*)`", line):
            commands.append(inline_command.strip())

    return sorted(dict.fromkeys(command for command in commands if command), key=lambda value: value.lower())


def detect_build_commands(key_files: dict[str, str]) -> list[str]:
    commands: list[str] = []
    package_json = _read_first_matching(key_files, "package.json")
    if package_json:
        try:
            parsed = json.loads(package_json)
        except json.JSONDecodeError:
            parsed = {}
        scripts = parsed.get("scripts") or {}
        if scripts.get("build"):
            commands.append(str(scripts["build"]).strip())

    makefile = _read_first_matching(key_files, "Makefile")
    for line in makefile.splitlines():
        stripped = line.strip()
        if any(token in stripped for token in ("build", "npm run build", "pnpm build", "yarn build", "mvn package")):
            commands.append(stripped)

    dockerfile = _read_first_matching(key_files, "Dockerfile")
    for line in dockerfile.splitlines():
        stripped = line.strip()
        if stripped.upper().startswith("RUN ") and any(token in stripped.lower() for token in ("build", "compile", "package")):
            commands.append(stripped[4:].strip())

    readme = _read_first_matching(key_files, "README", "README.md")
    for line in readme.splitlines():
        stripped = line.strip().strip("`")
        if stripped.startswith(("npm run build", "pnpm build", "yarn build", "mvn package", "go build")):
            commands.append(stripped)
        for inline_command in re.findall(r"`((?:npm run build|pnpm build|yarn build|mvn package|go build)[^`]*)`", line):
            commands.append(inline_command.strip())

    return sorted(dict.fromkeys(command for command in commands if command), key=lambda value: value.lower())


def detect_ports(key_files: dict[str, str], framework_result: dict | None = None) -> list[int]:
    ports: list[int] = []
    source_blob = "\n".join(key_files.values())

    dockerfile = _read_first_matching(key_files, "Dockerfile")
    ports.extend(int(port) for port in re.findall(r"EXPOSE\s+(\d+)", dockerfile, flags=re.IGNORECASE))

    compose = _read_first_matching(key_files, "docker-compose.yml", "compose.yml")
    for host_port, container_port in re.findall(r"(\d+)\s*:\s*(\d+)", compose):
        ports.extend([int(container_port), int(host_port)])

    ports.extend(int(port) for port in re.findall(r"listen\s*\(\s*(\d+)", source_blob, flags=re.IGNORECASE))
    ports.extend(int(port) for port in re.findall(r"--port\s+(\d+)", source_blob))
    ports.extend(int(port) for port in re.findall(r"port\s*=\s*(\d+)", source_blob, flags=re.IGNORECASE))

    if not ports and framework_result:
        framework = framework_result.get("detected_framework")
        defaults = {
            "FastAPI": 8000,
            "Flask": 8000,
            "Express": 3000,
            "Next.js": 3000,
            "Spring Boot": 8080,
        }
        default_port = defaults.get(framework)
        if default_port:
            ports.append(default_port)

    return sorted(dict.fromkeys(port for port in ports if port > 0))


def _extract_env_names_from_source(source_blob: str) -> list[str]:
    names = set(re.findall(r"process\.env\.([A-Z0-9_]+)", source_blob))
    names.update(re.findall(r"import\.meta\.env\.([A-Z0-9_]+)", source_blob))
    names.update(re.findall(r"os\.environ(?:\.get)?\(\s*[\"']([A-Z0-9_]+)[\"']", source_blob))
    names.update(re.findall(r"getenv\(\s*[\"']([A-Z0-9_]+)[\"']", source_blob))
    return sorted(names)


def build_runtime_chain_observations(
    entry_candidates: list[str],
    start_commands: list[str],
    build_commands: list[str],
    ports: list[int],
    key_files: dict[str, str],
    framework_result: dict | None = None,
) -> dict:
    key_map = {path.replace("\\", "/"): content for path, content in key_files.items()}
    source_blob = "\n".join(key_map.values()).lower()
    readme = _read_first_matching(key_files, "README", "README.md")
    dockerfile = _read_first_matching(key_files, "Dockerfile")

    def tri_state(value: bool | None) -> str:
        if value is True:
            return "true"
        if value is False:
            return "false"
        return "unknown"

    start_points = None
    if start_commands:
        normalized_entries = {candidate.replace("\\", "/") for candidate in entry_candidates}
        start_points = any(
            candidate in command or any(token in command.lower() for token in ("uvicorn", "gunicorn", "flask run", "npm start"))
            for command in start_commands
            for candidate in normalized_entries or {""}
        )

    runnable = None
    if entry_candidates:
        runnable = False
        for candidate in entry_candidates:
            content = key_map.get(candidate) or key_map.get(candidate.lower())
            if not content:
                continue
            lowered = content.lower()
            if any(token in lowered for token in ("app.listen", "fastapi(", "flask(", "if __name__ == \"__main__\"", "uvicorn.run", "http.listenandserve", "main(")):
                runnable = True
                break

    framework = (framework_result or {}).get("detected_framework")
    dependencies_cover = None
    if framework:
        framework_checks = {
            "FastAPI": "fastapi",
            "Flask": "flask",
            "Express": "express",
            "React": "react",
            "Next.js": "next",
            "Vue": "vue",
            "Django": "django",
            "Spring Boot": "spring-boot",
        }
        token = framework_checks.get(framework)
        if token:
            dependencies_cover = token in source_blob

    build_matches = None
    project_type = (framework_result or {}).get("detected_project_type_by_rule")
    if project_type in {"frontend_web", "fullstack"} and build_commands:
        build_matches = any("build" in command.lower() for command in build_commands)
    elif project_type in {"backend_api", "automation_tool", "mcp"}:
        build_matches = True if not build_commands else any(token in " ".join(build_commands).lower() for token in ("build", "package", "compile"))

    host_binding = None
    if source_blob:
        if any(token in source_blob for token in ("0.0.0.0", "host=\"0.0.0.0\"", "host='0.0.0.0'", "--host 0.0.0.0")):
            host_binding = True
        elif any(token in source_blob for token in ("localhost", "127.0.0.1")):
            host_binding = False

    readme_conflict = None
    readme_commands = [
        line.strip().strip("`")
        for line in readme.splitlines()
        if line.strip().strip("`").startswith(("npm ", "pnpm ", "yarn ", "python ", "uvicorn ", "node "))
    ]
    if readme_commands and start_commands:
        readme_conflict = not any(readme_command in start_commands for readme_command in readme_commands)

    docker_conflict = None
    docker_command = next(
        (line.split(maxsplit=1)[1].strip() for line in dockerfile.splitlines() if line.strip().upper().startswith(("CMD ", "ENTRYPOINT "))),
        None,
    )
    if docker_command and entry_candidates:
        docker_conflict = not any(candidate in docker_command for candidate in entry_candidates)

    return {
        "start_script_points_to_existing_entry": tri_state(start_points),
        "entry_contains_runnable_object": tri_state(runnable),
        "dependencies_cover_detected_framework": tri_state(dependencies_cover),
        "build_command_matches_project_type": tri_state(build_matches),
        "port_detected": tri_state(bool(ports)),
        "host_binding_observed": tri_state(host_binding),
        "env_vars_required": _extract_env_names_from_source("\n".join(key_map.values())),
        "readme_scripts_conflict": tri_state(readme_conflict),
        "dockerfile_entry_conflict": tri_state(docker_conflict),
    }


def analyze_entrypoints(
    file_tree: list[Any],
    key_files: dict[str, str],
    package_manager_result: dict | None = None,
    framework_result: dict | None = None,
) -> dict:
    entry_candidates = detect_entry_candidates(file_tree, key_files)
    start_commands = detect_start_commands(key_files)
    build_commands = detect_build_commands(key_files)
    ports = detect_ports(key_files, framework_result)
    runtime_observations = build_runtime_chain_observations(
        entry_candidates,
        start_commands,
        build_commands,
        ports,
        key_files,
        framework_result,
    )

    warnings: list[str] = []
    uncertain_points: list[str] = []
    if len(entry_candidates) > 1:
        uncertain_points.append("multiple_entry_candidates")
    if not entry_candidates and start_commands:
        uncertain_points.append("start_command_without_clear_entry")
    if not ports:
        warnings.append("port_not_detected")

    return {
        "has_entry_file": bool(entry_candidates),
        "entry_candidates": entry_candidates,
        "entry_summary": entry_candidates[0] if entry_candidates else None,
        "has_start_script": bool(start_commands),
        "detected_start_commands": start_commands,
        "has_build_script": bool(build_commands),
        "detected_build_commands": build_commands,
        "detected_ports": ports,
        "runtime_chain_observations": runtime_observations,
        "warnings": sorted(dict.fromkeys(warnings)),
        "uncertain_points": sorted(dict.fromkeys(uncertain_points)),
    }
