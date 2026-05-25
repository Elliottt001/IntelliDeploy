"""
与杨钞越的降级生成模块对接的客户端

支持两种模式：
1. HTTP 模式：base_url 是有效 URL（如 http://localhost:8001）
2. 进程内模式：base_url 为空 / "inprocess" / "in-process" / "memory"
   时直接调用 backend.app.services.inprocess_fallback_runner.InProcessFallbackRunner
"""
import httpx
from typing import Optional

from app.config import settings
from app.schemas.fallback import (
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
    QueryTaskStatusResponse,
    GetArtifactResultResponse,
    DeployFailureFeedbackRequest,
    DeployFailureFeedbackResponse,
)
from app.services.inprocess_fallback_runner import (
    InProcessFallbackRunner,
    get_inprocess_runner,
)


_INPROCESS_TOKENS = {"", "inprocess", "in-process", "memory", "local"}


class FallbackGenerationClient:
    """降级生成模块客户端"""

    def __init__(self, base_url: str = "http://localhost:8001"):
        """
        初始化客户端

        Args:
            base_url: 杨钞越的服务地址（或 "inprocess" 走进程内执行）
        """
        normalized = (base_url or "").strip().lower()
        self._inprocess = normalized in _INPROCESS_TOKENS
        self.base_url = "" if self._inprocess else base_url.rstrip("/")
        self.timeout = 30.0
        self._runner: Optional[InProcessFallbackRunner] = (
            get_inprocess_runner() if self._inprocess else None
        )

    async def start_fallback_task(
        self, request: StartFallbackTaskRequest
    ) -> StartFallbackTaskResponse:
        if self._runner is not None:
            return await self._runner.start_fallback_task(request)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/fallback/start",
                json=request.model_dump(exclude_none=True),
            )
            response.raise_for_status()
            return StartFallbackTaskResponse(**response.json())

    async def query_task_status(self, task_id: str) -> QueryTaskStatusResponse:
        if self._runner is not None:
            return await self._runner.query_task_status(task_id)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/fallback/status/{task_id}"
            )
            response.raise_for_status()
            return QueryTaskStatusResponse(**response.json())

    async def get_artifact_result(
        self, task_id: str
    ) -> GetArtifactResultResponse:
        if self._runner is not None:
            return await self._runner.get_artifact_result(task_id)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/fallback/artifact/{task_id}"
            )
            response.raise_for_status()
            return GetArtifactResultResponse(**response.json())

    async def send_deploy_failure_feedback(
        self, request: DeployFailureFeedbackRequest
    ) -> DeployFailureFeedbackResponse:
        if self._runner is not None:
            return await self._runner.send_deploy_failure_feedback(request)
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
        _fallback_client = FallbackGenerationClient(
            base_url=settings.FALLBACK_SERVICE_URL,
        )
    return _fallback_client
