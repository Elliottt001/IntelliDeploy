"""一次性 Kaniko-on-Sealos → GHCR 链路探测。

跑通的含义：
  1) image_builder 能在 KANIKO_NAMESPACE 里 upsert dockerconfigjson Secret
  2) Kaniko Job 在 PSA restricted（warn 模式）下能起 Pod、跑构建
  3) Kaniko 能用挂载的凭据 push 到 ghcr.io/<owner>/intellideploy-probe:test

不依赖项目里的 deployment_orchestrator / DB，纯粹打 image_builder。
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# 让这个脚本可以 `python backend/scripts/kaniko_ghcr_probe.py` 直接跑
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.services.image_builder import BuildMethod, ImageBuilder  # noqa: E402

PROBE_DOCKERFILE = (
    # 普通用户 Dockerfile 就是这种写法 —— 走 docker.io。Sealos 集群本身拉不到 docker.io，
    # 但 image_builder 给 Kaniko 加了 --registry-mirror，应该被自动重定向到 daocloud。
    "FROM alpine:3.20\n"
    'RUN echo "intellideploy kaniko probe ok" > /probe.txt\n'
    'CMD ["cat", "/probe.txt"]\n'
)


def _resolve_image() -> str:
    owner = (settings.GHCR_NAMESPACE or settings.GHCR_USERNAME or "").strip().lower()
    if not owner:
        sys.exit("GHCR_NAMESPACE / GHCR_USERNAME 都没设，无法决定 push 目标")
    server = (settings.GHCR_SERVER or "ghcr.io").strip().strip("/")
    return f"{server}/{owner}/intellideploy-probe"


async def main() -> int:
    if not settings.KANIKO_KUBECONFIG:
        sys.exit("KANIKO_KUBECONFIG 未配置")
    if not (settings.GHCR_USERNAME and settings.GHCR_TOKEN):
        sys.exit("GHCR_USERNAME / GHCR_TOKEN 缺失，无法上传 dockerconfigjson")

    image = _resolve_image()
    print(f"[probe] target = {image}:test")
    print(f"[probe] namespace = {settings.KANIKO_NAMESPACE}")
    print(f"[probe] secret name (resolved) = "
          f"{(settings.KANIKO_DOCKER_CONFIG_SECRET or '').strip() or 'kaniko-registry-auth'}")
    print(f"[probe] insecure = {settings.KANIKO_INSECURE_REGISTRY}")

    builder = ImageBuilder(method=BuildMethod.KANIKO)
    result = await builder.build_image(
        dockerfile_content=PROBE_DOCKERFILE,
        context_files=None,
        image_name=image,
        image_tag="test",
    )

    print("\n========== Kaniko probe result ==========")
    status = result.get("status")
    print(f"status     = {status}")
    print(f"image      = {result.get('image')}")
    print(f"job_name   = {result.get('job_name')}")
    if result.get("error"):
        print(f"error      = {result['error']}")
    if result.get("pod_status"):
        print("---- pod_status ----")
        print(result["pod_status"])
    if result.get("events"):
        print("---- events ----")
        print(result["events"])
    if result.get("logs"):
        print("---- logs (tail) ----")
        print(result["logs"][-4000:])
    print("=========================================")
    return 0 if status == "success" else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
