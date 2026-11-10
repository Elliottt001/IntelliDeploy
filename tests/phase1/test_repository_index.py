import json
from datetime import datetime, timezone

import pytest

from app.agent.repository_index import RepositoryIndex, load_index, update_index
from app.agent_core.brains.context_rag_agent import RepositoryCandidate


class Client:
    def __init__(self, fail=False, commit="a" * 40, interrupt=False): self.fail, self.commit, self.interrupt = fail, commit, interrupt
    async def enrich_repository(self, candidate):
        if self.interrupt: raise KeyboardInterrupt()
        if self.fail: raise RuntimeError("429")
        candidate.commit = self.commit
        candidate.default_branch = "main"
        candidate.file_tree = ["package.json", "app/page.tsx"]
        candidate.key_files = {"README.md": "notes web application", "package.json": "{}", "LICENSE": "MIT"}
        return candidate


@pytest.mark.asyncio
async def test_cold_start_and_atomic_refresh(tmp_path):
    destination = tmp_path / "current.json"
    assert load_index(destination).items == []
    report = await update_index(["https://github.com/example/notes"], destination, Client())
    loaded = load_index(destination)
    assert report.updated == 1 and loaded.items[0]["commit"] == "a" * 40
    assert loaded.items[0]["readme_hash"] and loaded.items[0]["license"] == "MIT"


@pytest.mark.asyncio
async def test_interrupted_update_keeps_last_good_snapshot(tmp_path):
    destination = tmp_path / "current.json"
    destination.write_text(RepositoryIndex(generated_at=datetime.now(timezone.utc), items=[{"repo_url": "https://github.com/old/repo", "status": "READY"}]).model_dump_json())
    before = destination.read_bytes()
    with pytest.raises(KeyboardInterrupt):
        await update_index(["https://github.com/example/notes"], destination, Client(interrupt=True))
    assert destination.read_bytes() == before


@pytest.mark.asyncio
async def test_failed_refresh_marks_previous_evidence_stale(tmp_path):
    destination = tmp_path / "current.json"
    destination.write_text(RepositoryIndex(generated_at=datetime.now(timezone.utc), items=[{"repo_url": "https://github.com/example/notes", "status": "READY"}]).model_dump_json())
    report = await update_index(["https://github.com/example/notes"], destination, Client(fail=True))
    assert report.failed and load_index(destination).items[0]["status"] == "STALE"


def test_invalid_or_partial_snapshot_is_rejected(tmp_path):
    path = tmp_path / "current.json"
    path.write_text('{"schema_version":1,"items":')
    with pytest.raises(ValueError): load_index(path)
