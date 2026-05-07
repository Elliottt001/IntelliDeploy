from __future__ import annotations

import json
import os
from typing import Any, Protocol

from pydantic import BaseModel, ValidationError


class AgentLLMError(RuntimeError):
    pass


class AgentLLMRunner(Protocol):
    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        output_model: type[BaseModel],
        context: dict[str, Any],
    ) -> BaseModel:
        ...


def extract_json_object(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise AgentLLMError("LLM response does not contain a JSON object")

    parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, dict):
        raise AgentLLMError("LLM response JSON must be an object")
    return parsed


class OpenAICompatibleLLMRunner:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY") or os.getenv("MODEL_KEY")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL") or os.getenv("MODEL_API")
        self.model = model or os.getenv("OPENAI_MODEL") or os.getenv("MODEL_NAME") or "gpt-4o-mini"
        self.timeout = timeout
        self._client: Any | None = None

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    @property
    def client(self) -> Any:
        if not self.available:
            raise AgentLLMError("OPENAI_API_KEY or MODEL_KEY is not configured")
        if self._client is None:
            try:
                from openai import OpenAI
            except ImportError as exc:
                raise AgentLLMError("openai package is not installed") from exc
            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url, timeout=self.timeout)
        return self._client

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        output_model: type[BaseModel],
        context: dict[str, Any],
    ) -> BaseModel:
        schema = output_model.model_json_schema()
        response = self.client.chat.completions.create(
            model=self.model,
            temperature=0.2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"{system_prompt}\n"
                        "Return strict JSON only. The JSON must match this JSON Schema:\n"
                        f"{json.dumps(schema, ensure_ascii=False)}"
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
        )
        content = response.choices[0].message.content or ""
        parsed = extract_json_object(content)
        try:
            return output_model.model_validate(parsed)
        except ValidationError as exc:
            raise AgentLLMError(f"LLM output failed Pydantic validation: {exc}") from exc
