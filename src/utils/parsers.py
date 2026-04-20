import json
import logging
from pydantic import ValidationError
from src.agents.schemas import DiagnosisResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ErrorParser:
    def __init__(self, llm_client):
        self.llm = llm_client

    async def parse_log(self, raw_log: str) -> DiagnosisResult:
        # 确保 Prompt 要求 AI 输出所有 5 个字段
        prompt = f"""
        你是一名 DevOps 专家。请分析以下报错日志，并严格按照 JSON 格式输出。
        JSON 必须包含字段: "error_type", "root_cause", "suggested_components", "key_component", "confidence"。
        
        日志内容: 
        {raw_log}
        """
        
        response = await self.llm.chat("You are a diagnostic expert.", prompt)
        
        try:
            # 清洗 Markdown 标记
            cleaned_json = response.replace("```json", "").replace("```", "").strip()
            # 校验数据
            result = DiagnosisResult.model_validate_json(cleaned_json)
            logger.info("日志解析成功，已通过校验。")
            return result
            
        except (ValidationError, json.JSONDecodeError) as e:
            logger.error(f"日志解析失败: {e}, 原始响应: {response}")
            # 抛出异常或返回兜底默认值
            raise ValueError("LLM 输出格式错误，无法解析为 DiagnosisResult")