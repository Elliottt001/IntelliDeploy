from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.brains.router_agent import RepoIntent
from app.schemas.fallback import RepoProfile


class ReadmeCorpusItem(BaseModel):
    repo_id: str
    full_name: str
    description: str = ""
    readme_content: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class RepoSearchRequest(BaseModel):
    natural_language_query: str = Field(min_length=1)
    top_n: int = Field(default=3, ge=1, le=10)
    readme_corpus: list[ReadmeCorpusItem] | None = None


class RepoSearchResponse(BaseModel):
    intent: RepoIntent
    candidates: list[RepositoryCandidate]
    repository_profile: RepoProfile | None = None


class ReadmeUpsertRequest(BaseModel):
    documents: list[ReadmeCorpusItem]


class ReadmeUpsertResponse(BaseModel):
    accepted: int
