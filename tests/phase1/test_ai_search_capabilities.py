import json

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.billing.ledger import LedgerConflict, balance, grant
from app.billing.models import PriceRule, UnknownUsage, UsageEntry
from app.core.types import CapabilityContext, Checkpoint, ModelTurn, ToolCall, ToolResult
from app.models.user import User


PRICE_KINDS = (
    "search.success",
    "fetch.success",
    "model.flash.input",
    "model.flash.cached_input",
    "model.flash.output",
)


@pytest.fixture
def capability_account(session_factory):
    with session_factory() as session:
        user = User(
            username="capability-payer",
            email="capability-payer@test",
            hashed_password="test-only",
        )
        session.add(user)
        session.flush()
        grant(session, user.id, "capability-budget", 1000, "PURCHASE")
        session.add_all(
            PriceRule(kind=kind, version="test-v1", numerator=1, denominator=1)
            for kind in PRICE_KINDS
        )
        session.commit()
        return user.id


@pytest.fixture
def capability_context(capability_account):
    return CapabilityContext(
        app_id="app-capability",
        instance_id="instance-capability",
        user_id=999999,
        payer_id=capability_account,
    )


def configure_search(monkeypatch, session_factory, transport):
    from app.capabilities import search as search_module

    monkeypatch.setattr(search_module, "_session_factory", session_factory)
    monkeypatch.setattr(search_module, "_transport", transport)
    monkeypatch.setattr(search_module.settings, "DEEPSEEK_API_KEY", "test-only")
    monkeypatch.setattr(search_module.settings, "PRICE_VERSION", "test-v1")
    monkeypatch.setattr(search_module.settings, "CAPABILITY_RESERVATION_UNITS", 100)
    monkeypatch.setattr(search_module.settings, "CAPABILITY_RETRY_DELAY_SECONDS", 0)
    return search_module


def configure_ai(monkeypatch, session_factory, transport):
    from app.capabilities import ai as ai_module

    monkeypatch.setattr(ai_module, "_session_factory", session_factory)
    monkeypatch.setattr(ai_module, "_transport", transport)
    monkeypatch.setattr(ai_module.settings, "DEEPSEEK_API_KEY", "test-only")
    monkeypatch.setattr(ai_module.settings, "PRICE_VERSION", "test-v1")
    monkeypatch.setattr(ai_module.settings, "CAPABILITY_RESERVATION_UNITS", 100)
    return ai_module


@pytest.mark.asyncio
async def test_search_preserves_sources_and_bills_empty_results(
    monkeypatch, session_factory, capability_context
):
    requests = []
    payloads = [
        {
            "results": [
                {
                    "title": "资料",
                    "url": "https://example.org/source",
                    "summary": "摘要",
                    "content": "原文",
                }
            ],
            "usage": {"billable_requests": 1},
        },
        {"results": [], "usage": {"billable_requests": 1}},
    ]

    def respond(request):
        requests.append(request)
        return httpx.Response(200, json=payloads[len(requests) - 1])

    module = configure_search(
        monkeypatch, session_factory, httpx.MockTransport(respond)
    )
    sourced = await module.search(capability_context, "资料", "search-source", 5)
    empty = await module.search(capability_context, "梦境研究", "search-empty", 3)

    assert sourced == [
        {
            "title": "资料",
            "url": "https://example.org/source",
            "summary": "摘要",
            "content": "原文",
        }
    ]
    assert empty == []
    assert [request.url.path for request in requests] == [
        "/v1/tools/search",
        "/v1/tools/search",
    ]
    assert json.loads(requests[0].content) == {
        "query": "资料",
        "count": 5,
        "need_content": True,
    }
    with session_factory() as session:
        entries = list(
            session.scalars(
                select(UsageEntry)
                .where(UsageEntry.kind == "search.success")
                .order_by(UsageEntry.operation_id)
            )
        )
        assert [(entry.payer_id, entry.units) for entry in entries] == [
            (capability_context.payer_id, 1),
            (capability_context.payer_id, 1),
        ]
        assert balance(session, capability_context.payer_id) == {
            "available_units": 998,
            "reserved_units": 0,
        }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query,count",
    [("", 5), ("x" * 129, 5), ("valid", 0), ("valid", 51)],
)
async def test_search_rejects_query_and_count_boundaries(
    monkeypatch, session_factory, capability_context, query, count
):
    requests = []
    module = configure_search(
        monkeypatch,
        session_factory,
        httpx.MockTransport(lambda request: requests.append(request)),
    )
    with pytest.raises(ValueError):
        await module.search(capability_context, query, "invalid-search", count)
    assert requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.org/file",
        "https://user:secret@example.org/private",
        "https://example.org:bad/path",
    ],
)
async def test_fetch_rejects_non_http_or_credential_urls(
    monkeypatch, session_factory, capability_context, url
):
    requests = []
    module = configure_search(
        monkeypatch,
        session_factory,
        httpx.MockTransport(lambda request: requests.append(request)),
    )
    with pytest.raises(ValueError):
        await module.fetch(capability_context, url, "invalid-fetch")
    assert requests == []


