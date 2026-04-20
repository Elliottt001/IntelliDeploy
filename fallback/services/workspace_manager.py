from __future__ import annotations

from datetime import UTC, datetime
import shutil

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.workspace import MaterializeResult, WorkspaceContext, WorkspacePaths, WorkspaceStatus

from .config import FallbackConfig, get_config
from .logger import get_fallback_logger
from .patch_applier import apply_patch_plan
from .source_fetcher import SourceFetchResult, fetch_source


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class WorkspaceManager:
    def __init__(self, *, config: FallbackConfig | None = None) -> None:
        self.config = config or get_config()
        self.logger = get_fallback_logger("fallback.workspace_manager")

    def create_task_workspace(
        self,
        *,
        task_id: str,
        decision: str,
        artifact_type: str | None,
        source_repo_url: str | None,
        default_branch: str | None,
        commit_sha: str | None = None,
    ) -> WorkspaceContext:
        paths = WorkspacePaths.for_task(
            task_id=task_id,
            workspaces_root=self.config.workspaces_dir,
            artifacts_root=self.config.artifacts_dir,
        )
        workspace_root = paths.metadata_path.parent
        if workspace_root.exists():
            shutil.rmtree(workspace_root)
        workspace_root.mkdir(parents=True, exist_ok=True)
        paths.source_path.mkdir(parents=True, exist_ok=True)
        paths.workspace_path.mkdir(parents=True, exist_ok=True)
        paths.logs_path.mkdir(parents=True, exist_ok=True)

        context = WorkspaceContext(
            task_id=task_id,
            decision=decision,
            paths=paths,
            source_repo_url=source_repo_url,
            default_branch=default_branch,
            commit_sha=commit_sha,
            artifact_type=artifact_type,
            status=WorkspaceStatus.INITIALIZED.value,
        )
        self.write_metadata(context)
        return context

    def write_metadata(self, context: WorkspaceContext) -> None:
        context.timestamps.updated_at = context.timestamps.updated_at or context.timestamps.created_at
        context.paths.metadata_path.write_text(context.model_dump_json(indent=2), encoding="utf-8")

    def clone_source_to_workspace(self, context: WorkspaceContext) -> None:
        if context.paths.workspace_path.exists():
            shutil.rmtree(context.paths.workspace_path)
        shutil.copytree(context.paths.source_path, context.paths.workspace_path)

    def materialize(
        self,
        *,
        task_id: str,
        request: FallbackRequest,
        plan: FallbackPlan,
        classify_response: ClassifyResponse,
    ) -> MaterializeResult:
        context = self.create_task_workspace(
            task_id=task_id,
            decision=plan.decision,
            artifact_type=plan.artifact_type,
            source_repo_url=plan.source_repo_url,
            default_branch=request.repo_info.default_branch,
        )
        if plan.decision == "A":
            return self.materialize_a(context=context, request=request, plan=plan)
        if plan.decision == "B":
            return self.materialize_b(context=context, request=request, plan=plan)
        if plan.decision == "C":
            return self.materialize_c(context=context, plan=plan)
        raise ValueError(f"Decision `{plan.decision}` does not materialize a workspace.")

    def _fetch_source(self, *, task_id: str, request: FallbackRequest) -> SourceFetchResult:
        return fetch_source(
            repo_url=request.repo_info.repo_url,
            default_branch=request.repo_info.default_branch,
            task_id=task_id,
            destination_root=self.config.workspaces_dir,
            seed_files=request.key_files or None,
        )

    def materialize_a(
        self,
        *,
        context: WorkspaceContext,
        request: FallbackRequest,
        plan: FallbackPlan,
    ) -> MaterializeResult:
        fetch_result = self._fetch_source(task_id=context.task_id, request=request)
        context.commit_sha = fetch_result.resolved_commit_sha
        context.status = WorkspaceStatus.SOURCE_FETCHED.value
        self.clone_source_to_workspace(context)
        patch_result = apply_patch_plan(
            workspace_path=context.paths.workspace_path,
            generated_files=plan.generated_files,
            modified_files=plan.modified_files,
        )
        context.status = WorkspaceStatus.MATERIALIZED.value
        context.timestamps.materialized_at = _now_iso()
        context.timestamps.updated_at = context.timestamps.materialized_at
        self.write_metadata(context)
        return MaterializeResult.from_patch_result(
            task_id=context.task_id,
            decision=plan.decision,
            workspace_context=context,
            patch_result=patch_result,
            warnings=list(plan.warnings),
            success=not patch_result.conflicts,
        )

    def materialize_b(
        self,
        *,
        context: WorkspaceContext,
        request: FallbackRequest,
        plan: FallbackPlan,
    ) -> MaterializeResult:
        return self.materialize_a(context=context, request=request, plan=plan)

    def materialize_c(
        self,
        *,
        context: WorkspaceContext,
        plan: FallbackPlan,
    ) -> MaterializeResult:
        if context.paths.workspace_path.exists():
            shutil.rmtree(context.paths.workspace_path)
        context.paths.workspace_path.mkdir(parents=True, exist_ok=True)
        patch_result = apply_patch_plan(
            workspace_path=context.paths.workspace_path,
            generated_files=plan.generated_files,
            modified_files=plan.modified_files,
        )
        context.status = WorkspaceStatus.MATERIALIZED.value
        context.timestamps.materialized_at = _now_iso()
        context.timestamps.updated_at = context.timestamps.materialized_at
        self.write_metadata(context)
        return MaterializeResult.from_patch_result(
            task_id=context.task_id,
            decision=plan.decision,
            workspace_context=context,
            patch_result=patch_result,
            warnings=list(plan.warnings),
            success=not patch_result.conflicts,
        )
