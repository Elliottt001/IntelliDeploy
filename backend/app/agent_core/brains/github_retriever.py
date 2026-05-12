from __future__ import annotations

import base64
import itertools
from typing import Sequence

import httpx

from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.memory.vector_store import clean_readme_text
from app.config import settings


class GitHubSearchError(Exception):
    pass


class GitHubTokenPool:
    """Round-robin token provider for GitHub Search API calls."""

    def __init__(self, tokens: Sequence[str] | None = None):
        clean_tokens = [token.strip() for token in (tokens or []) if token.strip()]
        self._tokens = clean_tokens
        self._cycle = itertools.cycle(clean_tokens) if clean_tokens else None

    @classmethod
    def from_settings(cls) -> "GitHubTokenPool":
        configured = getattr(settings, "GITHUB_SEARCH_TOKENS", "")
        tokens = [token.strip() for token in configured.split(",") if token.strip()]
        github_token = getattr(settings, "GITHUB_TOKEN", "")
        if github_token:
            tokens.append(github_token)
        return cls(tokens)

    def next_token(self) -> str | None:
        if self._cycle is None:
            return None
        return next(self._cycle)


class GitHubRepositorySearchClient:
    def __init__(
        self,
        token_pool: GitHubTokenPool | None = None,
        timeout_seconds: float | None = None,
        api_base: str = "https://api.github.com",
    ):
        self.token_pool = token_pool or GitHubTokenPool.from_settings()
        self.timeout_seconds = timeout_seconds or settings.GITHUB_SEARCH_TIMEOUT_SECONDS
        self.api_base = api_base.rstrip("/")

    async def search_repositories(
        self, query: str, per_page: int = 20
    ) -> list[RepositoryCandidate]:
        params = {
            "q": query,
            "sort": "stars",
            "order": "desc",
            "per_page": str(per_page),
        }
        data = await self._request_json("/search/repositories", params=params)
        items = data.get("items", []) if isinstance(data, dict) else []
        return [self._candidate_from_search_item(item) for item in items]

    async def enrich_repository(
        self, candidate: RepositoryCandidate
    ) -> RepositoryCandidate:
        owner_repo = candidate.full_name
        branch = candidate.default_branch

        # Root contents are cheap and give the hard-rule scorer quick evidence
        # for package managers, Dockerfiles, and common framework files.
        contents_path = f"/repos/{owner_repo}/contents"
        params = {"ref": branch} if branch else None
        contents = await self._request_json(contents_path, params=params, allow_404=True)
        if isinstance(contents, list):
            candidate.files = sorted(
                {item.get("name", "") for item in contents if item.get("name")}
            )

        # The interface contract asks for a file tree. GitHub's recursive tree
        # endpoint is a good fit, and we cap the stored tree to protect payload
        # size for unusually large repositories.
        if branch:
            tree = await self._request_json(
                f"/repos/{owner_repo}/git/trees/{branch}",
                params={"recursive": "1"},
                allow_404=True,
            )
            if isinstance(tree, dict) and isinstance(tree.get("tree"), list):
                candidate.file_tree = [
                    item["path"]
                    for item in tree["tree"][:500]
                    if item.get("type") == "blob" and item.get("path")
                ]

        await self._attach_readme(owner_repo, branch, candidate)
        await self._attach_key_files(owner_repo, branch, candidate)

        return candidate

    async def _attach_readme(
        self, owner_repo: str, branch: str | None, candidate: RepositoryCandidate
    ) -> None:
        params = {"ref": branch} if branch else None
        readme = await self._request_json(
            f"/repos/{owner_repo}/readme", params=params, allow_404=True
        )
        if not isinstance(readme, dict) or not readme.get("content"):
            return

        decoded = self._decode_content(readme)
        if decoded is None:
            return

        readme_name = readme.get("name") or "README.md"
        candidate.key_files.setdefault(readme_name, decoded)
        if not candidate.readme_snippet:
            candidate.readme_snippet = clean_readme_text(decoded)[:1000]

    async def _attach_key_files(
        self, owner_repo: str, branch: str | None, candidate: RepositoryCandidate
    ) -> None:
        key_paths = self._select_key_paths(candidate.file_tree or candidate.files)
        for path in key_paths[:12]:
            if path in candidate.key_files:
                continue
            params = {"ref": branch} if branch else None
            content = await self._request_json(
                f"/repos/{owner_repo}/contents/{path}", params=params, allow_404=True
            )
            if isinstance(content, dict):
                decoded = self._decode_content(content)
                if decoded is not None:
                    candidate.key_files[path] = decoded[:20000]

    @staticmethod
    def _decode_content(payload: dict) -> str | None:
        try:
            return base64.b64decode(payload["content"]).decode("utf-8", errors="ignore")
        except Exception:
            return None

    @staticmethod
    def _select_key_paths(paths: list[str]) -> list[str]:
        selected: list[str] = []
        for path in paths:
            name = path.replace("\\", "/").rsplit("/", 1)[-1].lower()
            if name in _KEY_FILE_NAMES or path.lower() in _KEY_FILE_NAMES:
                selected.append(path)
        return selected

    async def _request_json(
        self,
        path: str,
        params: dict[str, str] | None = None,
        allow_404: bool = False,
    ):
        url = f"{self.api_base}{path}"
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "IntelliDeploy",
        }
        token = self.token_pool.next_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.get(url, params=params, headers=headers)

        if allow_404 and response.status_code == 404:
            return None
        if response.status_code in {403, 429}:
            raise GitHubSearchError("GitHub search rate limit exceeded")
        if response.status_code >= 400:
            raise GitHubSearchError(
                f"GitHub API request failed: {response.status_code} {response.text[:200]}"
            )
        return response.json()

    @staticmethod
    def _candidate_from_search_item(item: dict) -> RepositoryCandidate:
        return RepositoryCandidate(
            full_name=item.get("full_name", ""),
            repo_url=item.get("html_url", ""),
            html_url=item.get("html_url", ""),
            description=item.get("description") or "",
            stars=int(item.get("stargazers_count") or 0),
            forks=int(item.get("forks_count") or 0),
            open_issues_count=item.get("open_issues_count"),
            pushed_at=item.get("pushed_at"),
            last_commit_at=item.get("pushed_at"),
            language=item.get("language"),
            topics=list(item.get("topics") or []),
            default_branch=item.get("default_branch"),
            is_archived=bool(item.get("archived") or False),
            source_scores={"github_search": 1.0},
        )


_KEY_FILE_NAMES = {
    "readme.md",
    "readme",
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "pom.xml",
    "go.mod",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "uv.lock",
    "dockerfile",
    "docker-compose.yml",
    "makefile",
    "main.py",
    "app.py",
    "server.js",
    "index.js",
    "main.ts",
    "vite.config.ts",
    "next.config.js",
    "procfile",
}