@pytest.mark.asyncio
async def test_search_operation_id_is_idempotent_and_content_bound(
    monkeypatch, session_factory, capability_context
):
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "title": "资料",
                        "url": "https://example.org",
                        "summary": "摘要",
                        "content": "原文",
                    }
                ],
                "usage": {"billable_requests": 1},
            },
        )

    module = configure_search(
        monkeypatch, session_factory, httpx.MockTransport(respond)
    )
    first = await module.search(capability_context, "资料", "same-search")
    replay = await module.search(capability_context, "资料", "same-search")
    assert replay == first
    assert len(requests) == 1

    with pytest.raises(LedgerConflict):
        await module.search(capability_context, "不同资料", "same-search")
    assert len(requests) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,expected_calls", [(401, 1), (402, 1), (429, 3), (503, 3)]
)
async def test_search_provider_failures_are_bounded_upstream_errors(
    monkeypatch,
    session_factory,
    capability_context,
    status,
    expected_calls,
):
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(status, json={"error": {"message": "provider failed"}})

    module = configure_search(
        monkeypatch, session_factory, httpx.MockTransport(respond)
    )
    with pytest.raises(module.CapabilityUpstreamUnavailable) as error:
        await module.search(capability_context, "资料", f"provider-{status}")
    assert error.value.status_code == 503
    assert error.value.detail["code"] == "UPSTREAM_UNAVAILABLE"
    assert len(requests) == expected_calls
    with session_factory() as session:
        assert balance(session, capability_context.payer_id)["reserved_units"] == 0


@pytest.mark.asyncio
async def test_success_without_provider_usage_is_unknown_not_free(
    monkeypatch, session_factory, capability_context
):
    module = configure_search(
        monkeypatch,
        session_factory,
        httpx.MockTransport(
            lambda request: httpx.Response(200, json={"results": []})
        ),
    )
    assert await module.search(capability_context, "资料", "unknown-search") == []
    with session_factory() as session:
        unknown = session.scalar(select(UnknownUsage))
        assert (unknown.payer_id, unknown.kind, unknown.status) == (
            capability_context.payer_id,
            "search.success",
            "UNKNOWN",
        )
        assert list(session.scalars(select(UsageEntry))) == []
        assert balance(session, capability_context.payer_id) == {
            "available_units": 1000,
            "reserved_units": 0,
        }


@pytest.mark.asyncio
async def test_missing_price_rejects_before_provider_call(
    monkeypatch, session_factory, capability_context
):
    requests = []
    with session_factory() as session:
        session.query(PriceRule).filter(PriceRule.kind == "search.success").delete()
        session.commit()
    module = configure_search(
        monkeypatch,
        session_factory,
        httpx.MockTransport(lambda request: requests.append(request)),
    )
    with pytest.raises(HTTPException) as error:
        await module.search(capability_context, "资料", "no-price")
    assert error.value.status_code == 503
    assert error.value.detail["code"] == "PRICE_UNAVAILABLE"
    assert requests == []


def chat_payload(*, usage=True):
    payload = {
        "id": "chat-capability",
        "object": "chat.completion",
        "created": 1,
        "model": "deepseek-flash",
        "choices": [
            {
                "index": 0,
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "可信回答",
                    "reasoning_content": "内部推理",
                },
            }
        ],
    }
    if usage:
        payload["usage"] = {
            "prompt_tokens": 7,
            "completion_tokens": 2,
            "total_tokens": 9,
            "prompt_cache_hit_tokens": 3,
        }
    return payload


@pytest.mark.asyncio
async def test_chat_uses_deepseek_usage_and_trusted_payer(
    monkeypatch, session_factory, capability_context
):
    module = configure_ai(
        monkeypatch,
        session_factory,
        httpx.MockTransport(
            lambda request: httpx.Response(200, json=chat_payload())
        ),
    )
    result = await module.chat(
        capability_context,
        [{"role": "user", "content": "回答"}],
        "deepseek-flash",
        "chat-once",
    )
    assert result["content"] == "可信回答"
    assert "api_key" not in json.dumps(result).lower()
    with session_factory() as session:
        entries = list(
            session.scalars(select(UsageEntry).order_by(UsageEntry.kind))
        )
        assert [(entry.kind, entry.units, entry.payer_id) for entry in entries] == [
            ("model.flash.cached_input", 3, capability_context.payer_id),
            ("model.flash.input", 4, capability_context.payer_id),
            ("model.flash.output", 2, capability_context.payer_id),
        ]
        assert balance(session, capability_context.payer_id) == {
            "available_units": 991,
            "reserved_units": 0,
        }


