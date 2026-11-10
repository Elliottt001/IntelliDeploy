from __future__ import annotations

import fcntl
import hashlib
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field

from app.agent_core.brains.context_rag_agent import RepositoryCandidate


class RepositoryIndex(BaseModel):
    schema_version: int = 1
    generated_at: datetime | None = None
    items: list[dict] = Field(default_factory=list)


class IndexUpdateReport(BaseModel):
    updated: int = 0
    unchanged: int = 0
    failed: list[dict] = Field(default_factory=list)
    snapshot_version: str | None = None


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
        if report.failed and not report.updated and not report.unchanged:
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

