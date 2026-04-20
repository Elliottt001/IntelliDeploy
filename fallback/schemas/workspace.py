from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from .plan import EnvVarSpec, FallbackPlan
from .validation import ValidationResult


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class WorkspaceStatus(StrEnum):
    INITIALIZED = "INITIALIZED"
    SOURCE_FETCHED = "SOURCE_FETCHED"
    MATERIALIZED = "MATERIALIZED"
    VALIDATED = "VALIDATED"
    PACKAGED = "PACKAGED"
    FAILED = "FAILED"


class WorkspacePaths(BaseModel):
    source_path: Path
    workspace_path: Path
    logs_path: Path
    artifact_path: Path
    metadata_path: Path

    model_config = ConfigDict(extra="ignore")

    @classmethod
    def for_task(
        cls,
        *,
        task_id: str,
        workspaces_root: str | Path,
        artifacts_root: str | Path,
    ) -> "WorkspacePaths":
        workspace_root = Path(workspaces_root) / task_id
        return cls(
            source_path=workspace_root / "source",
            workspace_path=workspace_root / "workspace",
            logs_path=workspace_root / "logs",
            artifact_path=Path(artifacts_root) / task_id,
            metadata_path=workspace_root / "metadata.json",
        )


class WorkspaceTimestamps(BaseModel):
    created_at: str = Field(default_factory=_utc_now_iso)
    updated_at: str = Field(default_factory=_utc_now_iso)
    materialized_at: str | None = None
    validated_at: str | None = None
    packaged_at: str | None = None

    model_config = ConfigDict(extra="ignore")


class WorkspaceContext(BaseModel):
    task_id: str
    decision: str
    paths: WorkspacePaths
    source_repo_url: str | None = None
    default_branch: str | None = None
    commit_sha: str | None = None
    artifact_type: str | None = None
    status: str = WorkspaceStatus.INITIALIZED.value
    timestamps: WorkspaceTimestamps = Field(default_factory=WorkspaceTimestamps)

    model_config = ConfigDict(extra="ignore")


class PatchApplyResult(BaseModel):
    created_files: list[str] = Field(default_factory=list)
    updated_files: list[str] = Field(default_factory=list)
    skipped_files: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    logs: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class MaterializeResult(BaseModel):
    task_id: str
    decision: str
    workspace_context: WorkspaceContext
    created_files: list[str] = Field(default_factory=list)
    updated_files: list[str] = Field(default_factory=list)
    skipped_files: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    logs: list[str] = Field(default_factory=list)
    success: bool = True

    model_config = ConfigDict(extra="ignore")

    @classmethod
    def from_patch_result(
        cls,
        *,
        task_id: str,
        decision: str,
        workspace_context: WorkspaceContext,
        patch_result: PatchApplyResult,
        warnings: list[str] | None = None,
        success: bool = True,
    ) -> "MaterializeResult":
        return cls(
            task_id=task_id,
            decision=decision,
            workspace_context=workspace_context,
            created_files=list(patch_result.created_files),
            updated_files=list(patch_result.updated_files),
            skipped_files=list(patch_result.skipped_files),
            conflicts=list(patch_result.conflicts),
            warnings=list(warnings or []),
            logs=list(patch_result.logs),
            success=success,
        )


class ArtifactValidationSummary(BaseModel):
    passed: bool
    final_status: str
    blocking_error_count: int = 0
    warning_count: int = 0
    summary: str | None = None
    errors: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")

    @classmethod
    def from_validation_result(cls, validation_result: ValidationResult) -> "ArtifactValidationSummary":
        final_status = getattr(validation_result, "final_status", None)
        if not final_status or (not validation_result.passed and final_status == "PASS"):
            final_status = "PASS" if validation_result.passed else "FAIL"

        calculated_blocking = sum(1 for error in validation_result.errors if getattr(error, "severity", "blocking") == "blocking")
        calculated_warning = sum(1 for error in validation_result.errors if getattr(error, "severity", "blocking") == "warning")
        blocking_error_count = getattr(validation_result, "blocking_error_count", 0) or calculated_blocking
        warning_count = getattr(validation_result, "warning_count", 0) or calculated_warning
        summary = getattr(validation_result, "summary", None)
        if summary is None and validation_result.errors:
            summary = validation_result.errors[0].message
        elif summary is None:
            summary = "Validation passed."

        return cls(
            passed=validation_result.passed,
            final_status=final_status,
            blocking_error_count=blocking_error_count,
            warning_count=warning_count,
            summary=summary,
            errors=[error.message for error in validation_result.errors],
        )


class ArtifactManifest(BaseModel):
    source_type: str
    decision: str
    source_repo_url: str | None = None
    commit_sha: str | None = None
    generated_files: list[str] = Field(default_factory=list)
    modified_files: list[str] = Field(default_factory=list)
    dockerfile_path: Path | None = None
    start_command: str | None = None
    exposed_port: int | None = None
    required_envs: list[EnvVarSpec] = Field(default_factory=list)
    validation_summary: ArtifactValidationSummary
    artifact_type: str | None = None
    project_root: Path | None = None
    warnings: list[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=_utc_now_iso)

    model_config = ConfigDict(extra="ignore")

    @classmethod
    def from_plan(
        cls,
        *,
        plan: FallbackPlan,
        validation_result: ValidationResult,
        project_root: str | Path,
        dockerfile_path: str | Path | None = None,
        source_type: str,
        commit_sha: str | None = None,
        warnings: list[str] | None = None,
    ) -> "ArtifactManifest":
        resolved_project_root = Path(project_root)
        resolved_dockerfile_path = Path(dockerfile_path) if dockerfile_path else None
        return cls(
            source_type=source_type,
            decision=plan.decision,
            source_repo_url=plan.source_repo_url,
            commit_sha=commit_sha,
            generated_files=[item.path for item in plan.generated_files],
            modified_files=[item.path for item in plan.modified_files],
            dockerfile_path=resolved_dockerfile_path,
            start_command=plan.docker_spec.start_command if plan.docker_spec else None,
            exposed_port=plan.docker_spec.exposed_port if plan.docker_spec else None,
            required_envs=list(plan.env_vars),
            validation_summary=ArtifactValidationSummary.from_validation_result(validation_result),
            artifact_type=plan.artifact_type,
            project_root=resolved_project_root,
            warnings=list(warnings or plan.warnings),
        )


class DeployArtifact(BaseModel):
    task_id: str
    artifact_path: Path
    artifact_type: str
    ready_for_deploy: bool
    warnings: list[str] = Field(default_factory=list)
    manifest_path: Path
    project_root: Path
    dockerfile_path: Path | None = None
    start_command: str | None = None
    exposed_port: int | None = None

    model_config = ConfigDict(extra="ignore")
