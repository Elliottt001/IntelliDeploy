"""Integer quota ledger. Caller commits the transaction, including its business state."""

from sqlalchemy import func, or_, select
from fastapi import HTTPException

from app.billing.models import (
    QuotaGrant,
    Reservation,
    ReservationAllocation,
    UsageEntry,
)
from app.billing.pricing import resolve_price
from app.models.user import User


class InsufficientQuota(HTTPException):
    def __init__(self):
        super().__init__(
            402,
            {
                "code": "QUOTA_INSUFFICIENT",
                "message": "可用额度不足，请补充后继续",
                "retryable": False,
            },
        )


class LedgerConflict(HTTPException):
    def __init__(self):
        super().__init__(
            409,
            {
                "code": "LEDGER_CONFLICT",
                "message": "该用量标识对应了不同操作",
                "retryable": False,
            },
        )


def lock_account(session, payer_id):
    if (
        session.scalar(select(User.id).where(User.id == payer_id).with_for_update())
        is None
    ):
        raise LedgerConflict()


def balance(session, payer_id):
    now = session.scalar(select(func.now()))
    grants = list(
        session.scalars(select(QuotaGrant).where(QuotaGrant.payer_id == payer_id))
    )
    return {
        "available_units": sum(
            g.balance_units - g.reserved_units
            for g in grants
            if g.expires_at is None or g.expires_at > now
        ),
        "reserved_units": sum(g.reserved_units for g in grants),
    }


def grant(session, payer_id, grant_key, units, source, expires_at=None):
    if units <= 0 or source not in {"FREE", "SUBSCRIPTION", "PURCHASE", "REFUND"}:
        raise ValueError("positive grant and recognized source required")
    lock_account(session, payer_id)
    existing = session.scalar(
        select(QuotaGrant).where(
            QuotaGrant.payer_id == payer_id, QuotaGrant.grant_key == grant_key
        )
    )
    if existing:
        if (existing.units, existing.source, existing.expires_at) != (
            units,
            source,
            expires_at,
        ):
            raise LedgerConflict()
        return existing
    result = QuotaGrant(
        payer_id=payer_id,
        grant_key=grant_key,
        units=units,
        balance_units=units,
        source=source,
        expires_at=expires_at,
    )
    session.add(result)
    session.flush()
    return result


def grant_period(
    session, payer_id, policy_version, units, period_start, period_end, source
):
    if (
        period_start.tzinfo is None
        or period_end.tzinfo is None
        or period_end <= period_start
    ):
        raise ValueError("a valid timezone-aware period is required")
    key = f"period:{source}:{policy_version}:{period_start.isoformat()}"
    return grant(session, payer_id, key, units, source, period_end)


def reserve(session, payer_id, operation_id, max_units):
    if max_units <= 0:
        raise ValueError("positive reservation required")
    lock_account(session, payer_id)
    existing = session.scalar(
        select(Reservation).where(Reservation.operation_id == operation_id)
    )
    if existing:
        if existing.payer_id != payer_id or existing.max_units != max_units:
            raise LedgerConflict()
        return existing
    grants = list(
        session.scalars(
            select(QuotaGrant)
            .where(
                QuotaGrant.payer_id == payer_id,
                or_(
                    QuotaGrant.expires_at.is_(None), QuotaGrant.expires_at > func.now()
                ),
            )
            .order_by(
                QuotaGrant.expires_at.asc().nulls_last(),
                QuotaGrant.created_at,
                QuotaGrant.id,
            )
            .with_for_update()
        )
    )
    if sum(g.balance_units - g.reserved_units for g in grants) < max_units:
        raise InsufficientQuota()
    result = Reservation(
        payer_id=payer_id, operation_id=operation_id, max_units=max_units
    )
    session.add(result)
    session.flush()
    remaining = max_units
    for index, g in enumerate(grants):
        amount = min(remaining, g.balance_units - g.reserved_units)
        if amount:
            g.reserved_units += amount
            session.add(
                ReservationAllocation(
                    reservation_id=result.id,
                    grant_id=g.id,
                    remaining_units=amount,
                    sequence=index,
                )
            )
            remaining -= amount
        if not remaining:
            break
    session.flush()
    return result


