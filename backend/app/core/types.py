from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from enum import StrEnum
from pathlib import PurePosixPath

class DemandFact(BaseModel):
    id: str
    source_message_id: str
    quote: str
    kind: Literal['FUNCTION', 'DATA', 'ACCESS', 'EXTERNAL']
    acceptance_ids: list[str] = Field(default_factory=list)

class Requirement(BaseModel):
    prompt: str
    acceptance: list[AcceptanceItem]
    revision: int = Field(default=1, ge=1)
    facts: list[DemandFact] = Field(default_factory=list)
    source_message_ids: list[str] = Field(default_factory=list)

class RequirementDraft(BaseModel):
    prompt: str
    acceptance: list[AcceptanceItem]
    facts: list[DemandFact]
    questions: list[str] = Field(default_factory=list, max_length=2)
    explicit_removals: list[str] = Field(default_factory=list)
    removal_evidence: dict[str, str] = Field(default_factory=dict)
    review_missing: list[str] = Field(default_factory=list)
    unsupported: list[str] = Field(default_factory=list)

class AcceptanceItem(BaseModel):
    id: str
    action: str
    expected: str
    private_data: bool = False

class RepoSource(BaseModel):
    url: str
    commit: str
    role: str


class RouteRejection(BaseModel):
    route: Literal['DEPLOY_EXISTING', 'MODIFY_EXISTING',
                   'COMPOSE_COMPONENTS', 'GENERATE_APP']
    reason: str
    evidence_refs: list[str] = Field(default_factory=list)


class RoutePlan(BaseModel):
    route: Literal['DEPLOY_EXISTING', 'MODIFY_EXISTING',
                   'COMPOSE_COMPONENTS', 'GENERATE_APP']
    sources: list[RepoSource] = Field(default_factory=list)
    template_version: str | None = None
    steps: list[str]
    reason: str
    rejected_alternatives: list[RouteRejection] = Field(default_factory=list)
    confidence: Literal['HIGH', 'MEDIUM', 'LOW'] = 'MEDIUM'

class CandidateEvaluation(BaseModel):
    repo_url: str
    match_score: float = Field(ge=0, le=100)
    deploy_score: float = Field(ge=0, le=100)
    quality_score: float = Field(ge=0, le=100)
    is_web_app: bool | None = None
    missing_core: list[str] = Field(default_factory=list)
    unknown_fields: list[str] = Field(default_factory=list)
    evidence: dict[str, str] = Field(default_factory=dict)
    compatibility: Literal['SUPPORTED', 'UNKNOWN', 'UNSUPPORTED'] = 'UNKNOWN'
    change_cost: float = Field(default=100, ge=0, le=100)
    evidence_confidence: float = Field(default=0, ge=0, le=100)
    reuse_roles: list[str] = Field(default_factory=list)
    rejection_reasons: list[str] = Field(default_factory=list)

    @property
    def total(self) -> float:
        return round(.60*self.match_score + .25*self.deploy_score + .15*self.quality_score, 2)

    @property
    def eligible_a(self) -> bool:
        return (self.is_web_app is True and self.compatibility == 'SUPPORTED' and not self.missing_core and
                not self.unknown_fields and bool(self.evidence) and
                not self.rejection_reasons and
                self.match_score >= 80 and self.deploy_score >= 70 and self.total >= 75)

class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict

class ToolResult(BaseModel):
    call_id: str
    ok: bool
    content: str

class ModelTurn(BaseModel):
    assistant_message: dict
    calls: list[ToolCall] = Field(default_factory=list)
    input_tokens: int = 0
    cached_input_tokens: int = 0
    output_tokens: int = 0
    usage_known: bool = True
    finish_reason: str | None = None
    provider_request_id: str | None = None
    protocol_error: str | None = None

class Checkpoint(BaseModel):
    messages: list[dict] = Field(default_factory=list)
    route: RoutePlan | None = None
    workspace: str | None = None
    pending_calls: list[ToolCall] = Field(default_factory=list)
    completed_calls: dict[str, ToolResult] = Field(default_factory=dict)
    call_arguments: dict[str, dict] = Field(default_factory=dict)
    route_switches: int = 0
    stalled_rounds: int = 0
    requirement_revision: int | None = None
    attempt_id: str | None = None
    validation_refs: list[str] = Field(default_factory=list)
    reservation_id: str | None = None
    manifest_hash: str | None = None

class CheckResult(BaseModel):
    id: str
    status: Literal['PASS', 'FAIL', 'NOT_RUN']
    evidence: str

