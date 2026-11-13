from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.core.types import DeliveryOutcome, JobReport, JobStatus


AlgorithmMode = Literal["baseline", "shadow", "hybrid"]


class EvaluationRunRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=20000)
    budget_units: int | None = Field(default=None, gt=0)
    target_id: str | None = None
    algorithm_mode: AlgorithmMode


class EvaluationAlgorithmReview(BaseModel):
    blocking_count: int = Field(ge=0)
    warning_count: int = Field(ge=0)
    info_count: int = Field(ge=0)


class EvaluationAlgorithmHealing(BaseModel):
    attempt_count: int = Field(ge=0)
    candidate_count: int = Field(ge=0)
    reasons: list[str] = Field(default_factory=list)


class EvaluationAlgorithm(BaseModel):
    mode: AlgorithmMode
    version: str
    route: str | None = None
    route_confidence: Literal["HIGH", "MEDIUM", "LOW"] | None = None
    retrieval_complete: bool = False
    review: EvaluationAlgorithmReview
    healing: EvaluationAlgorithmHealing


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


class EvaluationEvidenceGate(BaseModel):
    status: Literal["PASS", "FAIL", "NOT_RUN"]
    reasons: list[str] = Field(default_factory=list)


class EvaluationRequirementCompilation(BaseModel):
    status: str
    stage: str
    attempt_count: int = Field(ge=0)
    source_digest: str
    last_error_code: str | None = None
    unresolved_issues: list[str] = Field(default_factory=list)


class EvaluationRecord(BaseModel):
    job_id: str
    app_id: str
    version_id: str | None = None
    status: JobStatus
    route: str | None = None
    algorithm: EvaluationAlgorithm
    source_mode: Literal["real", "fixture"]
    routing_mode: Literal["automatic", "forced"] = "automatic"
    target_id: str | None = None
    target_override: bool = False
    model: str
    price_version: str
    usage_units: int = Field(ge=0)
    cost_units: int | None = Field(default=None, ge=0)
    cost_status: Literal["known", "unknown"]
    evidence_gate: EvaluationEvidenceGate
    duration_ms: int = Field(ge=0)
    phase_durations: list[PhaseDuration] = Field(default_factory=list)
    sources: list[EvaluationSource] = Field(default_factory=list)
    retrieval: EvaluationRetrieval
    requirement_compilation: EvaluationRequirementCompilation | None = None
    result: DeliveryOutcome | None = None
    delivery_kind: Literal['EXTERNAL_LINK', 'HOSTED_INSTANCE'] | None = None
    external_service_status: Literal['PASS', 'FAIL', 'NOT_RUN'] | None = None
    report: JobReport
    created_at: datetime
    updated_at: datetime
