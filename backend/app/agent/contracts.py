from __future__ import annotations

from typing import Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field

from app.core.types import (
    CandidateEvaluation,
    CompatibilityReport,
    RepoSource,
    RetrievalResult,
    RoutePlan,
)


ALGORITHM_VERSION = "fusion-v1"
AlgorithmMode: TypeAlias = Literal["baseline", "shadow", "hybrid"]
AlgorithmStage: TypeAlias = Literal[
    "QUERY_PLAN",
    "RETRIEVAL",
    "PROFILE",
    "RANK",
    "ROUTE",
    "REVIEW",
    "SECURITY",
    "HEALING",
]


class EvidenceRef(BaseModel):
    kind: Literal["REPOSITORY", "PROFILE", "REVIEW", "VALIDATION", "SECURITY"]
    reference: str
    digest: str
    access: Literal["PRIVATE", "OWNER", "DEVELOPER"]


class EnvRequirement(BaseModel):
    name: str
    required: bool
    source_ref: str
    secret: bool


class Finding(BaseModel):
    code: str
    message: str
    severity: Literal["BLOCKING", "WARNING", "INFO"]
    evidence_ref: str


class QueryPlan(BaseModel):
    original: str
    github_queries: list[str]
    readme_queries: list[str]
    translated_terms: list[str]
    categories: list[str]
    required_capabilities: list[str]
    constraints: dict[str, str]


class RepositoryProfile(BaseModel):
    repo_url: str
    commit: str
    languages: list[str] = Field(default_factory=list)
    frameworks: list[str] = Field(default_factory=list)
    project_type: str
    dependency_files: list[str] = Field(default_factory=list)
    lock_files: list[str] = Field(default_factory=list)
    package_manager: str | None = None
    entrypoints: list[str] = Field(default_factory=list)
    start_commands: list[str] = Field(default_factory=list)
    build_commands: list[str] = Field(default_factory=list)
    ports: list[int] = Field(default_factory=list)
    databases: list[str] = Field(default_factory=list)
    persistent_paths: list[str] = Field(default_factory=list)
    required_envs: list[EnvRequirement] = Field(default_factory=list)
    has_dockerfile: bool = False
    dockerfile_valid: bool = False
    compose_services: list[str] = Field(default_factory=list)
    identity_features: list[str] = Field(default_factory=list)
    file_features: list[str] = Field(default_factory=list)
    ai_features: list[str] = Field(default_factory=list)
    search_features: list[str] = Field(default_factory=list)
    license_status: Literal["ALLOWED", "UNKNOWN", "BLOCKED"] = "UNKNOWN"
    compatibility: CompatibilityReport
    conflicts: list[Finding] = Field(default_factory=list)
    risks: list[Finding] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)


class OrchestrationDecision(BaseModel):
    complexity: Literal["LOW", "MEDIUM", "HIGH"]
    risk: Literal["LOW", "MEDIUM", "HIGH"]
    require_llm_review: bool
    require_security_llm: bool
    allow_parallel_healing: bool
    max_build_attempts: int = Field(ge=1)
    max_route_switches: int = Field(ge=0)
    max_parallel_candidates: int = Field(ge=1, le=2)
    reasons: list[str] = Field(default_factory=list)


class ReviewFinding(BaseModel):
    id: str
    severity: Literal["BLOCKING", "WARNING", "INFO"]
    category: Literal[
        "REQUIREMENT", "ARCHITECTURE", "DATA", "ACCESS", "RUNTIME", "SECURITY"
    ]
    message: str
    evidence_ref: str
    acceptance_ids: list[str] = Field(default_factory=list)
    suggested_action: str | None = None


class ReviewReport(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    attempt_id: str
    requirement_revision: int = Field(ge=1)
    manifest_hash: str
    reviewer_kind: Literal[
        "DETERMINISTIC", "LLM", "SECURITY_RULES", "SECURITY_LLM"
    ]
    findings: list[ReviewFinding] = Field(default_factory=list)
    model_operation_id: str | None = None


class HealingDecision(BaseModel):
    failure_class: Literal[
        "SOURCE", "DEPENDENCY", "BUILD", "STARTUP", "BUSINESS",
        "ACCESS", "DATA", "TARGET", "UPSTREAM",
    ]
    strategy: Literal[
        "RETRY", "REPAIR_SERIAL", "REPAIR_PARALLEL", "SWITCH_SOURCE",
        "SWITCH_ROUTE", "STOP",
    ]
    candidate_count: int = Field(ge=0, le=2)
    reasons: list[str] = Field(default_factory=list)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)


class AlgorithmStageRecord(BaseModel):
    operation_id: str
    stage: AlgorithmStage
    input_hash: str
    implementation_version: str
    status: Literal["NOT_STARTED", "REQUESTED", "SUCCEEDED", "FAILED", "UNKNOWN"]
    output_ref: str | None = None
    attempt: int = Field(ge=0)
    duration_ms: int | None = Field(default=None, ge=0)
    usage_units: int | None = Field(default=None, ge=0)
    error_code: str | None = None


class AlgorithmCheckpoint(BaseModel):
    schema_version: Literal[1] = 1
    requirement_revision: int = Field(ge=1)
    mode: AlgorithmMode
    algorithm_version: str
    query_plan: QueryPlan | None = None
    retrieval: RetrievalResult | None = None
    profiles: list[RepositoryProfile] = Field(default_factory=list)
    evaluations: list[CandidateEvaluation] = Field(default_factory=list)
    route: RoutePlan | None = None
    shadow_route: RoutePlan | None = None
    orchestration: OrchestrationDecision | None = None
    reviews: list[ReviewReport] = Field(default_factory=list)
    healing: list[HealingDecision] = Field(default_factory=list)
    selected_sources: list[RepoSource] = Field(default_factory=list)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    stages: list[AlgorithmStageRecord] = Field(default_factory=list)

    @classmethod
    def empty(
        cls,
        requirement_revision: int,
        mode: AlgorithmMode,
        algorithm_version: str = ALGORITHM_VERSION,
    ) -> "AlgorithmCheckpoint":
        return cls(
            requirement_revision=requirement_revision,
            mode=mode,
            algorithm_version=algorithm_version,
        )
