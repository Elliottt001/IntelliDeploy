from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.apps.models import Instance
from app.billing.ledger import InsufficientQuota, record_usage, reserve, settle
from app.billing.models import Reservation, ResourceMeterWindow, UnknownUsage
from app.billing.pricing import resolve_price
from app.core.types import ResourceWindow, UsageInput
from app.database import SessionLocal
from app.runtime.operations import OperationConflict, _enqueue_instance_operation
from app.runtime.reconcile import collect_resource_window


STORAGE_UNFUNDED = object()


def _window_key(window: ResourceWindow) -> str:
    return f"{window.instance_id}:{window.window_start.isoformat()}:resource"


def _window_cost(session, window: ResourceWindow) -> int:
    compute_price = resolve_price("runtime.compute", window.price_version, session)
    storage_price = resolve_price("runtime.storage", window.price_version, session)
    compute_cost = 0
    if window.compute_units:
        compute_cost = (
            window.compute_units * compute_price[0] + compute_price[1] - 1
        ) // compute_price[1]
    storage_cost = 0
    if window.storage_units:
        storage_cost = (
            window.storage_units * storage_price[0] + storage_price[1] - 1
        ) // storage_price[1]
    return compute_cost + storage_cost


def _allocated_window(instance: Instance, window_start: datetime) -> ResourceWindow:
    window_start = window_start.astimezone(timezone.utc).replace(second=0, microsecond=0)
    window_end = window_start + timedelta(minutes=1)
    services = (instance.resource_spec or {}).get("services") or []
    allocated = sum(
        int(service.get("cpu_millis") or 0) + int(service.get("memory_mb") or 0)
        for service in services
    )
    storage_mb = int((instance.resource_spec or {}).get("storage_mb") or 0)
    return ResourceWindow(
        instance_id=instance.id,
        window_start=window_start,
        window_end=window_end,
        compute_state="RUNNING",
        compute_units=allocated * 60,
        storage_units=storage_mb * 60,
        price_version=instance.price_version,
        evidence_ref=f"start:{instance.id}:{window_start.isoformat()}",
    )


def _reserve_window(session, instance: Instance, window: ResourceWindow):
    operation_id = f"resource-window:{_window_key(window)}"
    existing = session.scalar(
        select(Reservation).where(Reservation.operation_id == operation_id)
    )
    if existing is not None:
        if existing.payer_id != instance.owner_id:
            raise RuntimeError("runtime reservation owner mismatch")
        return existing
    return reserve(session, instance.owner_id, operation_id, max(1, _window_cost(session, window)))


def _save_reserved_window(
    session,
    instance: Instance,
    window: ResourceWindow,
    reservation_operation_id: str,
):
    row = session.scalar(
        select(ResourceMeterWindow).where(
            ResourceMeterWindow.instance_id == window.instance_id,
            ResourceMeterWindow.window_start == window.window_start,
            ResourceMeterWindow.kind == "resource",
        )
    )
    if row is None:
        row = ResourceMeterWindow(
            instance_id=instance.id,
            payer_id=instance.owner_id,
            kind="resource",
            window_start=window.window_start,
            window_end=window.window_end,
            compute_state=window.compute_state,
            compute_units=window.compute_units,
            storage_units=window.storage_units,
            price_version=window.price_version,
            status="RESERVED",
            evidence_ref=window.evidence_ref,
            reservation_operation_id=reservation_operation_id,
        )
        session.add(row)
    elif row.status in {"PENDING", "RESERVED"}:
        row.reservation_operation_id = reservation_operation_id
    session.flush()
    return row


def reserve_start_window(session, instance: Instance):
    window = _allocated_window(instance, datetime.now(timezone.utc))
    reservation = _reserve_window(session, instance, window)
    _save_reserved_window(session, instance, window, reservation.operation_id)
    return reservation


def save_pending_window(session, window_key: str, window: ResourceWindow, payer_id: int):
    existing = session.scalar(
        select(ResourceMeterWindow).where(
            ResourceMeterWindow.instance_id == window.instance_id,
            ResourceMeterWindow.window_start == window.window_start,
            ResourceMeterWindow.kind == "resource",
        )
    )
    if existing is None:
        existing = ResourceMeterWindow(
            instance_id=window.instance_id,
            payer_id=payer_id,
            kind="resource",
            window_start=window.window_start,
            window_end=window.window_end,
            compute_state=window.compute_state,
            compute_units=window.compute_units,
            storage_units=window.storage_units,
            price_version=window.price_version,
            status="UNKNOWN",
            evidence_ref=window.evidence_ref,
        )
        session.add(existing)
    else:
        existing.window_end = window.window_end
        existing.compute_state = window.compute_state
        existing.compute_units = window.compute_units
        existing.storage_units = window.storage_units
        existing.status = "UNKNOWN"
        existing.evidence_ref = window.evidence_ref
        if existing.reservation_operation_id:
            reservation = session.scalar(
                select(Reservation).where(
                    Reservation.operation_id == existing.reservation_operation_id
                )
            )
            if reservation is not None and reservation.status == "OPEN":
                settle(session, reservation.operation_id)
    unknown = session.scalar(select(UnknownUsage).where(UnknownUsage.operation_id == window_key))
    if unknown is None:
        session.add(
            UnknownUsage(
                operation_id=window_key,
                payer_id=payer_id,
                kind="runtime.resource",
                status="UNKNOWN",
                metadata_json={"evidence_ref": window.evidence_ref},
            )
        )
    session.flush()
    return existing