def record_usage(session, usage):
    if usage.units < 0:
        raise ValueError("provider usage cannot be negative")
    lock_account(session, usage.payer_id)
    existing = session.scalar(
        select(UsageEntry).where(UsageEntry.operation_id == usage.operation_id)
    )
    if existing:
        if (
            existing.payer_id,
            existing.kind,
            existing.units,
            existing.price_version,
        ) != (usage.payer_id, usage.kind, usage.units, usage.price_version):
            raise LedgerConflict()
        return existing
    numerator, denominator = resolve_price(usage.kind, usage.price_version, session)
    cost = (usage.units * numerator + denominator - 1) // denominator
    standalone = usage.reservation_operation_id is None
    parent = None
    if cost or not standalone:
        parent = (
            reserve(
                session, usage.payer_id, "usage:" + usage.operation_id, max(1, cost)
            )
            if standalone
            else session.scalar(
                select(Reservation)
                .where(Reservation.operation_id == usage.reservation_operation_id)
                .with_for_update()
            )
        )
        if (
            parent is None
            or parent.payer_id != usage.payer_id
            or parent.status != "OPEN"
        ):
            raise LedgerConflict()
        if parent.used_units + cost > parent.max_units:
            raise InsufficientQuota()
    consumed = []
    remaining = cost
    allocations = (
        list(
            session.scalars(
                select(ReservationAllocation)
                .where(ReservationAllocation.reservation_id == parent.id)
                .order_by(ReservationAllocation.sequence)
            )
        )
        if parent
        else []
    )
    for allocation in allocations:
        amount = min(remaining, allocation.remaining_units)
        if amount:
            g = session.get(QuotaGrant, allocation.grant_id)
            g.balance_units -= amount
            g.reserved_units -= amount
            allocation.remaining_units -= amount
            consumed.append({"grant_id": g.id, "units": amount})
            remaining -= amount
    if remaining:
        raise InsufficientQuota()
    if parent:
        parent.used_units += cost
    result = UsageEntry(
        operation_id=usage.operation_id,
        payer_id=usage.payer_id,
        reservation_id=parent.id if parent else None,
        kind=usage.kind,
        units=usage.units,
        cost_units=cost,
        price_version=usage.price_version,
        metadata_json=usage.metadata,
        allocations=consumed,
    )
    session.add(result)
    session.flush()
    if standalone and parent:
        settle(session, parent.operation_id)
    return result


def settle(session, operation_id):
    parent = session.scalar(
        select(Reservation).where(Reservation.operation_id == operation_id)
    )
    if parent is None:
        raise LedgerConflict()
    lock_account(session, parent.payer_id)
    session.refresh(parent)
    if parent.status == "SETTLED":
        return parent
    for allocation in session.scalars(
        select(ReservationAllocation).where(
            ReservationAllocation.reservation_id == parent.id
        )
    ):
        g = session.get(QuotaGrant, allocation.grant_id)
        g.reserved_units -= allocation.remaining_units
        allocation.remaining_units = 0
    parent.status = "SETTLED"
    session.flush()
    return parent


def refund(session, operation_id, units, reason):
    original = session.scalar(
        select(UsageEntry).where(UsageEntry.operation_id == operation_id)
    )
    if (
        original is None
        or original.cost_units <= 0
        or units <= 0
        or units > original.cost_units
    ):
        raise LedgerConflict()
    lock_account(session, original.payer_id)
    existing = session.scalar(
        select(UsageEntry).where(UsageEntry.reversal_of == original.id)
    )
    if existing:
        if (
            existing.cost_units != -units
            or existing.metadata_json.get("reason") != reason
        ):
            raise LedgerConflict()
        return existing
    remaining = units
    for allocation in original.allocations:
        amount = min(remaining, allocation["units"])
        session.get(QuotaGrant, allocation["grant_id"]).balance_units += amount
        remaining -= amount
    reversal = UsageEntry(
        operation_id="refund:" + operation_id,
        payer_id=original.payer_id,
        kind="refund",
        units=-units,
        cost_units=-units,
        price_version=original.price_version,
        metadata_json={"reason": reason},
        reversal_of=original.id,
    )
    session.add(reversal)
    session.flush()
    return reversal
