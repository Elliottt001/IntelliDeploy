from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
import time
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core.engine import HealingEngine
from src.core.resilience import (
    BackpressureConfig,
    BackpressureController,
    CircuitBreakerConfig,
    RedisCircuitBreaker,
    TimeoutBudget,
    build_kv_store,
)


@dataclass
class Diagnosis:
    root_cause: str = "container failed to start"
    error_type: str = "RUNTIME_ERROR"


class DrillLLM:
    def __init__(self, scenario: str) -> None:
        self.scenario = scenario

    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        if self.scenario == "llm_timeout":
            await asyncio.sleep(10)
        await asyncio.sleep(0.02)
        return '["v1_bad", "v2_good", "v3_bad"]'


class DrillDeployAPI:
    def __init__(self, scenario: str) -> None:
        self.scenario = scenario

    async def deploy(self, content: str) -> str:
        await asyncio.sleep(0.03)
        if self.scenario == "deploy_failure":
            return "FAILED"
        return "SUCCESS" if "v2_good" in content or "last_healthy" in content else "FAILED"


async def run_one(engine: HealingEngine, idx: int) -> tuple[bool, float]:
    started = time.perf_counter()
    result = await engine.run_healing_race(
        Diagnosis(),
        current_dockerfile="current_bad",
        last_healthy_dockerfile="last_healthy",
        project_id=f"project-{idx % 4}",
    )
    return result, (time.perf_counter() - started) * 1000


async def run_drill(args: argparse.Namespace) -> None:
    circuit = RedisCircuitBreaker(
        build_kv_store(args.redis_url),
        CircuitBreakerConfig(
            failure_threshold=args.failure_threshold,
            cooldown_seconds=args.cooldown_seconds,
            half_open_probe_ttl_seconds=args.half_open_probe_ttl_seconds,
        ),
    )
    backpressure = BackpressureController(
        BackpressureConfig(
            max_global_concurrency=args.max_global_concurrency,
            max_project_concurrency=args.max_project_concurrency,
            max_queue_depth=args.max_queue_depth,
            acquire_timeout_seconds=args.acquire_timeout_seconds,
        )
    )
    engine = HealingEngine(
        DrillLLM(args.scenario),
        DrillDeployAPI(args.scenario),
        circuit_breaker=circuit,
        backpressure=backpressure,
        timeout_budget=TimeoutBudget(
            llm_seconds=args.llm_timeout,
            sandbox_build_seconds=args.build_timeout,
            deploy_seconds=args.deploy_timeout,
            total_seconds=args.total_timeout,
        ),
    )

    sem = asyncio.Semaphore(args.concurrency)

    async def guarded_run(i: int) -> tuple[bool, float]:
        async with sem:
            return await run_one(engine, i)

    results = await asyncio.gather(*(guarded_run(i) for i in range(args.requests)))
    successes = [ok for ok, _ in results if ok]
    latencies = [latency for _, latency in results]
    p95 = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies)

    print("healing_fault_drill_result")
    print(f"scenario={args.scenario}")
    print(f"requests={args.requests}")
    print(f"concurrency={args.concurrency}")
    print(f"success_count={len(successes)}")
    print(f"success_rate={len(successes) / args.requests:.4f}")
    print(f"latency_avg_ms={statistics.mean(latencies):.2f}")
    print(f"latency_p95_ms={p95:.2f}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parallel healing fault drill and baseline load test.")
    parser.add_argument("--scenario", choices=["normal", "llm_timeout", "deploy_failure"], default="normal")
    parser.add_argument("--requests", type=int, default=50)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--redis-url", default=None)
    parser.add_argument("--failure-threshold", type=int, default=3)
    parser.add_argument("--cooldown-seconds", type=int, default=10)
    parser.add_argument("--half-open-probe-ttl-seconds", type=int, default=3)
    parser.add_argument("--max-global-concurrency", type=int, default=8)
    parser.add_argument("--max-project-concurrency", type=int, default=2)
    parser.add_argument("--max-queue-depth", type=int, default=32)
    parser.add_argument("--acquire-timeout-seconds", type=float, default=0.2)
    parser.add_argument("--llm-timeout", type=float, default=0.2)
    parser.add_argument("--build-timeout", type=float, default=1.0)
    parser.add_argument("--deploy-timeout", type=float, default=1.0)
    parser.add_argument("--total-timeout", type=float, default=2.0)
    return parser.parse_args()


if __name__ == "__main__":
    asyncio.run(run_drill(parse_args()))
