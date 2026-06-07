from __future__ import annotations

import base64
import hashlib
import itertools
import json
import logging
import time
from typing import Sequence

import httpx

from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.memory.vector_store import clean_readme_text
from app.config import settings
from app.services.redis_client import RedisClient, get_redis_client

logger = logging.getLogger(__name__)


class GitHubSearchError(Exception):
    pass


class GitHubTokenPool:
    """Redis-backed GitHub token provider with rate-limit awareness.

    Token state is persisted so multiple API workers avoid repeatedly picking a
    token that GitHub has already exhausted. When Redis is disabled the shared
    RedisClient transparently falls back to process memory, which keeps local
    tests and demos dependency-free.
    """

    def __init__(
        self,
        tokens: Sequence[str] | None = None,
        redis_client: RedisClient | None = None,
        cooldown_seconds: int = 300,
        namespace: str = "github_search_tokens",
    ):
        clean_tokens = [token.strip() for token in (tokens or []) if token.strip()]
        self._tokens = clean_tokens
        self._cycle = itertools.cycle(clean_tokens) if clean_tokens else None
        self.redis = redis_client or get_redis_client()
        self.cooldown_seconds = cooldown_seconds
        self.namespace = namespace

    @classmethod
    def from_settings(cls) -> "GitHubTokenPool":
        configured = getattr(settings, "GITHUB_SEARCH_TOKENS", "")
        tokens = [token.strip() for token in configured.split(",") if token.strip()]
        github_token = getattr(settings, "GITHUB_TOKEN", "")
        if github_token and github_token not in tokens:
            tokens.append(github_token)

        if not tokens:
            logger.warning(
                "GitHub token pool is empty. Set GITHUB_SEARCH_TOKENS "
                "(comma-separated) or GITHUB_TOKEN in backend/.env. "
                "Without tokens, GitHub Search is limited to ~10 req/min by IP "
                "and RAG retrieval will return empty candidates."
            )
        else:
            logger.info(
                "GitHub token pool initialized with %d token(s).", len(tokens)
            )
        return cls(tokens)

    def next_token(self) -> str | None:
        """Compatibility shim for old call sites.

        New network code should use ``await acquire_token()`` so it can consult
        the persisted rate-limit state.
        """
        if self._cycle is None:
            return None
        return next(self._cycle)

    async def acquire_token(self) -> str | None:
        if not self._tokens:
            return None

        now = int(time.time())
        best_token: str | None = None
        best_remaining = -1

        for token in self._tokens:
            state = await self._get_state(token)
            cooled_until = int(state.get("cooled_until") or 0)
            reset_at = int(state.get("reset_at") or 0)
            remaining = int(state.get("remaining") or 5000)

            if cooled_until > now:
                continue
            if remaining <= 0 and reset_at > now:
                await self._set_state(token, {**state, "cooled_until": reset_at})
                continue

            if remaining > best_remaining:
                best_token = token
                best_remaining = remaining

        return best_token

    async def record_response(self, token: str | None, response: httpx.Response) -> None:
        if not token:
            return

        remaining = _safe_int(response.headers.get("x-ratelimit-remaining"))
        reset_at = _safe_int(response.headers.get("x-ratelimit-reset"))
        now = int(time.time())

        state = await self._get_state(token)
        if remaining is not None:
            state["remaining"] = remaining
        if reset_at is not None:
            state["reset_at"] = reset_at

        if response.status_code in {403, 429} or remaining == 0:
            state["cooled_until"] = reset_at or (now + self.cooldown_seconds)
        else:
            state["cooled_until"] = 0

        await self._set_state(token, state)

    async def cooldown_token(self, token: str | None, seconds: int | None = None) -> None:
        if not token:
            return
        state = await self._get_state(token)
        state["remaining"] = 0
        state["cooled_until"] = int(time.time()) + (seconds or self.cooldown_seconds)
        await self._set_state(token, state)

    async def _get_state(self, token: str) -> dict:
        raw = await self.redis.get(self._state_key(token))
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    async def _set_state(self, token: str, state: dict) -> None:
        await self.redis.set(
            self._state_key(token),
            json.dumps(state),
            ex=max(self.cooldown_seconds * 2, 600),
        )

    def _state_key(self, token: str) -> str:
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
        return f"{self.namespace}:{digest}"


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

        # 来自 GitHub Search 的 candidate 通常带 default_branch；但当候选来自
        # README BM25 / 用户手动指定时常常是 None，下面 `if branch:` 守卫会
        # 静默跳过 tree 抓取，最终 file_tree=[] → fallback 误判为空仓。
        # 主动调一次 /repos/{owner_repo} 把 default_branch 取回来。
        if not branch:
            repo_meta = await self._request_json(f"/repos/{owner_repo}", allow_404=True)
            if isinstance(repo_meta, dict):
                branch = repo_meta.get("default_branch") or None
                if branch:
                    candidate.default_branch = branch

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
                # GitHub 在仓库特别大时会切断响应并标 truncated=true。
                # 我们的 classifier 只看前 500 条已经够用，但要 warn 一声，
                # 否则上层把"部分 tree"误当作"全 tree"，分类决策会偏。
                if tree.get("truncated"):
                    logger.warning(
                        "github tree truncated for %s (branch=%s); only first %d blobs analyzed",
                        owner_repo,
                        branch,
                        len(candidate.file_tree),
                    )
        else:
            # 走到这里说明 candidate.full_name 都查不到 default_branch ——
            # 八成是仓库不存在 / 私有无权限 / GitHub 返回非 dict（罕见）。
            # 不要假装没事发生，下游会拿到空 file_tree 然后误判。
            logger.warning(
                "github enrichment skipped tree fetch for %s: no default branch resolved",
                owner_repo,
            )

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
        attempts = max(len(self.token_pool._tokens), 1)
        rate_limit_errors: list[str] = []

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            for _ in range(attempts):
                headers = {
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "IntelliDeploy",
                }
                token = await self.token_pool.acquire_token()
                if token:
                    headers["Authorization"] = f"Bearer {token}"

                response = await client.get(url, params=params, headers=headers)
                await self.token_pool.record_response(token, response)

                if allow_404 and response.status_code == 404:
                    return None
                if response.status_code in {403, 429}:
                    rate_limit_errors.append(response.text[:200])
                    await self.token_pool.cooldown_token(token)
                    if token:
                        continue
                    break
                if response.status_code >= 400:
                    raise GitHubSearchError(
                        f"GitHub API request failed: {response.status_code} {response.text[:200]}"
                    )
                return response.json()

        detail = "; ".join(rate_limit_errors) or "all configured tokens are cooling down"
        raise GitHubSearchError(f"GitHub search rate limit exceeded: {detail}")

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


def _safe_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
