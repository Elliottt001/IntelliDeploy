from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.core.types import DeliveryResult, JobReport, JobStatus


class EvaluationTarget(BaseModel):
    target_id: str
    name: str
    kind: str


class EvaluationSource(BaseModel):
    url: str
    commit: str
    role: str


class EvaluationCandidate(BaseModel):
    repo_url: str
    commit: str | None = None
    rank: int = Field(ge=1)
    stars: int | None = Field(default=None, ge=0)
    match_score: float | None = None
    deploy_score: float | None = None
    quality_score: float | None = None


class EvaluationRetrieval(BaseModel):
    queries: list[str] = Field(default_factory=list)
    completed: bool = False
    index_version: str | None = None
    candidates: list[EvaluationCandidate] = Field(default_factory=list)


class PhaseDuration(BaseModel):
    phase: str
    duration_ms: int = Field(ge=0)


class EvaluationRecord(BaseModel):
    job_id: str
    app_id: str
    version_id: str | None = None
    status: JobStatus
    route: str | None = None
    source_mode: Literal["real", "fixture"]
    routing_mode: Literal["automatic", "forced"] = "automatic"
    target_id: str | None = None
    target_override: bool = False
    model: str
    price_version: str
    usage_units: int = Field(ge=0)
    cost_units: int | None = Field(default=None, ge=0)
    cost_status: Literal["known", "unknown"]
    duration_ms: int = Field(ge=0)
    phase_durations: list[PhaseDuration] = Field(default_factory=list)
    sources: list[EvaluationSource] = Field(default_factory=list)
    retrieval: EvaluationRetrieval
    result: DeliveryResult | None = None
    report: JobReport
    created_at: datetime
    updated_at: datetime
