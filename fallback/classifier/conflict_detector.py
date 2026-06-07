from __future__ import annotations

import json
import re


def _read_first_matching(key_files: dict[str, str], *names: str) -> str:
    normalized = {path.replace("\\", "/").lower(): content for path, content in key_files.items()}
    for name in names:
        for path, content in normalized.items():
            if path.endswith(name.lower()):
                return content
    return ""


def detect_readme_script_conflicts(repo_fact_summary: dict, key_files: dict[str, str]) -> list[str]:
    conflicts: list[str] = []
    readme = _read_first_matching(key_files, "README", "README.md")
    package_json = _read_first_matching(key_files, "package.json")
    scripts = {}
    if package_json:
        try:
            scripts = (json.loads(package_json).get("scripts") or {})
        except json.JSONDecodeError:
            scripts = {}

    if "npm start" in readme.lower() and "start" not in scripts:
        conflicts.append("readme_start_missing_script")
    if "npm run dev" in readme.lower() and "dev" not in scripts:
        conflicts.append("readme_dev_missing_script")

    return conflicts


def detect_dockerfile_entry_conflicts(repo_fact_summary: dict, key_files: dict[str, str]) -> list[str]:
    conflicts: list[str] = []
    dockerfile = _read_first_matching(key_files, "Dockerfile")
    if not dockerfile:
        return conflicts

    command = next(
        (line.split(maxsplit=1)[1].strip() for line in dockerfile.splitlines() if line.strip().upper().startswith(("CMD ", "ENTRYPOINT "))),
        None,
    )
    if command and repo_fact_summary.get("entry_candidates"):
        if not any(entry in command for entry in repo_fact_summary["entry_candidates"]) and not any(
            token in command.lower() for token in ("uvicorn", "gunicorn", "flask run", "npm start", "node ", "python ")
        ):
            conflicts.append("dockerfile_entry_conflict")

    docker_ports = re.findall(r"EXPOSE\s+(\d+)", dockerfile, flags=re.IGNORECASE)
    if docker_ports and repo_fact_summary.get("detected_ports"):
        docker_port_set = {int(port) for port in docker_ports}
        detected_port_set = set(repo_fact_summary["detected_ports"])
        if docker_port_set.isdisjoint(detected_port_set):
            conflicts.append("dockerfile_port_conflict")

    return conflicts


def detect_framework_entry_conflicts(repo_fact_summary: dict, key_files: dict[str, str]) -> list[str]:
    conflicts: list[str] = []
    source_blob = "\n".join(key_files.values()).lower()
    framework = repo_fact_summary.get("detected_framework")

    if framework == "FastAPI" and "fastapi(" not in source_blob and "fastapi" not in source_blob:
        conflicts.append("framework_fastapi_without_evidence")
    if framework in {"React", "Vite"}:
        has_frontend_entry = any(
            entry.endswith(("src/main.tsx", "src/App.tsx", "app/page.tsx", "pages/index.tsx"))
            for entry in repo_fact_summary.get("entry_candidates", [])
        )
        if not has_frontend_entry or not repo_fact_summary.get("has_build_script"):
            conflicts.append("framework_frontend_without_entry_or_build")

    return conflicts


def detect_port_conflicts(repo_fact_summary: dict, key_files: dict[str, str]) -> list[str]:
    conflicts: list[str] = []
    compose = _read_first_matching(key_files, "docker-compose.yml", "compose.yml")
    compose_ports = {int(container) for _, container in re.findall(r"(\d+)\s*:\s*(\d+)", compose)}
    detected_ports = set(repo_fact_summary.get("detected_ports", []))
    if compose_ports and detected_ports and compose_ports.isdisjoint(detected_ports):
        conflicts.append("compose_port_conflict")
    return conflicts


def detect_script_path_conflicts(repo_fact_summary: dict, key_files: dict[str, str]) -> list[str]:
    conflicts: list[str] = []
    paths = set(repo_fact_summary.get("entry_candidates", []))
    package_json = _read_first_matching(key_files, "package.json")
    if not package_json:
        return conflicts
    try:
        scripts = (json.loads(package_json).get("scripts") or {})
    except json.JSONDecodeError:
        return conflicts

    for script in scripts.values():
        match = re.search(r"(?:node|python)\s+([^\s]+)", str(script))
        if match and match.group(1) not in paths:
            conflicts.append("script_points_to_missing_entry")
            break
    return conflicts


def detect_framework_config_conflicts(repo_fact_summary: dict, key_files: dict[str, str]) -> list[str]:
    """分类阶段就发现「声明了前端框架插件却缺对应 vite/build 配置」这类问题。

    这是和 validators.framework_config_validator 同源的规则（复用同一份
    FRAMEWORK_CONFIG_RULES，避免双写漂移）。把信号塞进 conflict_items 让
    classifier 的 scoring 看见 —— 一个真实仓库如果有这类问题会被减分，
    更可能被打回 Decision C 让我们重生成完整脚手架，而不是硬走 Decision A
    白白浪费一次 Kaniko 构建。
    """
    from fallback.validators.framework_config_validator import (
        FRAMEWORK_CONFIG_RULES,
        _collect_declared_deps,
    )

    pkg = _read_first_matching(key_files, "package.json")
    if not pkg:
        return []

    declared = _collect_declared_deps(pkg)
    if not declared:
        return []

    conflicts: list[str] = []
    for rule in FRAMEWORK_CONFIG_RULES:
        if not rule["requires_deps"].issubset(declared):
            continue
        config_texts = [
            _read_first_matching(key_files, name).lower() for name in rule["config_files"]
        ]
        mentions = tuple(token.lower() for token in rule["config_must_mention"])
        satisfied = any(
            text and any(token in text for token in mentions) for text in config_texts
        )
        if not satisfied:
            conflicts.append(rule["error_code"].lower())
    return conflicts


def detect_all_conflicts(repo_fact_summary: dict, key_files: dict[str, str]) -> dict:
    conflict_items = (
        detect_readme_script_conflicts(repo_fact_summary, key_files)
        + detect_dockerfile_entry_conflicts(repo_fact_summary, key_files)
        + detect_framework_entry_conflicts(repo_fact_summary, key_files)
        + detect_port_conflicts(repo_fact_summary, key_files)
        + detect_script_path_conflicts(repo_fact_summary, key_files)
        + detect_framework_config_conflicts(repo_fact_summary, key_files)
    )
    return {
        "conflict_items": sorted(dict.fromkeys(conflict_items)),
        "warnings": [],
    }
