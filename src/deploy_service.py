import logging
from src.utils.parsers import ErrorParser
from src.core.engine import HealingEngine

# 配置日志
logger = logging.getLogger(__name__)

class DeploymentManager:
    def __init__(self, engine: HealingEngine, parser: ErrorParser, deploy_api):
        self.engine = engine
        self.parser = parser
        self.deploy_api = deploy_api
        self.last_healthy_dockerfile = None  # 记录上一次成功的配置，作为“救命稻草”

    async def deploy_task(self, dockerfile, logs_callback):
        """
        部署任务主入口
        :param dockerfile: 当前要部署的 Dockerfile 内容
        :param logs_callback: 一个获取部署日志的异步函数 (返回字符串)
        """
        # 1. 尝试部署当前版本
        logger.info("开始部署任务...")
        status = await self.deploy_api.deploy(dockerfile)
        
        if status == "SUCCESS":
            # 成功则更新记录，保存为最新的“健康版本”
            logger.info("部署成功，更新 Last Known Good 版本。")
            self.last_healthy_dockerfile = dockerfile
            return True
        
        # 2. 如果部署失败，获取日志并触发修复引擎
        logger.warning("部署失败，开始触发自愈流程...")
        logs = await logs_callback()  # 获取刚才部署失败的日志
        
        # 解析错误
        diagnosis = await self.parser.parse_log(logs)
        logger.info(f"诊断完成: {diagnosis.error_type} - {diagnosis.root_cause}")

        # 3. 传入诊断信息和“救命稻草” (last_healthy_dockerfile) 启动赛马
        return await self.engine.run_healing_race(
            diagnosis, 
            current_dockerfile=dockerfile, 
            last_healthy_dockerfile=self.last_healthy_dockerfile
        )