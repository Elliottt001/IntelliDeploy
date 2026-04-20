from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
import json
import os
from typing import Any, Protocol

from fallback.services.config import FallbackConfig, get_config

try:
    import redis
except ImportError:  # pragma: no cover - optional dependency
    redis = None


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _merge_task_payload(current: dict[str, Any], changes: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(current)
    for key, value in changes.items():
        if key in {"project_id", "deployment_id"} and value is None and merged.get(key) is not None:
            continue
        merged[key] = value
    merged["updated_at"] = changes.get("updated_at") or _now_iso()
    return merged


class TaskStateStore(Protocol):
    def save_task(self, task_id: str, payload: dict[str, Any]) -> None: ...

    def update_task(self, task_id: str, **changes: Any) -> None: ...

    def get_task(self, task_id: str) -> dict[str, Any] | None: ...

    def save_request(self, task_id: str, payload: dict[str, Any]) -> None: ...

    def get_request(self, task_id: str) -> dict[str, Any] | None: ...

    def save_artifact(self, task_id: str, payload: dict[str, Any]) -> None: ...

    def get_artifact(self, task_id: str) -> dict[str, Any] | None: ...


class InMemoryTaskStateStore:
    def __init__(self) -> None:
        self._tasks: dict[str, dict[str, Any]] = {}
        self._requests: dict[str, dict[str, Any]] = {}
        self._artifacts: dict[str, dict[str, Any]] = {}

    def save_task(self, task_id: str, payload: dict[str, Any]) -> None:
        task_payload = deepcopy(payload)
        task_payload["updated_at"] = task_payload.get("updated_at") or _now_iso()
        self._tasks[task_id] = task_payload

    def update_task(self, task_id: str, **changes: Any) -> None:
        current = self._tasks.get(task_id)
        if current is None:
            raise KeyError(f"Task {task_id} does not exist.")
        self._tasks[task_id] = _merge_task_payload(current, changes)

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        payload = self._tasks.get(task_id)
        return deepcopy(payload) if payload is not None else None

    def save_request(self, task_id: str, payload: dict[str, Any]) -> None:
        self._requests[task_id] = deepcopy(payload)

    def get_request(self, task_id: str) -> dict[str, Any] | None:
        payload = self._requests.get(task_id)
        return deepcopy(payload) if payload is not None else None

    def save_artifact(self, task_id: str, payload: dict[str, Any]) -> None:
        self._artifacts[task_id] = deepcopy(payload)

    def get_artifact(self, task_id: str) -> dict[str, Any] | None:
        payload = self._artifacts.get(task_id)
        return deepcopy(payload) if payload is not None else None


class RedisTaskStateStore:
    def __init__(
        self,
        *,
        redis_url: str,
        ttl_seconds: int,
    ) -> None:
        if redis is None:  # pragma: no cover - import guarded at runtime
            raise RuntimeError("redis package is not installed.")
        self._client = redis.Redis.from_url(redis_url, decode_responses=True)
        self._ttl_seconds = ttl_seconds

    @staticmethod
    def _task_key(task_id: str) -> str:
        return f"fallback:task:{task_id}"

    @staticmethod
    def _artifact_key(task_id: str) -> str:
        return f"fallback:artifact:{task_id}"

    @staticmethod
    def _request_key(task_id: str) -> str:
        return f"fallback:request:{task_id}"

    def save_task(self, task_id: str, payload: dict[str, Any]) -> None:
        task_payload = deepcopy(payload)
        task_payload["updated_at"] = task_payload.get("updated_at") or _now_iso()
        self._client.set(self._task_key(task_id), json.dumps(task_payload), ex=self._ttl_seconds)

    def update_task(self, task_id: str, **changes: Any) -> None:
        key = self._task_key(task_id)
        raw = self._client.get(key)
        if raw is None:
            raise KeyError(f"Task {task_id} does not exist.")
        current = json.loads(raw)
        merged = _merge_task_payload(current, changes)
        self._client.set(key, json.dumps(merged), ex=self._ttl_seconds)

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        raw = self._client.get(self._task_key(task_id))
        return json.loads(raw) if raw is not None else None

    def save_request(self, task_id: str, payload: dict[str, Any]) -> None:
        self._client.set(self._request_key(task_id), json.dumps(payload), ex=self._ttl_seconds)

    def get_request(self, task_id: str) -> dict[str, Any] | None:
        raw = self._client.get(self._request_key(task_id))
        return json.loads(raw) if raw is not None else None

    def save_artifact(self, task_id: str, payload: dict[str, Any]) -> None:
        self._client.set(self._artifact_key(task_id), json.dumps(payload), ex=self._ttl_seconds)

    def get_artifact(self, task_id: str) -> dict[str, Any] | None:
        raw = self._client.get(self._artifact_key(task_id))
        return json.loads(raw) if raw is not None else None


_STATE_STORE: TaskStateStore | None = None


def get_state_store(*, config: FallbackConfig | None = None) -> TaskStateStore:
    global _STATE_STORE
    if _STATE_STORE is not None:
        return _STATE_STORE

    config = config or get_config()
    redis_url = os.getenv("FALLBACK_REDIS_URL") or os.getenv("REDIS_URL")
    if redis is not None and redis_url:
        _STATE_STORE = RedisTaskStateStore(redis_url=redis_url, ttl_seconds=config.state_ttl_seconds)
    else:
        _STATE_STORE = InMemoryTaskStateStore()
    return _STATE_STORE
