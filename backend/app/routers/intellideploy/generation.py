"""
降级生成任务相关的API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.fallback import (
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
    QueryTaskStatusResponse,
    GetArtifactResultResponse,
    DeployFailureFeedbackRequest,
    DeployFailureFeedbackResponse,
)
from app.services.generation_task_service import GenerationTaskService

router = APIRouter(prefix="/api/generation", tags=["generation"])


@router.post("/start", response_model=StartFallbackTaskResponse)
async def start_fallback_task(
    request: StartFallbackTaskRequest,
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start fallback task: {str(e)}",
        )


@router.get("/status/{task_id}", response_model=QueryTaskStatusResponse)
async def query_task_status(
    task_id: str,
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query task status: {str(e)}",
        )


@router.get("/artifact/{task_id}", response_model=GetArtifactResultResponse)
async def get_artifact_result(
    task_id: str,
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get artifact result: {str(e)}",
        )


@router.post("/feedback", response_model=DeployFailureFeedbackResponse)
async def send_deploy_failure_feedback(
    request: DeployFailureFeedbackRequest,
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send deploy failure feedback: {str(e)}",
        )


@router.get("/deployment/{deployment_id}/tasks")
async def get_deployment_tasks(
    deployment_id: int,
    db: Session = Depends(get_db),
):
    """
    获取某个部署的所有生成任务
    """
    service = GenerationTaskService(db)
    tasks = service.get_tasks_by_deployment(deployment_id)
    return {
        "deployment_id": deployment_id,
        "tasks": [
            {
                "task_id": task.task_id,
                "status": task.status,
                "generation_mode": task.generation_mode,
                "trigger_reason": task.trigger_reason,
                "queued_at": task.queued_at,
                "finished_at": task.finished_at,
                "artifact_ready": task.artifact_ready,
                "deploy_ready": task.deploy_ready,
            }
            for task in tasks
        ],
    }


@router.get("/deployment/{deployment_id}/events")
async def get_deployment_events(
    deployment_id: int,
    db: Session = Depends(get_db),
):
    """
    获取部署事件列表
    """
    service = GenerationTaskService(db)
    events = service.get_deployment_events(deployment_id)
    return {
        "deployment_id": deployment_id,
        "events": [
            {
                "id": event.id,
                "phase": event.phase,
                "level": event.level,
                "message": event.message,
                "error_type": event.error_type,
                "created_at": event.created_at,
            }
            for event in events
        ],
    }
