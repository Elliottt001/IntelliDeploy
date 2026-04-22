"""
自愈引擎
实现熔断限制和并行试错机制
"""
import asyncio
from typing import List, Dict, Optional
from datetime import datetime

from sqlalchemy.orm import Session

from app.config import settings
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.deployment_event import DeploymentEvent
from app.schemas.fallback import (
    DeployFailureFeedbackRequest,
    FailedStage,
    RegenMode,
)
from app.services.redis_client import CircuitBreakerService
from app.services.generation_task_service import GenerationTaskService
from app.utils.log_sanitizer import sanitize_deployment_log


class HealingEngine:
    """自愈引擎"""

    def __init__(self, db: Session):
        self.db = db
        self.circuit_breaker = CircuitBreakerService()
        self.generation_service = GenerationTaskService(db)

    async def check_can_heal(self, project_id: str) -> bool:
        """
        检查是否可以进行自愈

        Args:
            project_id: 项目ID

        Returns:
            bool: True表示可以自愈,False表示已熔断
        """
        return await self.circuit_breaker.check_circuit_breaker(
            project_id, max_retries=settings.MAX_HEALING_RETRIES
        )

    async def trigger_healing(
        self,
        deployment_id: int,
        error_logs: str,
        failed_stage: str,
    ) -> Optional[str]:
        """
        触发自愈流程

        Args:
            deployment_id: 部署ID
            error_logs: 错误日志
            failed_stage: 失败阶段

        Returns:
            Optional[str]: 新的任务ID,如果熔断则返回None
        """
        # 获取部署信息
        deployment = self.db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        project_id = str(deployment.project_id)

        # 检查熔断器
        if not await self.check_can_heal(project_id):
            # 记录熔断事件
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="heal",
                level="error",
                message=f"Healing circuit breaker triggered, max retries ({settings.MAX_HEALING_RETRIES}) exceeded",
                error_type="CIRCUIT_BREAKER",
            )
            self.db.add(event)
            self.db.commit()

            # 更新部署状态
            deployment.status = "failed"
            deployment.error_message = "Max healing retries exceeded"
            deployment.error_type = "CIRCUIT_BREAKER"
            self.db.commit()

            return None

        # 递增重试次数
        retry_count = await self.circuit_breaker.incr_retry_count(project_id)

        # 清洗错误日志
        log_info = sanitize_deployment_log(error_logs, failed_stage)

        # 构造反馈请求
        feedback_request = DeployFailureFeedbackRequest(
            project_id=project_id,
            deployment_id=str(deployment_id),
            source_task_id="",  # 如果有原始任务ID可以填入
            failed_stage=FailedStage(failed_stage),
            error_type=log_info.get("error_type"),
            sanitized_error_log=log_info.get("sanitized_log", error_logs[:1000]),
            last_dockerfile_content=deployment.dockerfile_content or "",
            retry_count=retry_count,
            regen_mode=RegenMode.REGENERATE,
        )

        # 发送反馈并启动重生成
        try:
            response = await self.generation_service.send_deploy_failure_feedback(feedback_request)

            if response.accepted:
                # 记录自愈事件
                event = DeploymentEvent(
                    deployment_id=deployment_id,
                    phase="heal",
                    level="info",
                    message=f"Healing triggered (retry {retry_count}/{settings.MAX_HEALING_RETRIES}), new task: {response.task_id}",
                )
                self.db.add(event)
                self.db.commit()

                return response.task_id
            else:
                return None

        except Exception as e:
            # 记录失败事件
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="heal",
                level="error",
                message=f"Healing failed: {str(e)}",
                error_type="HEALING_ERROR",
            )
            self.db.add(event)
            self.db.commit()
            return None

    async def parallel_healing(
        self,
        deployment_id: int,
        error_logs: str,
        failed_stage: str,
    ) -> List[str]:
        """
        并行试错自愈

        同时生成多个修复方案并行部署,选择第一个成功的

        Args:
            deployment_id: 部署ID
            error_logs: 错误日志
            failed_stage: 失败阶段

        Returns:
            List[str]: 生成的任务ID列表
        """
        # 获取部署信息
        deployment = self.db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        project_id = str(deployment.project_id)

        # 检查熔断器
        if not await self.check_can_heal(project_id):
            return []

        # 递增重试次数
        retry_count = await self.circuit_breaker.incr_retry_count(project_id)

        # 清洗错误日志
        log_info = sanitize_deployment_log(error_logs, failed_stage)

        # 创建多个并行任务
        task_ids = []
        parallel_count = min(settings.PARALLEL_HEALING_COUNT, settings.MAX_HEALING_RETRIES - retry_count + 1)

        for i in range(parallel_count):
            feedback_request = DeployFailureFeedbackRequest(
                project_id=project_id,
                deployment_id=str(deployment_id),
                source_task_id="",
                failed_stage=FailedStage(failed_stage),
                error_type=log_info.get("error_type"),
                sanitized_error_log=log_info.get("sanitized_log", error_logs[:1000]),
                last_dockerfile_content=deployment.dockerfile_content or "",
                retry_count=retry_count + i,
                regen_mode=RegenMode.REGENERATE,
            )

            try:
                response = await self.generation_service.send_deploy_failure_feedback(feedback_request)
                if response.accepted:
                    task_ids.append(response.task_id)
            except Exception:
                continue

        # 记录并行自愈事件
        if task_ids:
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="heal",
                level="info",
                message=f"Parallel healing triggered with {len(task_ids)} candidates: {', '.join(task_ids)}",
            )
            self.db.add(event)
            self.db.commit()

        return task_ids

    async def reset_healing_state(self, project_id: str):
        """
        重置自愈状态

        Args:
            project_id: 项目ID
        """
        await self.circuit_breaker.reset_retry_count(project_id)

    async def get_healing_status(self, project_id: str) -> Dict:
        """
        获取自愈状态

        Args:
            project_id: 项目ID

        Returns:
            Dict: 自愈状态信息
        """
        retry_count = await self.circuit_breaker.get_retry_count(project_id)
        can_heal = await self.check_can_heal(project_id)

        return {
            "project_id": project_id,
            "retry_count": retry_count,
            "max_retries": settings.MAX_HEALING_RETRIES,
            "can_heal": can_heal,
            "circuit_breaker_active": not can_heal,
        }
