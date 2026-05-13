"""
降级生成任务相关的API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.fallback import (
    AgentEventResponse,
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
    QueryTaskStatusResponse,
    GetArtifactResultResponse,
    DeployFailureFeedbackRequest,
    DeployFailureFeedbackResponse,
)
from app.services.generation_task_service import GenerationTaskService
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/generation", tags=["generation"])


def _internal_error(message: str, exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "error": f"{message}: {str(exc)}",
            "code": "INTERNAL_ERROR",
            "details": None,
        },
    )


@router.post("/start", response_model=StartFallbackTaskResponse)
async def start_fallback_task(
    request: StartFallbackTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    启动降级生成任务

    当以下情况发生时调用:
    - 候选仓库都不合适 (LOW_SCORE_ALL)
    - Top1 修复失败，转 Branch B (REPAIR_EXHAUSTED)
    - 人工指定强制走生成 (FORCE_FALLBACK)
    """
    service = GenerationTaskService(db)
    try:
        response = await service.start_fallback_task(request)
        return response
    except Exception as e:
        raise _internal_error("Failed to start fallback task", e)


@router.get("/status/{task_id}", response_model=QueryTaskStatusResponse)
async def query_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    查询生成任务状态

    用于轮询任务进度
    """
    service = GenerationTaskService(db)
    try:
        response = await service.query_task_status(task_id)
        return response
    except Exception as e:
        raise _internal_error("Failed to query task status", e)


@router.get("/artifact/{task_id}", response_model=GetArtifactResultResponse)
async def get_artifact_result(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取生成产物结果

    当任务状态为 SUCCEEDED 时调用
    """
    service = GenerationTaskService(db)
    try:
        response = await service.get_artifact_result(task_id)
        return response
    except Exception as e:
        raise _internal_error("Failed to get artifact result", e)


@router.post("/feedback", response_model=DeployFailureFeedbackResponse)
async def send_deploy_failure_feedback(
    request: DeployFailureFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    部署失败后回传修复/重生成请求

    当部署到 Sealos 后失败时，将清洗后的错误信息回传
    """
    service = GenerationTaskService(db)
    try:
        response = await service.send_deploy_failure_feedback(request)
        return response
    except Exception as e:
        raise _internal_error("Failed to send deploy failure feedback", e)


@router.get("/deployment/{deployment_id}/tasks")
async def get_deployment_tasks(
    deployment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取某个部署的所有生成任务
    """
    service = GenerationTaskService(db)
    tasks = service.get_tasks_by_deployment(deployment_id)
    return {
        "deploymentId": deployment_id,
        "tasks": [
            {
                "taskId": task.task_id,
                "status": task.status,
                "generationMode": task.generation_mode,
                "triggerReason": task.trigger_reason,
                "queuedAt": task.queued_at,
                "finishedAt": task.finished_at,
                "artifactReady": task.artifact_ready,
                "deployReady": task.deploy_ready,
            }
            for task in tasks
        ],
    }


@router.get("/deployment/{deployment_id}/events")
async def get_deployment_events(
    deployment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取部署事件列表
    """
    service = GenerationTaskService(db)
    events = service.get_deployment_events(deployment_id)
    return {
        "deploymentId": deployment_id,
        "events": [
            {
                "id": event.id,
                "phase": event.phase,
                "level": event.level,
                "message": event.message,
                "errorType": event.error_type,
                "createdAt": event.created_at,
            }
            for event in events
        ],
    }


@router.get("/task/{task_id}/agent-events", response_model=list[AgentEventResponse])
async def get_task_agent_events(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取某个生成任务的多智能体事件流。
    """
    service = GenerationTaskService(db)
    return [service.build_agent_event_response(event) for event in service.get_task_agent_events(task_id)]


@router.get("/session/{session_id}/agent-events", response_model=list[AgentEventResponse])
async def get_session_agent_events(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取某个session的多智能体事件流。
    """
    service = GenerationTaskService(db)
    return [service.build_agent_event_response(event) for event in service.get_session_agent_events(session_id)]
