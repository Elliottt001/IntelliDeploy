from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional, Protocol

import httpx

from app.config import settings
from app.schemas.fallback import (
    DeployFailureFeedbackRequest,
    DeployFailureFeedbackResponse,
    GetArtifactResultResponse,
    QueryTaskStatusResponse,
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
    TaskStatus,
)


def _ensure_fallback_import_path() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    repo_root_text = str(repo_root)
    if repo_root_text not in sys.path:
        sys.path.insert(0, repo_root_text)


class FallbackClientProtocol(Protocol):
    async def start_fallback_task(
        self, request: StartFallbackTaskRequest
    ) -> StartFallbackTaskResponse: ...

    async def query_task_status(self, task_id: str) -> QueryTaskStatusResponse: ...

    async def get_artifact_result(self, task_id: str) -> GetArtifactResultResponse: ...

    async def send_deploy_failure_feedback(
        self, request: DeployFailureFeedbackRequest
    ) -> DeployFailureFeedbackResponse: ...


class HttpFallbackGenerationClient:
    """Client for a separate fallback HTTP service."""

    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url.rstrip("/")
        self.timeout = 30.0

    async def start_fallback_task(
        self, request: StartFallbackTaskRequest
    ) -> StartFallbackTaskResponse:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/fallback/start",
                json=request.model_dump(mode="json", exclude_none=True),
            )
            response.raise_for_status()
            return StartFallbackTaskResponse(**response.json())

    async def query_task_status(self, task_id: str) -> QueryTaskStatusResponse:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.base_url}/api/fallback/status/{task_id}")
            response.raise_for_status()
            return QueryTaskStatusResponse(**response.json())

    async def get_artifact_result(self, task_id: str) -> GetArtifactResultResponse:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.base_url}/api/fallback/artifact/{task_id}")
            response.raise_for_status()
            return GetArtifactResultResponse(**response.json())

    async def send_deploy_failure_feedback(
        self, request: DeployFailureFeedbackRequest
    ) -> DeployFailureFeedbackResponse:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/fallback/feedback",
                json=request.model_dump(mode="json", exclude_none=True),
            )
            response.raise_for_status()
            return DeployFailureFeedbackResponse(**response.json())


class LocalFallbackGenerationClient:
    """In-process fallback client for local development and tests."""

    def __init__(self, store=None) -> None:
        _ensure_fallback_import_path()
        from fallback.async_tasks.redis_state import get_state_store

        self.store = store or get_state_store()

    @staticmethod
    def _to_fallback_request(request: StartFallbackTaskRequest):
        _ensure_fallback_import_path()
        from fallback.schemas.request import FallbackRequest

        preferred_stack = request.preferred_stack
        repo_profile = request.repo_profile
        constraints = request.constraints
        preferred_framework = None
        if preferred_stack:
            preferred_framework = preferred_stack.backend or preferred_stack.frontend

        return FallbackRequest(
            raw_query=request.original_prompt,
            user_intent={
                "target_output_type": "deployable_artifact",
                "target_app_type": (
                    "fullstack"
                    if preferred_stack and preferred_stack.frontend and preferred_stack.backend
                    else "backend_api"
                    if preferred_stack and preferred_stack.backend
                    else "frontend_web"
                    if preferred_stack and preferred_stack.frontend
                    else "unknown"
                ),
                "preferred_language": (
                    repo_profile.detected_languages[0]
                    if repo_profile and repo_profile.detected_languages
                    else None
                ),
                "preferred_framework": preferred_framework,
                "constraints": {
                    "trigger_reason": request.trigger_reason.value,
                    "generation_mode": request.generation_mode.value,
                    **(constraints.model_dump(exclude_none=True) if constraints else {}),
                },
            },
            repo_info={
                "repo_url": repo_profile.source_repo_url if repo_profile else None,
                "description": repo_profile.readme_summary if repo_profile else None,
            },
            file_tree=request.file_tree or [],
            key_files=request.key_files or {},
            project_id=request.project_id,
            deployment_id=request.deployment_id,
            request_id=request.request_id,
            force_fallback=request.trigger_reason.value == "FORCE_FALLBACK",
            repair_exhausted=request.trigger_reason.value == "REPAIR_EXHAUSTED",
        )

    async def start_fallback_task(
        self, request: StartFallbackTaskRequest
    ) -> StartFallbackTaskResponse:
        _ensure_fallback_import_path()
        from fallback.async_tasks.tasks import run_fallback_task, submit_fallback_task
        from fallback.interfaces import (
            get_external_task_status,
        )

        fallback_request = self._to_fallback_request(request)
        submit_response = submit_fallback_task(
            fallback_request,
            store=self.store,
        )
        saved_request = self.store.get_request(submit_response.task_id)
        if saved_request is not None:
            try:
                run_fallback_task(submit_response.task_id, saved_request, store=self.store)
            except Exception:
                # run_fallback_task persists a FAILED task state before raising.
                pass

        status = get_external_task_status(submit_response.task_id, store=self.store)
        return StartFallbackTaskResponse(
            accepted=submit_response.accepted,
            task_id=submit_response.task_id,
            status=TaskStatus(status.status) if status else TaskStatus(submit_response.status),
            queued_at=submit_response.queued_at,
            message=(status.progress_message if status else None) or submit_response.message,
        )

    async def query_task_status(self, task_id: str) -> QueryTaskStatusResponse:
        _ensure_fallback_import_path()
        from fallback.interfaces import get_external_task_status

        status = get_external_task_status(task_id, store=self.store)
        if status is None:
            raise ValueError(f"Fallback task {task_id} not found")
        return QueryTaskStatusResponse.model_validate(status.model_dump(mode="json"))

    async def get_artifact_result(self, task_id: str) -> GetArtifactResultResponse:
        _ensure_fallback_import_path()
        from fallback.interfaces import get_external_task_artifact

        artifact = get_external_task_artifact(task_id, store=self.store)
        if artifact is None:
            raise ValueError(f"Artifact for fallback task {task_id} not found")
        return GetArtifactResultResponse.model_validate(artifact.model_dump(mode="json"))

    async def send_deploy_failure_feedback(
        self, request: DeployFailureFeedbackRequest
    ) -> DeployFailureFeedbackResponse:
        _ensure_fallback_import_path()
        from fallback.async_tasks.tasks import run_fallback_task
        from fallback.interfaces import get_external_task_status, submit_repair_task

        repair_response = submit_repair_task(
            request.model_dump(mode="json", exclude_none=True),
            store=self.store,
        )
        saved_request = self.store.get_request(repair_response.task_id)
        if saved_request is not None:
            try:
                run_fallback_task(repair_response.task_id, saved_request, store=self.store)
            except Exception:
                pass

        status = get_external_task_status(repair_response.task_id, store=self.store)
        return DeployFailureFeedbackResponse(
            accepted=repair_response.accepted,
            task_id=repair_response.task_id,
            status=TaskStatus(status.status) if status else TaskStatus(repair_response.status),
            message=(status.progress_message if status else None) or repair_response.message,
        )


_fallback_client: Optional[FallbackClientProtocol] = None


def get_fallback_client() -> FallbackClientProtocol:
    """Return the configured fallback generation client."""
    global _fallback_client
    if _fallback_client is None:
        configured_url = settings.FALLBACK_SERVICE_URL.strip().lower()
        if configured_url in {"", "local", "inprocess"}:
            _fallback_client = LocalFallbackGenerationClient()
        else:
            _fallback_client = HttpFallbackGenerationClient(
                base_url=settings.FALLBACK_SERVICE_URL
            )
    return _fallback_client
