from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.billing.ledger import balance
from app.billing.models import ProductSku, Subscription, UsageEntry
from app.config import settings
from app.core.types import (
    QuotaBalance,
    QuotaPolicy,
    QuotaSku,
    QuotaUsage,
    QuotaUsagePage,
    SubscriptionInfo,
)
from app.database import get_db
from app.models.user import User
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/quota", tags=["quota"])


@router.get("/policy", response_model=QuotaPolicy)
def policy(user: User = Depends(get_current_user)):
    return QuotaPolicy(
        default_budget_units=settings.DEFAULT_BUDGET_UNITS,
        hard_cap_units=settings.HARD_CAP_UNITS,
        price_version=settings.PRICE_VERSION,
        failed_usage_rule=settings.FAILED_USAGE_RULE,
    )


@router.get("/balance", response_model=QuotaBalance)
def get_balance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return balance(db, user.id)


@router.get("/usage", response_model=QuotaUsagePage)
def usage(
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(UsageEntry).where(UsageEntry.payer_id == user.id)
    if cursor:
        query = query.where(UsageEntry.id > cursor)
    rows = list(db.scalars(query.order_by(UsageEntry.id).limit(limit + 1)))
    return QuotaUsagePage(
        items=[
            QuotaUsage(
                id=r.id,
                kind=r.kind,
                units=r.units,
                cost_units=r.cost_units,
                price_version=r.price_version,
                created_at=r.created_at,
            )
            for r in rows[:limit]
        ],
        next_cursor=rows[limit - 1].id if len(rows) > limit else None,
    )


@router.get("/skus", response_model=list[QuotaSku])
def skus(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [
        QuotaSku(
            id=r.id,
            name=r.name,
            provider=r.provider,
            currency=r.currency,
            amount_minor=r.amount_minor,
            units=r.units,
            period=r.period,
        )
        for r in db.scalars(select(ProductSku).where(ProductSku.enabled.is_(True)))
    ]


@router.get("/subscription", response_model=SubscriptionInfo | None)
def subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.scalar(
        select(Subscription)
        .where(Subscription.payer_id == user.id)
        .order_by(Subscription.period_end.desc())
        .limit(1)
    )
    return (
        SubscriptionInfo(
            id=row.id,
            sku_id=row.sku_id,
            provider=row.provider,
            status=row.status,
            period_end=row.period_end,
            cancelled=row.cancelled,
        )
        if row
        else None
    )
