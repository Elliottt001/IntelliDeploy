"""
部署编排服务
协调整个部署流程: 生成产物 → 构建镜像 → 部署 → 健康检查 → 自愈
"""
import asyncio
from typing import Optional, Dict
from datetime import datetime

from sqlalchemy.orm import Session

from app.config import settings
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.deployment_event import DeploymentEvent
from app.schemas.fallback import GetArtifactResultResponse
from app.services.sealos_client import SealosClient, DeploymentStatus, get_sealos_client
from app.services.healing_engine import HealingEngine
from app.services.generation_task_service import GenerationTaskService
from app.services.image_builder import get_image_builder, BuildMethod


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

        # 如果提供了kubeconfig,使用新的客户端
        if kubeconfig:
            self.sealos_client = get_sealos_client(kubeconfig)

        try:
            # 步骤1: 构建Docker镜像
            image_name = f"{deployment.runtime_name}"
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

            # 构建镜像
            builder = get_image_builder(method=BuildMethod.DOCKER_API)
            build_result = await builder.build_image(
                dockerfile_content=artifact.dockerfile_content,
                context_files=None,  # TODO: 如果有代码文件需要传入
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

            # 步骤3: 准备环境变量
            env_vars = {}
            for env in artifact.required_envs:
                if env.example_value:
                    env_vars[env.name] = env.example_value

            # 步骤4: 调用Sealos部署
            event = DeploymentEvent(
                deployment_id=deployment_id,
                phase="deploy",
                level="info",
                message=f"Deploying to Sealos with image: {final_image}",
            )
            self.db.add(event)
            self.db.commit()

            result = await self.sealos_client.create_app(
                name=deployment.runtime_name,
                image=final_image,
                port=artifact.runtime.exposed_port,
                env_vars=env_vars,
                enable_ingress=True,
                needs_database=False,
            )

            # 更新部署信息
            deployment.sealos_app_id = result.get("app_id")
            deployment.namespace = result.get("namespace")
            deployment.ingress_domain = result.get("ingress_domain")
            deployment.access_url = result.get("access_url")
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

            # 执行健康检查
            if artifact.runtime.healthcheck_path and deployment.access_url:
                health_url = f"{deployment.access_url}{artifact.runtime.healthcheck_path}"
                await self._perform_health_check(deployment_id, health_url)

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

            raise

    async def _perform_health_check(self, deployment_id: int, health_url: str) -> bool:
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

        # 重试健康检查
        for attempt in range(settings.HEALTHCHECK_RETRIES):
            try:
                is_healthy = await self.sealos_client.health_check(
                    health_url, timeout=settings.HEALTHCHECK_TIMEOUT
                )

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

                    return True

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

                    # 触发自愈
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
            task_id = await self.healing_engine.trigger_healing(
                deployment_id=deployment_id,
                error_logs=error_message,
                failed_stage=failed_stage,
            )

            if task_id:
                # 自愈已触发,等待新的生成任务完成
                # 这里可以选择轮询或使用回调
                pass
            else:
                # 自愈被熔断或失败
                pass

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
