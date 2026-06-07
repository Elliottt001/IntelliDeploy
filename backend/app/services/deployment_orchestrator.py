"""
部署编排服务
协调整个部署流程: 生成产物 → 构建镜像 → 部署 → 健康检查 → 自愈
"""
import asyncio
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Any
from urllib.parse import urlparse
import zipfile

from sqlalchemy.orm import Session

from app.config import settings
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.deployment_event import DeploymentEvent
from app.schemas.fallback import GetArtifactResultResponse
from app.services.sealos_client import SealosClient, DeploymentStatus, get_sealos_client
from app.services.healing_engine import HealingEngine
from app.services.generation_task_service import GenerationTaskService
from app.services.image_builder import get_image_builder, BuildMethod
from app.services.websocket_manager import get_ws_manager


def _preferred_build_method() -> BuildMethod:
    """根据 .env 配置选构建后端：有 Kaniko kubeconfig 走 Kaniko，否则才回退 Docker API。"""
    if settings.KANIKO_KUBECONFIG:
        return BuildMethod.KANIKO
    return BuildMethod.DOCKER_API


def _prefixed_image_name(runtime_name: str) -> str:
    """给镜像名加上 push 目标 registry 的前缀。

    优先级：
      1) 显式设置 KANIKO_DESTINATION_REGISTRY；
      2) 否则用 GHCR_SERVER / (GHCR_NAMESPACE or GHCR_USERNAME) 推算。
    若最终前缀本身已含路径段（出现 "/"），就不再注入 KANIKO_NAMESPACE
    —— 这是 GHCR / DockerHub / ACR 的形态（registry/owner/image）；
    只有当前缀是裸 host:port（如 sealos.hub:5000）时才追加 namespace 段。
    GHCR 要求镜像路径全小写，这里统一小写化。
    """
    registry = (settings.KANIKO_DESTINATION_REGISTRY or "").strip().strip("/")
    if not registry:
        ghcr_ns = (settings.GHCR_NAMESPACE or settings.GHCR_USERNAME or "").strip().lower()
        ghcr_server = (settings.GHCR_SERVER or "ghcr.io").strip().strip("/")
        if ghcr_ns:
            registry = f"{ghcr_server}/{ghcr_ns}"

    if not registry:
        return runtime_name.lower()

    has_path = "/" in registry
    namespace = (settings.KANIKO_NAMESPACE or "").strip()
    runtime = runtime_name.lower()
    if has_path or not namespace:
        return f"{registry}/{runtime}".lower()
    return f"{registry}/{namespace}/{runtime}".lower()


MAX_CONTEXT_BYTES = 5_000_000
IGNORED_CONTEXT_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}
IGNORED_CONTEXT_FILES = {".DS_Store"}
DATABASE_ENV_HINTS = {
    "postgresql": {"DATABASE_URL", "POSTGRES_URL", "POSTGRESQL_URL", "PGDATABASE", "PGHOST"},
    "mysql": {"MYSQL_URL", "MYSQL_DATABASE", "MYSQL_HOST"},
    "mongodb": {"MONGODB_URI", "MONGO_URL", "MONGO_URI"},
    "redis": {"REDIS_URL", "REDIS_HOST"},
}
DATABASE_CODE_HINTS = {
    "postgresql": ("postgres", "postgresql", "psycopg", "pgvector"),
    "mysql": ("mysql", "mariadb"),
    "mongodb": ("mongodb", "mongoose", "pymongo", "mongo"),
    "redis": ("redis", "ioredis"),
}


