"""
WebSocket路由
提供实时部署状态和日志推送
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.generation_task import GenerationTask
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
        "type": "status" | "log" | "event" | "error",
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


@router.websocket("/ws/sessions/{session_id}")
async def websocket_session(
    websocket: WebSocket,
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    WebSocket连接用于实时推送多智能体session状态。
    """
    manager = get_ws_manager()
    task = db.query(GenerationTask).filter(GenerationTask.session_id == session_id).first()
    if not task:
        await websocket.close(code=1008, reason="Session not found")
        return

    await manager.connect_session(websocket, session_id)

    try:
        await websocket.send_json(
            {
                "type": "session_status",
                "session_id": session_id,
                "task_id": task.task_id,
                "deployment_id": str(task.deployment_id),
                "status": task.status,
                "current_stage": task.current_stage,
                "iteration_count": task.iteration_count,
                "is_approved": task.is_approved,
                "timestamp": task.updated_at.isoformat(),
            }
        )

        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
            except Exception:
                break

    finally:
        await manager.disconnect_session(websocket, session_id)
