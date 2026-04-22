class MockLLMClient:
    """
    模拟 LLM 客户端，直接返回预设的 JSON 字符串，跳过网络请求。
    """
    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        # 这里你可以根据 user_prompt 的内容，返回不同的 mock 数据
        if "pandas" in user_prompt:
            return '{"error_type": "DependencyError", "root_cause": "missing pandas", "key_component": "pandas", "confidence": 0.95}'
        elif "CrashLoop" in user_prompt:
            return '{"error_type": "RuntimeError", "root_cause": "container loop", "key_component": "app", "confidence": 0.9}'
        return '{"error_type": "Unknown", "root_cause": "unknown", "key_component": "system", "confidence": 0.5}'