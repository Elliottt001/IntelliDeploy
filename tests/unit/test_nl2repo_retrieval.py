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
from app.agent_core.brains.router_agent import RouterAgent  # noqa: E402
from app.agent_core.memory.vector_store import BM25ReadmeStore, ReadmeDocument  # noqa: E402
from app.schemas.retrieval import ReadmeCorpusItem, RepoSearchRequest  # noqa: E402
from app.services.retrieval_service import RetrievalService  # noqa: E402


class FakeGitHubSearchClient:
    def __init__(self, candidates: list[RepositoryCandidate]):
        self.candidates = candidates
        self.seen_queries: list[str] = []
        self.enrich_calls = 0

    async def search_repositories(
        self, query: str, per_page: int = 20
    ) -> list[RepositoryCandidate]:
        self.seen_queries.append(query)
        return self.candidates[:per_page]

    async def enrich_repository(
        self, candidate: RepositoryCandidate
    ) -> RepositoryCandidate:
        self.enrich_calls += 1
        candidate.files = candidate.files or []
        return candidate


class NoTokenGitHubSearchClient(FakeGitHubSearchClient):
    has_auth_token = False


class QueryAwareGitHubSearchClient(FakeGitHubSearchClient):
    def __init__(self, query_candidates: list[tuple[str, list[RepositoryCandidate]]]):
        super().__init__([])
        self.query_candidates = query_candidates

    async def search_repositories(
        self, query: str, per_page: int = 20
    ) -> list[RepositoryCandidate]:
        self.seen_queries.append(query)
        normalized = query.lower()
        for marker, candidates in self.query_candidates:
            if marker in normalized:
                return [candidate.model_copy(deep=True) for candidate in candidates[:per_page]]
        return []


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


def test_router_agent_extracts_admin_auth_database_intent_from_chinese_fastapi_query():
    intent = RouterAgent().structure_intent(
        "我想部署一个 FastAPI 后台管理系统，带用户登录和数据库"
    )

    assert intent.target_app_type == "admin_dashboard"
    assert intent.has_database is True
    assert intent.constraints["has_database"] is True
    assert "admin dashboard" in intent.keywords
    assert "auth" in intent.keywords
    assert "database" in intent.keywords
    assert "FastAPI" in intent.tech_stack
    assert intent.preferred_language == "Python"


