"""
Sealos客户端服务
封装Sealos/K8s API调用
"""
import asyncio
import json
from typing import Dict, Optional, List
from enum import Enum

from app.config import settings
from app.services.intellideploy_k8s import deploy_with_kubeconfig, K8sDeployError


class DeploymentStatus(str, Enum):
    """部署状态枚举"""
    PENDING = "pending"
    BUILDING = "building"
    RUNNING = "running"
    FAILED = "failed"
    SUCCESS = "success"
    CRASH_LOOP = "crash_loop_backoff"


class SealosClient:
    """Sealos客户端"""

    def __init__(self, kubeconfig: Optional[str] = None):
        """
        初始化Sealos客户端

        Args:
            kubeconfig: K8s配置内容
        """
        self.kubeconfig = kubeconfig

    async def create_app(
        self,
        name: str,
        image: str,
        port: int,
        env_vars: Optional[Dict[str, str]] = None,
        enable_ingress: bool = True,
        domain: Optional[str] = None,
        needs_database: bool = False,
    ) -> Dict:
        """
        创建应用

        Args:
            name: 应用名称
            image: 镜像地址
            port: 端口
            env_vars: 环境变量
            enable_ingress: 是否启用Ingress
            domain: 域名
            needs_database: 是否需要数据库

        Returns:
            Dict: 部署结果
        """
        if not self.kubeconfig:
            raise ValueError("Kubeconfig is required")

        # 生成域名
        if enable_ingress and not domain:
            domain = f"{name}.{settings.SEALOS_DOMAIN_SUFFIX}"

        try:
            result = deploy_with_kubeconfig(
                kubeconfig_content=self.kubeconfig,
                name=name,
                image=image,
                port=port,
                enable_ingress=enable_ingress,
                domain=domain,
                env_vars=env_vars,
                needs_database=needs_database,
            )

            return {
                "app_id": name,  # 使用name作为app_id
                "status": result.get("status", "unknown"),
                "namespace": result.get("namespace"),
                "runtime_name": result.get("runtimeName"),
                "ingress_domain": result.get("ingressDomain"),
                "database_name": result.get("databaseName"),
                "access_url": f"https://{domain}" if enable_ingress and domain else None,
                "results": result.get("results", []),
                "log": result.get("log", ""),
            }

        except K8sDeployError as e:
            raise Exception(f"Sealos deployment failed: {str(e)}")
        except Exception as e:
            raise Exception(f"Unexpected error during deployment: {str(e)}")

    async def get_app_status(self, app_id: str) -> Dict:
        """
        获取应用状态

        Args:
            app_id: 应用ID

        Returns:
            Dict: 应用状态信息
        """
        # TODO: 实现真实的状态查询
        # 目前返回模拟数据
        return {
            "app_id": app_id,
            "status": DeploymentStatus.RUNNING.value,
            "phase": "Running",
            "ready": True,
            "replicas": 1,
            "available_replicas": 1,
        }

    async def get_app_logs(self, app_id: str, tail_lines: int = 100) -> str:
        """
        获取应用日志

        Args:
            app_id: 应用ID
            tail_lines: 获取最后N行日志

        Returns:
            str: 日志内容
        """
        # TODO: 实现真实的日志获取
        # 目前返回模拟数据
        return f"[Mock] Logs for {app_id} (last {tail_lines} lines)\nApplication is running..."

    async def delete_app(self, app_id: str):
        """
        删除应用

        Args:
            app_id: 应用ID
        """
        # TODO: 实现真实的删除逻辑
        pass

    async def health_check(self, url: str, timeout: int = 30) -> bool:
        """
        健康检查

        Args:
            url: 健康检查URL
            timeout: 超时时间(秒)

        Returns:
            bool: 是否健康
        """
        try:
            import httpx
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url)
                return response.status_code == 200
        except Exception:
            return False

    async def wait_for_ready(
        self,
        app_id: str,
        timeout: int = 300,
        poll_interval: int = 5,
    ) -> bool:
        """
        等待应用就绪

        Args:
            app_id: 应用ID
            timeout: 超时时间(秒)
            poll_interval: 轮询间隔(秒)

        Returns:
            bool: 是否就绪
        """
        import time
        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                status = await self.get_app_status(app_id)
                if status.get("ready"):
                    return True
            except Exception:
                pass

            await asyncio.sleep(poll_interval)

        return False


def get_sealos_client(kubeconfig: Optional[str] = None) -> SealosClient:
    """
    获取Sealos客户端实例

    Args:
        kubeconfig: K8s配置内容

    Returns:
        SealosClient: 客户端实例
    """
    return SealosClient(kubeconfig=kubeconfig)
