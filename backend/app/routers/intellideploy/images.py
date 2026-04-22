"""
镜像构建相关的API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict

from app.database import get_db
from app.models.user import User
from app.services.image_builder import (
    get_image_builder,
    BuildMethod,
    build_and_push_image,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/images", tags=["images"])


class BuildImageRequest(BaseModel):
    dockerfile: str
    image_name: str
    image_tag: str = "latest"
    context_files: Optional[Dict[str, str]] = None
    build_args: Optional[Dict[str, str]] = None
    registry: Optional[str] = None
    method: str = "docker_api"  # docker_api, sealos_build, kaniko


class BuildImageResponse(BaseModel):
    status: str
    image: Optional[str] = None
    image_id: Optional[str] = None
    logs: Optional[str] = None
    error: Optional[str] = None


@router.post("/build", response_model=BuildImageResponse)
async def build_image(
    request: BuildImageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    构建Docker镜像

    支持多种构建方法:
    - docker_api: 使用Docker API (需要Docker守护进程)
    - sealos_build: 使用Sealos构建服务
    - kaniko: 使用Kaniko在K8s中构建
    """
    try:
        # 验证构建方法
        try:
            build_method = BuildMethod(request.method)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid build method: {request.method}",
            )

        # 构建镜像
        result = await build_and_push_image(
            dockerfile_content=request.dockerfile,
            context_files=request.context_files,
            image_name=request.image_name,
            image_tag=request.image_tag,
            registry=request.registry,
            build_args=request.build_args,
            method=build_method,
        )

        return BuildImageResponse(**result)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build image: {str(e)}",
        )


@router.post("/push")
async def push_image(
    image_name: str,
    registry: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    推送镜像到仓库
    """
    try:
        builder = get_image_builder()
        result = await builder.push_image(image_name, registry)

        if result["status"] == "success":
            return result
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Push failed"),
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to push image: {str(e)}",
        )


@router.get("/methods")
async def list_build_methods():
    """
    列出支持的构建方法
    """
    return {
        "methods": [
            {
                "name": "docker_api",
                "description": "使用Docker API构建 (需要Docker守护进程)",
                "available": True,
            },
            {
                "name": "sealos_build",
                "description": "使用Sealos构建服务",
                "available": True,
            },
            {
                "name": "kaniko",
                "description": "使用Kaniko在K8s中构建",
                "available": False,  # 未实现
            },
        ]
    }
