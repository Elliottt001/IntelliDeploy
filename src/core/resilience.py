from __future__ import annotations

import asyncio
import os
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import StrEnum
from typing import AsyncIterator, Protocol


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class BackpressureRejected(RuntimeError):
    pass


class CircuitOpen(RuntimeError):
    pass


class AsyncKVStore(Protocol):
    async def get(self, key: str) -> str | None:
        ...

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        ...

    async def delete(self, key: str) -> None:
        ...


class InMemoryKVStore:
    def __init__(self) -> None:
        self._values: dict[str, str] = {}
        self._expires_at: dict[str, float] = {}

    async def get(self, key: str) -> str | None:
        expires_at = self._expires_at.get(key)
        if expires_at is not None and time.time() >= expires_at:
            await self.delete(key)
            return None
        return self._values.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._values[key] = value
        if ex is not None:
            self._expires_at[key] = time.time() + ex

    async def delete(self, key: str) -> None:
        self._values.pop(key, None)
        self._expires_at.pop(key, None)


class RedisKVStore:
    def __init__(self, redis_url: str) -> None:
        import redis.asyncio as redis

        self._client = redis.Redis.from_url(redis_url, decode_responses=True)

    async def get(self, key: str) -> str | None:
        return await self._client.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        await self._client.set(key, value, ex=ex)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)


def build_kv_store(redis_url: str | None = None) -> AsyncKVStore:
    url = redis_url or os.getenv("HEALING_REDIS_URL") or os.getenv("REDIS_URL")
    if url:
        try:
            return RedisKVStore(url)
        except Exception:
            return InMemoryKVStore()
    return InMemoryKVStore()


@dataclass(frozen=True)
class CircuitBreakerConfig:
    failure_threshold: int = 3
    cooldown_seconds: int = 300
    half_open_probe_ttl_seconds: int = 60
    namespace: str = "parallel_healing"


@dataclass(frozen=True)
class TimeoutBudget:
    llm_seconds: float = 30.0
    sandbox_build_seconds: float = 180.0
    deploy_seconds: float = 300.0
    total_seconds: float = 600.0


@dataclass(frozen=True)
class BackpressureConfig:
    max_global_concurrency: int = 8
    max_project_concurrency: int = 2
    max_queue_depth: int = 32
    acquire_timeout_seconds: float = 1.0


class RedisCircuitBreaker:
    def __init__(self, store: AsyncKVStore, config: CircuitBreakerConfig | None = None) -> None:
        self.store = store
        self.config = config or CircuitBreakerConfig()

    def _key(self, scope: str, name: str) -> str:
        return f"{self.config.namespace}:circuit:{scope}:{name}"

    async def state(self, scope: str) -> CircuitState:
        open_until = await self.store.get(self._key(scope, "open_until"))
        if open_until is None:
            return CircuitState.CLOSED
        if time.time() < float(open_until):
            return CircuitState.OPEN
        return CircuitState.HALF_OPEN

    async def before_call(self, scope: str) -> CircuitState:
        state = await self.state(scope)
        if state == CircuitState.OPEN:
            raise CircuitOpen(f"Healing circuit is open for {scope}")
        if state == CircuitState.HALF_OPEN:
            probe_key = self._key(scope, "half_open_probe")
            if await self.store.get(probe_key):
                raise CircuitOpen(f"Healing half-open probe already running for {scope}")
            await self.store.set(probe_key, "1", ex=self.config.half_open_probe_ttl_seconds)
        return state

    async def record_success(self, scope: str) -> None:
        await self.store.delete(self._key(scope, "failure_count"))
        await self.store.delete(self._key(scope, "open_until"))
        await self.store.delete(self._key(scope, "half_open_probe"))

    async def record_failure(self, scope: str) -> CircuitState:
        value = await self.store.get(self._key(scope, "failure_count"))
        failure_count = int(value or "0") + 1
        await self.store.set(self._key(scope, "failure_count"), str(failure_count), ex=self.config.cooldown_seconds)
        await self.store.delete(self._key(scope, "half_open_probe"))
        if failure_count >= self.config.failure_threshold:
            await self.store.set(
                self._key(scope, "open_until"),
                str(time.time() + self.config.cooldown_seconds),
                ex=self.config.cooldown_seconds,
            )
            return CircuitState.OPEN
        return CircuitState.CLOSED


class BackpressureController:
    def __init__(self, config: BackpressureConfig | None = None) -> None:
        self.config = config or BackpressureConfig()
        self._global = asyncio.Semaphore(self.config.max_global_concurrency)
        self._project_locks: dict[str, asyncio.Semaphore] = {}
        self._queued = 0
        self._lock = asyncio.Lock()

    @asynccontextmanager
    async def acquire(self, scope: str) -> AsyncIterator[None]:
        global_acquired = False
        project_acquired = False
        async with self._lock:
            if self._queued >= self.config.max_queue_depth:
                raise BackpressureRejected("Healing queue is full")
            self._queued += 1
            project_sem = self._project_locks.setdefault(scope, asyncio.Semaphore(self.config.max_project_concurrency))

        try:
            try:
                await asyncio.wait_for(self._global.acquire(), timeout=self.config.acquire_timeout_seconds)
                global_acquired = True
                await asyncio.wait_for(project_sem.acquire(), timeout=self.config.acquire_timeout_seconds)
                project_acquired = True
            except TimeoutError as exc:
                raise BackpressureRejected("Healing concurrency limit reached") from exc

            try:
                yield
            finally:
                if project_acquired:
                    project_sem.release()
                if global_acquired:
                    self._global.release()
        finally:
            async with self._lock:
                self._queued -= 1
