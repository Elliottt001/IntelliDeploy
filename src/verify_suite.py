# verify_suite.py 示例
from src.deploy_service import DeploymentManager
from src.agents.llm_client import LLMClient
import os

# 初始化
llm_instance = LLMClient(api_key=os.getenv("OPENAI_API_KEY"))
# 假设你的 DeploymentManager 需要这个 client
manager = DeploymentManager(llm_client=llm_instance) 

# 然后运行你的测试场景