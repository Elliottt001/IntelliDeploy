"""
部署相关的API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.intellideploy.deployment import Deployment
from app.models.user import User
from app.schemas.fallback import GetArtifactResultResponse
from app.services.deployment_orchestrator import DeploymentOrchestrator
from app.services.generation_task_service import GenerationTaskService
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/deployments", tags=["deployments"])


class StartDeploymentRequest(BaseModel):
    task_id: str  # 生成任务ID
    kubeconfig: Optional[str] = None  # K8s配置(可选)


class DeploymentResponse(BaseModel):
    id: int
    project_id: int
    status: str
    runtime_name: str
    access_url: Optional[str]
    ingress_domain: Optional[str]
    sealos_app_id: Optional[str]
    error_message: Optional[str]
    retry_count: int
    created_at: str
    started_at: Optional[str]
    finished_at: Optional[str]


@router.post("/start", response_model=dict)
async def start_deployment(
    request: StartDeploymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    启动部署

    从生成任务获取产物并部署到Sealos
    """
    generation_service = GenerationTaskService(db)

    try:
        # 获取生成产物
        artifact = await generation_service.get_artifact_result(request.task_id)

        # 检查是否可以部署
        if not artifact.deploy_ready:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Artifact is not ready for deployment",
            )

        # 获取生成任务信息
        task = generation_service.get_task_by_id(request.task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Generation task not found",
            )

        # 创建部署记录
        deployment = Deployment(
            project_id=task.project_id,
            status="pending",
            runtime_name=f"app-{task.project_id}",
            dockerfile_content=artifact.dockerfile_content,
        )
        db.add(deployment)
        db.commit()
        db.refresh(deployment)

        # 启动部署
        orchestrator = DeploymentOrchestrator(db, kubeconfig=request.kubeconfig)
        result = await orchestrator.start_deployment(
            deployment_id=deployment.id,
            artifact=artifact,
            kubeconfig=request.kubeconfig,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start deployment: {str(e)}",
        )


@router.get("/{deployment_id}", response_model=DeploymentResponse)
async def get_deployment(
    deployment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取部署详情
    """
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found",
        )

    return DeploymentResponse(
        id=deployment.id,
        project_id=deployment.project_id,
        status=deployment.status,
        runtime_name=deployment.runtime_name,
        access_url=deployment.access_url,
        ingress_domain=deployment.ingress_domain,
        sealos_app_id=deployment.sealos_app_id,
        error_message=deployment.error_message,
        retry_count=deployment.retry_count,
        created_at=deployment.created_at.isoformat(),
        started_at=deployment.started_at.isoformat() if deployment.started_at else None,
        finished_at=deployment.finished_at.isoformat() if deployment.finished_at else None,
    )


@router.get("/{deployment_id}/status")
async def get_deployment_status(
    deployment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    查询部署状态(包含实时状态)
    """
    orchestrator = DeploymentOrchestrator(db)
    try:
        status_info = await orchestrator.poll_deployment_status(deployment_id)
        return status_info
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get deployment status: {str(e)}",
        )


@router.get("/{deployment_id}/logs")
async def get_deployment_logs(
    deployment_id: int,
    tail_lines: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取部署日志
    """
    orchestrator = DeploymentOrchestrator(db)
    try:
        logs = await orchestrator.get_deployment_logs(deployment_id, tail_lines=tail_lines)
        return {"deployment_id": deployment_id, "logs": logs}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get deployment logs: {str(e)}",
        )


@router.post("/{deployment_id}/retry")
async def retry_deployment(
    deployment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    重试部署
    """
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found",
        )

    # 重置部署状态
    deployment.status = "pending"
    deployment.error_message = None
    deployment.error_type = None
    deployment.retry_count += 1
    deployment.started_at = None
    deployment.finished_at = None
    db.commit()

    return {
        "deployment_id": deployment_id,
        "status": "pending",
        "message": "Deployment retry initiated",
    }


@router.delete("/{deployment_id}")
async def delete_deployment(
    deployment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    删除部署
    """
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found",
        )

    # 如果有Sealos应用,先删除
    if deployment.sealos_app_id:
        try:
            orchestrator = DeploymentOrchestrator(db)
            await orchestrator.sealos_client.delete_app(deployment.sealos_app_id)
        except Exception:
            pass

    # 删除数据库记录
    db.delete(deployment)
    db.commit()

    return {"message": "Deployment deleted successfully"}


@router.get("/project/{project_id}/list")
async def list_project_deployments(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取项目的所有部署
    """
    deployments = (
        db.query(Deployment)
        .filter(Deployment.project_id == project_id)
        .order_by(Deployment.created_at.desc())
        .all()
    )

    return {
        "project_id": project_id,
        "deployments": [
            {
                "id": d.id,
                "status": d.status,
                "runtime_name": d.runtime_name,
                "access_url": d.access_url,
                "created_at": d.created_at.isoformat(),
                "finished_at": d.finished_at.isoformat() if d.finished_at else None,
            }
            for d in deployments
        ],
    }
