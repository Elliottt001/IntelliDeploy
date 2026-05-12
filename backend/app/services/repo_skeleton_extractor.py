from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

from app.schemas.fallback import RepoProfile
from app.services.intellideploy_github import GitHubApiError, github_request_json


IGNORE_DIRS = {
    ".git",
    ".github",
    ".idea",
    ".next",
    ".nuxt",
    ".pytest_cache",
    ".venv",
    ".vscode",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "env",
    "node_modules",
    "target",
    "venv",
}

DEPENDENCY_PATTERNS = (
    r"(^|/)package\.json$",
    r"(^|/)requirements\.txt$",
    r"(^|/)pyproject\.toml$",
    r"(^|/)Pipfile$",
    r"(^|/)poetry\.lock$",
    r"(^|/)go\.mod$",
    r"(^|/)pom\.xml$",
    r"(^|/)build\.gradle$",
    r"(^|/)Cargo\.toml$",
)

BUILD_PATTERNS = (
    r"(^|/)Dockerfile$",
    r"(^|/)docker-compose\.ya?ml$",
    r"(^|/)Makefile$",
    r"(^|/)\.dockerignore$",
)

README_PATTERNS = (
    r"(^|/)README(\.md|\.txt)?$",
)

ENTRY_PATTERNS = (
    r"(^|/)main\.py$",
    r"(^|/)app\.py$",
    r"(^|/)server\.py$",
    r"(^|/)manage\.py$",
    r"(^|/)index\.(js|ts|jsx|tsx)$",
    r"(^|/)main\.(js|ts|jsx|tsx)$",
    r"(^|/)app\.(js|ts|jsx|tsx)$",
    r"(^|/)server\.(js|ts)$",
    r"(^|/)src/main\.(js|ts|jsx|tsx)$",
    r"(^|/)src/App\.(js|ts|jsx|tsx)$",
    r"(^|/)main\.go$",
    r"(^|/)cmd/[^/]+/main\.go$",
    r"(^|/)Main\.java$",
    r"(^|/)Application\.java$",
)

LANGUAGE_EXTENSIONS = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".go": "Go",
    ".java": "Java",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
}


@dataclass(frozen=True)
class SkeletonFile:
    path: str
    content: str
    kind: str


@dataclass(frozen=True)
class RepoSkeleton:
    file_paths: list[str]
    key_files: list[SkeletonFile]
    prompt_context: str
    repo_profile: RepoProfile


