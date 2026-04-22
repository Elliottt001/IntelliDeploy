import asyncio
import logging
from src.agents.healer import ParallelHealer

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HealingEngine:
    def __init__(self, llm_client, deploy_api):
        self.healer = ParallelHealer(llm_client)
        self.api = deploy_api

    async def rollback(self, last_healthy_dockerfile) -> bool:
        """
        核心回滚逻辑：将服务强制恢复到历史健康版本
        """
        logger.warning("!!! 触发紧急回滚，正在恢复到历史健康镜像...")
        status = await self.api.deploy(last_healthy_dockerfile)
        
        if status == "SUCCESS":
            logger.info("回滚成功，服务已恢复至历史健康状态。")
            return True
        else:
            logger.error("回滚操作失败！系统处于不可用状态，请人工介入。")
            return False

    async def run_healing_race(self, diagnosis, current_dockerfile, last_healthy_dockerfile) -> bool:
        """
        执行并行修复赛马，若失败则自动触发回滚
        """
        # 1. 生成多种修复方案
        variants = await self.healer.generate_variants(diagnosis, current_dockerfile)
        
        if not variants:
            logger.error("LLM 未生成任何修复方案，直接触发回滚。")
            return await self.rollback(last_healthy_dockerfile)

        # 2. 定义并行任务
        tasks = [self._attempt_fix(v, i) for i, v in enumerate(variants)]
        
        # 3. 并行执行
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 4. 筛选胜出者 (第一个成功返回 True 的)
        for idx, success in enumerate(results):
            if success is True:
                logger.info(f"修复方案 {idx} 成功应用!")
                return True
        
        # 5. 兜底逻辑：如果赛马无人胜出，执行回滚
        logger.error("所有修复方案均失败，正在触发兜底回滚...")
        return await self.rollback(last_healthy_dockerfile)

    async def _attempt_fix(self, dockerfile_content, index) -> bool:
        """执行单一任务的生命周期"""
        logger.info(f"启动修复任务 {index}...")
        try:
            status = await self.api.deploy(dockerfile_content)
            return status == "SUCCESS"
        except Exception as e:
            logger.error(f"任务 {index} 运行异常: {e}")
            return False