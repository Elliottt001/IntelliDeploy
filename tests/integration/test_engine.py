import pytest
import asyncio
import random
from src.core.engine import HealingEngine

# 1. 创建一个模拟的 API 客户端，给它加点延迟
class MockDeployAPI:
    async def deploy(self, content):
        # 模拟 3 个方案，有的快，有的慢，有的甚至会失败
        delay = random.uniform(0.1, 1.0)
        await asyncio.sleep(delay)
        
        # 假设内容里包含 "v2" 的才是正确的（为了测试）
        if "v2" in content:
            return "SUCCESS"
        return "FAILED"

@pytest.mark.asyncio
async def test_healing_race_winner():
    # 2. 注入模拟 API
    mock_api = MockDeployAPI()
    # 假设我们有一个简单的 LLM mock
    engine = HealingEngine(llm_client=None, deploy_api=mock_api)
    
    # 手动触发竞速
    # 假设我们有 3 个方案
    variants = ["v1_bad", "v2_good", "v3_bad"]
    
    # 运行赛车
    tasks = [engine._attempt_fix(v, i) for i, v in enumerate(variants)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 3. 验证是否能捕捉到 "v2_good" 的成功
    assert True in results
    print(f"赛车结果: {results}")