class RemoteRepoSkeletonExtractor:
    def __init__(
        self,
        *,
        token: str,
        owner: str,
        repo: str,
        ref: str | None = None,
        depth: int = 2,
        max_files: int = 16,
        max_file_chars: int = 6000,
        readme_chars: int = 2000,
    ) -> None:
        self.token = token
        self.owner = owner
        self.repo = repo
        self.ref = ref
        self.depth = depth
        self.max_files = max_files
        self.max_file_chars = max_file_chars
        self.readme_chars = readme_chars

    def extract(self) -> RepoSkeleton:
        tree = self._get_tree()
        file_paths = self._filter_tree_paths(tree)
        target_paths = self._select_skeleton_paths(file_paths)
        key_files = self._fetch_key_files(target_paths)
        profile = self._build_profile(file_paths, key_files)
        return RepoSkeleton(
            file_paths=file_paths,
            key_files=key_files,
            prompt_context=self._build_prompt_context(key_files),
            repo_profile=profile,
        )

    def _get_tree(self) -> list[dict[str, Any]]:
        branch = self.ref or self._default_branch()
        ref_data = github_request_json(self.token, "GET", f"/repos/{self.owner}/{self.repo}/git/ref/heads/{branch}")
        commit_sha = ref_data.get("object", {}).get("sha") if isinstance(ref_data, dict) else None
        if not commit_sha:
            raise GitHubApiError(f"Unable to resolve branch ref for {self.owner}/{self.repo}:{branch}")

        commit = github_request_json(self.token, "GET", f"/repos/{self.owner}/{self.repo}/git/commits/{commit_sha}")
        tree_sha = commit.get("tree", {}).get("sha") if isinstance(commit, dict) else None
        if not tree_sha:
            raise GitHubApiError(f"Unable to resolve tree sha for {self.owner}/{self.repo}:{branch}")

        tree_data = github_request_json(self.token, "GET", f"/repos/{self.owner}/{self.repo}/git/trees/{tree_sha}?recursive=1")
        tree = tree_data.get("tree", []) if isinstance(tree_data, dict) else []
        return [item for item in tree if isinstance(item, dict)]

    def _default_branch(self) -> str:
        meta = github_request_json(self.token, "GET", f"/repos/{self.owner}/{self.repo}")
        if isinstance(meta, dict) and meta.get("default_branch"):
            return str(meta["default_branch"])
        return "main"

    def _filter_tree_paths(self, tree: list[dict[str, Any]]) -> list[str]:
        paths: list[str] = []
        for item in tree:
            if item.get("type") != "blob":
                continue
            path = str(item.get("path") or "").strip("/")
            if not path:
                continue
            parts = PurePosixPath(path).parts
            if any(part in IGNORE_DIRS for part in parts):
                continue
            if len(parts) > self.depth + 1:
                continue
            paths.append(path)
        return sorted(dict.fromkeys(paths), key=lambda value: (value.count("/"), value.lower()))

    def _select_skeleton_paths(self, file_paths: list[str]) -> list[str]:
        selected: list[str] = []
        for kind_patterns in (DEPENDENCY_PATTERNS, BUILD_PATTERNS, README_PATTERNS, ENTRY_PATTERNS):
            for path in file_paths:
                if path in selected:
                    continue
                if any(re.search(pattern, path, re.IGNORECASE) for pattern in kind_patterns):
                    selected.append(path)
                if len(selected) >= self.max_files:
                    return selected
        return selected

    def _fetch_key_files(self, paths: list[str]) -> list[SkeletonFile]:
        files: list[SkeletonFile] = []
        for path in paths:
            try:
                data = github_request_json(
                    self.token,
                    "GET",
                    f"/repos/{self.owner}/{self.repo}/contents/{path}",
                    allow_404=True,
                )
            except GitHubApiError:
                continue
            content = self._decode_content(data)
            if not content:
                continue
            kind = self._classify_path(path)
            limit = self.readme_chars if kind == "readme" else self.max_file_chars
            files.append(SkeletonFile(path=path, content=content[:limit], kind=kind))
        return files

    def _decode_content(self, data: Any) -> str | None:
        if not isinstance(data, dict):
            return None
        if data.get("encoding") != "base64" or not data.get("content"):
            return None
        try:
            raw = base64.b64decode(str(data["content"]).encode("utf-8"))
        except Exception:
            return None
        return raw.decode("utf-8", errors="ignore")

    def _classify_path(self, path: str) -> str:
        if any(re.search(pattern, path, re.IGNORECASE) for pattern in DEPENDENCY_PATTERNS):
            return "dependency"
        if any(re.search(pattern, path, re.IGNORECASE) for pattern in BUILD_PATTERNS):
            return "build"
        if any(re.search(pattern, path, re.IGNORECASE) for pattern in README_PATTERNS):
            return "readme"
        if any(re.search(pattern, path, re.IGNORECASE) for pattern in ENTRY_PATTERNS):
            return "entrypoint"
        return "other"

    def _build_profile(self, file_paths: list[str], key_files: list[SkeletonFile]) -> RepoProfile:
        dependency_files = [file.path for file in key_files if file.kind == "dependency"]
        entrypoints = [file.path for file in key_files if file.kind == "entrypoint"]
        build_files = [file.path for file in key_files if file.kind == "build"]
        readme = next((file.content for file in key_files if file.kind == "readme"), None)
        frameworks = self._detect_frameworks(key_files)
        languages = self._detect_languages(file_paths)
        package_manager = self._detect_package_manager(dependency_files)

        return RepoProfile(
            source_repo_url=f"https://github.com/{self.owner}/{self.repo}",
            detected_languages=languages,
            detected_frameworks=frameworks,
            package_manager=package_manager,
            entrypoints=entrypoints,
            dependency_files=dependency_files,
            has_valid_dockerfile=any(PurePosixPath(path).name == "Dockerfile" for path in build_files),
            readme_summary=self._summarize_readme(readme) if readme else None,
        )

    def _detect_languages(self, file_paths: list[str]) -> list[str]:
        languages: set[str] = set()
        for path in file_paths:
            language = LANGUAGE_EXTENSIONS.get(PurePosixPath(path).suffix)
            if language:
                languages.add(language)
        return sorted(languages)

    def _detect_frameworks(self, key_files: list[SkeletonFile]) -> list[str]:
        frameworks: list[str] = []
        package_json = next((file.content for file in key_files if PurePosixPath(file.path).name == "package.json"), "")
        if package_json:
            frameworks.extend(self._frameworks_from_package_json(package_json))

        python_deps = "\n".join(
            file.content
            for file in key_files
            if PurePosixPath(file.path).name in {"requirements.txt", "pyproject.toml", "Pipfile"}
        ).lower()
        for token, display in (("fastapi", "FastAPI"), ("flask", "Flask"), ("django", "Django")):
            if token in python_deps and display not in frameworks:
                frameworks.append(display)

        go_mod = next((file.content for file in key_files if PurePosixPath(file.path).name == "go.mod"), "")
        if "gin-gonic/gin" in go_mod and "Gin" not in frameworks:
            frameworks.append("Gin")
        return frameworks

    def _frameworks_from_package_json(self, content: str) -> list[str]:
        try:
            data = json.loads(content)
        except Exception:
            return []
        deps = {
            **(data.get("dependencies") or {}),
            **(data.get("devDependencies") or {}),
        }
        frameworks: list[str] = []
        for package_name, display in (
            ("next", "Next.js"),
            ("react", "React"),
            ("vue", "Vue"),
            ("vite", "Vite"),
            ("express", "Express"),
            ("fastify", "Fastify"),
        ):
            if package_name in deps and display not in frameworks:
                frameworks.append(display)
        return frameworks

    def _detect_package_manager(self, dependency_files: list[str]) -> str | None:
        names = {PurePosixPath(path).name for path in dependency_files}
        if "pnpm-lock.yaml" in names:
            return "pnpm"
        if "yarn.lock" in names:
            return "yarn"
        if "package-lock.json" in names or "package.json" in names:
            return "npm"
        if "poetry.lock" in names or "pyproject.toml" in names:
            return "poetry"
        if "Pipfile" in names or "requirements.txt" in names:
            return "pip"
        if "go.mod" in names:
            return "go"
        if "pom.xml" in names:
            return "maven"
        if "build.gradle" in names:
            return "gradle"
        if "Cargo.toml" in names:
            return "cargo"
        return None

    def _summarize_readme(self, content: str) -> str:
        content = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", content)
        content = re.sub(r"\[[^\]]+\]\([^)]*\)", " ", content)
        content = re.sub(r"[#>*`|_-]+", " ", content)
        normalized = " ".join(content.split())
        return normalized[: self.readme_chars]

    def _build_prompt_context(self, key_files: list[SkeletonFile]) -> str:
        sections: list[str] = []
        for file in key_files:
            sections.append(f"## {file.kind}: {file.path}\n```text\n{file.content}\n```")
        return "\n\n".join(sections)
