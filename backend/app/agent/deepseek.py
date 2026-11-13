"""Direct DeepSeek Chat Completions protocol; provider failures never mean user quota."""

import asyncio
import json

import httpx
from openai import APIConnectionError, APIStatusError, AsyncOpenAI

from app.config import settings
from app.core.types import ModelTurn, ToolCall


class ModelProtocolError(ValueError):
    def __init__(self, message, turn=None):
        self.turn = turn
        super().__init__(message)


def completion_options(tools):
    implementation = any(tool.get("function", {}).get("name") != "finish_implementation" for tool in tools or [])
    return {
        "max_tokens": settings.DEEPSEEK_MAX_OUTPUT_TOKENS,
        "extra_body": {"thinking": {"type": "enabled" if implementation else settings.DEEPSEEK_PLANNING_THINKING}},
    }


class UpstreamUnavailable(RuntimeError):
    code = "UPSTREAM_UNAVAILABLE"


class DeepSeekClient:
    def __init__(self, api_key=None, base_url=None, transport=None, retry_delay=0.25):
        key = api_key or settings.DEEPSEEK_API_KEY
        if not key:
            raise UpstreamUnavailable("模型服务尚未配置")
        self.retry_delay = retry_delay
        self.client = AsyncOpenAI(
            api_key=key,
            base_url=base_url or settings.DEEPSEEK_BASE_URL,
            max_retries=0,
            http_client=httpx.AsyncClient(transport=transport, timeout=120),
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        await self.client.close()

    async def complete(self, messages, tools, model):
        for attempt in range(3):
            try:
                response = await self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=tools or None,
                    **completion_options(tools),
                )
                break
            except APIStatusError as exc:
                retryable = (
                    exc.status_code in {408, 429} or 500 <= exc.status_code < 600
                )
                if not retryable or attempt == 2:
                    raise UpstreamUnavailable("模型服务暂时不可用") from exc
                await asyncio.sleep(self.retry_delay * 2**attempt)
            except APIConnectionError as exc:
                # A disconnected request may already have incurred cost. Caller records
                # its unknown outcome rather than blindly replaying and charging twice.
                raise UpstreamUnavailable("模型请求结果无法确认，请稍后重试") from exc
        choice = response.choices[0] if response.choices else None
        raw = choice.message.model_dump(exclude_none=False) if choice else {}
        usage = response.usage
        cached = getattr(usage, "prompt_cache_hit_tokens", 0) or 0
        valid_usage = usage is not None and 0 <= cached <= usage.prompt_tokens and usage.completion_tokens >= 0
        turn = ModelTurn(
            assistant_message=raw,
            input_tokens=usage.prompt_tokens if valid_usage else 0,
            cached_input_tokens=cached if valid_usage else 0,
            output_tokens=usage.completion_tokens if valid_usage else 0,
            usage_known=valid_usage,
            finish_reason=choice.finish_reason if choice else None,
            provider_request_id=response.id,
        )
        if usage is not None and not valid_usage:
            raise ModelProtocolError("invalid model usage", turn)
        if choice is None:
            raise ModelProtocolError("model response has no assistant turn", turn)
        if choice.finish_reason == "length":
            raise ModelProtocolError("MODEL_OUTPUT_TRUNCATED", turn)
        calls = []
        try:
            for call in choice.message.tool_calls or []:
                arguments = json.loads(call.function.arguments)
                if not isinstance(arguments, dict):
                    raise ValueError("arguments must be an object")
                calls.append(ToolCall(id=call.id, name=call.function.name, arguments=arguments))
        except (ValueError, AttributeError, TypeError) as exc:
            raise ModelProtocolError("invalid model tool arguments", turn) from exc
        if len({c.id for c in calls}) != len(calls):
            raise ModelProtocolError("duplicate model tool call IDs", turn)
        if not calls and not (raw.get("content") or "").strip():
            raise ModelProtocolError("MODEL_OUTPUT_EMPTY", turn)
        return turn.model_copy(update={"calls": calls})
