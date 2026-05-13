"""
WebSocket管理器
用于实时推送部署状态和日志
"""
from typing import Dict, Set
from fastapi import WebSocket
import asyncio


class ConnectionManager:
    """WebSocket连接管理器"""

    def __init__(self):
        # deployment_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # session_id -> Set[WebSocket]
        self.session_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, deployment_id: str):
        """
        连接WebSocket

        Args:
            websocket: WebSocket连接
            deployment_id: 部署ID
        """
        await websocket.accept()
        await self._connect_to_registry(websocket, deployment_id, self.active_connections)

    async def disconnect(self, websocket: WebSocket, deployment_id: str):
        """
        断开WebSocket连接

        Args:
            websocket: WebSocket连接
            deployment_id: 部署ID
        """
        await self._disconnect_from_registry(websocket, deployment_id, self.active_connections)

    async def connect_session(self, websocket: WebSocket, session_id: str):
        """连接session级WebSocket。"""
        await websocket.accept()
        await self._connect_to_registry(websocket, session_id, self.session_connections)

    async def disconnect_session(self, websocket: WebSocket, session_id: str):
        """断开session级WebSocket。"""
        await self._disconnect_from_registry(websocket, session_id, self.session_connections)

    async def _connect_to_registry(
        self,
        websocket: WebSocket,
        channel_id: str,
        registry: Dict[str, Set[WebSocket]],
    ):
        async with self._lock:
            if channel_id not in registry:
                registry[channel_id] = set()
            registry[channel_id].add(websocket)

    async def _disconnect_from_registry(
        self,
        websocket: WebSocket,
        channel_id: str,
        registry: Dict[str, Set[WebSocket]],
    ):
        async with self._lock:
            if channel_id in registry:
                registry[channel_id].discard(websocket)
                if not registry[channel_id]:
                    del registry[channel_id]

    async def send_message(self, deployment_id: str, message: Dict):
        """
        发送消息给指定部署的所有连接

        Args:
            deployment_id: 部署ID
            message: 消息内容
        """
        if deployment_id not in self.active_connections:
            return

        # 获取连接副本,避免在迭代时修改
        connections = list(self.active_connections.get(deployment_id, []))

        # 并发发送消息
        tasks = []
        for connection in connections:
            tasks.append(self._send_to_connection(connection, deployment_id, message))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_session_message(self, session_id: str, message: Dict):
        """发送消息给指定session的所有连接。"""
        if session_id not in self.session_connections:
            return

        connections = list(self.session_connections.get(session_id, []))
        tasks = []
        for connection in connections:
            tasks.append(self._send_to_session_connection(connection, session_id, message))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_to_connection(self, connection: WebSocket, deployment_id: str, message: Dict):
        """
        发送消息到单个连接

        Args:
            connection: WebSocket连接
            deployment_id: 部署ID
            message: 消息内容
        """
        try:
            await connection.send_json(message)
        except Exception:
            # 连接已断开,移除
            await self.disconnect(connection, deployment_id)

    async def _send_to_session_connection(self, connection: WebSocket, session_id: str, message: Dict):
        """发送消息到单个session连接。"""
        try:
            await connection.send_json(message)
        except Exception:
            await self.disconnect_session(connection, session_id)

    async def broadcast_status(self, deployment_id: str, status: str, data: Dict = None):
        """
        广播部署状态更新

        Args:
            deployment_id: 部署ID
            status: 状态
            data: 额外数据
        """
        payload = dict(data or {})
        payload.setdefault("status", status)
        message = {
            "type": "phase_update",
            "deploymentId": deployment_id,
            "data": payload,
            "timestamp": self._get_timestamp(),
        }
        await self.send_message(deployment_id, message)

    async def broadcast_log(self, deployment_id: str, log_line: str, level: str = "info"):
        """
        广播日志行

        Args:
            deployment_id: 部署ID
            log_line: 日志内容
            level: 日志级别
        """
        message = {
            "type": "log",
            "deploymentId": deployment_id,
            "log": log_line,
            "level": level,
            "timestamp": self._get_timestamp(),
        }
        await self.send_message(deployment_id, message)

    async def broadcast_event(self, deployment_id: str, event_type: str, data: Dict):
        """
        广播事件

        Args:
            deployment_id: 部署ID
            event_type: 事件类型
            data: 事件数据
        """
        message = {
            "type": "event",
            "deploymentId": deployment_id,
            "eventType": event_type,
            "data": data,
            "timestamp": self._get_timestamp(),
        }
        await self.send_message(deployment_id, message)

    async def broadcast_session_event(self, session_id: str, event_type: str, data: Dict):
        """广播session级事件。"""
        message = {
            "type": event_type,
            "sessionId": session_id,
            "data": data,
            "timestamp": self._get_timestamp(),
        }
        await self.send_session_message(session_id, message)

    async def broadcast_agent_state(
        self,
        deployment_id: str,
        *,
        stage: str,
        message: str = "",
        data: Dict | None = None,
    ):
        payload = {"phase": stage, "progressMessage": message}
        if data:
            payload.update(data)
        await self.broadcast_event(deployment_id, "phase_update", payload)

    async def broadcast_agent_state_by_session(
        self,
        session_id: str,
        *,
        stage: str,
        message: str = "",
        data: Dict | None = None,
    ):
        payload = {"phase": stage, "progressMessage": message}
        if data:
            payload.update(data)
        await self.broadcast_session_event(session_id, "phase_update", payload)

    async def broadcast_error(self, deployment_id: str, error_message: str, error_type: str = None):
        """
        广播错误

        Args:
            deployment_id: 部署ID
            error_message: 错误信息
            error_type: 错误类型
        """
        message = {
            "type": "task_error",
            "deploymentId": deployment_id,
            "data": {
                "error": error_message,
                "errorType": error_type,
            },
            "timestamp": self._get_timestamp(),
        }
        await self.send_message(deployment_id, message)

    def get_connection_count(self, deployment_id: str) -> int:
        """
        获取指定部署的连接数

        Args:
            deployment_id: 部署ID

        Returns:
            int: 连接数
        """
        return len(self.active_connections.get(deployment_id, set()))

    def get_session_connection_count(self, session_id: str) -> int:
        """获取指定session的连接数。"""
        return len(self.session_connections.get(session_id, set()))

    def _get_timestamp(self) -> str:
        """获取当前时间戳"""
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
