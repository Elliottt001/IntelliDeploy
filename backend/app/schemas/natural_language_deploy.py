from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.brains.router_agent import RepoIntent
from app.schemas.fallback import GetArtifactResultResponse
from app.schemas.retrieval import ReadmeCorpusItem


class NaturalLanguageDeployRequest(BaseModel):
    natural_language_query: str = Field(min_length=1)
    top_n: int = Field(default=3, ge=1, le=10)
    readme_corpus: list[ReadmeCorpusItem] | None = None
    deploy: bool = True
    kubeconfig: str | None = None


class NaturalLanguageDeployResponse(BaseModel):
    status: str
    message: str
    intent: RepoIntent | None = None
    selected_repository: RepositoryCandidate | None = None
    project_id: int | None = None
    deployment_id: int | None = None
    task_id: str | None = None
    artifact: GetArtifactResultResponse | None = None
    deployment_result: dict[str, Any] | None = None
