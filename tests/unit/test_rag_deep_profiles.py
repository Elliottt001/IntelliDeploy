from __future__ import annotations

from pathlib import Path
import sys

import pytest


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.agent_core.brains.context_rag_agent import RepositoryCandidate  # noqa: E402
from app.agent_core.brains.router_agent import RepoIntent  # noqa: E402
from app.schemas.fallback import RepoProfile  # noqa: E402
from app.schemas.retrieval import RepoSearchResponse  # noqa: E402
from app.services.rag_service import RagService  # noqa: E402


class RetrievalStub:
    github_client = None


def _candidate(name: str, score: float) -> RepositoryCandidate:
    return RepositoryCandidate(
        rank=None,
        full_name=name,
        repo_url=f"https://github.com/{name}",
        html_url=f"https://github.com/{name}",
        description=f"{name} description",
        stars=100,
        language="TypeScript",
        source_scores={"github_search": 1.0},
        score=score,
        retrieval_score=score,
        score_breakdown={"package_structure": 10.0},
    )


@pytest.mark.anyio
async def test_rag_service_deep_profiles_every_top_candidate(monkeypatch):
    service = RagService(db=None, retrieval_service=RetrievalStub())
    seen: list[str] = []
    profiles = {
        "org/one": RepoProfile(
            source_repo_url="https://github.com/org/one",
            detected_languages=["TypeScript"],
            detected_frameworks=["Next.js"],
            package_manager="pnpm",
            entrypoints=["src/App.tsx"],
            dependency_files=["package.json", "pnpm-lock.yaml"],
            has_valid_dockerfile=True,
            readme_summary="one",
            healthcheck_path="/",
        ),
        "org/two": RepoProfile(
            source_repo_url="https://github.com/org/two",
            detected_languages=["Python"],
            detected_frameworks=["FastAPI"],
            package_manager="pip",
            entrypoints=["main.py"],
            dependency_files=["requirements.txt"],
            has_valid_dockerfile=False,
            readme_summary="two",
        ),
        "org/three": RepoProfile(
            source_repo_url="https://github.com/org/three",
            detected_languages=["JavaScript"],
            detected_frameworks=["Express"],
            package_manager="npm",
            entrypoints=["server.js"],
            dependency_files=["package.json"],
            has_valid_dockerfile=True,
            readme_summary="three",
        ),
    }

    async def fake_deep_profile(candidate):
        seen.append(candidate.full_name)
        return profiles[candidate.full_name]

    monkeypatch.setattr(service, "_deep_profile_for_candidate", fake_deep_profile)

    response = RepoSearchResponse(
        intent=RepoIntent(
            raw_query="deploy app",
            normalized_query="deploy app",
            keywords=["deploy"],
            github_query="deploy",
        ),
        candidates=[
            _candidate("org/one", 90),
            _candidate("org/two", 80),
            _candidate("org/three", 70),
        ],
    )

    search = await service.search_response_from_retrieval_async("req-1", response)

    assert seen == ["org/one", "org/two", "org/three"]
    assert [candidate.repo_profile.readme_summary for candidate in search.candidates] == ["one", "two", "three"]
    assert search.candidates[0].missing_components == []
    assert "Dockerfile" in search.candidates[1].missing_components
    assert search.candidates[0].deployability_score > search.candidates[1].deployability_score
    assert search.warnings == []
