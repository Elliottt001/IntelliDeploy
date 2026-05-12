from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.agent_core.brains.context_rag_agent import (  # noqa: E402
    NL2RepoRetrievalPipeline,
    RepositoryCandidate,
)
from app.agent_core.brains.github_retriever import GitHubTokenPool  # noqa: E402
from app.agent_core.brains.llm_clients import (  # noqa: E402
    OpenAICompatibleRepoReranker,
    StructuredLLMOutputError,
    _json_schema_response_format,
    _strict_json_schema,
)
from app.agent_core.brains.router_agent import IntentStructuringError, RepoIntent, RouterAgent  # noqa: E402
from app.agent_core.memory.vector_store import BM25ReadmeStore, ReadmeDocument  # noqa: E402
from app.schemas.retrieval import ReadmeCorpusItem, RepoSearchRequest  # noqa: E402
from app.services.retrieval_service import RetrievalService  # noqa: E402


class FakeGitHubSearchClient:
    def __init__(self, candidates: list[RepositoryCandidate]):
        self.candidates = candidates
        self.seen_queries: list[str] = []

    async def search_repositories(
        self, query: str, per_page: int = 20
    ) -> list[RepositoryCandidate]:
        self.seen_queries.append(query)
        return self.candidates[:per_page]

    async def enrich_repository(
        self, candidate: RepositoryCandidate
    ) -> RepositoryCandidate:
        candidate.files = candidate.files or []
        return candidate


class FakeRedisClient:
    def __init__(self):
        self.values: dict[str, str] = {}

    async def get(self, key: str):
        return self.values.get(key)

    async def set(self, key: str, value: str, ex=None):
        self.values[key] = value


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_router_agent_structures_vague_portfolio_intent():
    intent = RouterAgent().structure_intent(
        "\u5e2e\u6211\u505a\u4e00\u4e2a\u597d\u770b\u7684\u4e2a\u4eba\u7f51\u7ad9"
    )

    assert "portfolio" in intent.keywords
    assert any(stack.lower() in {"next.js", "react", "vue"} for stack in intent.tech_stack)
    assert intent.is_frontend_only is True
    assert "stars:>50" in intent.github_query
    assert "pushed:>" in intent.github_query
    assert intent.target_output_type == "repository"
    assert intent.target_app_type == "portfolio_site"
    assert "portfolio" in intent.expected_features
    assert intent.preferred_framework in {"Next.js", "React", "Vue"}
    assert intent.constraints["frontend_only"] is True


def test_router_agent_raises_when_configured_model_returns_invalid_payload():
    router = RouterAgent(model_client=lambda query: {"raw_query": query})

    with pytest.raises(IntentStructuringError):
        router.structure_intent("build an app")


def test_strict_llm_response_format_uses_json_schema():
    schema = _strict_json_schema(RepoIntent)
    response_format = _json_schema_response_format("repo_intent", schema)

    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["strict"] is True
    assert schema["additionalProperties"] is False


def test_reranker_rejects_unknown_candidate_names(monkeypatch):
    def fake_chat_completion_content(*args, **kwargs):
        return '{"ordered_full_names":["unknown/repo"]}'

    monkeypatch.setattr(
        "app.agent_core.brains.llm_clients._chat_completion_content",
        fake_chat_completion_content,
    )
    reranker = OpenAICompatibleRepoReranker(
        api_base="https://models.example",
        api_key="test-key",
        model="test-model",
    )
    intent = RouterAgent().structure_intent("dream journal")
    candidates = [
        RepositoryCandidate(
            full_name="dream/dreamlog",
            html_url="https://github.com/dream/dreamlog",
        )
    ]

    with pytest.raises(StructuredLLMOutputError):
        reranker(intent, candidates)


@pytest.mark.anyio
async def test_github_token_pool_uses_remaining_quota_and_cools_exhausted_tokens():
    redis = FakeRedisClient()
    pool = GitHubTokenPool(
        ["token-low", "token-high"],
        redis_client=redis,
        cooldown_seconds=60,
    )
    await pool._set_state("token-low", {"remaining": 1})
    await pool._set_state("token-high", {"remaining": 42})

    assert await pool.acquire_token() == "token-high"

    class FakeResponse:
        status_code = 429
        headers = {}

    await pool.record_response("token-high", FakeResponse())

    assert await pool.acquire_token() == "token-low"


def test_bm25_readme_store_ranks_long_tail_semantic_match_first():
    store = BM25ReadmeStore()
    store.upsert_many(
        [
            ReadmeDocument(
                repo_id="dream/dreamlog",
                full_name="dream/dreamlog",
                description="A private dream journal and mood tracker",
                readme_content=(
                    "# DreamLog\nRecord dreams, tags, sleep mood, and recurring symbols."
                ),
                metadata={"stars": 120, "files": ["Dockerfile", "package.json"]},
            ),
            ReadmeDocument(
                repo_id="template/admin-dashboard",
                full_name="template/admin-dashboard",
                description="React journal dashboard template",
                readme_content="# Dashboard\nCharts, tables, journal analytics.",
                metadata={"stars": 9000, "files": ["package.json"]},
            ),
        ]
    )

    results = store.search(["dream", "journal", "sleep"], top_k=2)

    assert results[0].document.full_name == "dream/dreamlog"
    assert results[0].score > results[1].score