class ValidationReport(BaseModel):
    checks: list[CheckResult]
    required_ids: list[str] = Field(default_factory=list)
    requirement_revision: int | None = None
    attempt_id: str | None = None
    manifest_hash: str | None = None

    @property
    def passed(self) -> bool:
        ids = [c.id for c in self.checks]
        return (bool(ids) and len(ids) == len(set(ids))
                and set(self.required_ids) <= set(ids)
                and all(c.status == 'PASS' for c in self.checks))

class ServiceSpec(BaseModel):
    name: str
    image: str = Field(min_length=1)
    port: int | None = Field(default=None, ge=1, le=65535)
    env_refs: dict[str, str] = Field(default_factory=dict)
    volumes: dict[str, str] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)
    health_path: str | None = None
    memory_mb: int = Field(default=512, gt=0)
    cpu_millis: int = Field(default=500, gt=0)
    storage_mb: dict[str, int] = Field(default_factory=dict)

class BuildSpec(BaseModel):
    service: str = Field(min_length=1)
    context: str = Field(min_length=1)
    dockerfile: str = Field(min_length=1)

class AppManifest(BaseModel):
    schema_version: Literal[1] = 1
    web_service: str
    services: list[ServiceSpec]
    migration: list[str] = Field(default_factory=list)
    builds: list[BuildSpec] = Field(default_factory=list)

    @model_validator(mode='after')
    def validate_services(self):
        names = [s.name for s in self.services]
        if not names or len(set(names)) != len(names) or self.web_service not in names:
            raise ValueError('services must be unique and include the web entry')
        graph = {s.name: s.depends_on for s in self.services}
        visited, active = set(), set()
        def visit(name):
            if name not in graph or name in active:
                raise ValueError('missing dependency or dependency cycle')
            if name in visited:
                return
            active.add(name)
            for child in graph[name]:
                visit(child)
            active.remove(name)
            visited.add(name)
        for service in self.services:
            visit(service.name)
            for path in service.volumes.values():
                parts = PurePosixPath(path).parts
                if not path.startswith('/') or '..' in parts or path == '/' or any(path == p or path.startswith(p + '/') for p in ['/proc', '/sys', '/dev', '/etc', '/run', '/var/run']):
                    raise ValueError('unsafe container mount')
        builds = [b.service for b in self.builds]
        if len(builds) != len(set(builds)) or not set(builds) <= set(names):
            raise ValueError('build must reference a unique service')
        return self

class GenerationOutput(BaseModel):
    checkpoint: Checkpoint
    manifest: AppManifest | None = None
    question: str | None = None
    exhausted: bool = False
    requirement_revision: int | None = None

class DeploymentResult(BaseModel):
    operation_id: str
    instance_id: str
    url: str
    report: ValidationReport

class CapabilityContext(BaseModel):
    app_id: str
    instance_id: str
    user_id: int | None
    payer_id: int
    publication_id: str | None = None
    reservation_operation_id: str | None = None
    job_id: str | None = None


class PublishRequest(BaseModel):
    version_id: str
    payer_policy: Literal['SPONSOR', 'VISITOR']
    sponsor_period: Literal['DAY', 'MONTH'] = 'DAY'
    sponsor_limit_units: int = Field(default=100, gt=0)


class PublicationResponse(BaseModel):
    id: str
    app_id: str
    instance_id: str
    version_id: str
    name: str
    summary: str
    features: list[str]
    creator: str
    preview_url: str | None = None
    url: str | None
    available: bool
    payer_policy: Literal['SPONSOR', 'VISITOR']
    sponsor_period: Literal['DAY', 'MONTH']
    sponsor_limit_units: int
    copy_url: str
    updated_at: datetime


class PublicationPage(BaseModel):
    items: list[PublicationResponse]
    next_cursor: str | None = None


class CopyRequest(BaseModel):
    budget_units: int | None = Field(default=None, gt=0)

class UsageInput(BaseModel):
    operation_id: str
    payer_id: int
    kind: str
    units: int
    price_version: str
    metadata: dict = Field(default_factory=dict)
    reservation_operation_id: str | None = None

class PaymentEvent(BaseModel):
    provider: Literal['alipay', 'wechat', 'stripe']
    event_id: str
    order_id: str
    transaction_id: str
    amount_minor: int
    currency: Literal['CNY', 'USD']
    paid_at: datetime
    grant_key: str

