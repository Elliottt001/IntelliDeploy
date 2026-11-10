from __future__ import annotations

import asyncio
import re

from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient
from app.core.types import Requirement, RetrievalResult


class SearchUnavailable(RuntimeError):
    retryable = True


def normalize_candidate(candidate: RepositoryCandidate | dict) -> dict:
    row = candidate.model_dump(mode="json") if isinstance(candidate, RepositoryCandidate) else dict(candidate)
    row["repo_url"] = row.get("repo_url") or row.get("html_url")
    row["last_commit_at"] = row.get("last_commit_at") or row.get("pushed_at")
    row["file_tree"] = row.get("file_tree") or row.get("files") or []
    row["key_files"] = row.get("key_files") or {}
    return row


def requirement_queries(requirement: Requirement) -> list[str]:
    original = " ".join(requirement.prompt.split())
    chinese = " ".join(re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9_.+-]+", original)[:8])
    translations = []
    for source, target in (("梦境", "dream journal"), ("笔记", "notes app"), ("记录", "tracker"),
                           ("搜索", "search app"), ("实时", "real time"), ("多人", "multi user")):
        if source in original:
            translations.append(target)
    english = " ".join(translations) or "web application"
    return list(dict.fromkeys([original, f"{chinese} web app", f"{english} open source"]))


async def retrieve_sources(requirement: Requirement, github_client=None) -> RetrievalResult:
    client = github_client or GitHubRepositorySearchClient()
    queries = requirement_queries(requirement)
    errors: list[str] = []
    found: dict[str, RepositoryCandidate] = {}
    for query in queries:
        try:
            rows = await client.search_repositories(query, per_page=20)
        except Exception as exc:
            errors.append(f"{query}: {type(exc).__name__}: {exc}")
            continue
        for row in rows:
            found.setdefault(row.repo_key, row)
    enriched = []
    for row in found.values():
        try:
            enriched.append(await client.enrich_repository(row))
        except Exception as exc:
            errors.append(f"{row.repo_url}: {type(exc).__name__}: {exc}")
    return RetrievalResult(queries=queries, completed=not errors,
                           candidates=[normalize_candidate(row) for row in enriched], errors=errors)