def test_router_agent_keeps_fastapi_github_query_broad_enough():
    intent = RouterAgent().structure_intent("Deploy a FastAPI API service from GitHub")

    terms = intent.github_query.split()
    plain_terms = [
        term
        for term in terms
        if ":" not in term and not term.startswith(("stars:>", "pushed:>"))
    ]

    assert plain_terms == ["fastapi"]
    assert "topic:fastapi" in terms
    assert "topic:python" not in terms
    assert "stars:>50" in terms
    assert any(term.startswith("pushed:>") for term in terms)


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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_pipeline_uses_multi_query_recall_and_penalizes_frameworks_tutorials_and_tools():
    github_client = QueryAwareGitHubSearchClient(
        [
            (
                "admin",
                [
                    RepositoryCandidate(
                        full_name="acme/fastapi-admin-template",
                        html_url="https://github.com/acme/fastapi-admin-template",
                        description=(
                            "FastAPI admin dashboard starter with auth, PostgreSQL, "
                            "Docker, and React UI"
                        ),
                        stars=420,
                        pushed_at="2026-04-01T00:00:00Z",
                        language="Python",
                        topics=["fastapi", "admin", "dashboard", "template", "docker"],
                        files=["Dockerfile", "docker-compose.yml", "requirements.txt"],
                        file_tree=[
                            "Dockerfile",
                            "docker-compose.yml",
                            "requirements.txt",
                            "app/main.py",
                        ],
                        key_files={
                            "README.md": "FastAPI admin dashboard template with login and database.",
                            "Dockerfile": "FROM python:3.11-slim",
                            "requirements.txt": "fastapi\nuvicorn\nsqlmodel\n",
                        },
                    )
                ],
            ),
            (
                "fastapi",
                [
                    RepositoryCandidate(
                        full_name="fastapi/fastapi",
                        html_url="https://github.com/fastapi/fastapi",
                        description="FastAPI framework, high performance, easy to learn",
                        stars=99_000,
                        pushed_at="2026-04-01T00:00:00Z",
                        language="Python",
                        topics=["fastapi", "framework", "library"],
                        files=["pyproject.toml"],
                        file_tree=["pyproject.toml", "fastapi/applications.py"],
                    ),
                    RepositoryCandidate(
                        full_name="mouredev/Hello-Python",
                        html_url="https://github.com/mouredev/Hello-Python",
                        description="Python course tutorial with backend and FastAPI lessons",
                        stars=35_000,
                        pushed_at="2026-04-01T00:00:00Z",
                        language="Python",
                        topics=["python", "tutorial", "fastapi"],
                        files=["README.md", "requirements.txt"],
                        file_tree=["README.md", "requirements.txt"],
                    ),
                    RepositoryCandidate(
                        full_name="tools/photo-fastapi",
                        html_url="https://github.com/tools/photo-fastapi",
                        description="AI photo utility API built with FastAPI",
                        stars=20_000,
                        pushed_at="2026-04-01T00:00:00Z",
                        language="Python",
                        topics=["fastapi", "tools", "machine-learning"],
                        files=["Dockerfile", "requirements.txt"],
                        file_tree=["Dockerfile", "requirements.txt", "main.py"],
                    ),
                    RepositoryCandidate(
                        full_name="generic/full-stack-ai-fastapi",
                        html_url="https://github.com/generic/full-stack-ai-fastapi",
                        description=(
                            "Full-stack AI app generator with FastAPI, auth, "
                            "PostgreSQL, and Docker"
                        ),
                        stars=1400,
                        pushed_at="2026-04-01T00:00:00Z",
                        language="Python",
                        topics=["fastapi", "auth", "postgresql", "docker"],
                    ),
                ],
            ),
        ]
    )
    pipeline = NL2RepoRetrievalPipeline(
        router=RouterAgent(),
        github_client=github_client,
        readme_store=BM25ReadmeStore(),
    )

    result = await pipeline.retrieve(
        "我想部署一个 FastAPI 后台管理系统，带用户登录和数据库",
        top_n=5,
    )

    assert len(github_client.seen_queries) > 1
    assert any("admin" in query.lower() for query in github_client.seen_queries)
    assert result.candidates[0].full_name == "acme/fastapi-admin-template"
    assert result.candidates[0].score_breakdown["application_signal"] > 0
    assert result.candidates[0].score_breakdown["deployability"] > 0
    framework = next(
        candidate for candidate in result.candidates if candidate.full_name == "fastapi/fastapi"
    )
    assert framework.score_breakdown["framework_library_penalty"] < 0
    ai_template = next(
        candidate
        for candidate in result.candidates
        if candidate.full_name == "generic/full-stack-ai-fastapi"
    )
    assert ai_template.score_breakdown["intent_mismatch_penalty"] < 0
    assert ai_template.score_breakdown["intent_mismatch_penalty"] <= -45
    assert ai_template.score_breakdown["no_deploy_evidence_penalty"] == 0


@pytest.mark.asyncio
async def test_pipeline_skips_github_enrichment_without_auth_token():
    github_client = NoTokenGitHubSearchClient(
        [
            RepositoryCandidate(
                full_name="fastapi/framework",
                html_url="https://github.com/fastapi/framework",
                description="FastAPI framework",
                stars=100,
                pushed_at="2026-04-01T00:00:00Z",
                language="Python",
                topics=["fastapi"],
                source_scores={"github": 1.0},
            ),
            RepositoryCandidate(
                full_name="fastapi/template",
                html_url="https://github.com/fastapi/template",
                description="FastAPI service template",
                stars=100,
                pushed_at="2026-04-01T00:00:00Z",
                language="Python",
                topics=["fastapi", "docker"],
                source_scores={"github": 0.98},
            )
        ]
    )
    pipeline = NL2RepoRetrievalPipeline(
        router=RouterAgent(),
        github_client=github_client,
        readme_store=BM25ReadmeStore(),
    )

    result = await pipeline.retrieve("Deploy a FastAPI API service", top_n=1)

    assert github_client.seen_queries
    assert github_client.enrich_calls == 0
    assert result.candidates[0].full_name == "fastapi/template"
    assert result.candidates[0].score_breakdown["docker_bonus"] > 0


@pytest.mark.asyncio
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
