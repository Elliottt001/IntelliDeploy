from __future__ import annotations

import fcntl
import hashlib
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field

from app.agent.contracts import QueryPlan
from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.memory.vector_store import BM25ReadmeStore, ReadmeDocument
from app.core.types import RetrievalCandidate


class RepositoryIndex(BaseModel):
    schema_version: int = 1
    generated_at: datetime | None = None
    items: list[dict] = Field(default_factory=list)


class IndexUpdateReport(BaseModel):
    updated: int = 0
    unchanged: int = 0
    failed: list[dict] = Field(default_factory=list)
    snapshot_version: str | None = None


def index_readme_candidates(
    index: RepositoryIndex, query_plan: QueryPlan
) -> list[RetrievalCandidate]:
    store = BM25ReadmeStore()
    rows: dict[str, dict] = {}
    documents = []
    for row in index.items:
        url = row.get("repo_url")
        readme = row.get("readme")
        if not isinstance(url, str) or not isinstance(readme, str):
            continue
        rows[url] = row
        documents.append(
            ReadmeDocument(
                repo_id=url,
                full_name=str(row.get("full_name") or url),
                description=str(row.get("description") or ""),
                readme_content=readme,
            )
        )
    store.upsert_many(documents)
    candidates = []
    for result in store.search(query_plan.readme_queries, top_k=20):
        row = rows[result.document.repo_id]
        ready = row.get("status") == "READY"
        commit = row.get("commit")
        candidates.append(
            RetrievalCandidate(
                repo_url=result.document.repo_id,
                commit=commit if isinstance(commit, str) else None,
                description=str(row.get("description") or ""),
                stars=max(0, int(row.get("stars") or 0)),
                sources=["verified_index"],
                source_scores={"verified_index": result.score},
                enrichment_status=(
                    "COMPLETE"
                    if ready and isinstance(commit, str) and len(commit) == 40
                    else "PARTIAL"
                ),
                file_tree=row.get("file_tree") or [],
                key_files=row.get("key_files") or {},
            )
        )
    return candidates


def load_index(path: Path) -> RepositoryIndex:
    if not path.exists():
        return RepositoryIndex()
    try:
        result = RepositoryIndex.model_validate_json(path.read_text())
    except Exception as exc:
        raise ValueError("repository index is incomplete or invalid") from exc
    if result.schema_version != 1:
        raise ValueError("unsupported repository index schema")
    return result


def _identity(url: str) -> str:
    prefix = "https://github.com/"
    if not url.startswith(prefix) or len(url.removeprefix(prefix).split("/")) != 2:
        raise ValueError("seed must be an HTTPS GitHub repository")
    return url.removeprefix(prefix).removesuffix(".git")


async def update_index(seeds: list[str], destination: Path, github_client) -> IndexUpdateReport:
    destination.parent.mkdir(parents=True, exist_ok=True)
    lock_path = destination.with_suffix(destination.suffix + ".lock")
    with lock_path.open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        previous = load_index(destination)
        old = {row.get("repo_url"): row for row in previous.items}
        merged = dict(old)
        report = IndexUpdateReport()
        for url in dict.fromkeys(seeds):
            try:
                full_name = _identity(url)
                row = await github_client.enrich_repository(RepositoryCandidate(full_name=full_name, repo_url=url))
                if not row.commit or len(row.commit) != 40:
                    raise ValueError("GitHub did not return an immutable commit")
                readme = row.key_files.get("README.md", row.readme_snippet)
                license_text = next((content for name, content in row.key_files.items() if name.upper().startswith("LICENSE")), "")
                item = {
                    "repo_url": url, "full_name": full_name, "default_branch": row.default_branch,
                    "commit": row.commit, "license": "MIT" if "MIT" in license_text else "UNKNOWN",
                    "readme_hash": hashlib.sha256(readme.encode()).hexdigest(), "readme": readme,
                    "fetched_at": datetime.now(timezone.utc).isoformat(), "status": "READY",
                    "file_tree": row.file_tree, "key_files": row.key_files,
                }
                if old.get(url, {}).get("commit") == row.commit:
                    report.unchanged += 1
                else:
                    report.updated += 1
                merged[url] = item
            except Exception as exc:
                report.failed.append({"repo_url": url, "error": f"{type(exc).__name__}: {exc}"})
                if url in merged:
                    merged[url] = {**merged[url], "status": "STALE"}
        if report.failed and not report.updated and not report.unchanged and not old:
            return report
        snapshot = RepositoryIndex(generated_at=datetime.now(timezone.utc), items=list(merged.values()))
        payload = snapshot.model_dump_json(indent=2)
        report.snapshot_version = hashlib.sha256(payload.encode()).hexdigest()
        with tempfile.NamedTemporaryFile("w", dir=destination.parent, delete=False) as handle:
            handle.write(payload)
            temporary = Path(handle.name)
        load_index(temporary)
        os.replace(temporary, destination)
        return report

