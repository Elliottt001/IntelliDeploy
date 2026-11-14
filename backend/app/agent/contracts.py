from __future__ import annotations

from typing import Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pathlib import PurePosixPath

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
    "GAP",
    "PACKAGING",
    "COMPOSITION",
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


class ComponentRole(BaseModel):
    source: RepoSource
    role: str
    owned_capabilities: list[str] = Field(default_factory=list)


class ServiceBoundary(BaseModel):
    provider_role: str
    consumer_role: str
    protocol: str
    data_contract_ref: str


class ApiMapping(BaseModel):
    acceptance_ids: list[str]
    provider_role: str
    operation: str


class IntegrationContract(BaseModel):
    role_services: dict[str, str] = Field(default_factory=dict)
    components: list[ComponentRole]
    service_boundaries: list[ServiceBoundary] = Field(default_factory=list)
    identity_owner: str
    data_owners: dict[str, str]
    api_mappings: list[ApiMapping]
    shared_capabilities: list[str] = Field(default_factory=list)
    acceptance_coverage: dict[str, list[str]]


class QueryPlan(BaseModel):
    original: str
    github_queries: list[str]
    readme_queries: list[str]
    translated_terms: list[str]
    categories: list[str]
    required_capabilities: list[str]
    constraints: dict[str, str]


class DeploymentAsset(BaseModel):
    kind: Literal['OFFICIAL_SERVICE', 'DEMO', 'IMAGE', 'COMPOSE', 'SCRIPT', 'INSTALL_DOC']
    location: str
    source_ref: str
    source_digest: str = Field(pattern=r'^[0-9a-f]{64}$')
    verification_status: Literal['NOT_RUN', 'PASS', 'FAIL'] = 'NOT_RUN'

class CapabilityEvidence(BaseModel):
    acceptance_id: str
    status: Literal['SUPPORTED', 'MISSING', 'UNKNOWN']
    evidence_refs: list[str] = Field(default_factory=list)
    quote: str = ''
    reason: str

class RouteVerdict(BaseModel):
    status: Literal['ELIGIBLE', 'INELIGIBLE', 'UNKNOWN']
    reason: str
    evidence_refs: list[str] = Field(default_factory=list)

class CandidateAssessment(BaseModel):
    repo_url: str
    commit: str = Field(pattern=r'^[0-9a-f]{40}$')
    requirement_revision: int
    capabilities: list[CapabilityEvidence]
    differences: list[str] = Field(default_factory=list)
    adaptations: list[str] = Field(default_factory=list)
    route_verdicts: dict[Literal['A', 'B', 'C'], RouteVerdict] = Field(default_factory=dict)
    validation_issues: list[str] = Field(default_factory=list)

    def rejects_all_reuse(self):
        return all(route in self.route_verdicts and self.route_verdicts[route].status == 'INELIGIBLE'
                   and self.route_verdicts[route].evidence_refs for route in ('A', 'B', 'C'))

class ReuseDecision(BaseModel):
    delivery_kind: Literal['EXTERNAL_LINK', 'HOSTED_INSTANCE']
    route: Literal['DEPLOY_EXISTING', 'MODIFY_EXISTING', 'COMPOSE_COMPONENTS', 'GENERATE_APP'] | None = None
    selected_sources: list[RepoSource] = Field(default_factory=list)
    assessment_refs: list[str] = Field(default_factory=list)
    deployment_asset: DeploymentAsset | None = None
    differences: list[str] = Field(default_factory=list)
    adaptations: list[str] = Field(default_factory=list)

class DeploymentPlan(BaseModel):
    kind: Literal['IMAGE', 'COMPOSE', 'SCRIPT', 'SOURCE_BUILD']
    source_ref: str
    digest: str
    location: str
    required_configuration: list[str] = Field(default_factory=list)
    adaptations: list[str] = Field(default_factory=list)

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
    deployment_assets: list[DeploymentAsset] = Field(default_factory=list)


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


