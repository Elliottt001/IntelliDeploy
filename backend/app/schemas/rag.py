from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.fallback import (
    Constraints,
    GenerationMode,
    PreferredStack,
    RepoProfile,
    StartFallbackTaskResponse,
    TriggerReason,
)


class RetrievalSource(str, Enum):
    GITHUB_SEARCH = "github_search"
    USER_REPOS = "user_repos"
    README_BM25 = "readme_bm25"
    MOCK = "mock"


class RerankStage(str, Enum):
    COARSE = "coarse"
    LLM = "llm"
    FALLBACK = "fallback"


class RepoIntent(BaseModel):
    raw_query: str
    keywords: List[str] = Field(default_factory=list)
    github_query: str = ""
    tech_stack: List[str] = Field(default_factory=list)
    target_app_type: str = "unknown"
    target_output_type: str = "deployable_repo"
    is_frontend_only: bool = False
    has_database: Optional[bool] = None
    constraints: Dict[str, Any] = Field(default_factory=dict)


class RagSearchRequest(BaseModel):
    raw_query: str = Field(min_length=1)
    preferred_stack: Optional[PreferredStack] = None
    constraints: Optional[Constraints] = None
    top_k: int = Field(default=3, ge=1, le=10)
    include_readme: bool = False


class RagCandidate(BaseModel):
    rank: int
    repo_url: str
    full_name: str
    name: str
    owner: str
    description: Optional[str] = None
    default_branch: Optional[str] = None
    topics: List[str] = Field(default_factory=list)
    stars: int = 0
    forks: int = 0
    language: Optional[str] = None
    is_archived: bool = False
    last_commit_at: Optional[str] = None
    retrieval_sources: List[RetrievalSource] = Field(default_factory=list)
    retrieval_score: float = 0.0
    deployability_score: float = 0.0
    final_score: float = 0.0
    rerank_stage: RerankStage = RerankStage.COARSE
    match_reasons: List[str] = Field(default_factory=list)
    readme_summary: Optional[str] = None
    repo_profile: RepoProfile = Field(default_factory=RepoProfile)
    preferred_stack: PreferredStack = Field(default_factory=PreferredStack)
    missing_components: List[str] = Field(default_factory=list)


class RagSearchResponse(BaseModel):
    request_id: str
    intent: RepoIntent
    candidates: List[RagCandidate]
    selected: Optional[RagCandidate] = None
    generated_at: datetime
    warnings: List[str] = Field(default_factory=list)


class RagStartGenerationRequest(BaseModel):
    project_id: str
    deployment_id: str
    raw_query: str = Field(min_length=1)
    request_id: Optional[str] = None
    selected_repo_url: Optional[str] = None
    preferred_stack: Optional[PreferredStack] = None
    constraints: Optional[Constraints] = None
    generation_mode: GenerationMode = GenerationMode.AUTO
    trigger_reason: TriggerReason = TriggerReason.LOW_SCORE_ALL


class RagStartGenerationResponse(BaseModel):
    search: RagSearchResponse
    generation: StartFallbackTaskResponse


class RagChatRequest(BaseModel):
    raw_query: str = Field(min_length=1)
    selected_repo_url: Optional[str] = None
    preferred_stack: Optional[PreferredStack] = None
    constraints: Optional[Constraints] = None
    generation_mode: GenerationMode = GenerationMode.AUTO
    trigger_reason: TriggerReason = TriggerReason.LOW_SCORE_ALL
    top_k: int = Field(default=3, ge=1, le=10)


class RagChatResponse(BaseModel):
    search: RagSearchResponse
    generation: StartFallbackTaskResponse
    project_id: str
    deployment_id: str
