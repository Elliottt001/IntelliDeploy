import json
import logging
import asyncio
from typing import List

class ParallelHealer:
    def __init__(self, llm_client):
        self.llm = llm_client
        self.logger = logging.getLogger(__name__)

    async def generate_variants(self, diagnosis, current_dockerfile: str, timeout_seconds: float | None = None) -> List[str]:
        prompt = f"""
        你是一名顶尖的 Docker 修复专家。
        当前故障诊断: {diagnosis.root_cause} (类型: {diagnosis.error_type})
        
        请针对该错误，提供 3 种不同的修复思路，以 JSON 列表格式返回: ["Dockerfile_v1_content", "Dockerfile_v2_content", "Dockerfile_v3_content"]
        
        原始 Dockerfile:
        {current_dockerfile}
        """
        
        call = self.llm.chat("You are a code generator.", prompt)
        response = await asyncio.wait_for(call, timeout=timeout_seconds) if timeout_seconds else await call
        return self._parse_variants(response)

    def _parse_variants(self, response: str) -> List[str]:
        """健壮的 JSON 解析器"""
        try:
            cleaned = response.replace("```json", "").replace("```", "").strip()
            variants = json.loads(cleaned)
            if isinstance(variants, list) and len(variants) > 0:
                return variants
            return []
        except Exception as e:
            self.logger.error(f"解析修复方案失败: {e}")
            return [] # 返回空列表，由 Engine 层处理异常
