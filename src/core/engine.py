import asyncio
import logging
from src.agents.healer import ParallelHealer
from src.core.resilience import (
    BackpressureController,
    BackpressureConfig,
    BackpressureRejected,
    CircuitBreakerConfig,
    CircuitOpen,
    RedisCircuitBreaker,
    TimeoutBudget,
    build_kv_store,
)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HealingEngine:
    def __init__(
        self,
        llm_client,
        deploy_api,
        *,
        build_api=None,
        circuit_breaker: RedisCircuitBreaker | None = None,
        backpressure: BackpressureController | None = None,
        timeout_budget: TimeoutBudget | None = None,
    ):
        self.healer = ParallelHealer(llm_client)
        self.api = deploy_api
        self.build_api = build_api
        self.circuit_breaker = circuit_breaker or RedisCircuitBreaker(
            build_kv_store(),
            CircuitBreakerConfig(),
        )
        self.backpressure = backpressure or BackpressureController(BackpressureConfig())
        self.timeout_budget = timeout_budget or TimeoutBudget()

    async def rollback(self, last_healthy_dockerfile) -> bool:
        """
        核心回滚逻辑：将服务强制恢复到历史健康版本
        """
        logger.warning("!!! 触发紧急回滚，正在恢复到历史健康镜像...")
        status = await asyncio.wait_for(
            self.api.deploy(last_healthy_dockerfile),
            timeout=self.timeout_budget.deploy_seconds,
        )
        
        if status == "SUCCESS":
            logger.info("回滚成功，服务已恢复至历史健康状态。")
            return True
        else:
            logger.error("回滚操作失败！系统处于不可用状态，请人工介入。")
            return False

    async def run_healing_race(
        self,
        diagnosis,
        current_dockerfile,
        last_healthy_dockerfile,
        *,
        project_id: str = "default",
    ) -> bool:
        """
        执行并行修复赛马，若失败则自动触发回滚
        """
        try:
            return await asyncio.wait_for(
                self._run_guarded_healing_race(
                    project_id,
                    diagnosis,
                    current_dockerfile,
                    last_healthy_dockerfile,
                ),
                timeout=self.timeout_budget.total_seconds,
            )
        except (CircuitOpen, BackpressureRejected) as exc:
            logger.error("自愈请求被保护机制拒绝: %s", exc)
            return False
        except TimeoutError:
            logger.error("自愈总超时，触发回滚。")
            await self.circuit_breaker.record_failure(project_id)
            return await self.rollback(last_healthy_dockerfile)

    async def _run_guarded_healing_race(
        self,
        project_id: str,
        diagnosis,
        current_dockerfile,
        last_healthy_dockerfile,
    ) -> bool:
        await self.circuit_breaker.before_call(project_id)
        async with self.backpressure.acquire(project_id):
            try:
                variants = await self.healer.generate_variants(
                    diagnosis,
                    current_dockerfile,
                    timeout_seconds=self.timeout_budget.llm_seconds,
                )

                if not variants:
                    logger.error("LLM 未生成任何修复方案，直接触发回滚。")
                    await self.circuit_breaker.record_failure(project_id)
                    return await self.rollback(last_healthy_dockerfile)

                tasks = [self._attempt_fix(v, i) for i, v in enumerate(variants)]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for idx, success in enumerate(results):
                    if success is True:
                        logger.info(f"修复方案 {idx} 成功应用!")
                        await self.circuit_breaker.record_success(project_id)
                        return True

                logger.error("所有修复方案均失败，正在触发兜底回滚...")
                await self.circuit_breaker.record_failure(project_id)
                return await self.rollback(last_healthy_dockerfile)
            except TimeoutError:
                await self.circuit_breaker.record_failure(project_id)
                raise
            except Exception:
                await self.circuit_breaker.record_failure(project_id)
                raise

    async def _attempt_fix(self, dockerfile_content, index) -> bool:
        """执行单一任务的生命周期"""
        logger.info(f"启动修复任务 {index}...")
        try:
            deployable = dockerfile_content
            if self.build_api is not None:
                deployable = await asyncio.wait_for(
                    self.build_api.build(dockerfile_content),
                    timeout=self.timeout_budget.sandbox_build_seconds,
                )
            status = await asyncio.wait_for(
                self.api.deploy(deployable),
                timeout=self.timeout_budget.deploy_seconds,
            )
            return status == "SUCCESS"
        except TimeoutError:
            logger.error(f"任务 {index} 部署超时")
            return False
        except Exception as e:
            logger.error(f"任务 {index} 运行异常: {e}")
            return False
