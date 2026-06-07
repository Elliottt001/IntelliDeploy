"""
完整流水线后台执行器

把 Multi-Agent 共识 → 降级生成 → 构建 → 部署 → 健康检查 串成一个后台任务，
让 HTTP 请求立即返回、前端 WebSocket 能完整收到 11 个 stage 事件。

如果 Sealos / Kaniko 未配置，自动进入 demo 模式：模拟 Build/Deploy/HealthCheck
全套事件并把 deployment 标记成 success，让小白用户也能跑通完整链路。
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional

from app.config import settings
from app.database import SessionLocal
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.deployment_event import DeploymentEvent
from app.schemas.fallback import (
    Constraints,
    GenerationMode,
    PreferredStack,
    RepoProfile,
    StartFallbackTaskRequest,
    TriggerReason,
)
from app.services.deployment_orchestrator import DeploymentOrchestrator
from app.services.generation_task_service import GenerationTaskService
from app.services.multi_agent_deployment_service import (
    MultiAgentConsensusRejected,
    MultiAgentDeploymentService,
)
from app.services.websocket_manager import get_ws_manager

logger = logging.getLogger(__name__)


def _sealos_configured() -> bool:
    """判断是否已经配好 Sealos / Kaniko，能跑真实部署。"""
    return bool(settings.SEALOS_API_TOKEN) or bool(settings.KANIKO_KUBECONFIG)


async def run_full_pipeline_background(
    *,
    deployment_id: int,
    project_id: int,
    raw_query: str,
    request_id: str,
    repo_profile: Optional[RepoProfile],
    preferred_stack: Optional[PreferredStack],
    constraints: Optional[Constraints],
    evaluation_score: Optional[float],
    missing_components: list[str],
    generation_mode: GenerationMode,
    trigger_reason: TriggerReason,
    kubeconfig: Optional[str] = None,
) -> None:
    """
    后台执行完整流水线。该函数应该用 asyncio.create_task 启动。

    错误兜底：任何异常都会被捕获并广播 Finalize/failed，避免后台任务静默死掉。
    """
    deployment_id_str = str(deployment_id)
    ws = get_ws_manager()
    db = SessionLocal()

    try:
        gen_request = StartFallbackTaskRequest(
            project_id=str(project_id),
            deployment_id=deployment_id_str,
            request_id=request_id,
            trigger_reason=trigger_reason,
            original_prompt=raw_query,
            generation_mode=generation_mode,
            evaluation_score=round(evaluation_score) if evaluation_score is not None else None,
            missing_components=missing_components,
            preferred_stack=preferred_stack,
            repo_profile=repo_profile,
            constraints=constraints or Constraints(),
        )

        # 1) Multi-Agent 共识 + 降级生成（同步阻塞，但事件会经 WS buffer 缓存）
        try:
            gen_response = await MultiAgentDeploymentService(db).start_generation_with_consensus(gen_request)
        except MultiAgentConsensusRejected as exc:
            logger.warning("Multi-agent consensus rejected deployment %s: %s", deployment_id, exc)
            _mark_deployment_failed(db, deployment_id, str(exc), "MULTI_AGENT_REJECTED")
            return

        task_id = gen_response.task_id

        # 2) 取回 artifact（产物已经在 in-process 同步生成好了，这里只是读出来）
        generation_service = GenerationTaskService(db)
        try:
            artifact = await generation_service.get_artifact_result(task_id)
        except Exception as exc:
            logger.exception("Failed to fetch artifact for task %s: %s", task_id, exc)
            await ws.broadcast_pipeline_stage(
                deployment_id_str,
                "Packaging",
                status="failed",
                message=f"获取生成产物失败：{exc}",
                progress=0.62,
            )
            _mark_deployment_failed(db, deployment_id, str(exc), "ARTIFACT_FETCH_FAILED")
            await _broadcast_finalize_failed(deployment_id_str, str(exc))
            return

        if not artifact.deploy_ready:
            msg = artifact.summary or "生成产物未达到部署条件"
            logger.warning("Artifact not deploy-ready for deployment %s: %s", deployment_id, msg)
            _mark_deployment_failed(db, deployment_id, msg, "ARTIFACT_NOT_READY")
            await _broadcast_finalize_failed(deployment_id_str, msg)
            return

        # 3) 部署：有真实基础设施就跑 orchestrator，否则进 demo 模式模拟
        if _sealos_configured():
            # 部署用的 kubeconfig：优先用调用方传入的（用户在控制台配的），
            # 否则回退到 KANIKO_KUBECONFIG（通常和构建用的是同一个 Sealos 集群）。
            deploy_kubeconfig = kubeconfig or settings.KANIKO_KUBECONFIG or None
            try:
                await DeploymentOrchestrator(db, kubeconfig=deploy_kubeconfig).start_deployment(
                    deployment_id=deployment_id,
                    artifact=artifact,
                )
            except Exception as exc:
                logger.exception("Deployment failed for %s: %s", deployment_id, exc)
                # orchestrator 内部已经发了 Finalize/failed 和写库，这里就不重复发
        else:
            logger.info(
                "Sealos/Kaniko not configured; running deployment %s in demo mode.",
                deployment_id,
            )
            await _simulate_deployment_demo(db, deployment_id, artifact)

    except Exception as exc:
        # 总兜底
        logger.exception("Background pipeline crashed for deployment %s: %s", deployment_id, exc)
        try:
            _mark_deployment_failed(db, deployment_id, str(exc), "PIPELINE_CRASHED")
            await _broadcast_finalize_failed(deployment_id_str, str(exc))
        except Exception:
            pass
    finally:
        db.close()


async def _simulate_deployment_demo(db, deployment_id: int, artifact) -> None:
    """
    Demo 模式：在没有真实基础设施时，模拟一个完整的 build → deploy → health → finalize 链路。
    目的是让小白用户能看到整个 pipeline 跑完。
    """
    ws = get_ws_manager()
    deployment_id_str = str(deployment_id)

    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        await _broadcast_finalize_failed(deployment_id_str, f"Deployment {deployment_id} not found")
        return

    runtime_name = deployment.runtime_name or f"app-{deployment_id}"
    fake_image = f"{runtime_name}:demo-{deployment_id}"
    fake_subdomain = f"{runtime_name}-{uuid.uuid4().hex[:6]}"
    fake_access_url = f"https://{fake_subdomain}.{settings.SEALOS_DOMAIN_SUFFIX or 'demo.local'}"

    # Building
    deployment.status = "building"
    deployment.started_at = datetime.now()
    deployment.dockerfile_content = artifact.dockerfile_content
    db.commit()
    _record_event(db, deployment_id, "build", "info", "[Demo] 开始构建镜像（未配置真实基础设施，进入模拟模式）")
    await ws.broadcast_pipeline_stage(
        deployment_id_str, "Building", "running",
        "[Demo 模式] 正在模拟构建镜像", 0.64,
        data={"demo_mode": True, "reason": "Sealos/Kaniko 未配置"},
    )
    await asyncio.sleep(1.2)
    await ws.broadcast_pipeline_stage(
        deployment_id_str, "Building", "success",
        f"[Demo 模式] 镜像构建成功: {fake_image}", 0.72,
        data={"demo_mode": True, "image": fake_image},
    )

    # Deploying
    await ws.broadcast_pipeline_stage(
        deployment_id_str, "Deploying", "running",
        "[Demo 模式] 正在模拟创建 Sealos 应用", 0.8,
        data={"demo_mode": True, "image": fake_image},
    )
    await asyncio.sleep(1.0)
    deployment.access_url = fake_access_url
    deployment.ingress_domain = f"{fake_subdomain}.{settings.SEALOS_DOMAIN_SUFFIX or 'demo.local'}"
    deployment.sealos_app_id = f"demo-app-{deployment_id}"
    db.commit()
    await ws.broadcast_pipeline_stage(
        deployment_id_str, "Deploying", "success",
        f"[Demo 模式] 应用已创建: {deployment.sealos_app_id}", 0.86,
        data={"demo_mode": True, "app_id": deployment.sealos_app_id, "access_url": fake_access_url},
    )

    # HealthCheck
    await ws.broadcast_pipeline_stage(
        deployment_id_str, "HealthCheck", "running",
        f"[Demo 模式] 正在模拟健康检查: {fake_access_url}", 0.92,
        data={"demo_mode": True},
    )
    await asyncio.sleep(0.8)
    await ws.broadcast_pipeline_stage(
        deployment_id_str, "HealthCheck", "success",
        "[Demo 模式] 健康检查通过", 0.96,
        data={"demo_mode": True},
    )

    # Finalize
    deployment.status = "success"
    deployment.finished_at = datetime.now()
    db.commit()
    _record_event(db, deployment_id, "deploy", "info", f"[Demo] 部署完成（模拟）: {fake_access_url}")
    await ws.broadcast_pipeline_stage(
        deployment_id_str, "Finalize", "success",
        f"[Demo 模式] 应用已部署完成 👉 {fake_access_url}", 1.0,
        data={
            "demo_mode": True,
            "access_url": fake_access_url,
            "note": "这是 demo 模拟链路。配置 SEALOS_API_TOKEN 或 KANIKO_KUBECONFIG 后将进行真实部署。",
        },
    )


async def _broadcast_finalize_failed(deployment_id_str: str, error: str) -> None:
    await get_ws_manager().broadcast_pipeline_stage(
        deployment_id_str,
        "Finalize",
        status="failed",
        message=f"部署流程失败: {error}",
        progress=1.0,
        data={"error": error},
    )


def _mark_deployment_failed(db, deployment_id: int, error_message: str, error_type: str) -> None:
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        return
    deployment.status = "failed"
    deployment.error_message = error_message
    deployment.error_type = error_type
    deployment.finished_at = datetime.now()
    db.commit()
    _record_event(db, deployment_id, "deploy", "error", error_message, error_type)


def _record_event(db, deployment_id: int, phase: str, level: str, message: str, error_type: Optional[str] = None) -> None:
    event = DeploymentEvent(
        deployment_id=deployment_id,
        phase=phase,
        level=level,
        message=message,
        error_type=error_type,
    )
    db.add(event)
    db.commit()
