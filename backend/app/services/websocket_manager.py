"""
WebSocket管理器
用于实时推送部署状态和日志
"""
from collections import deque
from typing import Any, Deque, Dict, Set
from fastapi import WebSocket
import asyncio


# 每个 deployment 最多缓冲多少条事件，用于晚连接的客户端补发
_EVENT_BUFFER_MAX = 500


class ConnectionManager:
    """WebSocket连接管理器"""

    def __init__(self):
        # deployment_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # deployment_id -> 历史事件缓冲（用于 late-connect replay）
        self._event_buffer: Dict[str, Deque[Dict]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, deployment_id: str):
        """接受 WS 连接，并把缓存中的历史事件 replay 给它"""
        await websocket.accept()
        async with self._lock:
            if deployment_id not in self.active_connections:
                self.active_connections[deployment_id] = set()
            self.active_connections[deployment_id].add(websocket)
            buffered = list(self._event_buffer.get(deployment_id, ()))

        # Replay 缓冲事件——让 HTTP 请求结束前就发的 stage 不丢
        for message in buffered:
            try:
                await websocket.send_json(message)
            except Exception:
                break

    async def disconnect(self, websocket: WebSocket, deployment_id: str):
        async with self._lock:
            if deployment_id in self.active_connections:
                self.active_connections[deployment_id].discard(websocket)
                if not self.active_connections[deployment_id]:
                    del self.active_connections[deployment_id]

    async def send_message(self, deployment_id: str, message: Dict):
        """广播消息给该部署的所有连接，同时把它放进 replay 缓冲"""
        # 不论有没有连接，先把消息塞进缓冲（让后到的客户端能 replay）
        async with self._lock:
            buffer = self._event_buffer.setdefault(
                deployment_id, deque(maxlen=_EVENT_BUFFER_MAX)
            )
            buffer.append(message)
            connections = list(self.active_connections.get(deployment_id, ()))

        if not connections:
            return

        tasks = [
            self._send_to_connection(connection, deployment_id, message)
            for connection in connections
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_to_connection(self, connection: WebSocket, deployment_id: str, message: Dict):
        try:
            await connection.send_json(message)
        except Exception:
            await self.disconnect(connection, deployment_id)

    def clear_buffer(self, deployment_id: str) -> None:
        """部署彻底结束（或丢弃）后调用，回收 replay 缓冲，避免内存泄漏"""
        self._event_buffer.pop(deployment_id, None)

    async def broadcast_status(self, deployment_id: str, status: str, data: Dict = None):
        message = {
            "type": "status",
            "deployment_id": deployment_id,
            "status": status,
            "data": data or {},
            "timestamp": self._get_timestamp(),
        }
        await self.send_message(deployment_id, message)

    async def broadcast_log(self, deployment_id: str, log_line: str, level: str = "info"):
        message = {
            "type": "log",
            "deployment_id": deployment_id,
            "log": log_line,
            "level": level,
            "timestamp": self._get_timestamp(),
        }
        await self.send_message(deployment_id, message)

    async def broadcast_event(self, deployment_id: str, event_type: str, data: Dict):
        message = {
            "type": "event",
            "deployment_id": deployment_id,
            "event_type": event_type,
            "data": data,
            "timestamp": self._get_timestamp(),
        }
        await self.send_message(deployment_id, message)

    async def broadcast_error(self, deployment_id: str, error_message: str, error_type: str = None):
        message = {
            "type": "error",
            "deployment_id": deployment_id,
            "error_message": error_message,
            "error_type": error_type,
            "timestamp": self._get_timestamp(),
        }
        await self.send_message(deployment_id, message)

    async def broadcast_pipeline_stage(
        self,
        deployment_id: str,
        stage: str,
        status: str = "running",
        message: str = "",
        progress: float | None = None,
        data: Dict[str, Any] | None = None,
    ):
        """
        广播部署流水线阶段状态。

        这是前后端强契约事件,用于驱动 Thinking -> Building -> Healing 等状态机。
        """
        payload = {
            "type": "pipeline_stage",
            "deployment_id": deployment_id,
            "stage": stage,
            "status": status,
            "message": message,
            "data": data or {},
            "timestamp": self._get_timestamp(),
        }
        if progress is not None:
            payload["progress"] = max(0.0, min(1.0, float(progress)))
        await self.send_message(deployment_id, payload)

    def get_connection_count(self, deployment_id: str) -> int:
        return len(self.active_connections.get(deployment_id, set()))

    def _get_timestamp(self) -> str:
        from datetime import datetime
        return datetime.now().isoformat()


# 全局WebSocket管理器实例
_ws_manager: ConnectionManager = None


def get_ws_manager() -> ConnectionManager:
    """获取全局WebSocket管理器实例"""
    global _ws_manager
    if _ws_manager is None:
        _ws_manager = ConnectionManager()
    return _ws_manager
