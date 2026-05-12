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
        apps_api, core_api, _, namespace, api_exception = self._k8s_clients()
        try:
            deployment = await asyncio.to_thread(
                apps_api.read_namespaced_deployment,
                name=app_id,
                namespace=namespace,
            )
        except api_exception as exc:
            if exc.status == 404:
                return {
                    "app_id": app_id,
                    "status": DeploymentStatus.FAILED.value,
                    "phase": "NotFound",
                    "ready": False,
                    "replicas": 0,
                    "available_replicas": 0,
                    "namespace": namespace,
                    "error": "Deployment not found",
                }
            raise

        pods = await asyncio.to_thread(
            core_api.list_namespaced_pod,
            namespace=namespace,
            label_selector=f"app={app_id}",
        )
        pod_items = list(getattr(pods, "items", []) or [])
        pod_summaries = [self._pod_summary(pod) for pod in pod_items]
        ready_pods = sum(1 for pod in pod_summaries if pod["ready"])

        desired = int(getattr(deployment.spec, "replicas", None) or 0)
        available = int(getattr(deployment.status, "available_replicas", None) or 0)
        ready_replicas = int(getattr(deployment.status, "ready_replicas", None) or 0)
        unavailable = int(getattr(deployment.status, "unavailable_replicas", None) or 0)
        phase = self._deployment_phase(deployment, pod_summaries)
        status = self._status_from_phase(phase, desired, available, ready_replicas, unavailable)

        return {
            "app_id": app_id,
            "status": status,
            "phase": phase,
            "ready": status == DeploymentStatus.RUNNING.value,
            "namespace": namespace,
            "replicas": desired,
            "ready_replicas": ready_replicas,
            "available_replicas": available,
            "unavailable_replicas": unavailable,
            "ready_pods": ready_pods,
            "pods": pod_summaries,
            "conditions": self._deployment_conditions(deployment),
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
        _, core_api, _, namespace, api_exception = self._k8s_clients()
        pods = await asyncio.to_thread(
            core_api.list_namespaced_pod,
            namespace=namespace,
            label_selector=f"app={app_id}",
        )
        pod_items = list(getattr(pods, "items", []) or [])
        if not pod_items:
            return f"No pods found for app={app_id} in namespace={namespace}."

        chunks: list[str] = []
        for pod in pod_items:
            pod_name = pod.metadata.name
            containers = getattr(pod.spec, "containers", None) or []
            container_names = [container.name for container in containers] or [None]
            for container_name in container_names:
                try:
                    logs = await asyncio.to_thread(
                        core_api.read_namespaced_pod_log,
                        name=pod_name,
                        namespace=namespace,
                        container=container_name,
                        tail_lines=tail_lines,
                        timestamps=True,
                    )
                except api_exception as exc:
                    logs = f"<failed to read logs: {exc}>"

                title = f"== {pod_name}"
                if container_name:
                    title += f"/{container_name}"
                title += " =="
                chunks.append(f"{title}\n{logs}")

        return "\n\n".join(chunks)

    async def delete_app(self, app_id: str):
        """
        删除应用

        Args:
            app_id: 应用ID
        """
        apps_api, core_api, net_api, namespace, api_exception = self._k8s_clients()
        delete_results: list[dict] = []

        async def delete_resource(label: str, func, name: str):
            try:
                await asyncio.to_thread(func, name=name, namespace=namespace)
                delete_results.append({"resource": label, "name": name, "deleted": True})
            except api_exception as exc:
                if exc.status == 404:
                    delete_results.append({"resource": label, "name": name, "deleted": False, "missing": True})
                    return
                delete_results.append({"resource": label, "name": name, "deleted": False, "error": str(exc)})
                raise

        await delete_resource("deployment", apps_api.delete_namespaced_deployment, app_id)
        await delete_resource("service", core_api.delete_namespaced_service, f"{app_id}-svc")
        await delete_resource("ingress", net_api.delete_namespaced_ingress, f"{app_id}-ingress")

        return {
            "app_id": app_id,
            "namespace": namespace,
            "results": delete_results,
        }

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

    def _k8s_clients(self):
        if not self.kubeconfig:
            raise ValueError("Kubeconfig is required")

        try:
            import yaml
            from kubernetes import client, config
            from kubernetes.client import ApiException

            cfg = yaml.safe_load(self.kubeconfig)
            config.load_kube_config_from_dict(cfg)
            contexts, current = config.list_kube_config_contexts()
            namespace = (current or {}).get("context", {}).get("namespace") or "default"
            return (
                client.AppsV1Api(),
                client.CoreV1Api(),
                client.NetworkingV1Api(),
                namespace,
                ApiException,
            )
        except Exception as exc:
            raise K8sDeployError(f"Failed to initialize Kubernetes client: {exc}") from exc

    @staticmethod
    def _pod_summary(pod) -> Dict:
        statuses = list(getattr(pod.status, "container_statuses", None) or [])
        ready = bool(statuses) and all(bool(getattr(status, "ready", False)) for status in statuses)
        waiting_reasons = []
        for status in statuses:
            state = getattr(status, "state", None)
            waiting = getattr(state, "waiting", None)
            if waiting and getattr(waiting, "reason", None):
                waiting_reasons.append(waiting.reason)

        return {
            "name": pod.metadata.name,
            "phase": getattr(pod.status, "phase", None),
            "ready": ready,
            "restart_count": sum(int(getattr(status, "restart_count", 0) or 0) for status in statuses),
            "waiting_reasons": waiting_reasons,
            "node_name": getattr(getattr(pod, "spec", None), "node_name", None),
            "pod_ip": getattr(pod.status, "pod_ip", None),
        }

    @staticmethod
    def _deployment_conditions(deployment) -> List[Dict]:
        conditions = list(getattr(deployment.status, "conditions", None) or [])
        return [
            {
                "type": getattr(condition, "type", None),
                "status": getattr(condition, "status", None),
                "reason": getattr(condition, "reason", None),
                "message": getattr(condition, "message", None),
            }
            for condition in conditions
        ]

    @staticmethod
    def _deployment_phase(deployment, pods: List[Dict]) -> str:
        for reason in ("CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", "CreateContainerConfigError"):
            if any(reason in pod.get("waiting_reasons", []) for pod in pods):
                return reason
        if pods and all(pod.get("phase") == "Running" and pod.get("ready") for pod in pods):
            return "Running"

        conditions = SealosClient._deployment_conditions(deployment)
        for condition in conditions:
            if condition.get("type") == "Progressing" and condition.get("status") == "False":
                return condition.get("reason") or "ProgressingFalse"
        return pods[0]["phase"] if pods else "Pending"

    @staticmethod
    def _status_from_phase(
        phase: str,
        desired: int,
        available: int,
        ready_replicas: int,
        unavailable: int,
    ) -> str:
        if phase == "CrashLoopBackOff":
            return DeploymentStatus.CRASH_LOOP.value
        if phase in {"ImagePullBackOff", "ErrImagePull", "CreateContainerConfigError"}:
            return DeploymentStatus.FAILED.value
        if desired > 0 and available >= desired and ready_replicas >= desired:
            return DeploymentStatus.RUNNING.value
        return DeploymentStatus.PENDING.value


def get_sealos_client(kubeconfig: Optional[str] = None) -> SealosClient:
    """
    获取Sealos客户端实例

    Args:
        kubeconfig: K8s配置内容

    Returns:
        SealosClient: 客户端实例
    """
    return SealosClient(kubeconfig=kubeconfig)
