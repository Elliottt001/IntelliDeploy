"""
镜像构建服务
支持多种构建方式: Docker API, Sealos构建服务, Buildah等
"""
import asyncio
import base64
import json
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

        batch_api = client.BatchV1Api()
        core_api = client.CoreV1Api()

        config_map = client.V1ConfigMap(
            metadata=client.V1ObjectMeta(name=f"{job_name}-context"),
            data=files,
        )
        core_api.create_namespaced_config_map(namespace=namespace, body=config_map)

        args = [
            f"--dockerfile={context_mount}/Dockerfile",
            f"--context=dir://{context_mount}",
            f"--destination={full_image_name}",
            "--snapshotMode=redo",
        ]
        for key, value in build_args.items():
            args.append(f"--build-arg={key}={value}")

        volumes = [
            client.V1Volume(
                name="build-context",
                config_map=client.V1ConfigMapVolumeSource(name=f"{job_name}-context"),
            )
        ]
        mounts = [client.V1VolumeMount(name="build-context", mount_path=context_mount)]

        if settings.KANIKO_DOCKER_CONFIG_SECRET:
            volumes.append(
                client.V1Volume(
                    name="docker-config",
                    secret=client.V1SecretVolumeSource(secret_name=settings.KANIKO_DOCKER_CONFIG_SECRET),
                )
            )
            mounts.append(client.V1VolumeMount(name="docker-config", mount_path="/kaniko/.docker"))

        job = client.V1Job(
            metadata=client.V1ObjectMeta(name=job_name),
            spec=client.V1JobSpec(
                backoff_limit=0,
                ttl_seconds_after_finished=300,
                template=client.V1PodTemplateSpec(
                    metadata=client.V1ObjectMeta(labels={"job-name": job_name}),
                    spec=client.V1PodSpec(
                        restart_policy="Never",
                        containers=[
                            client.V1Container(
                                name="kaniko",
                                image=settings.KANIKO_IMAGE,
                                args=args,
                                volume_mounts=mounts,
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
                    return {
                        "status": BuildStatus.FAILED.value,
                        "error": "Kaniko job failed",
                        "logs": logs,
                        "job_name": job_name,
                    }
                time.sleep(3)

            return {
                "status": BuildStatus.FAILED.value,
                "error": f"Kaniko job timed out after {settings.KANIKO_JOB_TIMEOUT_SECONDS}s",
                "logs": logs,
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
            try:
                chunks.append(
                    core_api.read_namespaced_pod_log(
                        name=pod_name,
                        namespace=namespace,
                        container="kaniko",
                        tail_lines=200,
                    )
                )
            except Exception as exc:
                chunks.append(f"<failed to read {pod_name} logs: {exc}>")
        return "\n".join(chunks)

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
