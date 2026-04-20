from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from fallback.schemas.plan import EnvVarSpec


class TaskStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class TaskStage(StrEnum):
    QUEUED = "queued"
    CLASSIFYING = "classifying"
    SOLVING = "solving"
    MATERIALIZING = "materializing"
    VALIDATING = "validating"
    PACKAGING = "packaging"
    COMPLETED = "completed"
    FAILED = "failed"
    MANUAL_REQUIRED = "manual_required"


class TaskCreateResponse(BaseModel):
    accepted: bool = True
    task_id: str
    status: str = TaskStatus.QUEUED.value
    queued_at: str
    message: str | None = None

    model_config = ConfigDict(extra="ignore")


class TaskState(BaseModel):
    task_id: str
    project_id: str | None = None
    deployment_id: str | None = None
    status: str
    current_stage: str | None = None
    progress_message: str | None = None
    artifact_ready: bool = False
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    error_code: str | None = None
    error_message: str | None = None
    recoverable: bool | None = None

    model_config = ConfigDict(extra="ignore")


class ArtifactRuntime(BaseModel):
    base_image: str | None = None
    package_manager: str | None = None
    install_command: str | None = None
    start_command: str | None = None
    exposed_port: int | None = None
    healthcheck_path: str | None = None

    model_config = ConfigDict(extra="ignore")


class ArtifactResponse(BaseModel):
    task_id: str
    artifact_type: str
    artifact_path: str | None = None
    artifact_uri: str | None = None
    artifact_key: str | None = None
    dockerfile_content: str | None = None
    runtime: ArtifactRuntime
    required_envs: list[EnvVarSpec] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    summary: str | None = None
    deploy_ready: bool = False
    next_action: str | None = None

    model_config = ConfigDict(extra="ignore")

