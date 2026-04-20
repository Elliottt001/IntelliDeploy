import pytest
import json
from src.utils.parsers import ErrorParser
from src.agents.schemas import DiagnosisResult

# 1. 定义 Mock 客户端
class MockLLMClient:
    """模拟 LLM 的行为，根据输入返回预设的 JSON 字符串"""
    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        if "pandas" in user_prompt:
            return '{"error_type": "DependencyError", "root_cause": "missing pandas", "key_component": "pandas", "confidence": 0.95}'
        elif "CrashLoop" in user_prompt:
            return '{"error_type": "RuntimeError", "root_cause": "container restart loop", "key_component": "app", "confidence": 0.9}'
        elif "bad_json" in user_prompt:
            return "This is not a JSON string"  # 用于测试解析失败的情况
        return '{"error_type": "Unknown", "root_cause": "unknown", "key_component": "system", "confidence": 0.5}'

# 2. 测试集
@pytest.mark.asyncio
class TestErrorParser:
    
    @pytest.fixture
    def parser(self):
        """创建一个共享的 parser 实例"""
        return ErrorParser(llm_client=MockLLMClient())

    async def test_parser_detects_dependency_error(self, parser):
        """测试正常解析依赖报错"""
        mock_logs = "ImportError: No module named 'pandas'"
        result = await parser.diagnose(mock_logs)
        
        assert isinstance(result, DiagnosisResult)
        assert result.error_type == "DependencyError"
        assert result.key_component == "pandas"
        assert result.confidence == 0.95

    @pytest.mark.parametrize("log_input, expected_type", [
        ("Container CrashLoopBackOff error", "RuntimeError"),
        ("System failure in unknown module", "Unknown"),
    ])
    async def test_parser_scenarios(self, parser, log_input, expected_type):
        """使用参数化测试多种报错场景"""
        result = await parser.diagnose(log_input)
        assert result.error_type == expected_type

    async def test_parser_handles_malformed_json(self, parser):
        """测试当 LLM 返回非 JSON 格式时的兜底逻辑"""
        mock_logs = "Triggering bad_json response"
        result = await parser.diagnose(mock_logs)
        
        # 确保解析失败时，系统返回 Unknown 类型而不是直接报错崩溃
        assert result.error_type == "Unknown"
        assert "解析失败" in result.root_cause