def reserve_next_window_or_stop(session, instance: Instance, window: ResourceWindow):
    try:
        reservation = _reserve_window(session, instance, window)
    except InsufficientQuota:
        if not window.compute_units:
            operation_id = f"unfunded-storage:{_window_key(window)}"
            unknown = session.scalar(
                select(UnknownUsage).where(UnknownUsage.operation_id == operation_id)
            )
            if unknown is None:
                session.add(
                    UnknownUsage(
                        operation_id=operation_id,
                        payer_id=instance.owner_id,
                        kind="runtime.storage",
                        status="UNFUNDED_STORAGE",
                        metadata_json={
                            "evidence_ref": window.evidence_ref,
                            "price_version": window.price_version,
                            "storage_units": window.storage_units,
                        },
                    )
                )
                session.flush()
            return STORAGE_UNFUNDED
        instance.desired_state = "STOPPED"
        instance.stop_reason = "QUOTA"
        try:
            _enqueue_instance_operation(
                session,
                instance.id,
                instance.owner_id,
                "STOP",
                f"quota-{window.window_start.isoformat()}",
            )
        except OperationConflict as exc:
            if "another instance operation is active" not in str(exc):
                raise
        return None
    _save_reserved_window(session, instance, window, reservation.operation_id)
    return reservation


def settle_observed_window(
    session,
    window_row: ResourceMeterWindow,
    window: ResourceWindow,
    reservation_operation_id: str,
):
    key = _window_key(window)
    if window.compute_units:
        record_usage(
            session,
            UsageInput(
                operation_id=f"{key}:compute",
                payer_id=window_row.payer_id,
                kind="runtime.compute",
                units=window.compute_units,
                price_version=window.price_version,
                metadata={"evidence_ref": window.evidence_ref},
                reservation_operation_id=reservation_operation_id,
            ),
        )
    if window.storage_units:
        record_usage(
            session,
            UsageInput(
                operation_id=f"{key}:storage",
                payer_id=window_row.payer_id,
                kind="runtime.storage",
                units=window.storage_units,
                price_version=window.price_version,
                metadata={"evidence_ref": window.evidence_ref},
                reservation_operation_id=reservation_operation_id,
            ),
        )
    settle(session, reservation_operation_id)
    window_row.status = "SETTLED"
    window_row.reservation_operation_id = reservation_operation_id
    session.flush()
    return window_row


async def process_resource_window(
    instance_id,
    window_start,
    window_end,
    *,
    session_factory=SessionLocal,
    adapter,
):
    with session_factory() as session:
        existing = session.scalar(
            select(ResourceMeterWindow).where(
                ResourceMeterWindow.instance_id == instance_id,
                ResourceMeterWindow.window_start == window_start,
                ResourceMeterWindow.kind == "resource",
            )
        )
        if existing is not None and existing.status in {
            "SETTLED",
            "UNKNOWN",
            "QUOTA_STOP",
            "STORAGE_UNFUNDED",
        }:
            return existing
    window = await collect_resource_window(
        instance_id,
        window_start,
        window_end,
        session_factory=session_factory,
        adapter=adapter,
    )
    key = _window_key(window)
    with session_factory() as session:
        instance = session.scalar(select(Instance).where(Instance.id == instance_id).with_for_update())
        if window.compute_state == "UNKNOWN":
            row = save_pending_window(session, key, window, instance.owner_id)
            session.commit()
            return row
        row = session.scalar(
            select(ResourceMeterWindow).where(
                ResourceMeterWindow.instance_id == instance_id,
                ResourceMeterWindow.window_start == window_start,
                ResourceMeterWindow.kind == "resource",
            )
        )
        if row is not None and row.status == "RESERVED":
            window = window.model_copy(update={"price_version": row.price_version})
            row.window_end = window.window_end
            row.compute_state = window.compute_state
            row.compute_units = window.compute_units
            row.storage_units = window.storage_units
            row.evidence_ref = window.evidence_ref
            row.status = "PENDING"
        if row is None:
            row = ResourceMeterWindow(
                instance_id=instance.id,
                payer_id=instance.owner_id,
                kind="resource",
                window_start=window.window_start,
                window_end=window.window_end,
                compute_state=window.compute_state,
                compute_units=window.compute_units,
                storage_units=window.storage_units,
                price_version=window.price_version,
                status="PENDING",
                evidence_ref=window.evidence_ref,
            )
            session.add(row)
            session.flush()
        reservation = reserve_next_window_or_stop(session, instance, window)
        if reservation is STORAGE_UNFUNDED:
            row.status = "STORAGE_UNFUNDED"
            session.commit()
            return row
        if reservation is None:
            row.status = "QUOTA_STOP"
            session.commit()
            return row
        settle_observed_window(session, row, window, reservation.operation_id)
        if window.compute_state == "RUNNING":
            next_window = window.model_copy(
                update={
                    "window_start": window.window_end,
                    "window_end": window.window_end + timedelta(minutes=1),
                    "price_version": instance.price_version,
                    "evidence_ref": f"advance:{window.evidence_ref}",
                }
            )
            reserve_next_window_or_stop(session, instance, next_window)
        session.commit()
        return row

