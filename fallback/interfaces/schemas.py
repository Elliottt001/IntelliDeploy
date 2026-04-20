from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from fallback.schemas.enums import GenerationMode, TriggerReason


class PreferredStack(BaseModel):
    frontend: str | None = None
    backend: str | None = None
    database: str | None = None
    runtime: str | None = None

    model_config = ConfigDict(extra="ignore")


class SubmitConstraints(BaseModel):
    timeout_seconds: int | None = None
    target_port: int | None = None
    must_provide_dockerfile: bool | None = None
    must_provide_healthcheck: bool | None = None

    model_config = ConfigDict(extra="ignore")


class SubmitRepoProfile(BaseModel):
    source_repo_url: str | None = None
    detected_languages: list[str] = Field(default_factory=list)
    detected_frameworks: list[str] = Field(default_factory=list)
    package_manager: str | None = None
    entrypoints: list[str] = Field(default_factory=list)
    dependency_files: list[str] = Field(default_factory=list)
    has_valid_dockerfile: bool | None = None
    readme_summary: str | None = None

    model_config = ConfigDict(extra="ignore")


class FallbackTaskSubmitRequest(BaseModel):
    project_id: str
    deployment_id: str
    request_id: str | None = None
    trigger_reason: TriggerReason
    original_prompt: str
    generation_mode: GenerationMode
    evaluation_score: int | None = None
    missing_components: list[str] = Field(default_factory=list)
    preferred_stack: PreferredStack = Field(default_factory=PreferredStack)
    repo_profile: SubmitRepoProfile = Field(default_factory=SubmitRepoProfile)
    constraints: SubmitConstraints = Field(default_factory=SubmitConstraints)

    model_config = ConfigDict(extra="ignore")


class FallbackTaskSubmitResponse(BaseModel):
    accepted: bool
    task_id: str
    status: Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]
    queued_at: str
    message: str | None = None

    model_config = ConfigDict(extra="ignore")


class FallbackTaskStatusResponse(BaseModel):
    task_id: str
    project_id: str
    deployment_id: str
    status: Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]
    current_stage: Literal[
        "queued",
        "classifying",
        "solving",
        "materializing",
        "validating",
        "packaging",
        "completed",
        "failed",
        "manual_required",
    ] | None = None
    progress_message: str | None = None
    artifact_ready: bool
    updated_at: str
    error_code: str | None = None
    error_message: str | None = None
    recoverable: bool | None = None

    model_config = ConfigDict(extra="ignore")


class RequiredEnvVar(BaseModel):
    name: str
    required: bool
    example_value: str | None = None
    description: str | None = None
    source: Literal["DETECTED", "ASSUMED"] | None = None

    model_config = ConfigDict(extra="ignore")


class FallbackArtifactRuntime(BaseModel):
    base_image: str | None = None
    package_manager: str | None = None
    install_command: str | None = None
    start_command: str
    exposed_port: int
    healthcheck_path: str | None = None

    model_config = ConfigDict(extra="ignore")


class FallbackArtifactResponse(BaseModel):
    task_id: str
    artifact_type: Literal["TEMPLATE_PROJECT", "STITCHED_PROJECT"]
    artifact_path: str | None = None
    artifact_uri: str | None = None
    artifact_key: str | None = None
    dockerfile_content: str
    runtime: FallbackArtifactRuntime
    required_envs: list[RequiredEnvVar] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    summary: str | None = None
    deploy_ready: bool
    next_action: Literal["DEPLOY", "MANUAL_REVIEW"] | None = None

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="after")
    def ensure_artifact_locator(cls, value: "FallbackArtifactResponse") -> "FallbackArtifactResponse":
        if not any([value.artifact_path, value.artifact_uri, value.artifact_key]):
            raise ValueError("At least one of artifact_path, artifact_uri, or artifact_key must be present.")
        return value


class FailedStage(StrEnum):
    BUILD = "BUILD"
    RUN = "RUN"
    HEALTHCHECK = "HEALTHCHECK"


class RegenMode(StrEnum):
    PATCH_EXISTING = "PATCH_EXISTING"
    REGENERATE = "REGENERATE"


class RepairHealthcheckResult(BaseModel):
    status_code: int | None = None
    response_snippet: str | None = None

    model_config = ConfigDict(extra="ignore")


class FallbackRepairRequest(BaseModel):
    project_id: str
    deployment_id: str
    source_task_id: str
    failed_stage: FailedStage
    error_type: str | None = None
    sanitized_error_log: str
    last_dockerfile_content: str
    healthcheck_result: RepairHealthcheckResult = Field(default_factory=RepairHealthcheckResult)
    retry_count: int
    regen_mode: RegenMode
    constraints: SubmitConstraints = Field(default_factory=SubmitConstraints)

    model_config = ConfigDict(extra="ignore")


class FallbackRepairSubmitResponse(BaseModel):
    accepted: bool
    task_id: str
    status: Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]
    message: str | None = None

    model_config = ConfigDict(extra="ignore")
