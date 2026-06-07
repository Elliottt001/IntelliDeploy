"""
镜像构建服务
支持多种构建方式: Docker API, Sealos构建服务, Buildah等
"""
import asyncio
import base64
import io
import json
import tarfile
import tempfile
import time
import uuid
from typing import Optional, Dict, List
from pathlib import Path
from enum import Enum

import httpx

from app.config import settings


class BuildMethod(str, Enum):
    """构建方法"""
    DOCKER_API = "docker_api"  # 使用Docker API
    SEALOS_BUILD = "sealos_build"  # 使用Sealos构建服务
    KANIKO = "kaniko"  # 使用Kaniko (K8s内构建)
    BUILDAH = "buildah"  # 使用Buildah


class BuildStatus(str, Enum):
    """构建状态"""
    PENDING = "pending"
    BUILDING = "building"
    SUCCESS = "success"
    FAILED = "failed"


class ImageBuilder:
    """镜像构建器"""

    def __init__(self, method: BuildMethod = BuildMethod.DOCKER_API):
        """
        初始化镜像构建器

        Args:
            method: 构建方法
        """
        self.method = method

    async def build_image(
        self,
        dockerfile_content: str,
        context_files: Optional[Dict[str, str]] = None,
        image_name: str = None,
        image_tag: str = "latest",
        build_args: Optional[Dict[str, str]] = None,
    ) -> Dict:
        """
        构建Docker镜像

        Args:
            dockerfile_content: Dockerfile内容
            context_files: 上下文文件 {文件路径: 文件内容}
            image_name: 镜像名称
            image_tag: 镜像标签
            build_args: 构建参数

        Returns:
            Dict: 构建结果
            {
                "status": "success" | "failed",
                "image": "registry/image:tag",
                "image_id": "sha256:...",
                "logs": "构建日志",
                "error": "错误信息"
            }
        """
        if self.method == BuildMethod.DOCKER_API:
            return await self._build_with_docker_api(
                dockerfile_content, context_files, image_name, image_tag, build_args
            )
        elif self.method == BuildMethod.SEALOS_BUILD:
            return await self._build_with_sealos(
                dockerfile_content, context_files, image_name, image_tag, build_args
            )
        elif self.method == BuildMethod.KANIKO:
            return await self._build_with_kaniko(
                dockerfile_content, context_files, image_name, image_tag, build_args
            )
        else:
            raise ValueError(f"Unsupported build method: {self.method}")

    @staticmethod
    def _full_image_name(image_name: str | None, image_tag: str) -> str:
        return f"{image_name}:{image_tag}" if image_name else f"intellideploy-temp:{image_tag}"

    @staticmethod
    def _safe_context_files(
        dockerfile_content: str,
        context_files: Optional[Dict[str, str]],
    ) -> Dict[str, str]:
        files: Dict[str, str] = {}
        for file_path, content in (context_files or {}).items():
            normalized = Path(file_path)
            if normalized.is_absolute() or ".." in normalized.parts:
                continue
            path = normalized.as_posix()
            if Path(path).name.lower() == "dockerfile":
                continue
            files[path] = content
        files["Dockerfile"] = dockerfile_content
        return files

    async def _build_with_docker_api(
        self,
        dockerfile_content: str,
        context_files: Optional[Dict[str, str]],
        image_name: str,
        image_tag: str,
        build_args: Optional[Dict[str, str]],
    ) -> Dict:
        """
        使用Docker API构建镜像

        Args:
            dockerfile_content: Dockerfile内容
            context_files: 上下文文件
            image_name: 镜像名称
            image_tag: 镜像标签
            build_args: 构建参数

        Returns:
            Dict: 构建结果
        """
        try:
            import docker
            from docker.errors import BuildError, APIError

            # 连接Docker
            client = docker.from_env()

            # 创建临时目录
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)

                # 写入Dockerfile
                dockerfile_path = temp_path / "Dockerfile"
                dockerfile_path.write_text(dockerfile_content, encoding="utf-8")

                # 写入上下文文件
                if context_files:
                    for file_path, content in context_files.items():
                        file_full_path = temp_path / file_path
                        file_full_path.parent.mkdir(parents=True, exist_ok=True)
                        file_full_path.write_text(content, encoding="utf-8")

                # 构建镜像
                full_image_name = f"{image_name}:{image_tag}" if image_name else None

                image, build_logs = client.images.build(
                    path=str(temp_path),
                    tag=full_image_name,
                    buildargs=build_args or {},
                    rm=True,  # 删除中间容器
                    forcerm=True,  # 即使失败也删除中间容器
                )

                # 收集日志
                logs = []
                for log in build_logs:
                    if "stream" in log:
                        logs.append(log["stream"])
                    elif "error" in log:
                        logs.append(f"ERROR: {log['error']}")

                return {
                    "status": BuildStatus.SUCCESS.value,
                    "image": full_image_name or image.id,
                    "image_id": image.id,
                    "logs": "".join(logs),
                }

        except BuildError as e:
            return {
                "status": BuildStatus.FAILED.value,
                "error": str(e),
                "logs": e.build_log if hasattr(e, "build_log") else str(e),
            }
        except APIError as e:
            return {
                "status": BuildStatus.FAILED.value,
                "error": f"Docker API error: {str(e)}",
            }
        except ImportError:
            # Docker SDK未安装,降级到命令行
            return await self._build_with_docker_cli(
                dockerfile_content, context_files, image_name, image_tag, build_args
            )
        except Exception as e:
            return {
                "status": BuildStatus.FAILED.value,
                "error": f"Unexpected error: {str(e)}",
            }

    async def _build_with_docker_cli(
        self,
        dockerfile_content: str,
        context_files: Optional[Dict[str, str]],
        image_name: str,
        image_tag: str,
        build_args: Optional[Dict[str, str]],
    ) -> Dict:
        """
        使用Docker CLI构建镜像

        Args:
            dockerfile_content: Dockerfile内容
            context_files: 上下文文件
            image_name: 镜像名称
            image_tag: 镜像标签
            build_args: 构建参数

        Returns:
            Dict: 构建结果
        """
        try:
            # 创建临时目录
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)

                # 写入Dockerfile
                dockerfile_path = temp_path / "Dockerfile"
                dockerfile_path.write_text(dockerfile_content, encoding="utf-8")

                # 写入上下文文件
                if context_files:
                    for file_path, content in context_files.items():
                        file_full_path = temp_path / file_path
                        file_full_path.parent.mkdir(parents=True, exist_ok=True)
                        file_full_path.write_text(content, encoding="utf-8")

                # 构建命令
                full_image_name = f"{image_name}:{image_tag}" if image_name else "temp-image:latest"
                cmd = ["docker", "build", "-t", full_image_name]

                # 添加构建参数
                if build_args:
                    for key, value in build_args.items():
                        cmd.extend(["--build-arg", f"{key}={value}"])

                cmd.append(str(temp_path))

                # 执行构建
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                )

                stdout, _ = await process.communicate()
                logs = stdout.decode("utf-8", errors="ignore")

                if process.returncode == 0:
                    # 获取镜像ID
                    inspect_cmd = ["docker", "inspect", "--format={{.Id}}", full_image_name]
                    inspect_process = await asyncio.create_subprocess_exec(
                        *inspect_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    image_id_output, _ = await inspect_process.communicate()
                    image_id = image_id_output.decode("utf-8").strip()

                    return {
                        "status": BuildStatus.SUCCESS.value,
                        "image": full_image_name,
                        "image_id": image_id,
                        "logs": logs,
                    }
                else:
                    return {
                        "status": BuildStatus.FAILED.value,
                        "error": "Docker build failed",
                        "logs": logs,
                    }

        except Exception as e:
            return {
                "status": BuildStatus.FAILED.value,
                "error": f"Docker CLI error: {str(e)}",
            }

    async def _build_with_sealos(
        self,
        dockerfile_content: str,
        context_files: Optional[Dict[str, str]],
        image_name: str,
        image_tag: str,
        build_args: Optional[Dict[str, str]],
    ) -> Dict:
        """
        使用Sealos构建服务构建镜像

        Args:
            dockerfile_content: Dockerfile内容
            context_files: 上下文文件
            image_name: 镜像名称
            image_tag: 镜像标签
            build_args: 构建参数

        Returns:
            Dict: 构建结果
        """
        try:
            if not settings.SEALOS_API_TOKEN:
                return {
                    "status": BuildStatus.FAILED.value,
                    "error": "SEALOS_API_TOKEN is required for Sealos remote builds.",
                }

            full_image_name = self._full_image_name(image_name, image_tag)
            files = self._safe_context_files(dockerfile_content, context_files)
            encoded_files = {
                path: base64.b64encode(content.encode("utf-8")).decode("ascii")
                for path, content in files.items()
            }
            build_request = {
                "image": full_image_name,
                "image_name": image_name,
                "image_tag": image_tag,
                "dockerfile_path": "Dockerfile",
                "files": encoded_files,
                "context": context_files or {},
                "build_args": build_args or {},
            }
            async with httpx.AsyncClient(timeout=600) as client:
                response = await client.post(
                    f"{settings.SEALOS_API_URL}/build",
                    json=build_request,
                    headers={"Authorization": f"Bearer {settings.SEALOS_API_TOKEN}"},
                )

                if response.status_code >= 400:
                    return {
                        "status": BuildStatus.FAILED.value,
                        "error": f"Sealos build failed: {response.text}",
                    }

                result = response.json()
                build_id = result.get("build_id") or result.get("id") or result.get("task_id")
                if result.get("status") in {"success", "succeeded", BuildStatus.SUCCESS.value}:
                    return self._sealos_success_result(result, full_image_name)
                if result.get("status") in {"failed", BuildStatus.FAILED.value}:
                    return {
                        "status": BuildStatus.FAILED.value,
                        "error": result.get("error") or "Sealos build failed.",
                        "logs": result.get("logs", ""),
                    }
                if not build_id:
                    return self._sealos_success_result(result, full_image_name)

                return await self._poll_sealos_build(client, str(build_id), full_image_name)

        except Exception as e:
            return {
                "status": BuildStatus.FAILED.value,
                "error": f"Sealos build error: {str(e)}",
            }

    async def _poll_sealos_build(
        self,
        client: httpx.AsyncClient,
        build_id: str,
        full_image_name: str,
    ) -> Dict:
        deadline = time.monotonic() + settings.SEALOS_BUILD_TIMEOUT_SECONDS
        status_url = f"{settings.SEALOS_API_URL}/build/{build_id}"

        while time.monotonic() < deadline:
            response = await client.get(
                status_url,
                headers={"Authorization": f"Bearer {settings.SEALOS_API_TOKEN}"},
            )
            if response.status_code >= 400:
                return {
                    "status": BuildStatus.FAILED.value,
                    "error": f"Sealos build status failed: {response.text}",
                }

            result = response.json()
            status = str(result.get("status", "")).lower()
            if status in {"success", "succeeded", "completed"}:
                return self._sealos_success_result(result, full_image_name, build_id=build_id)
            if status in {"failed", "error", "cancelled"}:
                return {
                    "status": BuildStatus.FAILED.value,
                    "error": result.get("error") or f"Sealos build {status}",
                    "logs": result.get("logs", ""),
                    "build_id": build_id,
                }
            await asyncio.sleep(settings.SEALOS_BUILD_POLL_INTERVAL_SECONDS)

        return {
            "status": BuildStatus.FAILED.value,
            "error": f"Sealos build timed out after {settings.SEALOS_BUILD_TIMEOUT_SECONDS}s",
            "build_id": build_id,
        }

    @staticmethod
    def _sealos_success_result(result: Dict, fallback_image: str, build_id: str | None = None) -> Dict:
        return {
            "status": BuildStatus.SUCCESS.value,
            "image": result.get("image") or result.get("image_ref") or fallback_image,
            "image_id": result.get("image_id") or result.get("digest"),
            "logs": result.get("logs", ""),
            "build_id": build_id or result.get("build_id") or result.get("id") or result.get("task_id"),
        }

    async def _build_with_kaniko(
        self,
        dockerfile_content: str,
        context_files: Optional[Dict[str, str]],
        image_name: str,
        image_tag: str,
        build_args: Optional[Dict[str, str]],
    ) -> Dict:
        """
        使用Kaniko在K8s中构建镜像

        Args:
            dockerfile_content: Dockerfile内容
            context_files: 上下文文件
            image_name: 镜像名称
            image_tag: 镜像标签
            build_args: 构建参数

        Returns:
            Dict: 构建结果
        """
        try:
            if not settings.KANIKO_KUBECONFIG:
                return {
                    "status": BuildStatus.FAILED.value,
                    "error": "KANIKO_KUBECONFIG is required for Kaniko builds.",
                }

            full_image_name = self._full_image_name(image_name, image_tag)
            files = self._safe_context_files(dockerfile_content, context_files)
            manifest_size = sum(len(content.encode("utf-8")) for content in files.values())
            if manifest_size > settings.KANIKO_CONTEXT_MAX_BYTES:
                return {
                    "status": BuildStatus.FAILED.value,
                    "error": (
                        "Kaniko inline ConfigMap context is too large "
                        f"({manifest_size} bytes > {settings.KANIKO_CONTEXT_MAX_BYTES})."
                    ),
                }

            return await asyncio.to_thread(
                self._run_kaniko_job_sync,
                files,
                full_image_name,
                build_args or {},
            )
        except Exception as e:
            return {
                "status": BuildStatus.FAILED.value,
                "error": f"Kaniko build error: {str(e)}",
            }

    def _run_kaniko_job_sync(
        self,
        files: Dict[str, str],
        full_image_name: str,
        build_args: Dict[str, str],
    ) -> Dict:
        from kubernetes import client, config
        import yaml

        api_exception = client.ApiException

        cfg = yaml.safe_load(settings.KANIKO_KUBECONFIG)
        config.load_kube_config_from_dict(cfg)

        namespace = settings.KANIKO_NAMESPACE
        suffix = uuid.uuid4().hex[:10]
        job_name = f"intellideploy-kaniko-{suffix}"
        context_mount = "/workspace"
        tarball_mount = "/context-tarball"
        tarball_name = "context.tar.gz"

        batch_api = client.BatchV1Api()
        core_api = client.CoreV1Api()

        # 如果配了 GHCR_* 凭据，就在 namespace 里 upsert 一个 dockerconfigjson Secret，
        # Kaniko 挂到 /kaniko/.docker 后就能 push 到 GHCR（或任何外部 registry）。
        registry_secret_name = self._ensure_registry_secret(
            core_api=core_api,
            namespace=namespace,
            api_exception=api_exception,
        )

        # K8s ConfigMap data keys 必须匹配 [-._a-zA-Z0-9]+，不允许包含 "/"。
        # 上下文里有 "app/page.tsx" 这种嵌套路径就会被 k8s API 拒绝(422)。
        # 解法：所有文件 tar.gz 成一个 blob 放 binaryData，再用 initContainer 解压。
        tar_buf = io.BytesIO()
        with tarfile.open(fileobj=tar_buf, mode="w:gz") as tar:
            for file_path, content in files.items():
                data = content.encode("utf-8")
                info = tarfile.TarInfo(name=file_path)
                info.size = len(data)
                info.mode = 0o644
                tar.addfile(info, io.BytesIO(data))
        tarball_bytes = tar_buf.getvalue()

        config_map = client.V1ConfigMap(
            metadata=client.V1ObjectMeta(name=f"{job_name}-context"),
            binary_data={tarball_name: base64.b64encode(tarball_bytes).decode("ascii")},
        )
        core_api.create_namespaced_config_map(namespace=namespace, body=config_map)

        args = [
            f"--dockerfile={context_mount}/Dockerfile",
            f"--context=dir://{context_mount}",
            f"--destination={full_image_name}",
            "--snapshotMode=redo",
            # Sealos 用户命名空间 ephemeral-storage 紧，single-snapshot 只输出一次
            # 最终快照而不是每个 RUN 都打一份，能显著省盘。
            "--single-snapshot",
            "--verbosity=debug",
        ]
        if settings.KANIKO_REGISTRY_MIRROR:
            # 用户 Dockerfile 写 `FROM alpine:3.20` 默认走 docker.io，Sealos 集群拉不到。
            # 给 Kaniko 配 mirror 后，所有 docker.io 拉取会自动重定向到 mirror（如 daocloud），
            # 完全不需要改用户的 Dockerfile。
            args.append(f"--registry-mirror={settings.KANIKO_REGISTRY_MIRROR}")
        if settings.KANIKO_INSECURE_REGISTRY:
            # Sealos 内置 registry (sealos.hub:5000) 用自签证书，必须 --insecure 才能 push
            args.append("--insecure")
            args.append("--skip-tls-verify")
        for key, value in build_args.items():
            args.append(f"--build-arg={key}={value}")

        volumes = [
            client.V1Volume(
                name="context-tarball",
                config_map=client.V1ConfigMapVolumeSource(name=f"{job_name}-context"),
            ),
            client.V1Volume(
                name="build-context",
                empty_dir=client.V1EmptyDirVolumeSource(),
            ),
        ]
        kaniko_mounts = [
            client.V1VolumeMount(name="build-context", mount_path=context_mount),
        ]
        init_mounts = [
            client.V1VolumeMount(name="context-tarball", mount_path=tarball_mount, read_only=True),
            client.V1VolumeMount(name="build-context", mount_path=context_mount),
        ]

        if registry_secret_name:
            # kubernetes.io/dockerconfigjson 类型 Secret 的 key 固定叫 .dockerconfigjson，
            # 但 Kaniko 读的是 /kaniko/.docker/config.json —— 必须用 items 把文件名投影改对，
            # 否则挂载后 Kaniko 找不到凭据会匿名请求 registry，被 GHCR 直接 DENIED。
            volumes.append(
                client.V1Volume(
                    name="docker-config",
                    secret=client.V1SecretVolumeSource(
                        secret_name=registry_secret_name,
                        items=[
                            client.V1KeyToPath(
                                key=".dockerconfigjson", path="config.json"
                            )
                        ],
                    ),
                )
            )
            kaniko_mounts.append(client.V1VolumeMount(name="docker-config", mount_path="/kaniko/.docker"))

        # Sealos 用户命名空间默认 PodSecurity=restricted（当前是 warn，未来可能升级到 enforce）。
        # 这三项 Kaniko 都支持，提前合规可避免将来集群升级把构建炸掉。
        # runAsNonRoot 没设：Kaniko 官方 executor 镜像默认以 root 跑，需要写 /workspace、
        # /kaniko/.docker 等路径；改非 root 要换成 rootless 变体，本次暂不动。
        init_sc = client.V1SecurityContext(
            allow_privilege_escalation=False,
            capabilities=client.V1Capabilities(drop=["ALL"]),
            seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
        )
        # Kaniko 容器不能丢 capabilities —— 它解压 rootfs 时 chown 各种文件
        # （/etc/shadow 等），如果丢了 CAP_CHOWN 会 "operation not permitted"。
        # 这里只关 privilege-escalation + 上 seccomp，cap 集让 image 自带的默认生效。
        kaniko_sc = client.V1SecurityContext(
            allow_privilege_escalation=False,
            seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
        )

        # initContainer 把 ConfigMap 里的 tar.gz 解压到共享 emptyDir，让 Kaniko 看到正常目录结构
        init_container = client.V1Container(
            name="extract-context",
            image="busybox:1.36",
            command=["sh", "-c"],
            args=[f"tar -xzf {tarball_mount}/{tarball_name} -C {context_mount}"],
            volume_mounts=init_mounts,
            security_context=init_sc,
            # initContainer 只解一个 <1MB 的 tar.gz，显式给个小限额，
            # 避免被 LimitRange 默认值 (100Mi) 套上后影响 Pod 总额。
            resources=client.V1ResourceRequirements(
                requests={
                    "cpu": "50m",
                    "memory": "64Mi",
                    "ephemeral-storage": "64Mi",
                },
                limits={
                    "cpu": "200m",
                    "memory": "128Mi",
                    "ephemeral-storage": "128Mi",
                },
            ),
        )

        job = client.V1Job(
            metadata=client.V1ObjectMeta(name=job_name),
            spec=client.V1JobSpec(
                backoff_limit=0,
                ttl_seconds_after_finished=300,
                template=client.V1PodTemplateSpec(
                    metadata=client.V1ObjectMeta(labels={"job-name": job_name}),
                    spec=client.V1PodSpec(
                        restart_policy="Never",
                        init_containers=[init_container],
                        containers=[
                            client.V1Container(
                                name="kaniko",
                                image=settings.KANIKO_IMAGE,
                                args=args,
                                # Kaniko 的 distroless 镜像没有 /etc/passwd，$HOME 为空，
                                # containers/image 库找不到 ~/.docker/config.json fallback。
                                # 必须显式指定 DOCKER_CONFIG，否则即使 Secret 投影到
                                # /kaniko/.docker/config.json，凭据也读不到，push 会被 registry 当匿名请求拒掉。
                                env=[
                                    client.V1EnvVar(
                                        name="DOCKER_CONFIG", value="/kaniko/.docker"
                                    ),
                                ],
                                volume_mounts=kaniko_mounts,
                                security_context=kaniko_sc,
                                # Sealos 默认 LimitRange ephemeral-storage default = 100Mi，
                                # Kaniko 解 base image rootfs 直接超限 → Evicted。
                                # 显式覆盖到 4Gi (默认) 足够大多数 build。
                                resources=client.V1ResourceRequirements(
                                    requests={
                                        "cpu": settings.KANIKO_CPU_REQUEST,
                                        "memory": settings.KANIKO_MEMORY_REQUEST,
                                        "ephemeral-storage": settings.KANIKO_EPHEMERAL_STORAGE_REQUEST,
                                    },
                                    limits={
                                        "cpu": settings.KANIKO_CPU_LIMIT,
                                        "memory": settings.KANIKO_MEMORY_LIMIT,
                                        "ephemeral-storage": settings.KANIKO_EPHEMERAL_STORAGE_LIMIT,
                                    },
                                ),
                            )
                        ],
                        volumes=volumes,
                    ),
                ),
            ),
        )
        batch_api.create_namespaced_job(namespace=namespace, body=job)

        logs = ""
        deadline = time.monotonic() + settings.KANIKO_JOB_TIMEOUT_SECONDS
        try:
            while time.monotonic() < deadline:
                current = batch_api.read_namespaced_job(name=job_name, namespace=namespace)
                succeeded = int(getattr(current.status, "succeeded", 0) or 0)
                failed = int(getattr(current.status, "failed", 0) or 0)
                logs = self._read_kaniko_logs(core_api, namespace, job_name) or logs
                if succeeded > 0:
                    return {
                        "status": BuildStatus.SUCCESS.value,
                        "image": full_image_name,
                        "image_id": None,
                        "logs": logs,
                        "job_name": job_name,
                    }
                if failed > 0:
                    # 把失败原因尽量挖出来：pod phase / 容器 reason / events / 镜像拉取错
                    diagnostics = self._collect_kaniko_failure_diagnostics(
                        core_api, namespace, job_name
                    )
                    return {
                        "status": BuildStatus.FAILED.value,
                        "error": diagnostics["summary"] or "Kaniko job failed",
                        "logs": diagnostics["logs"] or logs,
                        "events": diagnostics["events"],
                        "pod_status": diagnostics["pod_status"],
                        "job_name": job_name,
                    }
                time.sleep(3)

            diagnostics = self._collect_kaniko_failure_diagnostics(
                core_api, namespace, job_name
            )
            return {
                "status": BuildStatus.FAILED.value,
                "error": (
                    f"Kaniko job timed out after {settings.KANIKO_JOB_TIMEOUT_SECONDS}s. "
                    f"{diagnostics['summary']}"
                ).strip(),
                "logs": diagnostics["logs"] or logs,
                "events": diagnostics["events"],
                "pod_status": diagnostics["pod_status"],
                "job_name": job_name,
            }
        finally:
            self._cleanup_kaniko_resources(
                batch_api=batch_api,
                core_api=core_api,
                namespace=namespace,
                job_name=job_name,
                api_exception=api_exception,
            )

    @staticmethod
    def _read_kaniko_logs(core_api, namespace: str, job_name: str) -> str:
        pods = core_api.list_namespaced_pod(namespace=namespace, label_selector=f"job-name={job_name}")
        chunks: list[str] = []
        for pod in list(getattr(pods, "items", []) or []):
            pod_name = pod.metadata.name
            for container_name in ("extract-context", "kaniko"):
                try:
                    log = core_api.read_namespaced_pod_log(
                        name=pod_name,
                        namespace=namespace,
                        container=container_name,
                        tail_lines=200,
                    )
                    if log:
                        chunks.append(f"--- {pod_name}/{container_name} ---\n{log}")
                except Exception as exc:
                    chunks.append(
                        f"<failed to read {pod_name}/{container_name} logs: {exc}>"
                    )
        return "\n".join(chunks)

    @staticmethod
    def _collect_kaniko_failure_diagnostics(
        core_api, namespace: str, job_name: str
    ) -> Dict:
        """汇总 Pod phase / 容器状态 / events，定位 Kaniko Job 失败的真实原因。"""
        pods = core_api.list_namespaced_pod(
            namespace=namespace, label_selector=f"job-name={job_name}"
        )
        pod_items = list(getattr(pods, "items", []) or [])

        pod_status_lines: list[str] = []
        summary_reasons: list[str] = []
        log_chunks: list[str] = []

        for pod in pod_items:
            pod_name = pod.metadata.name
            phase = getattr(pod.status, "phase", "Unknown")
            pod_status_lines.append(f"{pod_name} phase={phase}")

            for cs in (pod.status.init_container_statuses or []) + (pod.status.container_statuses or []):
                state = cs.state
                terminated = getattr(state, "terminated", None)
                waiting = getattr(state, "waiting", None)
                if terminated and terminated.exit_code not in (0, None):
                    reason = terminated.reason or "Error"
                    msg = (terminated.message or "").strip()
                    line = (
                        f"  container={cs.name} exit={terminated.exit_code} "
                        f"reason={reason}"
                        + (f" message={msg}" if msg else "")
                    )
                    pod_status_lines.append(line)
                    summary_reasons.append(f"{cs.name}: {reason}" + (f" — {msg}" if msg else ""))
                elif waiting and waiting.reason and waiting.reason not in ("ContainerCreating", "PodInitializing"):
                    msg = (waiting.message or "").strip()
                    line = (
                        f"  container={cs.name} waiting reason={waiting.reason}"
                        + (f" message={msg}" if msg else "")
                    )
                    pod_status_lines.append(line)
                    summary_reasons.append(
                        f"{cs.name} waiting: {waiting.reason}" + (f" — {msg}" if msg else "")
                    )

            for container_name in ("extract-context", "kaniko"):
                try:
                    log = core_api.read_namespaced_pod_log(
                        name=pod_name,
                        namespace=namespace,
                        container=container_name,
                        tail_lines=200,
                    )
                    if log:
                        log_chunks.append(f"--- {pod_name}/{container_name} ---\n{log}")
                except Exception as exc:
                    log_chunks.append(
                        f"<no logs for {pod_name}/{container_name}: {exc}>"
                    )

        events_text = ""
        try:
            field_selectors = []
            for pod in pod_items:
                field_selectors.append(f"involvedObject.name={pod.metadata.name}")
            field_selectors.append(f"involvedObject.name={job_name}")
            event_lines: list[str] = []
            seen: set[str] = set()
            for selector in field_selectors:
                evts = core_api.list_namespaced_event(
                    namespace=namespace, field_selector=selector
                )
                for evt in getattr(evts, "items", []) or []:
                    key = f"{evt.involved_object.name}:{evt.reason}:{evt.message}"
                    if key in seen:
                        continue
                    seen.add(key)
                    event_lines.append(
                        f"[{evt.type}] {evt.involved_object.name} {evt.reason}: {evt.message}"
                    )
                    if evt.type == "Warning" and evt.reason in (
                        "Failed", "FailedScheduling", "FailedCreatePodSandBox", "ErrImagePull", "ImagePullBackOff",
                    ):
                        summary_reasons.append(f"event {evt.reason}: {evt.message}")
            events_text = "\n".join(event_lines)
        except Exception as exc:
            events_text = f"<failed to fetch events: {exc}>"

        summary = "; ".join(dict.fromkeys(summary_reasons))
        return {
            "summary": summary,
            "logs": "\n".join(log_chunks),
            "events": events_text,
            "pod_status": "\n".join(pod_status_lines),
        }

    @staticmethod
    def _ensure_registry_secret(core_api, namespace: str, api_exception) -> str | None:
        """根据 GHCR_* 配置在 namespace 里 upsert 一个 dockerconfigjson Secret，
        返回 Secret 名；如果凭据不全则返回 None（Kaniko 将不挂载 docker config，
        push 公共镜像可以，push 私有 registry 会失败）。"""
        # KANIKO_DOCKER_CONFIG_SECRET 显式给名字最好；空字符串时用兜底名，
        # 这样 .env 即使没补这一行，只要 GHCR_TOKEN 在，链路也能走通。
        secret_name = (settings.KANIKO_DOCKER_CONFIG_SECRET or "").strip() or "kaniko-registry-auth"
        username = (settings.GHCR_USERNAME or "").strip()
        token = (settings.GHCR_TOKEN or "").strip()
        server = (settings.GHCR_SERVER or "ghcr.io").strip()
        if not (username and token):
            return None

        auth_b64 = base64.b64encode(f"{username}:{token}".encode("utf-8")).decode("ascii")
        entry = {
            "username": username,
            "password": token,
            "auth": auth_b64,
        }
        # go-containerregistry / Kaniko 在不同版本里对 auths 字典的 key 形态有差异。
        # 同时塞裸 host、https URL 和 v1/v2 端点形态，覆盖 keychain 的所有匹配分支。
        dockerconfig = {
            "auths": {
                server: entry,
                f"https://{server}": entry,
                f"https://{server}/": entry,
                f"https://{server}/v1/": entry,
                f"https://{server}/v2/": entry,
            }
        }
        config_b64 = base64.b64encode(
            json.dumps(dockerconfig).encode("utf-8")
        ).decode("ascii")

        from kubernetes import client as _client  # 局部导入避免顶层依赖

        body = _client.V1Secret(
            metadata=_client.V1ObjectMeta(name=secret_name),
            type="kubernetes.io/dockerconfigjson",
            data={".dockerconfigjson": config_b64},
        )
        try:
            core_api.create_namespaced_secret(namespace=namespace, body=body)
        except api_exception as exc:
            if getattr(exc, "status", None) == 409:
                core_api.replace_namespaced_secret(
                    name=secret_name, namespace=namespace, body=body
                )
            else:
                raise
        return secret_name

    @staticmethod
    def _cleanup_kaniko_resources(batch_api, core_api, namespace: str, job_name: str, api_exception) -> None:
        for delete_call, name in (
            (batch_api.delete_namespaced_job, job_name),
            (core_api.delete_namespaced_config_map, f"{job_name}-context"),
        ):
            try:
                delete_call(name=name, namespace=namespace)
            except api_exception as exc:
                if getattr(exc, "status", None) != 404:
                    raise

    async def push_image(self, image_name: str, registry: Optional[str] = None) -> Dict:
        """
        推送镜像到仓库

        Args:
            image_name: 镜像名称
            registry: 仓库地址

        Returns:
            Dict: 推送结果
        """
        try:
            import docker

            client = docker.from_env()

            # 如果指定了registry,先tag镜像
            if registry:
                full_name = f"{registry}/{image_name}"
                client.images.get(image_name).tag(full_name)
                push_name = full_name
            else:
                push_name = image_name

            # 推送镜像
            push_logs = []
            for log in client.images.push(push_name, stream=True, decode=True):
                if "status" in log:
                    push_logs.append(log["status"])
                if "error" in log:
                    return {
                        "status": "failed",
                        "error": log["error"],
                    }

            return {
                "status": "success",
                "image": push_name,
                "logs": "\n".join(push_logs),
            }

        except ImportError:
            # 使用CLI
            return await self._push_image_cli(image_name, registry)
        except Exception as e:
            return {
                "status": "failed",
                "error": f"Push failed: {str(e)}",
            }

    async def _push_image_cli(self, image_name: str, registry: Optional[str] = None) -> Dict:
        """使用CLI推送镜像"""
        try:
            if registry:
                full_name = f"{registry}/{image_name}"
                # Tag镜像
                tag_cmd = ["docker", "tag", image_name, full_name]
                await asyncio.create_subprocess_exec(*tag_cmd)
                push_name = full_name
            else:
                push_name = image_name

            # 推送镜像
            push_cmd = ["docker", "push", push_name]
            process = await asyncio.create_subprocess_exec(
                *push_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

            stdout, _ = await process.communicate()
            logs = stdout.decode("utf-8", errors="ignore")

            if process.returncode == 0:
                return {
                    "status": "success",
                    "image": push_name,
                    "logs": logs,
                }
            else:
                return {
                    "status": "failed",
                    "error": "Push failed",
                    "logs": logs,
                }

        except Exception as e:
            return {
                "status": "failed",
                "error": f"Push CLI error: {str(e)}",
            }


def get_image_builder(method: BuildMethod = BuildMethod.DOCKER_API) -> ImageBuilder:
    """
    获取镜像构建器实例

    Args:
        method: 构建方法

    Returns:
        ImageBuilder: 构建器实例
    """
    return ImageBuilder(method=method)


async def build_and_push_image(
    dockerfile_content: str,
    context_files: Optional[Dict[str, str]] = None,
    image_name: str = None,
    image_tag: str = "latest",
    registry: Optional[str] = None,
    build_args: Optional[Dict[str, str]] = None,
    method: BuildMethod = BuildMethod.DOCKER_API,
) -> Dict:
    """
    构建并推送镜像的便捷函数

    Args:
        dockerfile_content: Dockerfile内容
        context_files: 上下文文件
        image_name: 镜像名称
        image_tag: 镜像标签
        registry: 仓库地址
        build_args: 构建参数
        method: 构建方法

    Returns:
        Dict: 构建和推送结果
    """
    builder = get_image_builder(method)

    # 构建镜像
    build_result = await builder.build_image(
        dockerfile_content=dockerfile_content,
        context_files=context_files,
        image_name=image_name,
        image_tag=image_tag,
        build_args=build_args,
    )

    if build_result["status"] != BuildStatus.SUCCESS.value:
        return build_result

    # 推送镜像
    if registry:
        push_result = await builder.push_image(
            image_name=build_result["image"],
            registry=registry,
        )

        return {
            **build_result,
            "push_status": push_result.get("status"),
            "push_error": push_result.get("error"),
            "final_image": push_result.get("image", build_result["image"]),
        }

    return build_result
