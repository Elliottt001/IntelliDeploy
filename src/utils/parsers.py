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
        prompt = f"""
        You are a DevOps diagnostic expert. Analyze the following logs and
        return JSON with: error_type, root_cause, suggested_components,
        key_component, confidence.

        Logs:
        {raw_log}
        """

        response = await self.llm.chat("You are a diagnostic expert.", prompt)

        try:
            cleaned_json = response.replace("```json", "").replace("```", "").strip()
            payload = json.loads(cleaned_json)
            payload.setdefault("suggested_components", [])
            if not payload["suggested_components"] and payload.get("key_component"):
                payload["suggested_components"] = [payload["key_component"]]
            result = DiagnosisResult.model_validate(payload)
            logger.info("Log diagnosis parsed successfully.")
            return result
        except (ValidationError, json.JSONDecodeError) as exc:
            logger.error("Log diagnosis parse failed: %s, raw response: %s", exc, response)
            raise ValueError("LLM output could not be parsed as DiagnosisResult") from exc

    async def diagnose(self, raw_log: str) -> DiagnosisResult:
        try:
            return await self.parse_log(raw_log)
        except Exception as exc:
            logger.error("diagnose fallback after parse failure: %s", exc)
            return DiagnosisResult(
                error_type="Unknown",
                root_cause=f"解析失败: {exc}",
                suggested_components=[],
                key_component="unknown",
                confidence=0.0,
            )
