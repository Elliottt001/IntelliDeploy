"""
闄嶇骇鐢熸垚浠诲姟绠＄悊鏈嶅姟
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sys
from typing import Any, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.intellideploy.deployment_event import DeploymentEvent
from app.models.intellideploy.generation_task import GenerationTask
from app.models.intellideploy.generation_task_agent_event import GenerationTaskAgentEvent
from app.models.intellideploy.generation_task_artifact_version import GenerationTaskArtifactVersion
from app.schemas.fallback import (
    AgentEventResponse,
    ArtifactType,
    DeployFailureFeedbackRequest,
    DeployFailureFeedbackResponse,
    GetArtifactResultResponse,
    NextAction,
    QueryTaskStatusResponse,
    RequiredEnv,
    RuntimeInfo,
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
    TaskStatus,
)
from app.services.fallback_client import get_fallback_client
from app.services.websocket_manager import get_ws_manager

DEPLOY_ROOT = Path(__file__).resolve().parents[5]
if str(DEPLOY_ROOT) not in sys.path:
    sys.path.insert(0, str(DEPLOY_ROOT))

try:
    from graph import run_graph
except Exception:  # pragma: no cover
    run_graph = None


def _model_to_dict(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_model_to_dict(item) for item in value]
    if isinstance(value, dict):
        return {key: _model_to_dict(item) for key, item in value.items()}
    return value


class GenerationTaskService:
    """闄嶇骇鐢熸垚浠诲姟鏈嶅姟"""

    def __init__(self, db: Session):
        self.db = db
        self.fallback_client = get_fallback_client()

    async def start_fallback_task(
        self, request: StartFallbackTaskRequest
    ) -> StartFallbackTaskResponse:
        """
        浼樺厛鎵ц涓绘枃浠跺す澶氭櫤鑳戒綋 graph锛涘け璐ユ椂鍐嶉€€鍥?fallback 鏈嶅姟銆?
        """
        graph_response = await self._try_start_main_graph_task(request)
        if graph_response is not None:
            return graph_response

        response = await self.fallback_client.start_fallback_task(request)

        task = GenerationTask(
            task_id=response.task_id,
            project_id=int(request.project_id),
            deployment_id=int(request.deployment_id),
            trigger_reason=request.trigger_reason.value,
            generation_mode=request.generation_mode.value,
            execution_engine="fallback",
            status=response.status.value,
            original_prompt=request.original_prompt,
            repo_profile=request.repo_profile.model_dump() if request.repo_profile else None,
            preferred_stack=request.preferred_stack.model_dump() if request.preferred_stack else None,
            constraints=request.constraints.model_dump() if request.constraints else None,
            evaluation_score=request.evaluation_score,
            missing_components=request.missing_components,
            queued_at=response.queued_at,
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        event = DeploymentEvent(
            deployment_id=int(request.deployment_id),
            phase="generation",
            level="info",
            message=f"Started fallback generation task: {response.task_id}",
        )
        self.db.add(event)
        self.db.commit()

        return response

    async def query_task_status(self, task_id: str) -> QueryTaskStatusResponse:
        task = self.db.query(GenerationTask).filter(GenerationTask.task_id == task_id).first()
        if task and self._is_main_graph_task(task):
            return self._build_main_graph_status_response(task)

        response = await self.fallback_client.query_task_status(task_id)

        if task:
            task.status = response.status.value
            task.current_stage = response.current_stage
            task.progress_message = response.progress_message
            task.artifact_ready = response.artifact_ready
            task.error_code = response.error_code.value if response.error_code else None
            task.error_message = response.error_message
            task.recoverable = response.recoverable

            if response.status == TaskStatus.RUNNING and not task.started_at:
                task.started_at = datetime.now()
            elif response.status in [TaskStatus.SUCCEEDED, TaskStatus.FAILED] and not task.finished_at:
                task.finished_at = datetime.now()

            self.db.commit()

        return response

    async def get_artifact_result(self, task_id: str) -> GetArtifactResultResponse:
        task = self.db.query(GenerationTask).filter(GenerationTask.task_id == task_id).first()
        if task and self._is_main_graph_task(task):
            return self._build_main_graph_artifact_response(task)

        response = await self.fallback_client.get_artifact_result(task_id)

        if task:
            task.artifact_ready = True
            task.artifact_type = response.artifact_type.value
            task.artifact_path = response.artifact_path
            task.artifact_uri = response.artifact_uri
            task.dockerfile_content = response.dockerfile_content
            task.runtime_info = response.runtime.model_dump()
            task.required_envs = [env.model_dump() for env in response.required_envs]
            task.warnings = response.warnings
            task.summary = response.summary
            task.deploy_ready = response.deploy_ready
            self.db.commit()

        return response

    async def send_deploy_failure_feedback(
        self, request: DeployFailureFeedbackRequest
    ) -> DeployFailureFeedbackResponse:
        source_task = (
            self.db.query(GenerationTask)
            .filter(GenerationTask.task_id == request.source_task_id)
            .first()
        )
        if source_task and self._is_main_graph_task(source_task):
            return await self._rerun_main_graph_task(request, source_task)

        response = await self.fallback_client.send_deploy_failure_feedback(request)

        if response.accepted and source_task:
            new_task = GenerationTask(
                task_id=response.task_id,
                project_id=int(request.project_id),
                deployment_id=int(request.deployment_id),
                trigger_reason="REPAIR_EXHAUSTED",
                generation_mode=source_task.generation_mode,
                status=response.status.value,
                original_prompt=source_task.original_prompt,
                repo_profile=source_task.repo_profile,
                preferred_stack=source_task.preferred_stack,
                constraints=request.constraints.model_dump() if request.constraints else None,
                queued_at=datetime.now(),
            )
            self.db.add(new_task)
            self.db.commit()

            event = DeploymentEvent(
                deployment_id=int(request.deployment_id),
                phase="heal",
                level="warning",
                message=f"Deploy failed at {request.failed_stage.value}, started regeneration: {response.task_id}",
                error_type=request.error_type,
            )
            self.db.add(event)
            self.db.commit()

        return response

    def get_task_by_id(self, task_id: str) -> Optional[GenerationTask]:
        return self.db.query(GenerationTask).filter(GenerationTask.task_id == task_id).first()

    def get_tasks_by_deployment(self, deployment_id: int) -> List[GenerationTask]:
        return (
            self.db.query(GenerationTask)
            .filter(GenerationTask.deployment_id == deployment_id)
            .order_by(GenerationTask.queued_at.desc())
            .all()
        )

    def get_deployment_events(self, deployment_id: int) -> List[DeploymentEvent]:
        return (
            self.db.query(DeploymentEvent)
            .filter(DeploymentEvent.deployment_id == deployment_id)
            .order_by(DeploymentEvent.created_at.desc())
            .all()
        )

    def get_task_agent_events(self, task_id: str) -> List[GenerationTaskAgentEvent]:
        return (
            self.db.query(GenerationTaskAgentEvent)
            .filter(GenerationTaskAgentEvent.task_id == task_id)
            .order_by(GenerationTaskAgentEvent.created_at.asc(), GenerationTaskAgentEvent.id.asc())
            .all()
        )

    def get_session_agent_events(self, session_id: str) -> List[GenerationTaskAgentEvent]:
        return (
            self.db.query(GenerationTaskAgentEvent)
            .filter(GenerationTaskAgentEvent.session_id == session_id)
            .order_by(GenerationTaskAgentEvent.created_at.asc(), GenerationTaskAgentEvent.id.asc())
            .all()
        )

    def build_agent_event_response(self, event: GenerationTaskAgentEvent) -> AgentEventResponse:
        return AgentEventResponse(
            id=event.id,
            task_id=event.task_id,
            session_id=event.session_id,
            deployment_id=str(event.deployment_id),
            iteration_count=event.iteration_count,
            agent_name=event.agent_name,
            stage=event.stage,
            event_type=event.event_type,
            message=event.message,
            payload=event.payload,
            created_at=event.created_at,
        )

    async def _try_start_main_graph_task(
        self, request: StartFallbackTaskRequest
    ) -> StartFallbackTaskResponse | None:
        if run_graph is None:
            return None
        try:
            return await self._create_main_graph_task(
                project_id=request.project_id,
                deployment_id=request.deployment_id,
                original_prompt=request.original_prompt,
                repo_profile=request.repo_profile.model_dump(exclude_none=True) if request.repo_profile else {},
                constraints=request.constraints.model_dump(exclude_none=True) if request.constraints else {},
                trigger_reason=request.trigger_reason.value,
                generation_mode=request.generation_mode.value,
                request_id=request.request_id,
                error_context=None,
                source_task_id=None,
            )
        except Exception:  # pragma: no cover
            return None

    async def _rerun_main_graph_task(
        self,
        request: DeployFailureFeedbackRequest,
        source_task: GenerationTask,
    ) -> DeployFailureFeedbackResponse:
        response = await self._create_main_graph_task(
            project_id=request.project_id,
            deployment_id=request.deployment_id,
            original_prompt=source_task.original_prompt,
            repo_profile=source_task.repo_profile or {},
            constraints=request.constraints.model_dump(exclude_none=True) if request.constraints else (source_task.constraints or {}),
            trigger_reason="REPAIR_EXHAUSTED",
            generation_mode=source_task.generation_mode,
            request_id=f"{request.source_task_id}-repair-{request.retry_count + 1}",
            error_context=request.sanitized_error_log,
            source_task_id=request.source_task_id,
        )
        return DeployFailureFeedbackResponse(
            accepted=response.accepted,
            task_id=response.task_id,
            status=response.status,
            message=response.message,
        )

    async def _create_main_graph_task(
        self,
        *,
        project_id: str,
        deployment_id: str,
        original_prompt: str,
        repo_profile: dict[str, Any],
        constraints: dict[str, Any],
        trigger_reason: str,
        generation_mode: str,
        request_id: str | None,
        error_context: str | None,
        source_task_id: str | None,
    ) -> StartFallbackTaskResponse:
        queued_at = datetime.now()
        task_id = f"graph-{uuid4().hex[:12]}"
        session_id = request_id or f"session-{uuid4().hex[:12]}"
        graph_state = self._run_main_graph(
            session_id=session_id,
            project_id=project_id,
            original_prompt=original_prompt,
            repo_profile=repo_profile,
            constraints=constraints,
            error_context=error_context,
        )
        build_result = graph_state.get("build_result")
        graph_meta = self._build_graph_meta(graph_state, session_id=session_id)
        runtime_info = {
            **self._build_runtime_info(graph_state),
            "_graph": graph_meta,
        }
        task_status = TaskStatus.SUCCEEDED if graph_state.get("is_approved") else TaskStatus.FAILED

        task = GenerationTask(
            task_id=task_id,
            project_id=int(project_id),
            deployment_id=int(deployment_id),
            trigger_reason=trigger_reason,
            generation_mode=generation_mode,
            execution_engine="main_graph",
            session_id=session_id,
            status=task_status.value,
            current_stage=str(graph_state.get("stage") or "").upper() or None,
            progress_message=graph_state.get("status_message"),
            iteration_count=int(graph_state.get("iteration_count") or 0),
            is_approved=bool(graph_state.get("is_approved")),
            original_prompt=original_prompt,
            repo_profile={
                **(repo_profile or {}),
                "integration_source": "main_graph",
                "source_task_id": source_task_id,
            },
            preferred_stack=None,
            constraints={
                **(constraints or {}),
                "integration_source": "main_graph",
                "session_id": session_id,
            },
            artifact_ready=build_result is not None,
            artifact_type=ArtifactType.STITCHED_PROJECT.value if build_result is not None else None,
            artifact_version=getattr(build_result, "artifact_version", None),
            dockerfile_content=getattr(build_result, "current_dockerfile", None),
            runtime_info=runtime_info,
            required_envs=self._build_required_envs(graph_state),
            graph_state_snapshot=graph_meta,
            error_message=graph_state.get("failure_reason") or graph_state.get("last_error"),
            failure_reason=graph_state.get("failure_reason"),
            recoverable=not bool(graph_state.get("is_approved")),
            warnings=getattr(build_result, "build_warnings", []),
            summary=getattr(build_result, "build_summary", None),
            deploy_ready=bool(graph_state.get("is_approved")),
            queued_at=queued_at,
            started_at=queued_at,
            finished_at=datetime.now(),
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        await self._persist_graph_events(
            deployment_id=int(deployment_id),
            task_id=task_id,
            session_id=session_id,
            graph_state=graph_state,
        )
        await self._persist_artifact_version(
            deployment_id=int(deployment_id),
            task_id=task_id,
            session_id=session_id,
            graph_state=graph_state,
        )
        await self._broadcast_graph_events(
            deployment_id=str(deployment_id),
            task_id=task_id,
            session_id=session_id,
            graph_state=graph_state,
        )

        return StartFallbackTaskResponse(
            accepted=True,
            task_id=task_id,
            status=task_status,
            queued_at=queued_at,
            message="Started main multi-agent flow",
        )

    def _run_main_graph(
        self,
        *,
        session_id: str,
        project_id: str,
        original_prompt: str,
        repo_profile: dict[str, Any],
        constraints: dict[str, Any],
        error_context: str | None,
    ) -> dict[str, Any]:
        repo_context = {
            "repo_url": repo_profile.get("source_repo_url"),
            "repo_owner": None,
            "repo_name": None,
            "default_branch": None,
            "file_list": repo_profile.get("dependency_files") or [],
            "readme_text": repo_profile.get("readme_summary") or "",
            "tech_stack": repo_profile.get("detected_frameworks") or repo_profile.get("detected_languages") or [],
            "entrypoints": repo_profile.get("entrypoints") or [],
            "dependency_files": repo_profile.get("dependency_files") or [],
            "detected_ports": [constraints["target_port"]] if constraints.get("target_port") else [],
            "env_candidates": [],
            "error_context": error_context or "",
        }
        state = {
            "project_id": str(project_id),
            "session_id": session_id,
            "user_prompt": original_prompt,
            "trigger_source": "api_generation_start" if not error_context else "deploy_failure_feedback",
            "repo_context": repo_context,
            "max_iteration_limit": 3,
        }
        return run_graph(state)

    def _build_graph_meta(self, graph_state: dict[str, Any], *, session_id: str) -> dict[str, Any]:
        build_result = graph_state.get("build_result")
        return {
            "session_id": session_id,
            "stage": graph_state.get("stage"),
            "iteration_count": graph_state.get("iteration_count", 0),
            "is_approved": graph_state.get("is_approved", False),
            "failure_reason": graph_state.get("failure_reason"),
            "artifact_version": getattr(build_result, "artifact_version", None),
            "current_configs": _model_to_dict(graph_state.get("current_configs", {})),
            "review_history": _model_to_dict(graph_state.get("review_history", [])),
            "security_reports": _model_to_dict(graph_state.get("security_reports", [])),
            "event_stream": _model_to_dict(graph_state.get("event_stream", [])),
        }

    def _build_runtime_info(self, graph_state: dict[str, Any]) -> dict[str, Any]:
        configs = graph_state.get("current_configs") or {}
        ports = configs.get("ports") or graph_state.get("repo_context", {}).get("detected_ports") or [8000]
        return {
            "base_image": None,
            "package_manager": None,
            "install_command": None,
            "start_command": None,
            "exposed_port": ports[0] if ports else 8000,
            "healthcheck_path": None,
        }

    def _build_required_envs(self, graph_state: dict[str, Any]) -> list[dict[str, Any]]:
        candidates = graph_state.get("repo_context", {}).get("env_candidates") or []
        required_envs: list[dict[str, Any]] = []
        for item in candidates:
            if isinstance(item, str):
                required_envs.append(
                    {
                        "name": item,
                        "required": True,
                        "example_value": None,
                        "description": None,
                        "source": None,
                    }
                )
            elif isinstance(item, dict) and item.get("name"):
                required_envs.append(
                    {
                        "name": item["name"],
                        "required": bool(item.get("required", True)),
                        "example_value": item.get("example_value"),
                        "description": item.get("description"),
                        "source": item.get("source"),
                    }
                )
        return required_envs

    async def _persist_graph_events(
        self,
        *,
        deployment_id: int,
        task_id: str,
        session_id: str,
        graph_state: dict[str, Any],
    ) -> None:
        db_events: list[DeploymentEvent] = []
        agent_events: list[GenerationTaskAgentEvent] = []
        for event in graph_state.get("event_stream", []):
            stage = str(event.get("stage") or graph_state.get("stage") or "").upper() or None
            normalized_payload = self._build_agent_event_payload(event, graph_state)
            agent_name = self._infer_agent_name(event)
            db_events.append(
                DeploymentEvent(
                    deployment_id=deployment_id,
                    phase="generation",
                    level="info" if event.get("event_type") != "graph_error" else "error",
                    message=f"[{task_id}] {event.get('message', '')}",
                    error_type=event.get("event_type"),
                )
            )
            agent_events.append(
                GenerationTaskAgentEvent(
                    task_id=task_id,
                    session_id=session_id,
                    deployment_id=deployment_id,
                    iteration_count=event.get("iteration_count", graph_state.get("iteration_count", 0)),
                    agent_name=agent_name,
                    stage=stage,
                    event_type=str(event.get("event_type") or "agent_state"),
                    message=event.get("message"),
                    payload=normalized_payload,
                )
            )
        if db_events:
            self.db.add_all(db_events)
        if agent_events:
            self.db.add_all(agent_events)
        if db_events or agent_events:
            self.db.commit()

    async def _persist_artifact_version(
        self,
        *,
        deployment_id: int,
        task_id: str,
        session_id: str,
        graph_state: dict[str, Any],
    ) -> None:
        build_result = graph_state.get("build_result")
        if build_result is None:
            return

        artifact = GenerationTaskArtifactVersion(
            task_id=task_id,
            session_id=session_id,
            deployment_id=deployment_id,
            artifact_version=getattr(build_result, "artifact_version", None),
            iteration_count=int(graph_state.get("iteration_count") or 0),
            is_approved=bool(graph_state.get("is_approved")),
            dockerfile_content=getattr(build_result, "current_dockerfile", None),
            current_configs=_model_to_dict(graph_state.get("current_configs", {})),
            review_history=_model_to_dict(graph_state.get("review_history", [])),
            security_reports=_model_to_dict(graph_state.get("security_reports", [])),
            summary=getattr(build_result, "build_summary", None),
        )
        self.db.add(artifact)
        self.db.commit()

    async def _broadcast_graph_events(
        self,
        *,
        deployment_id: str,
        task_id: str,
        session_id: str,
        graph_state: dict[str, Any],
    ) -> None:
        manager = get_ws_manager()
        for event in graph_state.get("event_stream", []):
            stage = str(event.get("stage") or graph_state.get("stage") or "").upper()
            payload = {
                "task_id": task_id,
                "session_id": session_id,
                "deployment_id": deployment_id,
                "agent_name": self._infer_agent_name(event),
                "iteration_count": event.get("iteration_count", 0),
                "event_type": event.get("event_type"),
                "payload": self._build_agent_event_payload(event, graph_state),
            }
            await manager.broadcast_agent_state(
                deployment_id,
                stage=stage,
                message=str(event.get("message") or ""),
                data=payload,
            )
            await manager.broadcast_agent_state_by_session(
                session_id,
                stage=stage,
                message=str(event.get("message") or ""),
                data=payload,
            )
        await manager.broadcast_status(
            deployment_id,
            str(graph_state.get("stage") or "").upper(),
            {
                "task_id": task_id,
                "session_id": session_id,
                "is_approved": graph_state.get("is_approved", False),
                "iteration_count": graph_state.get("iteration_count", 0),
                "failure_reason": graph_state.get("failure_reason"),
            },
        )
        await manager.broadcast_session_event(
            session_id,
            "session_status",
            {
                "task_id": task_id,
                "deployment_id": deployment_id,
                "stage": str(graph_state.get("stage") or "").upper(),
                "is_approved": graph_state.get("is_approved", False),
                "iteration_count": graph_state.get("iteration_count", 0),
                "failure_reason": graph_state.get("failure_reason"),
            },
        )

    def _infer_agent_name(self, event: dict[str, Any]) -> str:
        explicit_agent = event.get("agent_name")
        if explicit_agent:
            return str(explicit_agent)

        stage = str(event.get("stage") or "").upper()
        if "REVIEW" in stage:
            return "reviewer"
        if "SECURITY" in stage:
            return "security"
        if "BUILD" in stage:
            return "builder"
        if "THINK" in stage:
            return "router"
        return "graph"

    def _build_agent_event_payload(
        self,
        event: dict[str, Any],
        graph_state: dict[str, Any],
    ) -> dict[str, Any]:
        payload = _model_to_dict(event.get("payload") or {})
        if not isinstance(payload, dict):
            payload = {"value": payload}
        payload.setdefault("status_message", graph_state.get("status_message"))
        payload.setdefault("failure_reason", graph_state.get("failure_reason"))
        return payload

    def _is_main_graph_task(self, task: GenerationTask) -> bool:
        if getattr(task, "execution_engine", None) == "main_graph":
            return True
        repo_profile = task.repo_profile or {}
        constraints = task.constraints or {}
        return (
            repo_profile.get("integration_source") == "main_graph"
            or constraints.get("integration_source") == "main_graph"
        )

    def _build_main_graph_status_response(self, task: GenerationTask) -> QueryTaskStatusResponse:
        graph_meta = task.graph_state_snapshot or (task.runtime_info or {}).get("_graph", {})
        return QueryTaskStatusResponse(
            task_id=task.task_id,
            project_id=str(task.project_id),
            deployment_id=str(task.deployment_id),
            status=TaskStatus(task.status),
            execution_engine=task.execution_engine,
            current_stage=task.current_stage,
            progress_message=task.progress_message,
            artifact_ready=task.artifact_ready,
            updated_at=task.updated_at,
            error_message=task.error_message,
            recoverable=task.recoverable,
            session_id=task.session_id or graph_meta.get("session_id"),
            iteration_count=task.iteration_count if task.iteration_count is not None else graph_meta.get("iteration_count"),
            is_approved=task.is_approved if task.is_approved is not None else graph_meta.get("is_approved"),
            failure_reason=task.failure_reason or graph_meta.get("failure_reason"),
        )

    def _build_main_graph_artifact_response(self, task: GenerationTask) -> GetArtifactResultResponse:
        runtime_payload = dict(task.runtime_info or {})
        graph_meta = task.graph_state_snapshot or runtime_payload.pop("_graph", {})
        runtime = RuntimeInfo(
            base_image=runtime_payload.get("base_image"),
            package_manager=runtime_payload.get("package_manager"),
            install_command=runtime_payload.get("install_command"),
            start_command=runtime_payload.get("start_command") or "sh start.sh",
            exposed_port=int(runtime_payload.get("exposed_port") or 8000),
            healthcheck_path=runtime_payload.get("healthcheck_path"),
        )
        required_envs = [RequiredEnv.model_validate(item) for item in (task.required_envs or [])]
        return GetArtifactResultResponse(
            task_id=task.task_id,
            artifact_type=ArtifactType(task.artifact_type or ArtifactType.STITCHED_PROJECT.value),
            artifact_path=task.artifact_path,
            artifact_uri=task.artifact_uri,
            artifact_key=None,
            dockerfile_content=task.dockerfile_content or "",
            runtime=runtime,
            required_envs=required_envs,
            warnings=task.warnings,
            summary=task.summary,
            deploy_ready=task.deploy_ready,
            next_action=NextAction.DEPLOY if task.deploy_ready else NextAction.MANUAL_REVIEW,
            execution_engine=task.execution_engine,
            session_id=task.session_id or graph_meta.get("session_id"),
            artifact_version=task.artifact_version or graph_meta.get("artifact_version"),
            current_configs=graph_meta.get("current_configs"),
            review_history=graph_meta.get("review_history"),
            security_reports=graph_meta.get("security_reports"),
        )
