"""Metered live search and fetch capabilities backed by DeepSeek tools."""

from __future__ import annotations

import asyncio
import hashlib
import json
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException
from sqlalchemy import select

from app.billing.ledger import LedgerConflict, record_usage, reserve, settle
from app.billing.models import UnknownUsage, UsageEntry
from app.billing.pricing import resolve_price
from app.config import settings
from app.core.types import CapabilityContext, UsageInput
from app.database import SessionLocal


_session_factory = SessionLocal
_transport = None
_NO_REPLAY = object()


class CapabilityUpstreamUnavailable(HTTPException):
    def __init__(self, message="上游能力暂时不可用"):
        super().__init__(
            503,
            {
                "code": "UPSTREAM_UNAVAILABLE",
                "message": message,
                "retryable": True,
            },
        )


class _UncertainRequest(RuntimeError):
    pass


def _reservation_id(operation_id: str) -> str:
    return f"capability:{operation_id}:reservation"


def _result_id(operation_id: str) -> str:
    return f"capability:{operation_id}:result"


def _unknown_id(operation_id: str) -> str:
    return f"capability:{operation_id}:unknown"


def _fingerprint(kind: str, context: CapabilityContext, payload: dict) -> str:
    document = {
        "kind": kind,
        "app_id": context.app_id,
        "instance_id": context.instance_id,
        "user_id": context.user_id,
        "payer_id": context.payer_id,
        "payload": payload,
    }
    encoded = json.dumps(
        document, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def _validate_operation_id(operation_id: str) -> None:
    if not isinstance(operation_id, str) or not 1 <= len(operation_id) <= 128:
        raise ValueError("operation_id must contain 1..128 characters")


def _load_replay(session, operation_id: str, request_hash: str):
    entry = session.scalar(
        select(UsageEntry).where(UsageEntry.operation_id == _result_id(operation_id))
    )
    if entry is not None:
        if entry.metadata_json.get("request_hash") != request_hash:
            raise LedgerConflict()
        return entry.metadata_json["response"]
    unknown = session.scalar(
        select(UnknownUsage).where(
            UnknownUsage.operation_id == _unknown_id(operation_id)
        )
    )
    if unknown is not None:
        if unknown.metadata_json.get("request_hash") != request_hash:
            raise LedgerConflict()
        if "response" in unknown.metadata_json:
            return unknown.metadata_json["response"]
        raise CapabilityUpstreamUnavailable("上游请求结果待核对，请稍后查询")
    return _NO_REPLAY


def _reserve_operation(
    context: CapabilityContext,
    operation_id: str,
    request_hash: str,
    price_kinds: tuple[str, ...],
    session_factory=None,
):
    factory = session_factory or _session_factory
    with factory() as session:
        replay = _load_replay(session, operation_id, request_hash)
        if replay is not _NO_REPLAY:
            return replay
        for kind in price_kinds:
            resolve_price(kind, settings.PRICE_VERSION, session)
        reserve(
            session,
            context.payer_id,
            _reservation_id(operation_id),
            settings.CAPABILITY_RESERVATION_UNITS,
        )
        session.commit()
    return _NO_REPLAY


def _release_reservation(operation_id: str, session_factory=None) -> None:
    factory = session_factory or _session_factory
    with factory() as session:
        settle(session, _reservation_id(operation_id))
        session.commit()


def save_unknown_usage(
    context: CapabilityContext,
    operation_id: str,
    kind: str,
    request_hash: str,
    *,
    status_code: int | None = None,
    response=None,
    session_factory=None,
) -> UnknownUsage:
    metadata = {"request_hash": request_hash}
    if status_code is not None:
        metadata["provider_status"] = status_code
    if response is not None:
        metadata["response"] = response
    factory = session_factory or _session_factory
    with factory() as session:
        existing = session.scalar(
            select(UnknownUsage).where(
                UnknownUsage.operation_id == _unknown_id(operation_id)
            )
        )
        if existing is not None:
            if (
                existing.payer_id != context.payer_id
                or existing.kind != kind
                or existing.metadata_json.get("request_hash") != request_hash
            ):
                raise LedgerConflict()
            return existing
        result = UnknownUsage(
            operation_id=_unknown_id(operation_id),
            payer_id=context.payer_id,
            kind=kind,
            metadata_json=metadata,
        )
        session.add(result)
        settle(session, _reservation_id(operation_id))
        session.commit()
        return result


def parse_provider_search_usage(response: httpx.Response) -> int | None:
    try:
        payload = response.json()
    except ValueError:
        return None
    usage = payload.get("usage") if isinstance(payload, dict) else None
    candidates = []
    if isinstance(usage, dict):
        candidates.extend(
            usage.get(key)
            for key in ("billable_requests", "search_requests", "fetch_requests")
        )
    if isinstance(payload, dict):
        candidates.append(payload.get("billable_requests"))
    candidates.append(response.headers.get("x-deepseek-billable-requests"))
    for value in candidates:
        if value is None or isinstance(value, bool):
            continue
        try:
            units = int(value)
        except (TypeError, ValueError):
            continue
        if units >= 0:
            return units
    return None


async def _post(path: str, payload: dict) -> httpx.Response:
    key = settings.DEEPSEEK_API_KEY
    if not key:
        raise CapabilityUpstreamUnavailable("实时搜索服务尚未配置")
    async with httpx.AsyncClient(
        base_url=settings.DEEPSEEK_BASE_URL,
        headers={"Authorization": f"Bearer {key}"},
        transport=_transport,
        timeout=settings.CAPABILITY_HTTP_TIMEOUT_SECONDS,
    ) as client:
        for attempt in range(3):
            try:
                response = await client.post(path, json=payload)
            except httpx.RequestError as exc:
                raise _UncertainRequest() from exc
            retryable = response.status_code in {408, 429} or 500 <= response.status_code < 600
            if retryable and attempt < 2:
                await asyncio.sleep(
                    settings.CAPABILITY_RETRY_DELAY_SECONDS * 2**attempt
                )
                continue
            if response.status_code >= 400:
                raise CapabilityUpstreamUnavailable()
            return response
    raise AssertionError("unreachable")


def _record_success(
    context: CapabilityContext,
    operation_id: str,
    kind: str,
    units: int,
    request_hash: str,
    response,
):
    with _session_factory() as session:
        replay = _load_replay(session, operation_id, request_hash)
        if replay is not _NO_REPLAY:
            return replay
        record_usage(
            session,
            UsageInput(
                operation_id=_result_id(operation_id),
                payer_id=context.payer_id,
                kind=kind,
                units=units,
                price_version=settings.PRICE_VERSION,
                metadata={"request_hash": request_hash, "response": response},
                reservation_operation_id=_reservation_id(operation_id),
            ),
        )
        settle(session, _reservation_id(operation_id))
        session.commit()
    return response


async def search(
    context: CapabilityContext,
    query: str,
    operation_id: str,
    count: int = 5,
) -> list[dict]:
    if not isinstance(query, str) or not 1 <= len(query) <= 128:
        raise ValueError("query must contain 1..128 characters")
    if not isinstance(count, int) or isinstance(count, bool) or not 1 <= count <= 50:
        raise ValueError("count must be between 1 and 50")
    _validate_operation_id(operation_id)
    payload = {"query": query, "count": count, "need_content": True}
    request_hash = _fingerprint("search", context, payload)
    replay = _reserve_operation(
        context, operation_id, request_hash, ("search.success",)
    )
    if replay is not _NO_REPLAY:
        return replay
    try:
        response = await _post("/v1/tools/search", payload)
    except _UncertainRequest:
        save_unknown_usage(
            context, operation_id, "search.success", request_hash
        )
        raise CapabilityUpstreamUnavailable("搜索请求结果无法确认，请稍后重试")
    except CapabilityUpstreamUnavailable:
        _release_reservation(operation_id)
        raise
    try:
        body = response.json()
        raw_results = body["results"]
        if not isinstance(raw_results, list):
            raise TypeError
        results = []
        for item in raw_results:
            if not isinstance(item, dict):
                raise TypeError
            results.append(
                {
                    field: item.get(field)
                    for field in ("title", "url", "summary", "content")
                }
            )
    except (KeyError, TypeError, ValueError):
        save_unknown_usage(
            context,
            operation_id,
            "search.success",
            request_hash,
            status_code=response.status_code,
        )
        raise CapabilityUpstreamUnavailable("搜索服务返回了无效响应")
    units = parse_provider_search_usage(response)
    if units is None:
        save_unknown_usage(
            context,
            operation_id,
            "search.success",
            request_hash,
            status_code=response.status_code,
            response=results,
        )
        return results
    return _record_success(
        context, operation_id, "search.success", units, request_hash, results
    )


async def fetch(
    context: CapabilityContext, url: str, operation_id: str
) -> dict:
    try:
        parsed = urlsplit(url)
        _ = parsed.port
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError("a valid HTTP(S) URL is required") from exc
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError("a credential-free HTTP(S) URL is required")
    _validate_operation_id(operation_id)
    payload = {"url": url}
    request_hash = _fingerprint("fetch", context, payload)
    replay = _reserve_operation(
        context, operation_id, request_hash, ("fetch.success",)
    )
    if replay is not _NO_REPLAY:
        return replay
    try:
        response = await _post("/v1/tools/fetch", payload)
    except _UncertainRequest:
        save_unknown_usage(context, operation_id, "fetch.success", request_hash)
        raise CapabilityUpstreamUnavailable("页面获取结果无法确认，请稍后重试")
    except CapabilityUpstreamUnavailable:
        _release_reservation(operation_id)
        raise
    try:
        body = response.json()
        item = body.get("result", body)
        if not isinstance(item, dict):
            raise TypeError
        result = {
            field: item.get(field)
            for field in ("title", "url", "summary", "content")
        }
    except (TypeError, ValueError):
        save_unknown_usage(
            context,
            operation_id,
            "fetch.success",
            request_hash,
            status_code=response.status_code,
        )
        raise CapabilityUpstreamUnavailable("页面获取服务返回了无效响应")
    units = parse_provider_search_usage(response)
    if units is None:
        save_unknown_usage(
            context,
            operation_id,
            "fetch.success",
            request_hash,
            status_code=response.status_code,
            response=result,
        )
        return result
    return _record_success(
        context, operation_id, "fetch.success", units, request_hash, result
    )