@pytest.mark.anyio
async def test_pipeline_merges_dual_track_results_and_reranks_for_deployability():
    store = BM25ReadmeStore()
    store.upsert_many(
        [
            ReadmeDocument(
                repo_id="dream/dreamlog",
                full_name="dream/dreamlog",
                description="Private dream journal web app",
                readme_content="Dream journal with tags, calendar, search, and Docker deployment.",
                metadata={
                    "html_url": "https://github.com/dream/dreamlog",
                    "stars": 180,
                    "language": "TypeScript",
                    "pushed_at": "2026-04-01T00:00:00Z",
                    "topics": ["journal", "dreams", "nextjs"],
                    "files": ["Dockerfile", "package.json"],
                    "file_tree": ["Dockerfile", "package.json", "src/main.ts"],
                    "key_files": {
                        "README.md": "# DreamLog",
                        "Dockerfile": "FROM node:20-alpine",
                        "package.json": '{"scripts":{"start":"next start"}}',
                    },
                },
            )
        ]
    )
    github_client = FakeGitHubSearchClient(
        [
            RepositoryCandidate(
                full_name="popular/portfolio",
                html_url="https://github.com/popular/portfolio",
                description="High star portfolio template",
                stars=50_000,
                pushed_at="2026-03-01T00:00:00Z",
                language="JavaScript",
                topics=["portfolio"],
                files=["package.json"],
                file_tree=["package.json", "src/App.jsx"],
                source_scores={"github": 1.0},
            ),
            RepositoryCandidate(
                full_name="dream/dreamlog",
                html_url="https://github.com/dream/dreamlog",
                description="Private dream journal web app",
                stars=180,
                pushed_at="2026-04-01T00:00:00Z",
                language="TypeScript",
                topics=["journal", "dreams", "nextjs"],
                files=["Dockerfile", "package.json"],
                file_tree=["Dockerfile", "package.json", "src/main.ts"],
                key_files={
                    "README.md": "# DreamLog",
                    "Dockerfile": "FROM node:20-alpine",
                    "package.json": '{"scripts":{"start":"next start"}}',
                },
                source_scores={"github": 0.7},
            ),
        ]
    )
    pipeline = NL2RepoRetrievalPipeline(
        router=RouterAgent(),
        github_client=github_client,
        readme_store=store,
    )

    result = await pipeline.retrieve(
        "\u6211\u60f3\u8981\u4e00\u4e2a\u8bb0\u5f55\u68a6\u5883\u5e76\u53ef\u4ee5\u76f4\u63a5\u90e8\u7f72\u7684\u5de5\u5177",
        top_n=3,
    )

    assert github_client.seen_queries
    assert len(result.candidates) == 2
    assert result.candidates[0].full_name == "dream/dreamlog"
    assert result.candidates[0].rank == 1
    assert result.candidates[0].retrieval_score == result.candidates[0].score
    assert result.candidates[0].repo_url == "https://github.com/dream/dreamlog"
    assert result.candidates[0].last_commit_at == "2026-04-01T00:00:00Z"
    assert "src/main.ts" in result.candidates[0].file_tree
    assert "Dockerfile" in result.candidates[0].key_files
    assert result.candidates[0].score_breakdown["docker_bonus"] > 0
    assert result.repository_profile is not None
    assert result.repository_profile.source_repo_url == "https://github.com/dream/dreamlog"
    assert result.repository_profile.has_valid_dockerfile is True


@pytest.mark.anyio
async def test_retrieval_service_accepts_request_scoped_readme_corpus():
    github_client = FakeGitHubSearchClient([])
    service = RetrievalService(github_client=github_client)
    request = RepoSearchRequest(
        natural_language_query="\u5e2e\u6211\u627e\u4e00\u4e2a\u53ef\u90e8\u7f72\u7684\u68a6\u5883\u8bb0\u5f55\u5de5\u5177",
        top_n=3,
        readme_corpus=[
            ReadmeCorpusItem(
                repo_id="dream/dreamlog",
                full_name="dream/dreamlog",
                description="Dream journal app",
                readme_content="Dream journal with Dockerfile and Next.js deployment.",
                metadata={
                    "html_url": "https://github.com/dream/dreamlog",
                    "stars": 200,
                    "language": "TypeScript",
                    "pushed_at": "2026-04-01T00:00:00Z",
                    "topics": ["dreams", "nextjs"],
                    "files": ["Dockerfile", "package.json"],
                    "file_tree": ["Dockerfile", "package.json", "src/main.ts"],
                    "key_files": {
                        "README.md": "# DreamLog",
                        "Dockerfile": "FROM node:20-alpine",
                    },
                },
            )
        ],
    )

    response = await service.search(request)

    assert response.intent.keywords
    assert response.intent.target_output_type == "repository"
    assert response.candidates[0].full_name == "dream/dreamlog"
    payload = response.model_dump()
    assert {
        "rank",
        "retrieval_score",
        "repo_url",
        "default_branch",
        "description",
        "topics",
        "stars",
        "is_archived",
        "last_commit_at",
        "file_tree",
        "key_files",
    }.issubset(payload["candidates"][0])
    assert response.repository_profile is not None
    assert response.repository_profile.has_valid_dockerfile is True
