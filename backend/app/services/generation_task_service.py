"""
降级生成任务管理服务
"""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.intellideploy.generation_task import GenerationTask
from app.models.intellideploy.deployment_event import DeploymentEvent
from app.schemas.fallback import (
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
    QueryTaskStatusResponse,
    GetArtifactResultResponse,
    DeployFailureFeedbackRequest,
    DeployFailureFeedbackResponse,
    TaskStatus,
)
from app.services.fallback_client import get_fallback_client
from app.services.websocket_manager import get_ws_manager


class GenerationTaskService:
    """降级生成任务服务"""

    def __init__(self, db: Session):
        self.db = db
        self.fallback_client = get_fallback_client()

    async def start_fallback_task(
        self, request: StartFallbackTaskRequest
    ) -> StartFallbackTaskResponse:
        """
        启动降级生成任务

        1. 调用杨钞越的服务启动任务
        2. 将任务信息存入数据库

        Args:
            request: 启动任务请求

        Returns:
            StartFallbackTaskResponse: 任务启动响应
        """
        # 调用杨钞越的服务
        response = await self.fallback_client.start_fallback_task(request)

        # 存入数据库
        task = GenerationTask(
            task_id=response.task_id,
            project_id=int(request.project_id),
            deployment_id=int(request.deployment_id),
            trigger_reason=request.trigger_reason.value,
            generation_mode=request.generation_mode.value,
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

        # 记录部署事件
        event = DeploymentEvent(
            deployment_id=int(request.deployment_id),
            phase="generation",
            level="info",
            message=f"Started fallback generation task: {response.task_id}",
        )
        self.db.add(event)
        self.db.commit()

        await get_ws_manager().broadcast_pipeline_stage(
            str(request.deployment_id),
            "Generating",
            status="running",
            message=f"生成任务已入队: {response.task_id}",
            progress=0.45,
            data={"task_id": response.task_id, "task_status": response.status.value},
        )

        return response

    async def query_task_status(self, task_id: str) -> QueryTaskStatusResponse:
        """
        查询生成任务状态

        1. 从杨钞越的服务查询最新状态
        2. 更新数据库中的任务状态

        Args:
            task_id: Celery任务ID

        Returns:
            QueryTaskStatusResponse: 任务状态响应
        """
        # 查询杨钞越的服务
        response = await self.fallback_client.query_task_status(task_id)

        # 更新数据库
        task = self.db.query(GenerationTask).filter(GenerationTask.task_id == task_id).first()
        if task:
            task.status = response.status.value
            task.current_stage = response.current_stage
            task.progress_message = response.progress_message
            task.artifact_ready = response.artifact_ready
            task.error_code = response.error_code.value if response.error_code else None
            task.error_message = response.error_message
            task.recoverable = response.recoverable

            # 更新时间戳
            if response.status == TaskStatus.RUNNING and not task.started_at:
                task.started_at = datetime.now()
            elif response.status in [TaskStatus.SUCCEEDED, TaskStatus.FAILED] and not task.finished_at:
                task.finished_at = datetime.now()

            self.db.commit()

            stage, stage_status, progress = self._map_task_stage(
                response.current_stage,
                response.status.value,
                response.artifact_ready,
            )
            await get_ws_manager().broadcast_pipeline_stage(
                str(task.deployment_id),
                stage,
                status=stage_status,
                message=response.progress_message or self._task_status_message(response.status.value),
                progress=progress,
                data={
                    "task_id": task_id,
                    "task_status": response.status.value,
                    "current_stage": response.current_stage,
                    "artifact_ready": response.artifact_ready,
                    "recoverable": response.recoverable,
                },
            )

        return response

    async def get_artifact_result(self, task_id: str) -> GetArtifactResultResponse:
        """
        获取生成产物结果

        1. 从杨钞越的服务获取产物
        2. 更新数据库中的产物信息

        Args:
            task_id: Celery任务ID

        Returns:
            GetArtifactResultResponse: 产物结果响应
        """
        # 获取产物
        response = await self.fallback_client.get_artifact_result(task_id)

        # 更新数据库
        task = self.db.query(GenerationTask).filter(GenerationTask.task_id == task_id).first()
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

            await get_ws_manager().broadcast_pipeline_stage(
                str(task.deployment_id),
                "Packaging" if response.deploy_ready else "Generating",
                status="success" if response.deploy_ready else "failed",
                message=response.summary or ("生成产物已就绪" if response.deploy_ready else "生成产物未达到部署条件"),
                progress=0.62 if response.deploy_ready else 0.58,
                data={
                    "task_id": task_id,
                    "artifact_type": response.artifact_type.value,
                    "deploy_ready": response.deploy_ready,
                    "artifact_uri": response.artifact_uri,
                },
            )

        return response

    async def send_deploy_failure_feedback(
        self, request: DeployFailureFeedbackRequest
    ) -> DeployFailureFeedbackResponse:
        """
        部署失败后回传修复/重生成请求

        1. 调用杨钞越的服务发起重生成
        2. 创建新的任务记录

        Args:
            request: 部署失败反馈请求

        Returns:
            DeployFailureFeedbackResponse: 反馈响应
        """
        # 调用杨钞越的服务
        response = await self.fallback_client.send_deploy_failure_feedback(request)

        # 创建新任务记录
        if response.accepted:
            # 获取原任务信息
            source_task = (
                self.db.query(GenerationTask)
                .filter(GenerationTask.task_id == request.source_task_id)
                .first()
            )

            if source_task:
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

            # 记录部署事件
            event = DeploymentEvent(
                deployment_id=int(request.deployment_id),
                phase="heal",
                level="warning",
                message=f"Deploy failed at {request.failed_stage.value}, started regeneration: {response.task_id}",
                error_type=request.error_type,
            )
            self.db.add(event)
            self.db.commit()

            await get_ws_manager().broadcast_pipeline_stage(
                str(request.deployment_id),
                "Healing",
                status="running",
                message=f"部署失败,已启动修复生成任务: {response.task_id}",
                progress=0.72,
                data={
                    "task_id": response.task_id,
                    "source_task_id": request.source_task_id,
                    "failed_stage": request.failed_stage.value,
                    "error_type": request.error_type,
                },
            )

        return response

    def get_task_by_id(self, task_id: str) -> Optional[GenerationTask]:
        """根据task_id获取任务"""
        return self.db.query(GenerationTask).filter(GenerationTask.task_id == task_id).first()

    def get_tasks_by_deployment(self, deployment_id: int) -> List[GenerationTask]:
        """获取某个部署的所有生成任务"""
        return (
            self.db.query(GenerationTask)
            .filter(GenerationTask.deployment_id == deployment_id)
            .order_by(GenerationTask.queued_at.desc())
            .all()
        )

    def get_deployment_events(self, deployment_id: int) -> List[DeploymentEvent]:
        """获取部署事件列表"""
        return (
            self.db.query(DeploymentEvent)
            .filter(DeploymentEvent.deployment_id == deployment_id)
            .order_by(DeploymentEvent.created_at.desc())
            .all()
        )

    @staticmethod
    def _map_task_stage(
        current_stage: Optional[str],
        task_status: str,
        artifact_ready: bool,
    ) -> tuple[str, str, float]:
        if task_status == TaskStatus.FAILED.value:
            return ("Finalize", "failed", 1.0)
        if task_status == TaskStatus.SUCCEEDED.value or artifact_ready:
            return ("Packaging", "success", 0.62)
        if task_status == TaskStatus.QUEUED.value:
            return ("Generating", "running", 0.45)

        stage_key = (current_stage or "").lower()
        if stage_key in {"classifying", "planning", "thinking"}:
            return ("Thinking", "running", 0.16)
        if stage_key in {"solving", "building", "generating"}:
            return ("Building", "running", 0.5)
        if stage_key in {"validating", "reviewing"}:
            return ("Reviewing", "running", 0.56)
        if stage_key in {"materializing", "packaging"}:
            return ("Packaging", "running", 0.6)
        return ("Generating", "running", 0.5)

    @staticmethod
    def _task_status_message(task_status: str) -> str:
        messages = {
            TaskStatus.QUEUED.value: "生成任务等待调度",
            TaskStatus.RUNNING.value: "生成任务正在执行",
            TaskStatus.SUCCEEDED.value: "生成任务已完成",
            TaskStatus.FAILED.value: "生成任务失败",
        }
        return messages.get(task_status, "生成任务状态已更新")