class DeploymentOrchestrator:
    """部署编排器"""

    def __init__(self, db: Session, kubeconfig: Optional[str] = None):
        self.db = db
        self.sealos_client = get_sealos_client(kubeconfig)
        self.healing_engine = HealingEngine(db)
        self.generation_service = GenerationTaskService(db)

    async def start_deployment(
        self,
        deployment_id: int,
        artifact: GetArtifactResultResponse,
        kubeconfig: Optional[str] = None,
        registry: Optional[str] = None,
    ) -> Dict:
        """
        启动部署

        Args:
            deployment_id: 部署ID
            artifact: 生成产物
            kubeconfig: K8s配置(可选)
            registry: 镜像仓库地址(可选)

        Returns:
            Dict: 部署结果
        """
        # 获取部署记录
        deployment = self.db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        # 更新部署状态
        deployment.status = DeploymentStatus.BUILDING.value
        deployment.started_at = datetime.now()
        deployment.dockerfile_content = artifact.dockerfile_content
        self.db.commit()

        # 记录事件
        event = DeploymentEvent(
            deployment_id=deployment_id,
            phase="build",
            level="info",
            message="Starting image build",
        )
        self.db.add(event)
        self.db.commit()
        await self._broadcast_stage(
            deployment_id,
            "Building",
            "running",
            "开始构建部署镜像",
            0.64,
        )

        # 如果提供了kubeconfig,使用新的客户端
        if kubeconfig:
            self.sealos_client = get_sealos_client(kubeconfig)

        try:
            # 步骤1: 构建Docker镜像
            image_name = _prefixed_image_name(deployment.runtime_name)
            image_tag = f"deploy-{deployment_id}"

            # 记录构建开始
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="build",
                level="info",
                message=f"Building image: {image_name}:{image_tag}",
            )
            self.db.add(event)
            self.db.commit()

            context_files = self._extract_context_files(artifact)
            self._record_event(
                deployment_id,
                "build",
                "info",
                f"Build context prepared with {len(context_files)} file(s)",
            )
            await self._broadcast_stage(
                deployment_id,
                "Building",
                "running",
                f"构建上下文已准备: {len(context_files)} 个文件",
                0.66,
                {"context_file_count": len(context_files)},
            )

            # 构建镜像
            builder = get_image_builder(method=_preferred_build_method())
            build_result = await builder.build_image(
                dockerfile_content=artifact.dockerfile_content,
                context_files=context_files,
                image_name=image_name,
                image_tag=image_tag,
            )

            if build_result["status"] != "success":
                # 构建失败
                deployment.status = DeploymentStatus.FAILED.value
                deployment.error_message = build_result.get("error", "Image build failed")
                deployment.error_type = "BUILD_FAILED"
                deployment.finished_at = datetime.now()
                self.db.commit()

                # 把 Kaniko 的全部诊断输出到后端日志，方便定位真实失败原因
                diagnostics_blob = "\n".join(
                    section
                    for section in (
                        f"error: {build_result.get('error')}",
                        f"pod_status:\n{build_result.get('pod_status', '')}".rstrip(),
                        f"events:\n{build_result.get('events', '')}".rstrip(),
                        f"logs:\n{build_result.get('logs', '')}".rstrip(),
                    )
                    if section
                )
                import logging as _logging
                _logging.getLogger(__name__).error(
                    "Kaniko build failed for deployment %s:\n%s",
                    deployment_id,
                    diagnostics_blob,
                )

                # 记录失败事件
                event = DeploymentEvent(
                    deployment_id=deployment_id,
                    phase="build",
                    level="error",
                    message=f"Image build failed: {build_result.get('error')}",
                    error_type="BUILD_FAILED",
                )
                self.db.add(event)
                self.db.commit()
                await self._broadcast_stage(
                    deployment_id,
                    "Building",
                    "failed",
                    build_result.get("error", "镜像构建失败"),
                    0.68,
                    {
                        "logs": build_result.get("logs"),
                        "events": build_result.get("events"),
                        "pod_status": build_result.get("pod_status"),
                    },
                )

                # 触发自愈
                await self._trigger_healing_if_needed(
                    deployment_id,
                    build_result.get("logs", build_result.get("error", "")),
                    "BUILD"
                )

                raise Exception(f"Image build failed: {build_result.get('error')}")

            # 记录构建成功
            built_image = build_result.get("image")
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="build",
                level="info",
                message=f"Image built successfully: {built_image}",
            )
            self.db.add(event)
            self.db.commit()
            await self._broadcast_stage(
                deployment_id,
                "Building",
                "success",
                f"镜像构建成功: {built_image}",
                0.72,
                {"image": built_image},
            )

            # 步骤2: 推送镜像(如果指定了registry)
            final_image = built_image
            if registry:
                event = DeploymentEvent(
                    deployment_id=deployment_id,
                    phase="build",
                    level="info",
                    message=f"Pushing image to registry: {registry}",
                )
                self.db.add(event)
                self.db.commit()

                push_result = await builder.push_image(built_image, registry)
                if push_result["status"] == "success":
                    final_image = push_result["image"]
                    event = DeploymentEvent(
                        deployment_id=deployment_id,
                        phase="build",
                        level="info",
                        message=f"Image pushed successfully: {final_image}",
                    )
                    self.db.add(event)
                    self.db.commit()
                else:
                    # 推送失败,但可以继续使用本地镜像
                    event = DeploymentEvent(
                        deployment_id=deployment_id,
                        phase="build",
                        level="warning",
                        message=f"Image push failed, using local image: {push_result.get('error')}",
                    )
                    self.db.add(event)
                    self.db.commit()

            # 步骤3: 准备环境变量与外部依赖
            dependency_plan = self._infer_dependency_plan(artifact, context_files)
            env_vars = self._env_vars_from_artifact(artifact, dependency_plan, deployment.runtime_name)
            deployment.env_vars = json.dumps(env_vars, ensure_ascii=False)
            self.db.commit()

            # 步骤4: 调用Sealos部署
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="deploy",
                level="info",
                message=f"Deploying to Sealos with image: {final_image}",
            )
            self.db.add(event)
            self.db.commit()
            await self._broadcast_stage(
                deployment_id,
                "Deploying",
                "running",
                "正在创建 Sealos 应用",
                0.78,
                {"image": final_image},
            )

            result = await self.sealos_client.create_app(
                name=deployment.runtime_name,
                image=final_image,
                port=artifact.runtime.exposed_port,
                env_vars=env_vars,
                enable_ingress=True,
                needs_database=dependency_plan["needs_database"],
                database_type=dependency_plan["database_type"],
                external_dependencies=dependency_plan["external_dependencies"],
            )

            # 更新部署信息
            deployment.sealos_app_id = result.get("app_id")
            deployment.namespace = result.get("namespace")
            deployment.ingress_domain = result.get("ingress_domain")
            deployment.access_url = result.get("access_url")
            deployment.database_name = result.get("database_name")
            deployment.status = DeploymentStatus.RUNNING.value
            self.db.commit()

            # 记录成功事件
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="deploy",
                level="info",
                message=f"Deployment created successfully: {result.get('app_id')}",
            )
            self.db.add(event)
            self.db.commit()
            await self._broadcast_stage(
                deployment_id,
                "Deploying",
                "success",
                f"Sealos 应用已创建: {result.get('app_id')}",
                0.86,
                {"app_id": result.get("app_id"), "access_url": deployment.access_url},
            )

            # 执行健康检查
            if deployment.access_url:
                health_url = f"{deployment.access_url}{self._healthcheck_path(artifact)}"
                await self._perform_health_check(
                    deployment_id,
                    health_url,
                    expected_keywords=self._expected_health_keywords(artifact, context_files),
                )

            return {
                "deployment_id": deployment_id,
                "status": deployment.status,
                "access_url": deployment.access_url,
                "app_id": deployment.sealos_app_id,
                "image": final_image,
            }

        except Exception as e:
            # 部署失败
            deployment.status = DeploymentStatus.FAILED.value
            deployment.error_message = str(e)
            deployment.finished_at = datetime.now()
            self.db.commit()

            # 记录失败事件
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="deploy",
                level="error",
                message=f"Deployment failed: {str(e)}",
                error_type="DEPLOY_ERROR",
            )
            self.db.add(event)
            self.db.commit()

            # 触发自愈
            await self._trigger_healing_if_needed(deployment_id, str(e), "BUILD")
            await self._broadcast_stage(
                deployment_id,
                "Finalize",
                "failed",
                f"部署失败: {str(e)}",
                1.0,
                {"error_type": deployment.error_type},
            )

            raise

    async def _perform_health_check(
        self,
        deployment_id: int,
        health_url: str,
        trigger_healing: bool = True,
        expected_keywords: Optional[list[str]] = None,
    ) -> bool:
        """
        执行健康检查

        Args:
            deployment_id: 部署ID
            health_url: 健康检查URL

        Returns:
            bool: 是否健康
        """
        deployment = self.db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment:
            return False

        # 记录健康检查开始
        event = DeploymentEvent(
            deployment_id=deployment_id,
            phase="health_check",
            level="info",
            message=f"Starting health check: {health_url}",
        )
        self.db.add(event)
        self.db.commit()
        await self._broadcast_stage(
            deployment_id,
            "HealthCheck",
            "running",
            f"正在健康检查: {health_url}",
            0.9,
        )

        # 重试健康检查
        for attempt in range(settings.HEALTHCHECK_RETRIES):
            try:
                result = await self.sealos_client.health_check(
                    health_url,
                    timeout=settings.HEALTHCHECK_TIMEOUT,
                    expected_keywords=expected_keywords,
                )
                is_healthy = bool(result.get("healthy"))

                if is_healthy:
                    # 健康检查成功
                    deployment.status = DeploymentStatus.SUCCESS.value
                    deployment.finished_at = datetime.now()
                    self.db.commit()

                    event = DeploymentEvent(
                        deployment_id=deployment_id,
                        phase="health_check",
                        level="info",
                        message="Health check passed",
                    )
                    self.db.add(event)
                    self.db.commit()
                    await self._broadcast_stage(
                        deployment_id,
                        "HealthCheck",
                        "success",
                        "健康检查通过",
                        0.96,
                        {"health_url": health_url, "result": result},
                    )
                    await self._broadcast_stage(
                        deployment_id,
                        "Finalize",
                        "success",
                        "应用已部署完成",
                        1.0,
                        {"access_url": deployment.access_url},
                    )

                    return True

                if attempt == settings.HEALTHCHECK_RETRIES - 1:
                    raise RuntimeError(result.get("failure_reason") or f"L7 health check failed: {result}")
            except Exception as e:
                if attempt == settings.HEALTHCHECK_RETRIES - 1:
                    # 最后一次重试失败
                    deployment.status = DeploymentStatus.FAILED.value
                    deployment.error_message = f"Health check failed: {str(e)}"
                    deployment.error_type = "HEALTHCHECK_FAILED"
                    deployment.finished_at = datetime.now()
                    self.db.commit()

                    event = DeploymentEvent(
                        deployment_id=deployment_id,
                        phase="health_check",
                        level="error",
                        message=f"Health check failed after {settings.HEALTHCHECK_RETRIES} attempts",
                        error_type="HEALTHCHECK_FAILED",
                    )
                    self.db.add(event)
                    self.db.commit()
                    await self._broadcast_stage(
                        deployment_id,
                        "HealthCheck",
                        "failed",
                        f"健康检查失败: {str(e)}",
                        0.94,
                        {"health_url": health_url, "expected_keywords": expected_keywords or []},
                    )

                    if trigger_healing:
                        await self._trigger_healing_if_needed(deployment_id, str(e), "HEALTHCHECK")

            # 等待后重试
            if attempt < settings.HEALTHCHECK_RETRIES - 1:
                await asyncio.sleep(settings.HEALTHCHECK_INTERVAL)

        return False

    async def _trigger_healing_if_needed(
        self, deployment_id: int, error_message: str, failed_stage: str
    ):
        """
        根据需要触发自愈

        Args:
            deployment_id: 部署ID
            error_message: 错误信息
            failed_stage: 失败阶段
        """
        try:
            await self._broadcast_stage(
                deployment_id,
                "Healing",
                "running",
                f"{failed_stage} 失败,正在启动自愈",
                0.72,
                {"failed_stage": failed_stage},
            )
            result = await self.run_parallel_healing_race(
                deployment_id=deployment_id,
                error_logs=error_message,
                failed_stage=failed_stage,
            )

            if result.get("success"):
                return

            self._record_event(
                deployment_id,
                "heal",
                "warning",
                result.get("message", "Parallel healing did not produce a successful candidate."),
                error_type="HEALING_RACE_FAILED",
            )

        except Exception as e:
            # 自愈触发失败,记录日志
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="heal",
                level="error",
                message=f"Failed to trigger healing: {str(e)}",
                error_type="HEALING_TRIGGER_ERROR",
            )
            self.db.add(event)
            self.db.commit()
            await self._broadcast_stage(
                deployment_id,
                "Healing",
                "failed",
                f"自愈触发失败: {str(e)}",
                0.82,
                {"error_type": "HEALING_TRIGGER_ERROR"},
            )

    async def run_parallel_healing_race(
        self,
        deployment_id: int,
        error_logs: str,
        failed_stage: str,
        registry: Optional[str] = None,
    ) -> Dict:
        task_ids = await self.healing_engine.parallel_healing(
            deployment_id=deployment_id,
            error_logs=error_logs,
            failed_stage=failed_stage,
        )
        if not task_ids:
            await self._broadcast_stage(
                deployment_id,
                "Healing",
                "failed",
                "没有可用的自愈候选",
                0.78,
            )
            return {
                "success": False,
                "deployment_id": deployment_id,
                "message": "No healing candidates were accepted.",
            }

        self._record_event(
            deployment_id,
            "heal",
            "info",
            f"Starting parallel healing race with {len(task_ids)} candidate(s)",
        )
        await self._broadcast_stage(
            deployment_id,
            "Healing",
            "running",
            f"正在并行试错 {len(task_ids)} 个修复候选",
            0.76,
            {"task_ids": task_ids},
        )

        tasks = [
            asyncio.create_task(
                self._attempt_healing_candidate(
                    deployment_id=deployment_id,
                    task_id=task_id,
                    index=index,
                    registry=registry,
                )
            )
            for index, task_id in enumerate(task_ids, start=1)
        ]

        failures: list[Dict] = []
        try:
            for completed in asyncio.as_completed(tasks, timeout=settings.HEALING_TIMEOUT):
                result = await completed
                if result.get("success"):
                    for task in tasks:
                        if not task.done():
                            task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
                    self._record_event(
                        deployment_id,
                        "heal",
                        "info",
                        f"Healing candidate {result.get('task_id')} won the race",
                    )
                    await self._broadcast_stage(
                        deployment_id,
                        "Healing",
                        "success",
                        f"自愈候选胜出: {result.get('task_id')}",
                        0.92,
                        result,
                    )
                    return result
                failures.append(result)
        except asyncio.TimeoutError:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            await self._broadcast_stage(
                deployment_id,
                "Healing",
                "failed",
                "并行自愈超时",
                0.86,
                {"task_ids": task_ids, "failures": failures},
            )
            return {
                "success": False,
                "deployment_id": deployment_id,
                "task_ids": task_ids,
                "failures": failures,
                "message": "Parallel healing race timed out.",
            }

        await self._broadcast_stage(
            deployment_id,
            "Healing",
            "failed",
            "所有自愈候选都失败",
            0.86,
            {"task_ids": task_ids, "failures": failures},
        )
        return {
            "success": False,
            "deployment_id": deployment_id,
            "task_ids": task_ids,
            "failures": failures,
            "message": "All healing candidates failed.",
        }

    async def _attempt_healing_candidate(
        self,
        deployment_id: int,
        task_id: str,
        index: int,
        registry: Optional[str] = None,
    ) -> Dict:
        try:
            artifact = await self._wait_for_healing_artifact(task_id)
            if not artifact.deploy_ready:
                raise RuntimeError("Healing artifact is not deploy-ready.")

            deployment = self.db.query(Deployment).filter(Deployment.id == deployment_id).first()
            if not deployment:
                raise ValueError(f"Deployment {deployment_id} not found")

            context_files = self._extract_context_files(artifact)
            image_name = _prefixed_image_name(f"{deployment.runtime_name}-heal-{index}")
            image_tag = f"deploy-{deployment_id}-{task_id[:8]}"
            builder = get_image_builder(method=_preferred_build_method())

            self._record_event(
                deployment_id,
                "heal",
                "info",
                f"Candidate {task_id} building image with {len(context_files)} context file(s)",
            )
            await self._broadcast_stage(
                deployment_id,
                "Healing",
                "running",
                f"候选 {task_id} 正在构建镜像",
                0.8,
                {"task_id": task_id, "context_file_count": len(context_files)},
            )
            build_result = await builder.build_image(
                dockerfile_content=artifact.dockerfile_content,
                context_files=context_files,
                image_name=image_name,
                image_tag=image_tag,
            )
            if build_result["status"] != "success":
                raise RuntimeError(build_result.get("logs") or build_result.get("error") or "Image build failed")

            final_image = build_result.get("image")
            if registry:
                push_result = await builder.push_image(final_image, registry)
                if push_result["status"] == "success":
                    final_image = push_result["image"]

            dependency_plan = self._infer_dependency_plan(artifact, context_files)
            env_vars = self._env_vars_from_artifact(artifact, dependency_plan, deployment.runtime_name)
            deploy_result = await self.sealos_client.create_app(
                name=deployment.runtime_name,
                image=final_image,
                port=artifact.runtime.exposed_port,
                env_vars=env_vars,
                enable_ingress=True,
                needs_database=dependency_plan["needs_database"],
                database_type=dependency_plan["database_type"],
                external_dependencies=dependency_plan["external_dependencies"],
            )

            deployment.sealos_app_id = deploy_result.get("app_id")
            deployment.namespace = deploy_result.get("namespace")
            deployment.ingress_domain = deploy_result.get("ingress_domain")
            deployment.access_url = deploy_result.get("access_url")
            deployment.database_name = deploy_result.get("database_name")
            deployment.env_vars = json.dumps(env_vars, ensure_ascii=False)
            deployment.dockerfile_content = artifact.dockerfile_content
            deployment.error_message = None
            deployment.error_type = None
            deployment.status = DeploymentStatus.RUNNING.value
            self.db.commit()
            await self._broadcast_stage(
                deployment_id,
                "Healing",
                "running",
                f"候选 {task_id} 已部署,正在验证",
                0.88,
                {"task_id": task_id, "access_url": deployment.access_url},
            )

            if deployment.access_url:
                healthy = await self._perform_health_check(
                    deployment_id,
                    f"{deployment.access_url}{self._healthcheck_path(artifact)}",
                    trigger_healing=False,
                    expected_keywords=self._expected_health_keywords(artifact, context_files),
                )
                if not healthy:
                    raise RuntimeError("Healing candidate failed health check.")
            else:
                deployment.status = DeploymentStatus.SUCCESS.value
                deployment.finished_at = datetime.now()
                self.db.commit()
                await self._broadcast_stage(
                    deployment_id,
                    "Finalize",
                    "success",
                    "自愈部署已完成",
                    1.0,
                    {"task_id": task_id, "access_url": deployment.access_url},
                )

            return {
                "success": True,
                "deployment_id": deployment_id,
                "task_id": task_id,
                "image": final_image,
                "access_url": deployment.access_url,
                "status": deployment.status,
            }
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self._record_event(
                deployment_id,
                "heal",
                "warning",
                f"Healing candidate {task_id} failed: {str(exc)}",
                error_type="HEALING_CANDIDATE_FAILED",
            )
            await self._broadcast_stage(
                deployment_id,
                "Healing",
                "failed",
                f"候选 {task_id} 失败: {str(exc)}",
                0.84,
                {"task_id": task_id, "error": str(exc)},
            )
            return {
                "success": False,
                "deployment_id": deployment_id,
                "task_id": task_id,
                "error": str(exc),
            }

    async def _wait_for_healing_artifact(self, task_id: str) -> GetArtifactResultResponse:
        deadline = asyncio.get_running_loop().time() + settings.HEALING_TIMEOUT
        while True:
            status = await self.generation_service.query_task_status(task_id)
            if status.artifact_ready or status.status == "SUCCEEDED":
                return await self.generation_service.get_artifact_result(task_id)
            if status.status == "FAILED":
                raise RuntimeError(status.error_message or f"Healing task {task_id} failed.")
            if asyncio.get_running_loop().time() >= deadline:
                raise TimeoutError(f"Healing task {task_id} timed out waiting for artifact.")
            await asyncio.sleep(settings.DEPLOYMENT_POLL_INTERVAL)

    def _extract_context_files(self, artifact: GetArtifactResultResponse) -> Dict[str, str]:
        context_files: Dict[str, str] = {}
        if artifact.context_files:
            context_files.update(self._sanitize_context_files(artifact.context_files))

        if artifact.artifact_path:
            context_files.update(self._read_artifact_path_context(artifact.artifact_path))

        return {
            path: content
            for path, content in context_files.items()
            if Path(path).name.lower() != "dockerfile"
        }

    def _read_artifact_path_context(self, artifact_path: str) -> Dict[str, str]:
        parsed = urlparse(artifact_path)
        if parsed.scheme and parsed.scheme != "file":
            return {}

        path = Path(parsed.path if parsed.scheme == "file" else artifact_path)
        if not path.exists():
            return {}
        if path.is_dir():
            return self._read_directory_context(path)
        if zipfile.is_zipfile(path):
            return self._read_zip_context(path)
        return {}

    def _read_directory_context(self, root: Path) -> Dict[str, str]:
        context_files: Dict[str, str] = {}
        total_bytes = 0
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(root)
            if any(part in IGNORED_CONTEXT_DIRS for part in relative.parts):
                continue
            if relative.name in IGNORED_CONTEXT_FILES:
                continue
            size = path.stat().st_size
            if total_bytes + size > MAX_CONTEXT_BYTES:
                break
            try:
                context_files[relative.as_posix()] = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            total_bytes += size
        return context_files

    def _read_zip_context(self, path: Path) -> Dict[str, str]:
        context_files: Dict[str, str] = {}
        total_bytes = 0
        with zipfile.ZipFile(path) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                relative = Path(info.filename)
                if any(part in IGNORED_CONTEXT_DIRS for part in relative.parts):
                    continue
                if relative.name in IGNORED_CONTEXT_FILES:
                    continue
                if total_bytes + info.file_size > MAX_CONTEXT_BYTES:
                    break
                try:
                    context_files[relative.as_posix()] = archive.read(info).decode("utf-8")
                except UnicodeDecodeError:
                    continue
                total_bytes += info.file_size
        return context_files

    @staticmethod
    def _sanitize_context_files(files: Dict[str, str]) -> Dict[str, str]:
        sanitized: Dict[str, str] = {}
        total_bytes = 0
        for file_path, content in files.items():
            relative = Path(file_path)
            if relative.is_absolute() or ".." in relative.parts:
                continue
            if any(part in IGNORED_CONTEXT_DIRS for part in relative.parts):
                continue
            if relative.name in IGNORED_CONTEXT_FILES:
                continue
            encoded_size = len(content.encode("utf-8"))
            if total_bytes + encoded_size > MAX_CONTEXT_BYTES:
                break
            sanitized[relative.as_posix()] = content
            total_bytes += encoded_size
        return sanitized

    def _infer_dependency_plan(
        self,
        artifact: GetArtifactResultResponse,
        context_files: Dict[str, str],
    ) -> Dict[str, Any]:
        env_names = {env.name.upper() for env in artifact.required_envs}
        haystack = self._dependency_haystack(artifact, context_files)
        detected: list[str] = []

        for dependency, env_hints in DATABASE_ENV_HINTS.items():
            if env_names & env_hints:
                detected.append(dependency)

        lowered = haystack.lower()
        for dependency, tokens in DATABASE_CODE_HINTS.items():
            if any(token in lowered for token in tokens):
                detected.append(dependency)

        detected = sorted(dict.fromkeys(detected))
        database_types = [item for item in detected if item != "redis"]
        database_type = database_types[0] if database_types else None
        external_dependencies = [item for item in detected if item == "redis"]
        return {
            "needs_database": bool(database_type),
            "database_type": database_type,
            "external_dependencies": external_dependencies,
            "detected_dependencies": detected,
        }

    @staticmethod
    def _dependency_haystack(artifact: GetArtifactResultResponse, context_files: Dict[str, str]) -> str:
        interesting_names = {
            "package.json",
            "requirements.txt",
            "pyproject.toml",
            "pom.xml",
            "go.mod",
            "docker-compose.yml",
            "compose.yml",
            ".env.example",
        }
        chunks = [
            artifact.dockerfile_content,
            artifact.summary or "",
            artifact.runtime.start_command,
            artifact.runtime.install_command or "",
        ]
        for path, content in context_files.items():
            if Path(path).name.lower() in interesting_names:
                chunks.append(content[:5000])
        return "\n".join(chunks)

    @staticmethod
    def _env_vars_from_artifact(
        artifact: GetArtifactResultResponse,
        dependency_plan: Optional[Dict[str, Any]] = None,
        runtime_name: str = "app",
    ) -> Dict[str, str]:
        env_vars = {}
        for env in artifact.required_envs:
            if env.example_value:
                env_vars[env.name] = env.example_value
        dependency_plan = dependency_plan or {}
        database_type = dependency_plan.get("database_type")
        db_name = f"{runtime_name}-db"
        if database_type == "postgresql":
            env_vars.setdefault("DATABASE_URL", f"postgresql://postgres:postgres@{db_name}:5432/{runtime_name}")
            env_vars.setdefault("POSTGRES_HOST", db_name)
        elif database_type == "mysql":
            env_vars.setdefault("DATABASE_URL", f"mysql://root:password@{db_name}:3306/{runtime_name}")
            env_vars.setdefault("MYSQL_HOST", db_name)
        elif database_type == "mongodb":
            env_vars.setdefault("MONGODB_URI", f"mongodb://{db_name}:27017/{runtime_name}")

        if "redis" in set(dependency_plan.get("external_dependencies") or []):
            env_vars.setdefault("REDIS_URL", f"redis://{runtime_name}-redis:6379/0")
        return env_vars

    @staticmethod
    def _healthcheck_path(artifact: GetArtifactResultResponse) -> str:
        path = artifact.runtime.healthcheck_path or "/"
        return path if path.startswith("/") else f"/{path}"

    @staticmethod
    def _expected_health_keywords(
        artifact: GetArtifactResultResponse,
        context_files: Dict[str, str],
    ) -> list[str]:
        keywords: list[str] = []
        path = (artifact.runtime.healthcheck_path or "").lower()
        if "health" in path:
            keywords.extend(["ok", "healthy", "health", "true", "up", "ready"])

        runtime_blob = " ".join(
            [
                artifact.runtime.start_command,
                artifact.runtime.base_image or "",
                artifact.runtime.package_manager or "",
                artifact.summary or "",
            ]
        ).lower()
        if any(token in runtime_blob for token in ("nginx", "vite", "next", "react", "vue")):
            keywords.extend(["<html", "<!doctype", "root", "__next", "app"])
        if any(token in runtime_blob for token in ("fastapi", "flask", "django", "express", "spring", "gin")):
            keywords.extend(["ok", "app", "healthy", "health", "true", "up", "ready"])

        for path_name, content in context_files.items():
            if Path(path_name).name.lower() in {"index.html", "app.py", "main.py", "server.js", "package.json"}:
                title_match = re.search(r"<title>([^<]+)</title>", content, re.IGNORECASE)
                if title_match:
                    keywords.append(title_match.group(1).strip())
        return sorted({keyword for keyword in keywords if keyword})

    def _record_event(
        self,
        deployment_id: int,
        phase: str,
        level: str,
        message: str,
        error_type: Optional[str] = None,
    ) -> None:
        event = DeploymentEvent(
            deployment_id=deployment_id,
            phase=phase,
            level=level,
            message=message,
            error_type=error_type,
        )
        self.db.add(event)
        self.db.commit()

    async def _broadcast_stage(
        self,
        deployment_id: int,
        stage: str,
        status: str,
        message: str,
        progress: float,
        data: Optional[Dict] = None,
    ) -> None:
        await get_ws_manager().broadcast_pipeline_stage(
            str(deployment_id),
            stage,
            status=status,
            message=message,
            progress=progress,
            data=data,
        )

    async def poll_deployment_status(self, deployment_id: int) -> Dict:
        """
        轮询部署状态

        Args:
            deployment_id: 部署ID

        Returns:
            Dict: 部署状态信息
        """
        deployment = self.db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        # 如果有sealos_app_id,查询实时状态
        if deployment.sealos_app_id:
            try:
                status = await self.sealos_client.get_app_status(deployment.sealos_app_id)
                return {
                    "deployment_id": deployment_id,
                    "status": deployment.status,
                    "sealos_status": status,
                    "access_url": deployment.access_url,
                    "error_message": deployment.error_message,
                }
            except Exception:
                pass

        return {
            "deployment_id": deployment_id,
            "status": deployment.status,
            "access_url": deployment.access_url,
            "error_message": deployment.error_message,
        }

    async def get_deployment_logs(self, deployment_id: int, tail_lines: int = 100) -> str:
        """
        获取部署日志

        Args:
            deployment_id: 部署ID
            tail_lines: 获取最后N行

        Returns:
            str: 日志内容
        """
        deployment = self.db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        # 从数据库获取日志
        db_logs = deployment.log or ""

        # 如果有sealos_app_id,获取实时日志
        if deployment.sealos_app_id:
            try:
                live_logs = await self.sealos_client.get_app_logs(
                    deployment.sealos_app_id, tail_lines=tail_lines
                )
                return f"{db_logs}\n\n=== Live Logs ===\n{live_logs}"
            except Exception:
                pass

        return db_logs
