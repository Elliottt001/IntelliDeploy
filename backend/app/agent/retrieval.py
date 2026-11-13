from __future__ import annotations

import asyncio
import hashlib
from urllib.parse import urlsplit, urlunsplit

from app.agent.query import deterministic_queries
from app.agent.repository_index import RepositoryIndex, index_readme_candidates
from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient, EmptyRepository
from app.agent_core.memory.vector_store import ReadmeSearchResult
from app.core.types import Requirement, RetrievalCandidate, RetrievalResult


class SearchUnavailable(RuntimeError):
    retryable = True


def normalize_candidate(
    candidate: RepositoryCandidate | RetrievalCandidate | dict,
) -> dict:
    if isinstance(candidate, (RepositoryCandidate, RetrievalCandidate)):
        row = candidate.model_dump(mode="json")
    else:
        row = dict(candidate)
    row["repo_url"] = row.get("repo_url") or row.get("html_url")
    row["last_commit_at"] = row.get("last_commit_at") or row.get("pushed_at")
    row["file_tree"] = row.get("file_tree") or row.get("files") or []
    row["key_files"] = row.get("key_files") or {}
    return row


def requirement_queries(requirement: Requirement) -> list[str]:
    return deterministic_queries(requirement).github_queries


def _canonical_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme != "https" or parsed.netloc.lower() != "github.com":
        return value.rstrip("/")
    path = parsed.path.rstrip("/")
    if path.endswith(".git"):
        path = path[:-4]
    return urlunsplit(("https", "github.com", path, "", ""))


def _valid_commit(value) -> bool:
    return isinstance(value, str) and len(value) == 40 and all(
        character in "0123456789abcdef" for character in value.lower()
    )


def _readme_row(value) -> dict:
    if isinstance(value, ReadmeSearchResult):
        document = value.document
        metadata = dict(document.metadata)
        return {
            **metadata,
            "repo_url": metadata.get("repo_url") or document.repo_id,
            "description": metadata.get("description") or document.description,
            "source_scores": {"readme": value.score},
        }
    return normalize_candidate(value)


def _merge_rows(rows: list[tuple[str, dict]]) -> list[RetrievalCandidate]:
    merged: dict[str, dict] = {}
    source_order = {"github": 0, "readme": 1, "verified_index": 2}
    for source, raw in rows:
        row = normalize_candidate(raw)
        url = row.get("repo_url")
        if not isinstance(url, str) or not url:
            continue
        canonical = _canonical_url(url)
        current = merged.setdefault(
            canonical,
            {
                "repo_url": canonical,
                "commit_values": set(),
                "description": "",
                "stars": 0,
                "last_commit_at": None,
                "sources": [],
                "source_scores": {},
                "statuses": [],
                "file_tree": [],
                "key_files": {},
                "compatibility": "UNKNOWN",
            },
        )
        commit = row.get("commit")
        if _valid_commit(commit):
            current["commit_values"].add(commit.lower())
        if source not in current["sources"]:
            current["sources"].append(source)
        current["source_scores"].update(row.get("source_scores") or {})
        if source not in current["source_scores"]:
            current["source_scores"][source] = float(row.get("score") or 0)
        current["description"] = current["description"] or str(
            row.get("description") or ""
        )
        current["stars"] = max(current["stars"], int(row.get("stars") or 0))
        current["last_commit_at"] = (
            current["last_commit_at"] or row.get("last_commit_at")
        )
        current["file_tree"] = current["file_tree"] or row.get("file_tree") or []
        current["key_files"] = current["key_files"] or row.get("key_files") or {}
        current["compatibility"] = (
            row.get("compatibility") or current["compatibility"]
        )
        current["statuses"].append(
            row.get("enrichment_status")
            or ("COMPLETE" if _valid_commit(commit) else "PARTIAL")
        )

    candidates = []
    for row in merged.values():
        commits = row.pop("commit_values")
        statuses = row.pop("statuses")
        commit = next(iter(commits)) if len(commits) == 1 else None
        if "FAILED" in statuses and not commit:
            status = "FAILED"
        elif len(commits) != 1 or "PARTIAL" in statuses or "FAILED" in statuses:
            status = "PARTIAL"
        else:
            status = "COMPLETE"
        row["sources"].sort(key=source_order.__getitem__)
        candidates.append(
            RetrievalCandidate(
                **row,
                commit=commit,
                enrichment_status=status,
            )
        )
    return candidates


