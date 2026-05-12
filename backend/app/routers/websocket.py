"""
WebSocket路由
提供实时部署状态和日志推送
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.intellideploy.deployment import Deployment
from app.services.websocket_manager import get_ws_manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/deployments/{deployment_id}")
async def websocket_deployment(
    websocket: WebSocket,
    deployment_id: int,
    db: Session = Depends(get_db),
):
    """
    WebSocket连接用于实时推送部署状态和日志

    消息格式:
    {
        "type": "status" | "log" | "event" | "error" | "pipeline_stage",
        "deployment_id": int,
        "data": {...},
        "timestamp": "ISO8601"
    }
    """
    manager = get_ws_manager()
    deployment_id_str = str(deployment_id)

    # 验证部署是否存在
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        await websocket.close(code=1008, reason="Deployment not found")
        return

    # 连接WebSocket
    await manager.connect(websocket, deployment_id_str)

    try:
        # 发送初始状态
        await manager.broadcast_status(
            deployment_id_str,
            deployment.status,
            {
                "runtime_name": deployment.runtime_name,
                "access_url": deployment.access_url,
                "created_at": deployment.created_at.isoformat(),
            },
        )
        await manager.broadcast_pipeline_stage(
            deployment_id_str,
            *_pipeline_snapshot(deployment.status),
            data={
                "runtime_name": deployment.runtime_name,
                "access_url": deployment.access_url,
            },
        )

        # 保持连接并接收客户端消息(如果需要)
        while True:
            try:
                # 接收客户端消息(可选,用于心跳或控制)
                data = await websocket.receive_text()

                # 处理客户端消息
                if data == "ping":
                    await websocket.send_text("pong")

            except WebSocketDisconnect:
                break
            except Exception:
                break

    finally:
        # 断开连接
        await manager.disconnect(websocket, deployment_id_str)


def _pipeline_snapshot(status: str) -> tuple[str, str, str, float]:
    snapshots = {
        "pending": ("Thinking", "running", "正在理解需求并准备生成方案", 0.08),
        "building": ("Building", "running", "正在构建镜像", 0.55),
        "running": ("Deploying", "success", "应用已创建,正在等待健康检查", 0.82),
        "success": ("Finalize", "success", "应用已部署完成", 1.0),
        "failed": ("Finalize", "failed", "部署流程失败", 1.0),
        "crash_loop_backoff": ("Healing", "running", "运行异常,正在尝试自愈", 0.86),
    }
    return snapshots.get(status, ("Thinking", "running", "正在同步部署状态", 0.1))
