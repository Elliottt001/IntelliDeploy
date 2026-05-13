"""
WebSocket路由
提供实时部署状态和日志推送
"""
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.generation_task import GenerationTask
from app.services.websocket_manager import get_ws_manager
from app.utils.security import get_user_from_token

router = APIRouter(tags=["websocket"])


def _extract_bearer_token(websocket: WebSocket) -> str | None:
    token = websocket.query_params.get("token")
    if token:
        return token

    authorization = websocket.headers.get("authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:]
    return None


async def _authenticate_websocket(websocket: WebSocket, db: Session) -> bool:
    token = _extract_bearer_token(websocket)
    if not token:
        await websocket.close(code=1008, reason="Unauthorized")
        return False
    try:
        get_user_from_token(token, db)
        return True
    except Exception:
        await websocket.close(code=1008, reason="Unauthorized")
        return False


async def _handle_ping_message(websocket: WebSocket, data: str) -> None:
    if data == "ping":
        await websocket.send_text("pong")
        return

    if data.strip().startswith("{"):
        import json

        payload = json.loads(data)
        if payload.get("type") == "ping":
            await websocket.send_json({"type": "pong"})


@router.websocket("/ws/deployments/{deployment_id}")
async def websocket_deployment(
    websocket: WebSocket,
    deployment_id: int,
    db: Session = Depends(get_db),
):
    """
    WebSocket连接用于实时推送部署状态和日志
    """
    manager = get_ws_manager()
    deployment_id_str = str(deployment_id)

    if not await _authenticate_websocket(websocket, db):
        return

    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        await websocket.close(code=1008, reason="Deployment not found")
        return

    await manager.connect(websocket, deployment_id_str)

    try:
        await manager.broadcast_status(
            deployment_id_str,
            deployment.status,
            {
                "runtimeName": deployment.runtime_name,
                "accessUrl": deployment.access_url,
                "createdAt": deployment.created_at.isoformat(),
            },
        )

        while True:
            try:
                data = await websocket.receive_text()
                await _handle_ping_message(websocket, data)
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        await manager.disconnect(websocket, deployment_id_str)


async def _websocket_session_impl(
    websocket: WebSocket,
    session_id: str,
    db: Session,
):
    manager = get_ws_manager()

    if not await _authenticate_websocket(websocket, db):
        return

    task = db.query(GenerationTask).filter(GenerationTask.session_id == session_id).first()
    if not task:
        await websocket.close(code=1008, reason="Session not found")
        return

    await manager.connect_session(websocket, session_id)

    try:
        app_card = None
        if task.status.lower() in {"succeeded", "failed"}:
            deployment = db.query(Deployment).filter(Deployment.id == task.deployment_id).first()
            prompt = (task.original_prompt or "").strip()
            app_card = {
                "taskId": task.task_id,
                "title": (prompt[:48] + ("..." if len(prompt) > 48 else "")) or "Generated App",
                "summary": task.summary or task.progress_message,
                "status": "ready" if task.is_approved else "needs_review",
                "artifactVersion": task.artifact_version,
                "deployReady": task.deploy_ready,
                "accessUrl": deployment.access_url if deployment else None,
                "runtimeName": deployment.runtime_name if deployment else None,
                "ingressDomain": deployment.ingress_domain if deployment else None,
            }
        await websocket.send_json(
            {
                "type": "phase_update",
                "sessionId": session_id,
                "taskId": task.task_id,
                "data": {
                    "phase": task.current_stage,
                    "status": task.status.lower(),
                    "progressMessage": task.progress_message,
                    "deploymentId": str(task.deployment_id),
                    "iterationCount": task.iteration_count,
                    "isApproved": task.is_approved,
                    "appCard": app_card,
                },
                "timestamp": task.updated_at.isoformat(),
            }
        )

        while True:
            try:
                data = await websocket.receive_text()
                await _handle_ping_message(websocket, data)
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        await manager.disconnect_session(websocket, session_id)


@router.websocket("/ws/sessions/{session_id}")
async def websocket_session(
    websocket: WebSocket,
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    WebSocket连接用于实时推送多智能体session状态。
    """
    await _websocket_session_impl(websocket=websocket, session_id=session_id, db=db)


@router.websocket("/ws/chat/{session_id}")
async def websocket_chat(
    websocket: WebSocket,
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    与 API.md 对齐的会话流路由。
    """
    await _websocket_session_impl(websocket=websocket, session_id=session_id, db=db)
