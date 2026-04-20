from __future__ import annotations

from datetime import UTC, datetime
import shutil

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.validation import ValidationResult
from fallback.schemas.workspace import ArtifactManifest, DeployArtifact, WorkspaceContext, WorkspaceStatus

from .config import FallbackConfig, get_config
from .logger import get_fallback_logger


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class ArtifactBuilder:
    def __init__(self, *, config: FallbackConfig | None = None) -> None:
        self.config = config or get_config()
        self.logger = get_fallback_logger("fallback.artifact_builder")

    def package(
        self,
        *,
        workspace_context: WorkspaceContext,
        validation_result: ValidationResult,
        plan: FallbackPlan,
    ) -> DeployArtifact:
        artifact_path = workspace_context.paths.artifact_path
        if artifact_path.exists():
            shutil.rmtree(artifact_path)
        shutil.copytree(workspace_context.paths.workspace_path, artifact_path)

        dockerfile_path = artifact_path / "Dockerfile"
        manifest = ArtifactManifest.from_plan(
            plan=plan,
            validation_result=validation_result,
            project_root=artifact_path,
            dockerfile_path=dockerfile_path if dockerfile_path.exists() else None,
            source_type="REPO_SOURCE" if plan.decision in {"A", "B"} else "GENERATED_PROJECT",
            commit_sha=workspace_context.commit_sha,
        )
        manifest_path = artifact_path / "artifact_manifest.json"
        manifest_path.write_text(manifest.model_dump_json(indent=2), encoding="utf-8")

        workspace_context.status = WorkspaceStatus.PACKAGED.value
        workspace_context.timestamps.packaged_at = _now_iso()
        workspace_context.timestamps.updated_at = workspace_context.timestamps.packaged_at
        workspace_context.paths.metadata_path.write_text(workspace_context.model_dump_json(indent=2), encoding="utf-8")

        deploy_artifact = DeployArtifact(
            task_id=workspace_context.task_id,
            artifact_path=artifact_path,
            artifact_type=plan.artifact_type or ("STITCHED_PROJECT" if plan.decision in {"A", "B"} else "TEMPLATE_PROJECT"),
            ready_for_deploy=validation_result.passed,
            warnings=list(plan.warnings),
            manifest_path=manifest_path,
            project_root=artifact_path,
            dockerfile_path=dockerfile_path if dockerfile_path.exists() else None,
            start_command=plan.docker_spec.start_command if plan.docker_spec else None,
            exposed_port=plan.docker_spec.exposed_port if plan.docker_spec else None,
        )
        self.logger.info(
            "artifact_packaged task_id=%s artifact=%s ready=%s",
            workspace_context.task_id,
            artifact_path,
            validation_result.passed,
        )
        return deploy_artifact