class CompatibilityReport(BaseModel):
    status: Literal['SUPPORTED', 'UNKNOWN', 'UNSUPPORTED']
    reasons: list[str] = Field(default_factory=list)
    runtime: str | None = None
    databases: list[str] = Field(default_factory=list)
    architecture: str = 'amd64'
    evidence: dict[str, str] = Field(default_factory=dict)


class RetrievalEvidenceRef(BaseModel):
    kind: Literal['REPOSITORY', 'PROFILE', 'REVIEW', 'VALIDATION', 'SECURITY']
    reference: str
    digest: str
    access: Literal['PRIVATE', 'OWNER', 'DEVELOPER']


class RetrievalCandidate(BaseModel):
    repo_url: str
    commit: str | None = None
    description: str = ''
    stars: int = Field(default=0, ge=0)
    last_commit_at: datetime | None = None
    sources: list[Literal['github', 'readme', 'verified_index']] = Field(default_factory=list)
    source_scores: dict[str, float] = Field(default_factory=dict)
    evidence_refs: list[RetrievalEvidenceRef] = Field(default_factory=list)
    enrichment_status: Literal['COMPLETE', 'PARTIAL', 'FAILED'] = 'PARTIAL'
    file_tree: list[str] = Field(default_factory=list)
    key_files: dict[str, str] = Field(default_factory=dict)
    compatibility: Literal['SUPPORTED', 'UNKNOWN', 'UNSUPPORTED'] = 'UNKNOWN'

    def __getitem__(self, key: str):
        return getattr(self, key)

    def __setitem__(self, key: str, value) -> None:
        if key not in type(self).model_fields:
            raise KeyError(key)
        setattr(self, key, value)

    def get(self, key: str, default=None):
        return getattr(self, key, default)


class RetrievalResult(BaseModel):
    queries: list[str]
    completed: bool
    candidates: list[RetrievalCandidate] = Field(default_factory=list)
    reuse_rejections: list[dict] = Field(default_factory=list)
    index_version: str | None = None
    errors: list[str] = Field(default_factory=list)

class BrowserCheck(BaseModel):
    item_id: str
    actor: Literal['owner', 'other', 'anonymous']
    actions: list[dict]
    expected: str

class CandidateRuntime(BaseModel):
    id: str
    base_url: str
    manifest_hash: str
    data_namespace: str
    identity_refs: dict[str, str] = Field(default_factory=dict)

class InstanceSnapshot(BaseModel):
    id: str
    status: Literal['PENDING', 'RUNNING', 'STOPPED', 'FAILED', 'DELETED']
    desired_state: Literal['RUNNING', 'STOPPED', 'DELETED']
    stop_reason: Literal['USER', 'QUOTA', 'ERROR'] | None = None
    url: str | None = None
    observed_at: datetime | None = None
    active_operation_id: str | None = None

class ResourceWindow(BaseModel):
    instance_id: str
    window_start: datetime
    window_end: datetime
    compute_state: Literal['RUNNING', 'STOPPED', 'UNKNOWN']
    compute_units: int | None = None
    storage_units: int | None = None
    price_version: str
    evidence_ref: str


class JobStatus(StrEnum):
    QUEUED = 'QUEUED'
    RUNNING = 'RUNNING'
    WAITING_USER = 'WAITING_USER'
    PAUSED_QUOTA = 'PAUSED_QUOTA'
    SUCCEEDED = 'SUCCEEDED'
    FAILED = 'FAILED'
    CANCELLED = 'CANCELLED'


class InstanceStatus(StrEnum):
    PENDING = 'PENDING'
    DEPLOYING = 'DEPLOYING'
    RUNNING = 'RUNNING'
    STOPPED = 'STOPPED'
    FAILED = 'FAILED'
    DELETING = 'DELETING'
    DELETED = 'DELETED'


class PublicError(BaseModel):
    code: str
    message: str
    retryable: bool = False


class CreateAppResponse(BaseModel):
    app_id: str
    job_id: str
    status: JobStatus


class JobRef(CreateAppResponse):
    pass


class DeliveryResult(BaseModel):
    app_id: str
    version_id: str
    instance_id: str
    url: str
    summary: str
    features: list[str]
    report_url: str
    artifact_url: str
    published_at: datetime


