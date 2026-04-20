from __future__ import annotations

from typing import Any

from fallback.schemas.enums import PackageManager


DEPENDENCY_FILENAMES = [
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "go.mod",
    "cargo.toml",
    "composer.json",
    "gemfile",
]

LOCK_FILENAMES = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "uv.lock",
]


def _normalize_paths(file_tree: list[Any]) -> list[str]:
    output: list[str] = []

    def visit(node: Any, prefix: str = "") -> None:
        if isinstance(node, str):
            output.append(node.replace("\\", "/"))
            return
        if isinstance(node, dict):
            node_path = (node.get("path") or node.get("name") or "").replace("\\", "/")
            node_type = node.get("type", "file")
            path = node_path or prefix
            if path and node_type != "dir":
                output.append(path)
            for child in node.get("children", []):
                visit(child, path)

    for item in file_tree:
        visit(item)
    return output


def _normalize_key_files(key_files: dict[str, str]) -> dict[str, str]:
    return {path.replace("\\", "/").lower(): content for path, content in key_files.items()}


def _find_matching_paths(paths: list[str], target_names: list[str]) -> list[str]:
    lowered_targets = tuple(name.lower() for name in target_names)
    matches = [path for path in paths if path.lower().endswith(lowered_targets)]
    return sorted(dict.fromkeys(matches), key=lambda path: path.lower())


def collect_dependency_files(file_tree: list[Any], key_files: dict[str, str]) -> list[str]:
    paths = _normalize_paths(file_tree)
    key_file_map = _normalize_key_files(key_files)
    matches = _find_matching_paths(paths, DEPENDENCY_FILENAMES)
    for key in key_file_map:
        if key.endswith(tuple(DEPENDENCY_FILENAMES)):
            matches.append(key)
    return sorted(dict.fromkeys(matches), key=lambda path: path.lower())


def collect_lock_files(file_tree: list[Any], key_files: dict[str, str]) -> list[str]:
    paths = _normalize_paths(file_tree)
    key_file_map = _normalize_key_files(key_files)
    matches = _find_matching_paths(paths, LOCK_FILENAMES)
    for key in key_file_map:
        if key.endswith(tuple(LOCK_FILENAMES)):
            matches.append(key)
    return sorted(dict.fromkeys(matches), key=lambda path: path.lower())


def detect_package_manager(file_tree: list[Any], key_files: dict[str, str]) -> dict:
    dependency_files = collect_dependency_files(file_tree, key_files)
    lock_files = collect_lock_files(file_tree, key_files)
    warnings: list[str] = []

    dependency_names = {path.rsplit("/", 1)[-1].lower() for path in dependency_files}
    lock_names = {path.rsplit("/", 1)[-1].lower() for path in lock_files}

    manager = PackageManager.UNKNOWN.value
    confidence = "low"

    if "pnpm-lock.yaml" in lock_names:
        manager = PackageManager.PNPM.value
        confidence = "high"
    elif "yarn.lock" in lock_names:
        manager = PackageManager.YARN.value
        confidence = "high"
    elif "package-lock.json" in lock_names:
        manager = PackageManager.NPM.value
        confidence = "high"
    elif "pyproject.toml" in dependency_names and "poetry.lock" in lock_names:
        manager = PackageManager.POETRY.value
        confidence = "high"
    elif "pyproject.toml" in dependency_names and "uv.lock" in lock_names:
        manager = PackageManager.UV.value
        confidence = "high"
    elif "pom.xml" in dependency_names:
        manager = PackageManager.MAVEN.value
        confidence = "medium"
    elif "build.gradle" in dependency_names or "build.gradle.kts" in dependency_names:
        manager = PackageManager.GRADLE.value
        confidence = "medium"
    elif "go.mod" in dependency_names:
        manager = PackageManager.GO.value
        confidence = "medium"
    elif "cargo.toml" in dependency_names:
        manager = PackageManager.CARGO.value
        confidence = "medium"
    elif "composer.json" in dependency_names:
        manager = PackageManager.COMPOSER.value
        confidence = "medium"
    elif "gemfile" in dependency_names:
        manager = PackageManager.BUNDLER.value
        confidence = "medium"
    elif "requirements.txt" in dependency_names:
        manager = PackageManager.PIP.value
        confidence = "medium"
    elif "package.json" in dependency_names:
        manager = PackageManager.NPM.value
        confidence = "low"
        warnings.append("missing_node_lockfile")

    if "requirements.txt" in dependency_names and "pyproject.toml" in dependency_names:
        warnings.append("multi_python_dependency_definition")

    ecosystems_detected = {
        "node" if "package.json" in dependency_names else None,
        "python" if {"requirements.txt", "pyproject.toml"} & dependency_names else None,
        "java" if {"pom.xml", "build.gradle", "build.gradle.kts"} & dependency_names else None,
        "go" if "go.mod" in dependency_names else None,
        "rust" if "cargo.toml" in dependency_names else None,
        "php" if "composer.json" in dependency_names else None,
        "ruby" if "gemfile" in dependency_names else None,
    }
    ecosystems_detected.discard(None)
    if len(ecosystems_detected) > 1:
        warnings.append("multi_package_manager_detected")

    return {
        "package_manager": manager,
        "dependency_files": dependency_files,
        "lock_files": lock_files,
        "package_manager_confidence": confidence,
        "warnings": sorted(dict.fromkeys(warnings)),
    }
