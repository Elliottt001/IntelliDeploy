from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.brains.router_agent import RepoIntent
from app.schemas.fallback import RepoProfile


class ReadmeCorpusItem(BaseModel):
    """One crawled README record available for BM25 retrieval."""

    repo_id: str = Field(description="Stable repository id in the README corpus.")
    full_name: str = Field(description="GitHub full name, for example owner/repo.")
    description: str = Field(default="", description="Repository short description.")
    readme_content: str = Field(
        default="",
        description="Clean or raw README text used by BM25 keyword matching.",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Optional repo facts such as stars, topics, files, file_tree, key_files, "
            "pushed_at, language, and html_url."
        ),
    )


class RepoSearchRequest(BaseModel):
    """Request for phase-one natural-language-to-repository retrieval."""

    natural_language_query: str = Field(
        min_length=1,
        description="User raw natural language need. Returned as intent.raw_query.",
    )
    top_n: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Number of reranked candidate repositories to return.",
    )
    readme_corpus: list[ReadmeCorpusItem] | None = Field(
        default=None,
        description="Optional request-scoped README corpus for BM25 retrieval.",
    )


class RepoSearchResponse(BaseModel):
    """Response shaped to the contract in .idea/interface documentation."""

    intent: RepoIntent = Field(description="Structured user intent.")
    candidates: list[RepositoryCandidate] = Field(
        description="Top candidate repositories with ranking, file tree, and key files."
    )
    repository_profile: RepoProfile | None = Field(
        default=None,
        description="Compressed profile for the top repository and Builder Agent.",
    )


class ReadmeUpsertRequest(BaseModel):
    documents: list[ReadmeCorpusItem] = Field(
        description="README records to add to the in-memory BM25 corpus."
    )


class ReadmeUpsertResponse(BaseModel):
    accepted: int = Field(description="Number of README records accepted.")