class JobSnapshot(BaseModel):
    id: str
    app_id: str
    kind: Literal['GENERATE', 'ADJUST', 'COPY']
    status: JobStatus
    phase: str
    event_cursor: int = Field(ge=0)
    question: str | None = None
    usage_units: int = Field(ge=0)
    result: DeliveryResult | None = None
    error: PublicError | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode='after')
    def check_result(self):
        if self.status != JobStatus.SUCCEEDED and self.result is not None:
            raise ValueError('unfinished jobs cannot expose delivery results')
        if self.status == JobStatus.SUCCEEDED and self.result is None:
            raise ValueError('successful jobs require actual delivery')
        return self


class ReportCheck(BaseModel):
    id: str
    action: str
    expected: str
    status: Literal['PASS', 'FAIL', 'NOT_RUN']
    evidence_urls: list[str] = Field(default_factory=list)


class JobReport(BaseModel):
    job_id: str
    overall: Literal['PASS', 'FAIL', 'NOT_RUN']
    checks: list[ReportCheck] = Field(default_factory=list)
    requirement_revision: int | None = None
    attempt_id: str | None = None
    manifest_hash: str | None = None


class ConversationMessage(BaseModel):
    id: str
    sequence: int
    role: Literal['user', 'assistant']
    content: str
    created_at: datetime


class AppSummary(BaseModel):
    id: str
    name: str
    updated_at: datetime
    active_job_id: str | None = None
    instance_status: Literal['PENDING', 'RUNNING', 'STOPPED', 'FAILED', 'DELETED'] | None = None
    source_version_id: str | None = None


class AppDetail(AppSummary):
    requirement: Requirement
    conversation: list[ConversationMessage]
    active_job: JobSnapshot | None = None
    latest_job: JobSnapshot | None = None
    delivery: DeliveryResult | None = None
    candidate_version_id: str | None = None
    instance: InstanceSnapshot | None = None
    publication: PublicationResponse | None = None


class AppPage(BaseModel):
    items: list[AppSummary]
    next_cursor: str | None = None


class JobEvent(BaseModel):
    id: int
    kind: str
    message: str
    status: JobStatus
    phase: str
    usage_units: int = Field(default=0, ge=0)


class InstanceOperationResponse(BaseModel):
    id: str
    instance_id: str
    kind: Literal['START', 'STOP', 'DELETE']
    status: Literal['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED']
    error: PublicError | None = None
    created_at: datetime
    updated_at: datetime


class DeleteInstanceRequest(BaseModel):
    confirmation: str
    delete_data: bool


Requirement.model_rebuild()
RequirementDraft.model_rebuild()


class CreateAppRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=20000)
    budget_units: int | None = Field(default=None, gt=0)
    evaluation_target_id: str | None = None

    @model_validator(mode='after')
    def nonblank(self):
        if not self.prompt.strip():
            raise ValueError('prompt cannot be blank')
        return self


class MessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=20000)
    budget_units: int | None = Field(default=None, gt=0)

    @model_validator(mode='after')
    def nonblank(self):
        if not self.content.strip():
            raise ValueError('message cannot be blank')
        return self


class ResumeRequest(BaseModel):
    budget_units: int | None = Field(default=None, gt=0)


class QuotaBalance(BaseModel):
    available_units: int
    reserved_units: int


class QuotaPolicy(BaseModel):
    default_budget_units: int
    hard_cap_units: int
    price_version: str
    failed_usage_rule: str


class QuotaUsage(BaseModel):
    id: str
    kind: str
    units: int
    cost_units: int
    price_version: str
    created_at: datetime


class QuotaUsagePage(BaseModel):
    items: list[QuotaUsage]
    next_cursor: str | None = None


class QuotaSku(BaseModel):
    id: str
    name: str
    provider: Literal['alipay','wechat','stripe']
    currency: Literal['CNY','USD']
    amount_minor: int
    units: int
    period: str | None = None


class SubscriptionInfo(BaseModel):
    id: str
    sku_id: str
    provider: str
    status: str
    period_end: datetime
    cancelled: bool


class CreateOrderRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    sku_id: str = Field(min_length=1, max_length=128)
    provider: Literal['alipay', 'wechat', 'stripe']


class PaymentOrderInfo(BaseModel):
    order_id: str
    status: Literal['CREATED', 'PAID', 'CANCELLED', 'FAILED']
    provider: Literal['alipay', 'wechat', 'stripe']
    name: str
    currency: Literal['CNY', 'USD']
    amount_minor: int
    units: int
    period: str | None = None
    checkout_url: str | None = None
    payment_url: str | None = None
    checkout_kind: Literal['QR', 'REDIRECT'] | None = None
    expires_at: datetime
    paid_at: datetime | None = None
    refunded_amount_minor: int = 0
    refund_review_required: bool = False