@pytest.mark.asyncio
async def test_chat_missing_usage_creates_unknown_record(
    monkeypatch, session_factory, capability_context
):
    module = configure_ai(
        monkeypatch,
        session_factory,
        httpx.MockTransport(
            lambda request: httpx.Response(200, json=chat_payload(usage=False))
        ),
    )
    result = await module.chat(
        capability_context,
        [{"role": "user", "content": "回答"}],
        "deepseek-flash",
        "chat-unknown",
    )
    assert result["content"] == "可信回答"
    with session_factory() as session:
        unknown = session.scalar(select(UnknownUsage))
        assert unknown.kind == "model.chat"
        assert list(session.scalars(select(UsageEntry))) == []


@pytest.mark.asyncio
async def test_chat_rejects_empty_operation_id_before_provider_call(
    monkeypatch, session_factory, capability_context
):
    requests = []
    module = configure_ai(
        monkeypatch,
        session_factory,
        httpx.MockTransport(lambda request: requests.append(request)),
    )
    with pytest.raises(ValueError):
        await module.chat(
            capability_context,
            [{"role": "user", "content": "回答"}],
            "deepseek-flash",
            "",
        )
    assert requests == []


def test_live_web_tools_require_controlled_capability_executor(tmp_path):
    from app.agent.tools import execute_tool

    missing = execute_tool(
        str(tmp_path),
        ToolCall(id="search-call", name="web_search", arguments={"query": "资料"}),
    )
    assert missing.ok is False
    assert "能力执行器" in missing.content

    class Executor:
        def web_search(self, query, count, operation_id):
            assert (query, count, operation_id) == ("资料", 5, "search-call")
            return [{"title": "资料", "url": "https://example.org"}]

        def fetch_page(self, url, operation_id):
            assert (url, operation_id) == ("https://example.org", "fetch-call")
            return {"url": url, "content": "原文"}

    executor = Executor()
    found = execute_tool(
        str(tmp_path),
        ToolCall(id="search-call", name="web_search", arguments={"query": "资料"}),
        capability_executor=executor,
    )
    fetched = execute_tool(
        str(tmp_path),
        ToolCall(
            id="fetch-call",
            name="fetch_page",
            arguments={"url": "https://example.org"},
        ),
        capability_executor=executor,
    )
    assert json.loads(found.content)[0]["url"] == "https://example.org"
    assert json.loads(fetched.content)["content"] == "原文"


@pytest.mark.asyncio
async def test_generation_model_receives_live_web_tool_definitions():
    from app.agent.loop import run_generation

    class Model:
        async def complete(self, messages, tools, model):
            names = {item["function"]["name"] for item in tools}
            assert {"web_search", "fetch_page"} <= names
            return ModelTurn(
                assistant_message={"role": "assistant", "content": "完成"}
            )

    async def unused_tool(call):
        return ToolResult(call_id=call.id, ok=False, content="unused")

    result = await run_generation(
        "web-tools",
        Checkpoint(),
        Model(),
        unused_tool,
        lambda checkpoint: None,
        lambda usage: None,
    )
    assert result.exhausted is True


def test_capability_chat_route_never_returns_platform_key(
    monkeypatch, api_client, capability_context
):
    from app.capabilities import router as capability_router
    from app.main import app

    async def fake_chat(context, messages, model, operation_id):
        assert context == capability_context
        return {"role": "assistant", "content": "回答"}

    app.dependency_overrides[capability_router.capability_context] = (
        lambda: capability_context
    )
    monkeypatch.setattr(capability_router, "chat", fake_chat)
    try:
        response = api_client.post(
            "/api/capabilities/chat",
            json={
                "messages": [{"role": "user", "content": "问题"}],
                "model": "deepseek-flash",
                "operation_id": "route-chat",
            },
        )
        rejected = api_client.post(
            "/api/capabilities/chat",
            json={
                "messages": [{"role": "user", "content": "问题"}],
                "model": "deepseek-flash",
                "operation_id": "route-chat-with-payer",
                "payer_id": 123456,
            },
        )
    finally:
        app.dependency_overrides.pop(capability_router.capability_context, None)
    assert response.status_code == 200
    assert response.json() == {"role": "assistant", "content": "回答"}
    assert "key" not in response.text.lower()
    assert rejected.status_code == 422
