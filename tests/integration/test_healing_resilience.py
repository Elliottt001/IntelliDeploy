from __future__ import annotations

import asyncio
from dataclasses import dataclass

from src.core.engine import HealingEngine
from src.core.resilience import (
    BackpressureConfig,
    BackpressureController,
    CircuitBreakerConfig,
    RedisCircuitBreaker,
    TimeoutBudget,
    InMemoryKVStore,
)


@dataclass
class Diagnosis:
    root_cause: str = "bad dockerfile"
    error_type: str = "BUILD"


class StaticLLM:
    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        return '["v1_bad", "v2_good", "v3_bad"]'


class SlowLLM:
    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        await asyncio.sleep(1)
        return '["v1_bad"]'


class DeployAPI:
    def __init__(self, *, always_fail: bool = False, delay: float = 0.0) -> None:
        self.always_fail = always_fail
        self.delay = delay

    async def deploy(self, content: str) -> str:
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.always_fail:
            return "FAILED"
        return "SUCCESS" if "v2_good" in content or "last_healthy" in content else "FAILED"


def build_engine(llm, deploy_api, *, failure_threshold: int = 2, backpressure: BackpressureController | None = None):
    return HealingEngine(
        llm,
        deploy_api,
        circuit_breaker=RedisCircuitBreaker(
            InMemoryKVStore(),
            CircuitBreakerConfig(failure_threshold=failure_threshold, cooldown_seconds=60),
        ),
        backpressure=backpressure or BackpressureController(),
        timeout_budget=TimeoutBudget(
            llm_seconds=0.05,
            sandbox_build_seconds=0.05,
            deploy_seconds=0.2,
            total_seconds=0.5,
        ),
    )


def test_healing_records_success_and_keeps_circuit_closed() -> None:
    async def run() -> None:
        engine = build_engine(StaticLLM(), DeployAPI())

        result = await engine.run_healing_race(Diagnosis(), "current", "last_healthy", project_id="ok")

        assert result is True
        assert await engine.circuit_breaker.state("ok") == "closed"

    asyncio.run(run())


def test_healing_opens_circuit_after_consecutive_failures() -> None:
    async def run() -> None:
        engine = build_engine(SlowLLM(), DeployAPI(), failure_threshold=1)

        result = await engine.run_healing_race(Diagnosis(), "current", "last_healthy", project_id="broken")

        assert result is True
        assert await engine.circuit_breaker.state("broken") == "open"

    asyncio.run(run())


def test_healing_backpressure_rejects_when_queue_is_full() -> None:
    async def run() -> None:
        backpressure = BackpressureController(
            BackpressureConfig(
                max_global_concurrency=1,
                max_project_concurrency=1,
                max_queue_depth=1,
                acquire_timeout_seconds=0.01,
            )
        )
        engine = build_engine(StaticLLM(), DeployAPI(delay=0.05), backpressure=backpressure)

        results = await asyncio.gather(
            *[
                engine.run_healing_race(Diagnosis(), "current", "last_healthy", project_id="hot")
                for _ in range(4)
            ]
        )

        assert results.count(False) >= 1

    asyncio.run(run())
