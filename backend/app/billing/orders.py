"""All providers settle immutable orders through the same transactional ledger."""
import calendar
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from sqlalchemy import or_, select
from fastapi import HTTPException

from app.billing.ledger import grant, lock_account
from app.billing.models import PaymentOrder, PaymentReceipt, ProductSku, QuotaGrant, Subscription
from app.config import settings


class PaymentMismatch(HTTPException):
    def __init__(self):
        super().__init__(400, {'code': 'PAYMENT_MISMATCH', 'message': '支付签名或交易信息不匹配', 'retryable': False})


class PaymentUnavailable(HTTPException):
    def __init__(self):
        super().__init__(503, {'code': 'PAYMENT_UNAVAILABLE', 'message': '支付渠道尚未配置或结果待核对，请稍后刷新订单', 'retryable': True})


def platform_origin():
    value = settings.PAYMENT_PLATFORM_ORIGIN.rstrip('/')
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        raise PaymentUnavailable()
    return value


def notification_url(provider):
    value = settings.PAYMENT_NOTIFY_BASE_URL.rstrip('/')
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise PaymentUnavailable()
    return value + '/api/quota/payments/' + provider + '/notify'


def create_order(session, user_id, sku_id, provider, operation_id):
    lock_account(session, user_id)
    existing = session.scalar(select(PaymentOrder).where(PaymentOrder.user_id == user_id, PaymentOrder.operation_id == operation_id))
    if existing:
        if (existing.sku_id, existing.provider) != (sku_id, provider):
            raise HTTPException(409, {'code': 'IDEMPOTENCY_CONFLICT', 'message': '请求标识对应另一订单', 'retryable': False})
        return existing
    sku = session.get(ProductSku, sku_id)
    if not sku or not sku.enabled or sku.provider != provider or sku.currency not in {'CNY', 'USD'} or sku.amount_minor <= 0 or sku.units <= 0 or sku.period not in {None, 'MONTH', 'YEAR'}:
        raise PaymentMismatch()
    if provider in {'alipay', 'wechat'} and sku.currency != 'CNY':
        raise PaymentMismatch()
    snapshot = {key: getattr(sku, key) for key in ('id', 'name', 'provider', 'currency', 'amount_minor', 'units', 'period', 'stripe_price_id')}
    order = PaymentOrder(user_id=user_id, sku_id=sku_id, operation_id=operation_id, provider=provider,
        sku_snapshot=snapshot, currency=sku.currency, amount_minor=sku.amount_minor, units=sku.units,
        period=sku.period, expires_at=datetime.now(timezone.utc) + timedelta(minutes=30))
    session.add(order)
    session.flush()
    return order


def period_end(start, period):
    month = start.month % 12 + 1 if period == 'MONTH' else start.month
    year = start.year + (start.month == 12) if period == 'MONTH' else start.year + 1
    return start.replace(year=year, month=month, day=min(start.day, calendar.monthrange(year, month)[1]))


def apply_payment(session, event):
    # Lock the account before the order everywhere, including callbacks.
    order = session.get(PaymentOrder, event.order_id)
    if not order:
        raise PaymentMismatch()
    lock_account(session, order.user_id)
    order = session.scalar(select(PaymentOrder).where(PaymentOrder.id == event.order_id).with_for_update().execution_options(populate_existing=True))
    if (order.provider, order.currency, order.amount_minor) != (event.provider, event.currency, event.amount_minor) or not event.transaction_id or not event.event_id or event.paid_at.tzinfo is None:
        raise PaymentMismatch()
    receipt = session.scalar(select(PaymentReceipt).where(PaymentReceipt.provider == event.provider,
        or_(PaymentReceipt.event_id == event.event_id, PaymentReceipt.transaction_id == event.transaction_id)))
    if receipt:
        if (receipt.order_id, receipt.transaction_id, receipt.amount_minor, receipt.currency) != (order.id, event.transaction_id, event.amount_minor, event.currency):
            raise PaymentMismatch()
        return order
    if order.status == 'PAID':
        if order.transaction_id != event.transaction_id:
            raise PaymentMismatch()
        return order
    if order.status != 'CREATED':
        raise PaymentMismatch()
    if order.period:
        start = order.period_start or event.paid_at.astimezone(timezone.utc)
        end = order.period_end or period_end(start, order.period)
        grant(session, order.user_id, 'payment:' + order.id, order.units, 'SUBSCRIPTION', end)
        order.period_start, order.period_end = start, end
        if order.provider != 'stripe':
            session.add(Subscription(payer_id=order.user_id, sku_id=order.sku_id, provider=order.provider,
                status='PAID', period_start=start, period_end=end, payment_order_id=order.id))
    else:
        grant(session, order.user_id, 'payment:' + order.id, order.units, 'PURCHASE')
    session.add(PaymentReceipt(provider=event.provider, event_id=event.event_id, transaction_id=event.transaction_id,
        order_id=order.id, amount_minor=event.amount_minor, currency=event.currency))
    order.status, order.transaction_id, order.paid_at = 'PAID', event.transaction_id, event.paid_at
    session.flush()
    return order


