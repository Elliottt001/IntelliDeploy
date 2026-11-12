from typing import Annotated
from fastapi import APIRouter, Depends, Query, Header, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.billing.ledger import balance
from app.billing.catalog import list_enabled_skus
from app.billing.models import PaymentOrder, Subscription, UsageEntry
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
from app.billing import orders
from app.core.types import CreateOrderRequest, PaymentOrderInfo

router = APIRouter(prefix="/api/quota", tags=["quota"])
Key = Annotated[str, Header(alias='Idempotency-Key', min_length=1, max_length=128)]


def order_response(order):
    refunds = [row for row in (order.audit or {}).values() if row.get('kind') == 'REFUND']
    return PaymentOrderInfo(order_id=order.id, status=order.status, provider=order.provider,
        name=order.sku_snapshot['name'], currency=order.currency, amount_minor=order.amount_minor,
        units=order.units, period=order.period, checkout_url=order.checkout_url, payment_url=order.payment_url,
        checkout_kind=order.checkout_kind, expires_at=order.expires_at, paid_at=order.paid_at,
        refunded_amount_minor=sum(row['amount_minor'] for row in refunds), refund_review_required=any(row['pending_units'] for row in refunds))


@router.post('/orders', response_model=PaymentOrderInfo, status_code=201)
def create_order(body: CreateOrderRequest, key: Key, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = orders.create_order(db, user.id, body.sku_id, body.provider, key)
    db.commit()
    return order_response(orders.prepare_checkout(db, order))


@router.get('/orders/{order_id}', response_model=PaymentOrderInfo)
def get_order(order_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = orders.owned_order(db, order_id, user.id)
    return order_response(orders.reconcile_order(db, order))


@router.get('/orders', response_model=list[PaymentOrderInfo])
def order_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(PaymentOrder).where(PaymentOrder.user_id == user.id).order_by(PaymentOrder.created_at.desc(), PaymentOrder.id.desc()).limit(50))
    return [order_response(order) for order in rows]


@router.post('/payments/alipay/notify', response_class=PlainTextResponse)
async def alipay_notice(request: Request, db: Session = Depends(get_db)):
    from app.billing.alipay import parse_notification, verify_notification, _amount
    pairs = list((await request.form()).multi_items())
    if len({key for key, _ in pairs}) != len(pairs):
        raise orders.PaymentMismatch()
    data = dict(pairs)
    verify_notification(data)
    if data.get('trade_status') == 'TRADE_CLOSED':
        order = db.get(PaymentOrder, data.get('out_trade_no'))
        if not order or order.provider != 'alipay':
            raise orders.PaymentMismatch()
        orders.close_order(db, order, data['notify_id'])
    else:
        order = orders.apply_payment(db, parse_notification(data))
    refunded = _amount(data.get('refund_fee', '0'), allow_zero=True)
    if refunded:
        if order.transaction_id != data.get('trade_no'):
            raise orders.PaymentMismatch()
        orders.record_refund(db, order, 'alipay-refund:' + data['notify_id'], refunded, cumulative=True)
    db.commit()
    return PlainTextResponse('success')


@router.post('/payments/wechat/notify')
async def wechat_notice(request: Request, db: Session = Depends(get_db)):
    import json
    from app.billing.wechat import parse_notification, parse_refund
    body = await request.body()
    try:
        notice = json.loads(body)
        if not isinstance(notice, dict):
            raise orders.PaymentMismatch()
        kind = notice.get('event_type')
    except ValueError as exc:
        raise orders.PaymentMismatch() from exc
    if kind == 'REFUND.SUCCESS':
        data = parse_refund(body, request.headers)
        order = db.get(PaymentOrder, data.get('out_trade_no'))
        if not order or order.provider != 'wechat' or data.get('transaction_id') != order.transaction_id or data.get('amount', {}).get('total') != order.amount_minor or data.get('amount', {}).get('currency') != order.currency:
            raise orders.PaymentMismatch()
        orders.record_refund(db, order, 'wechat-refund:' + data['refund_id'], data['amount']['refund'])
    else:
        orders.apply_payment(db, parse_notification(body, request.headers))
    db.commit()
    return {'code': 'SUCCESS', 'message': '成功'}


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
    return list_enabled_skus(db)


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
