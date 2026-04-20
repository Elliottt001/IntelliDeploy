from __future__ import annotations

from typing import Any, Callable

from .json_repair import loads_json_or_raise
from .prompt_loader import render_prompt


class LLMClientError(RuntimeError):
    pass


class LLMClient:
    def __init__(self, runner: Callable[[dict[str, Any]], Any] | None = None) -> None:
        self._runner = runner

    @property
    def available(self) -> bool:
        return self._runner is not None

    def generate_json(
        self,
        *,
        prompt_name: str,
        variables: dict[str, object] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if self._runner is None:
            raise LLMClientError("LLM runner is not configured")

        request_payload = dict(payload or {})
        request_payload["prompt"] = render_prompt(prompt_name, variables)
        result = self._runner(request_payload)
        parsed = loads_json_or_raise(result)
        if not isinstance(parsed, dict):
            raise LLMClientError("LLM output must be a JSON object")
        return parsed

