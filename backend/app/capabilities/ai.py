"""Metered application chat capability using the shared DeepSeek client."""

from __future__ import annotations

from openai import APIConnectionError

from app.agent.deepseek import DeepSeekClient, UpstreamUnavailable
from app.billing.ledger import record_usage, settle
from app.capabilities.search import (
    CapabilityUpstreamUnavailable,
    _fingerprint,
    _load_replay,
    _NO_REPLAY,
    _operation_lock,
    _reservation_id,
    _reserve_operation,
    _result_id,
    _validate_operation_id,
    save_unknown_usage,
    finish_capability_reservation,
    lock_shared_job,
)
from app.config import settings
from app.core.types import CapabilityContext, UsageInput
from app.database import SessionLocal


_session_factory = SessionLocal
_transport = None


def _usage_operation_id(operation_id: str, suffix: str) -> str:
    if suffix == "output":
        return _result_id(operation_id)
    return f"capability:{operation_id}:{suffix}"


async def chat(
    context: CapabilityContext,
    messages: list[dict],
    model: str,
    operation_id: str,
) -> dict:
    _validate_operation_id(operation_id)
    async with _operation_lock(operation_id, _session_factory):
        return await _chat(context, messages, model, operation_id)


async def _chat(
    context: CapabilityContext,
    messages: list[dict],
    model: str,
    operation_id: str,
) -> dict:
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must not be empty")
    if not isinstance(model, str) or not 1 <= len(model) <= 128:
        raise ValueError("model must contain 1..128 characters")
    payload = {"messages": messages, "model": model}
    request_hash = _fingerprint("chat", context, payload)
    price_kinds = (
        "model.flash.input",
        "model.flash.cached_input",
        "model.flash.output",
    )
    if not settings.DEEPSEEK_API_KEY:
        raise CapabilityUpstreamUnavailable("模型服务尚未配置")
    replay = _reserve_operation(
        context,
        operation_id,
        request_hash,
        price_kinds,
        session_factory=_session_factory,
    )
    if replay is not _NO_REPLAY:
        return replay
    try:
        async with DeepSeekClient(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
            transport=_transport,
            retry_delay=settings.CAPABILITY_RETRY_DELAY_SECONDS,
        ) as client:
            turn = await client.complete(messages, [], model)
    except UpstreamUnavailable as exc:
        if isinstance(exc.__cause__, APIConnectionError):
            save_unknown_usage(
                context,
                operation_id,
                "model.chat",
                request_hash,
                session_factory=_session_factory,
            )
        else:
            save_unknown_usage(
                context,
                operation_id,
                "model.chat",
                request_hash,
                session_factory=_session_factory,
                status="FAILED",
                error_message=str(exc),
            )
        raise CapabilityUpstreamUnavailable(str(exc)) from exc

    response = dict(turn.assistant_message)
    if not turn.usage_known:
        save_unknown_usage(
            context,
            operation_id,
            "model.chat",
            request_hash,
            response=response,
            session_factory=_session_factory,
        )
        return response

    usages = (
        (
            "input",
            "model.flash.input",
            max(0, turn.input_tokens - turn.cached_input_tokens),
        ),
        ("cached_input", "model.flash.cached_input", turn.cached_input_tokens),
        ("output", "model.flash.output", turn.output_tokens),
    )
    with _session_factory() as session:
        lock_shared_job(session,context)
        replay = _load_replay(session, operation_id, request_hash)
        if replay is not _NO_REPLAY:
            return replay
        for suffix, kind, units in usages:
            record_usage(
                session,
                UsageInput(
                    operation_id=_usage_operation_id(operation_id, suffix),
                    payer_id=context.payer_id,
                    kind=kind,
                    units=units,
                    price_version=settings.PRICE_VERSION,
                    metadata={
                        "request_hash": request_hash,
                        "response": response,
                    },
                    reservation_operation_id=context.reservation_operation_id or _reservation_id(operation_id),
                ),
            )
        finish_capability_reservation(session,context,operation_id)
        session.commit()
    return response
