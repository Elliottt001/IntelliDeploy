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
        contents_path = f"/repos/{owner_repo}/contents"
        params = {"ref": branch} if branch else None
        contents = await self._request_json(contents_path, params=params, allow_404=True)
        if isinstance(contents, list):
            candidate.files = sorted(
                {item.get("name", "") for item in contents if item.get("name")}
            )

        if not candidate.readme_snippet:
            readme = await self._request_json(
                f"/repos/{owner_repo}/readme", params=params, allow_404=True
            )
            if isinstance(readme, dict) and readme.get("content"):
                try:
                    decoded = base64.b64decode(readme["content"]).decode(
                        "utf-8", errors="ignore"
                    )
                    candidate.readme_snippet = clean_readme_text(decoded)[:1000]
                except Exception:
                    candidate.readme_snippet = ""

        return candidate

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
            html_url=item.get("html_url", ""),
            description=item.get("description") or "",
            stars=int(item.get("stargazers_count") or 0),
            forks=int(item.get("forks_count") or 0),
            open_issues_count=item.get("open_issues_count"),
            pushed_at=item.get("pushed_at"),
            language=item.get("language"),
            topics=list(item.get("topics") or []),
            default_branch=item.get("default_branch"),
            source_scores={"github": 1.0},
        )