class PlanValue(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PackagingFinding(PlanValue):
    code: str
    severity: Literal["BLOCKING", "WARNING", "INFO"]
    message: str
    evidence_ref: str


class SafeDockerEdit(PlanValue):
    kind: Literal["INSERT_WORKDIR", "SET_EXPOSE", "SET_START_COMMAND", "SET_INSTALL_COMMAND"]
    old_value: str | None = None
    new_value: str
    evidence_refs: list[str] = Field(min_length=1)


class PackagingPlan(PlanValue):
    source_url: str | None = None
    source_commit: str | None = Field(default=None, pattern=r"^[0-9a-f]{40}$")
    dockerfile_path: str
    action: Literal["REUSE", "NORMALIZE", "GENERATE", "BLOCKED"]
    package_manager: str | None = None
    install_command: list[str] | None = Field(default=None, min_length=1)
    start_command: list[str] | None = Field(default=None, min_length=1)
    container_port: int | None = Field(default=None, ge=1, le=65535)
    health_path: str | None = None
    safe_edits: list[SafeDockerEdit] = Field(default_factory=list)
    findings: list[PackagingFinding] = Field(default_factory=list)
    input_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    output_digest: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def path_is_relative(self):
        validate_plan_path(self.dockerfile_path)
        return self


def validate_plan_path(value: str):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or ".." in path.parts or "\\" in value:
        raise ValueError("plan path must be relative")


class CompositionCost(PlanValue):
    local_units: int = Field(ge=0)
    composition_units: int = Field(ge=0)
    evidence_refs: list[str] = Field(min_length=1)


class AcceptanceGap(PlanValue):
    acceptance_id: str
    status: Literal["SATISFIED", "LOCAL_REPAIR", "COMPONENT_SOURCE", "BLOCKED"]
    principal_source: RepoSource | None = None
    provider_source: RepoSource | None = None
    capability: str
    required_changes: list[str] = Field(default_factory=list)
    preserve: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)
    reason: str


class GapPlan(PlanValue):
    requirement_revision: int = Field(ge=1)
    principal_source: RepoSource | None = None
    gaps: list[AcceptanceGap]
    complete: bool
    input_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    composition_cost: CompositionCost | None = None

    @model_validator(mode="after")
    def unique_acceptance(self):
        ids = [g.acceptance_id for g in self.gaps]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate gap acceptance")
        return self


class ComponentWorkspace(PlanValue):
    role: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,31}$")
    source: RepoSource
    relative_path: str
    read_only_source_path: str
    tree_digest: str = Field(pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def valid_component(self):
        import re
        if not re.fullmatch(r"[0-9a-f]{40}", self.source.commit):
            raise ValueError("component requires full commit")
        if self.relative_path != "components/" + self.role or self.read_only_source_path != self.relative_path:
            raise ValueError("invalid component path")
        return self


class AlgorithmCheckpoint(BaseModel):
    assessments: list[CandidateAssessment] = Field(default_factory=list)
    reuse_decision: ReuseDecision | None = None
    gap_plan: GapPlan | None = None
    packaging_plans: list[PackagingPlan] = Field(default_factory=list)
    component_workspaces: list[ComponentWorkspace] = Field(default_factory=list)
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
    integration_contract: IntegrationContract | None = None
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


class ComponentPolicyEntry(PlanValue):
    role: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,31}$")
    relative_path: str
    tree_digest: str = Field(pattern=r"^[0-9a-f]{64}$")


class ComponentWorkspacePolicy(PlanValue):
    mode: Literal["COMPOSITION"] = "COMPOSITION"
    writable_root: Literal["app"] = "app"
    components: list[ComponentPolicyEntry] = Field(min_length=2)

    @model_validator(mode="after")
    def safe_roles(self):
        roles = [p.role for p in self.components]
        if len(roles) != len(set(roles)) or any(p.relative_path != "components/" + p.role for p in self.components):
            raise ValueError("component policy paths or roles conflict")
        return self
