import httpx
import pytest

from app.agent.deepseek import DeepSeekClient, ModelProtocolError, UpstreamUnavailable


def payload(arguments='{"path":"README.md"}', usage=True):
    data = {
        "id": "chat-test",
        "object": "chat.completion",
        "created": 1,
        "model": "deepseek-flash",
        "choices": [
            {
                "index": 0,
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "content": None,
                    "reasoning_content": "检查依赖",
                    "tool_calls": [
                        {
                            "id": "call-1",
                            "type": "function",
                            "function": {"name": "read_file", "arguments": arguments},
                        }
                    ],
                },
            }
        ],
    }
    if usage:
        data["usage"] = {
            "prompt_tokens": 20,
            "completion_tokens": 5,
            "total_tokens": 25,
            "prompt_cache_hit_tokens": 10,
        }
    return data


@pytest.mark.asyncio
async def test_preserves_reasoning_tool_ids_and_actual_usage():
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload()))
    async with DeepSeekClient(api_key="test-only", transport=transport) as client:
        turn = await client.complete(
            [{"role": "user", "content": "运行"}], [], "deepseek-flash"
        )
    assert turn.assistant_message["reasoning_content"] == "检查依赖"
    assert turn.calls[0].id == "call-1"
    assert (turn.input_tokens, turn.cached_input_tokens, turn.output_tokens) == (
        20,
        10,
        5,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,expected_calls", [(429, 3), (401, 1), (402, 1), (503, 3)]
)
async def test_provider_errors_are_bounded_and_not_user_quota(status, expected_calls):
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(
            status,
            json={
                "error": {
                    "message": "provider unavailable",
                    "type": "provider_error",
                    "code": str(status),
                }
            },
        )

    async with DeepSeekClient(
        api_key="test-only", transport=httpx.MockTransport(respond), retry_delay=0
    ) as client:
        with pytest.raises(UpstreamUnavailable):
            await client.complete(
                [{"role": "user", "content": "test"}], [], "deepseek-flash"
            )
    assert len(requests) == expected_calls


@pytest.mark.asyncio
async def test_bad_tool_arguments_are_not_implementation_success():
    async with DeepSeekClient(
        api_key="test-only",
        transport=httpx.MockTransport(
            lambda r: httpx.Response(200, json=payload("[]"))
        ),
    ) as client:
        with pytest.raises(ModelProtocolError):
            await client.complete([], [], "deepseek-flash")


@pytest.mark.asyncio
async def test_missing_usage_is_unknown_instead_of_free():
    async with DeepSeekClient(
        api_key="test-only",
        transport=httpx.MockTransport(
            lambda r: httpx.Response(200, json=payload(usage=False))
        ),
    ) as client:
        turn = await client.complete([], [], "deepseek-flash")
    assert turn.usage_known is False
