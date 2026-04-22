"""
镜像构建服务
支持多种构建方式: Docker API, Sealos构建服务, Buildah等
"""
import asyncio
import base64
import json
import tempfile
import shutil
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
            # TODO: 实现Sealos构建服务API调用
            # 这需要Sealos提供构建API端点

            async with httpx.AsyncClient(timeout=600) as client:
                # 准备构建请求
                build_request = {
                    "dockerfile": dockerfile_content,
                    "context": context_files or {},
                    "image_name": image_name,
                    "image_tag": image_tag,
                    "build_args": build_args or {},
                }

                # 调用Sealos构建API
                response = await client.post(
                    f"{settings.SEALOS_API_URL}/build",
                    json=build_request,
                    headers={"Authorization": f"Bearer {settings.SEALOS_API_TOKEN}"},
                )

                if response.status_code == 200:
                    result = response.json()
                    return {
                        "status": BuildStatus.SUCCESS.value,
                        "image": result.get("image"),
                        "image_id": result.get("image_id"),
                        "logs": result.get("logs", ""),
                    }
                else:
                    return {
                        "status": BuildStatus.FAILED.value,
                        "error": f"Sealos build failed: {response.text}",
                    }

        except Exception as e:
            return {
                "status": BuildStatus.FAILED.value,
                "error": f"Sealos build error: {str(e)}",
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
        # TODO: 实现Kaniko构建
        # 需要创建K8s Job运行Kaniko
        return {
            "status": BuildStatus.FAILED.value,
            "error": "Kaniko build not implemented yet",
        }

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
