"""Direct DeepSeek Chat Completions protocol; provider failures never mean user quota."""

import asyncio
import json

import httpx
from openai import APIConnectionError, APIStatusError, AsyncOpenAI

from app.config import settings
from app.core.types import ModelTurn, ToolCall


class ModelProtocolError(ValueError):
    pass


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
                    extra_body={"thinking": {"type": "enabled"}},
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
        if not response.choices:
            raise ModelProtocolError("model response has no assistant turn")
        raw = response.choices[0].message.model_dump(exclude_none=False)
        calls = []
        try:
            for call in response.choices[0].message.tool_calls or []:
                arguments = json.loads(call.function.arguments)
                if not isinstance(arguments, dict):
                    raise ValueError("arguments must be an object")
                calls.append(
                    ToolCall(id=call.id, name=call.function.name, arguments=arguments)
                )
        except (ValueError, AttributeError, TypeError) as exc:
            raise ModelProtocolError("invalid model tool arguments") from exc
        if len({c.id for c in calls}) != len(calls):
            raise ModelProtocolError("duplicate model tool call IDs")
        usage = response.usage
        if usage is None:
            return ModelTurn(assistant_message=raw, calls=calls, usage_known=False)
        cached = getattr(usage, "prompt_cache_hit_tokens", 0) or 0
        if not (0 <= cached <= usage.prompt_tokens and usage.completion_tokens >= 0):
            raise ModelProtocolError("invalid model usage")
        return ModelTurn(
            assistant_message=raw,
            calls=calls,
            input_tokens=usage.prompt_tokens,
            cached_input_tokens=cached,
            output_tokens=usage.completion_tokens,
            usage_known=True,
        )