async def retrieve_sources(
    requirement: Requirement,
    query_plan=None,
    github_client=None,
    repository_index=None,
    readme_search=None,
) -> RetrievalResult:
    client = github_client or GitHubRepositorySearchClient()
    plan = query_plan or deterministic_queries(requirement)
    index = repository_index or RepositoryIndex()
    github_queries = list(dict.fromkeys(plan.github_queries))
    tasks = [
        client.search_repositories(query, per_page=20) for query in github_queries
    ]
    if readme_search is not None:
        tasks.append(
            asyncio.to_thread(readme_search.search, plan.readme_queries, 20)
        )
    tasks.append(asyncio.to_thread(index_readme_candidates, index, plan))
    results = await asyncio.gather(*tasks, return_exceptions=True)

    errors: list[str] = []
    reuse_rejections: list[dict] = []
    collected: list[tuple[str, dict]] = []
    enrichment_cache = {}
    prepared_keys = {}
    semaphore = asyncio.Semaphore(4)

    def enrichment_key(row):
        return (_canonical_url(str(row.get("repo_url") or "")).casefold(),
                row.get("default_branch"), row.get("commit"))

    async def enrich(value):
        async with semaphore:
            try:
                return normalize_candidate(await client.enrich_repository(value)), None
            except Exception as exc:
                return None, exc

    for result in results[:len(github_queries)]:
        if isinstance(result, BaseException):
            continue
        for value in result:
            row = normalize_candidate(value)
            if not _valid_commit(row.get("commit")) and hasattr(client, "enrich_repository"):
                key = enrichment_key(row)
                prepared_keys[id(value)] = key
                if key not in enrichment_cache:
                    enrichment_cache[key] = asyncio.create_task(enrich(value))
    if enrichment_cache:
        keys = list(enrichment_cache)
        values = await asyncio.gather(*enrichment_cache.values())
        enrichment_cache = dict(zip(keys, values, strict=True))
    reported_errors = set()
    github_results = results[: len(github_queries)]
    for query, result in zip(github_queries, github_results, strict=True):
        if isinstance(result, BaseException):
            errors.append(f"{query}: {type(result).__name__}: {result}")
            continue
        for value in result:
            row = normalize_candidate(value)
            if id(value) in prepared_keys:
                cache_key = prepared_keys[id(value)]
                enriched, error = enrichment_cache[cache_key]
                if error is not None and cache_key not in reported_errors:
                    reported_errors.add(cache_key)
                    if isinstance(error, EmptyRepository):
                        reuse_rejections.append({"repo_url": row.get("repo_url"), "reason": "empty_repository", "evidence": "github_git_tree_409"})
                    else:
                        errors.append(f"{row.get('repo_url')}: {type(error).__name__}: {error}")
                if isinstance(error, EmptyRepository):
                    continue
                if error is not None:
                    row["enrichment_status"] = "FAILED"
                else:
                    row = {**enriched,
                           "stars": max(int(enriched.get("stars") or 0), int(row.get("stars") or 0)),
                           "source_scores": {**(enriched.get("source_scores") or {}), **(row.get("source_scores") or {})}}
            collected.append(("github", row))

    cursor = len(github_queries)
    if readme_search is not None:
        readme_result = results[cursor]
        cursor += 1
        if isinstance(readme_result, BaseException):
            errors.append(
                f"readme: {type(readme_result).__name__}: {readme_result}"
            )
        else:
            collected.extend(
                ("readme", _readme_row(row)) for row in readme_result
            )
    index_result = results[cursor]
    if isinstance(index_result, BaseException):
        errors.append(f"index: {type(index_result).__name__}: {index_result}")
    else:
        collected.extend(
            ("verified_index", row.model_dump(mode="json"))
            for row in index_result
        )

    index_version = None
    if index.items:
        index_version = hashlib.sha256(
            index.model_dump_json().encode("utf-8")
        ).hexdigest()
    return RetrievalResult(
        queries=github_queries,
        completed=not errors,
        candidates=_merge_rows(collected),
        index_version=index_version,
        errors=errors,
        reuse_rejections=reuse_rejections,
    )
