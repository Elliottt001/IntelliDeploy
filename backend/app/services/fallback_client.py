"""
与杨钞越的降级生成模块对接的客户端
"""
import httpx
from typing import Optional
from datetime import datetime

from app.config import settings
from app.schemas.fallback import (
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
    QueryTaskStatusResponse,
    GetArtifactResultResponse,
    DeployFailureFeedbackRequest,
    DeployFailureFeedbackResponse,
)


class FallbackGenerationClient:
    """降级生成模块客户端"""

    def __init__(self, base_url: str = "http://localhost:8001"):
        """
        初始化客户端

        Args:
            base_url: 杨钞越的服务地址
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = 30.0

    async def start_fallback_task(
        self, request: StartFallbackTaskRequest
    ) -> StartFallbackTaskResponse:
        """
        接口 A：启动降级生成任务

        Args:
            request: 启动任务请求

        Returns:
            StartFallbackTaskResponse: 任务启动响应

        Raises:
            httpx.HTTPError: 网络请求失败
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/fallback/start",
                json=request.model_dump(exclude_none=True),
            )
            response.raise_for_status()
            return StartFallbackTaskResponse(**response.json())

    async def query_task_status(self, task_id: str) -> QueryTaskStatusResponse:
        """
        接口 B：查询生成任务状态

        Args:
            task_id: Celery任务ID

        Returns:
            QueryTaskStatusResponse: 任务状态响应

        Raises:
            httpx.HTTPError: 网络请求失败
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/fallback/status/{task_id}"
            )
            response.raise_for_status()
            return QueryTaskStatusResponse(**response.json())

    async def get_artifact_result(self, task_id: str) -> GetArtifactResultResponse:
        """
        接口 C：获取生成产物结果

        Args:
            task_id: Celery任务ID

        Returns:
            GetArtifactResultResponse: 产物结果响应

        Raises:
            httpx.HTTPError: 网络请求失败
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/fallback/artifact/{task_id}"
            )
            response.raise_for_status()
            return GetArtifactResultResponse(**response.json())

    async def send_deploy_failure_feedback(
        self, request: DeployFailureFeedbackRequest
    ) -> DeployFailureFeedbackResponse:
        """
        接口 D：部署失败后回传修复/重生成请求

        Args:
            request: 部署失败反馈请求

        Returns:
            DeployFailureFeedbackResponse: 反馈响应

        Raises:
            httpx.HTTPError: 网络请求失败
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/fallback/feedback",
                json=request.model_dump(exclude_none=True),
            )
            response.raise_for_status()
            return DeployFailureFeedbackResponse(**response.json())


# 全局客户端实例
_fallback_client: Optional[FallbackGenerationClient] = None


def get_fallback_client() -> FallbackGenerationClient:
    """获取全局降级生成客户端实例"""
    global _fallback_client
    if _fallback_client is None:
        _fallback_client = FallbackGenerationClient(base_url=settings.FALLBACK_SERVICE_URL)
    return _fallback_client
