from datetime import datetime
from typing import List, Optional
from enum import Enum

from pydantic import BaseModel, Field


# ==================== 枚举定义 ====================

class TriggerReason(str, Enum):
    LOW_SCORE_ALL = "LOW_SCORE_ALL"
    REPAIR_EXHAUSTED = "REPAIR_EXHAUSTED"
    FORCE_FALLBACK = "FORCE_FALLBACK"


class GenerationMode(str, Enum):
    AUTO = "AUTO"
    VIBE = "VIBE"
    COMPONENT_REASSEMBLY = "COMPONENT_REASSEMBLY"


class TaskStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    GENERATING = "GENERATING"
    STITCHING = "STITCHING"
    PACKAGING = "PACKAGING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class ErrorCode(str, Enum):
    TEMPLATE_NOT_FOUND = "TEMPLATE_NOT_FOUND"
    STITCH_FAILED = "STITCH_FAILED"
    INVALID_DOCKERFILE = "INVALID_DOCKERFILE"
    START_COMMAND_MISSING = "START_COMMAND_MISSING"
    PORT_NOT_DETECTED = "PORT_NOT_DETECTED"
    MISSING_RUNTIME_INFO = "MISSING_RUNTIME_INFO"
    TIMEOUT = "TIMEOUT"
    UNKNOWN = "UNKNOWN"


class FailedStage(str, Enum):
    BUILD = "BUILD"
    RUN = "RUN"
    HEALTHCHECK = "HEALTHCHECK"


class PackageManager(str, Enum):
    npm = "npm"
    pnpm = "pnpm"
    yarn = "yarn"
    pip = "pip"
    poetry = "poetry"
    go = "go"
    maven = "maven"
    gradle = "gradle"


class ArtifactType(str, Enum):
    TEMPLATE_PROJECT = "TEMPLATE_PROJECT"
    STITCHED_PROJECT = "STITCHED_PROJECT"


class EnvSource(str, Enum):
    DETECTED = "DETECTED"
    ASSUMED = "ASSUMED"


class NextAction(str, Enum):
    DEPLOY = "DEPLOY"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class RegenMode(str, Enum):
    PATCH_EXISTING = "PATCH_EXISTING"
    REGENERATE = "REGENERATE"


# ==================== 子结构 ====================

class PreferredStack(BaseModel):
    frontend: Optional[str] = None
    backend: Optional[str] = None
    database: Optional[str] = None
    runtime: Optional[str] = None


class RepoProfile(BaseModel):
    source_repo_url: Optional[str] = None
    detected_languages: Optional[List[str]] = None
    detected_frameworks: Optional[List[str]] = None
    package_manager: Optional[PackageManager] = None
    entrypoints: Optional[List[str]] = None
    dependency_files: Optional[List[str]] = None
    has_valid_dockerfile: Optional[bool] = None
    readme_summary: Optional[str] = None


class Constraints(BaseModel):
    timeout_seconds: Optional[int] = None
    target_port: Optional[int] = None
    must_provide_dockerfile: Optional[bool] = True
    must_provide_healthcheck: Optional[bool] = True


class RuntimeInfo(BaseModel):
    base_image: Optional[str] = None
    package_manager: Optional[str] = None
    install_command: Optional[str] = None
    start_command: str
    exposed_port: int
    healthcheck_path: Optional[str] = None


class RequiredEnv(BaseModel):
    name: str
    required: bool
    example_value: Optional[str] = None
    description: Optional[str] = None
    source: Optional[EnvSource] = None


class HealthcheckResult(BaseModel):
    status_code: Optional[int] = None
    response_snippet: Optional[str] = None


# ==================== 接口 A：启动降级生成任务 ====================

class StartFallbackTaskRequest(BaseModel):
    project_id: str
    deployment_id: str
    request_id: Optional[str] = None
    trigger_reason: TriggerReason
    original_prompt: str
    generation_mode: GenerationMode
    evaluation_score: Optional[int] = Field(None, ge=0, le=100)
    missing_components: Optional[List[str]] = None
    preferred_stack: Optional[PreferredStack] = None
    repo_profile: Optional[RepoProfile] = None
    constraints: Optional[Constraints] = None


class StartFallbackTaskResponse(BaseModel):
    accepted: bool
    task_id: str
    status: TaskStatus
    queued_at: datetime
    message: Optional[str] = None


# ==================== 接口 B：查询生成任务状态 ====================

class QueryTaskStatusRequest(BaseModel):
    task_id: str


class QueryTaskStatusResponse(BaseModel):
    task_id: str
    project_id: str
    deployment_id: str
    status: TaskStatus
    current_stage: Optional[str] = None
    progress_message: Optional[str] = None
    artifact_ready: bool
    updated_at: datetime
    error_code: Optional[ErrorCode] = None
    error_message: Optional[str] = None
    recoverable: Optional[bool] = None


# ==================== 接口 C：获取生成产物结果 ====================

class GetArtifactResultRequest(BaseModel):
    task_id: str


class GetArtifactResultResponse(BaseModel):
    task_id: str
    artifact_type: ArtifactType
    artifact_path: Optional[str] = None
    artifact_uri: Optional[str] = None
    artifact_key: Optional[str] = None
    dockerfile_content: str
    runtime: RuntimeInfo
    required_envs: List[RequiredEnv]
    warnings: Optional[List[str]] = None
    summary: Optional[str] = None
    deploy_ready: bool
    next_action: Optional[NextAction] = None


# ==================== 接口 D：部署失败后回传修复/重生成请求 ====================

class DeployFailureFeedbackRequest(BaseModel):
    project_id: str
    deployment_id: str
    source_task_id: str
    failed_stage: FailedStage
    error_type: Optional[str] = None
    sanitized_error_log: str
    last_dockerfile_content: str
    healthcheck_result: Optional[HealthcheckResult] = None
    retry_count: int
    regen_mode: RegenMode
    constraints: Optional[Constraints] = None


class DeployFailureFeedbackResponse(BaseModel):
    accepted: bool
    task_id: str
    status: TaskStatus
    message: Optional[str] = None