def owned_order(session, order_id, user_id):
    order = session.scalar(select(PaymentOrder).where(PaymentOrder.id == order_id, PaymentOrder.user_id == user_id))
    if not order:
        raise HTTPException(404, '订单不存在')
    return order


def close_order(session, order, operation_id):
    lock_account(session, order.user_id)
    session.refresh(order, with_for_update=True)
    if order.status == 'CREATED':
        order.status = 'CANCELLED'
        order.audit = {**(order.audit or {}), operation_id: {'kind': 'CLOSED', 'at': datetime.now(timezone.utc).isoformat()}}


def record_refund(session, order, adjustment_id, amount_minor, *, cumulative=False):
    lock_account(session, order.user_id)
    session.refresh(order, with_for_update=True)
    if order.status != 'PAID' or type(amount_minor) is not int or amount_minor <= 0 or not adjustment_id:
        raise PaymentMismatch()
    audit = dict(order.audit or {})
    previous = audit.get(adjustment_id)
    if previous:
        if previous.get('provider_amount_minor') != amount_minor or previous.get('cumulative') != cumulative:
            raise PaymentMismatch()
        return previous
    refunds = [row for row in audit.values() if row.get('kind') == 'REFUND']
    already = sum(row['amount_minor'] for row in refunds)
    delta = amount_minor - already if cumulative else amount_minor
    if delta <= 0:
        return None  # A delayed cumulative refund must not reclaim the same units again.
    total = already + delta
    if total > order.amount_minor:
        raise PaymentMismatch()
    units = (order.units * total + order.amount_minor - 1) // order.amount_minor - sum(row['units'] for row in refunds)
    credit = session.scalar(select(QuotaGrant).where(QuotaGrant.payer_id == order.user_id, QuotaGrant.grant_key == 'payment:' + order.id).with_for_update())
    if not credit:
        raise PaymentMismatch()
    reclaimed = min(units, credit.balance_units - credit.reserved_units)
    credit.balance_units -= reclaimed
    entry = {'kind': 'REFUND', 'amount_minor': delta, 'provider_amount_minor': amount_minor, 'cumulative': cumulative,
        'units': units, 'reclaimed_units': reclaimed, 'pending_units': units - reclaimed,
        'status': 'REVIEW_REQUIRED' if units > reclaimed else 'SETTLED', 'at': datetime.now(timezone.utc).isoformat()}
    order.audit = {**audit, adjustment_id: entry}
    session.flush()
    return entry


def provider_checkout(order):
    if order.provider == 'alipay':
        from app.billing.alipay import create_checkout
    elif order.provider == 'wechat':
        from app.billing.wechat import create_checkout
    elif order.provider == 'stripe':
        from app.billing.stripe_payments import create_checkout
    else:
        raise PaymentMismatch()
    return create_checkout(order)


def prepare_checkout(session, order):
    lock_account(session, order.user_id)
    session.refresh(order, with_for_update=True)
    if order.checkout_state == 'READY' or order.status == 'PAID':
        return order
    if order.checkout_state != 'PENDING':
        raise PaymentUnavailable()
    order.checkout_state = 'STARTED'
    session.commit()  # Save the intent before the paid external operation.
    try:
        url, kind = provider_checkout(order)
        parsed = urlsplit(url)
        if not parsed.hostname or parsed.scheme not in {'https', 'weixin'} or parsed.username or parsed.password:
            raise PaymentUnavailable()
        order.payment_url, order.checkout_kind = url, kind
        order.checkout_url = platform_origin() + '/billing/orders/' + order.id if kind == 'QR' else url
        order.checkout_state = 'READY'
        session.commit()
    except Exception as exc:
        session.rollback()
        order = session.get(PaymentOrder, order.id)
        order.checkout_state = 'UNKNOWN'
        session.commit()
        raise PaymentUnavailable() from exc
    return order


def reconcile_order(session, order):
    if order.status != 'CREATED' or order.checkout_state == 'PENDING':
        return order
    if order.provider == 'alipay':
        from app.billing.alipay import query_payment
    elif order.provider == 'wechat':
        from app.billing.wechat import query_payment
    else:
        from app.billing.stripe_payments import query_payment
    payment = query_payment(order)
    if payment:
        apply_payment(session, payment)
    session.commit()
    return order
