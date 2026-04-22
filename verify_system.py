import asyncio
import unittest
from unittest.mock import AsyncMock
# 导入你的实际代码模块
from src.agents.schemas import DiagnosisResult
from src.utils.parsers import ErrorParser
from src.agents.healer import ParallelHealer
from src.core.engine import HealingEngine

# 1. 模拟 LLM 客户端：返回我们预期的结构化数据
class MockLLM:
    async def chat(self, system_prompt, user_prompt):
        # 如果是 Parser 请求，返回 JSON 诊断结果
        if "diagnostic" in user_prompt.lower() or "分析" in user_prompt:
            return """
            {
                "error_type": "DependencyError",
                "root_cause": "缺少 numpy 库",
                "suggested_components": ["requirements.txt"],
                "key_component": "numpy",
                "confidence": 0.95
            }
            """
        # 如果是 Healer 请求，返回修复方案列表
        return '["FROM python:3.9\\nRUN pip install numpy", "FROM python:3.8\\nRUN pip install numpy"]'

# 2. 模拟部署 API：模拟不同方案的部署结果
class MockDeployAPI:
    async def deploy(self, dockerfile_content):
        # 模拟第一个方案成功，第二个失败
        if "3.9" in dockerfile_content:
            return "SUCCESS"
        return "FAILED"

class TestIntelliDeploy(unittest.IsolatedAsyncioTestCase):
    
    async def test_full_healing_loop(self):
        print("\n[开始系统全流程验证]...")

        # 初始化组件
        mock_llm = MockLLM()
        parser = ErrorParser(llm_client=mock_llm)
        engine = HealingEngine(llm_client=mock_llm, deploy_api=MockDeployAPI())
        
        # 步骤 1: 测试 Parser (验证 Schema 校验)
        raw_log = "ModuleNotFoundError: No module named 'numpy'"
        diagnosis = await parser.parse_log(raw_log)
        
        print(f"-> 步骤1: 日志解析成功。类型: {diagnosis.error_type}, 根本原因: {diagnosis.root_cause}")
        self.assertEqual(diagnosis.error_type, "DependencyError")
        self.assertEqual(diagnosis.key_component, "numpy")

        # 步骤 2: 测试 Healing Engine (验证并行修复逻辑)
        print("-> 步骤2: 启动并行修复引擎...")
        success = await engine.run_healing_race(diagnosis, "FROM python:3.8")
        
        # 步骤 3: 结果断言
        self.assertTrue(success, "系统应该成功修复并部署")
        print("-> 步骤3: 修复闭环验证通过！")

if __name__ == "__main__":
    unittest.main()