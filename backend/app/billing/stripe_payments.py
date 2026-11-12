"""Stripe official SDK; provider objects, never browser returns, settle orders."""
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

import stripe
from sqlalchemy import select

from app.billing.crypto import secret_file
from app.billing.ledger import lock_account
from app.billing.models import PaymentOrder, PaymentReceipt, Subscription
from app.billing.orders import PaymentMismatch, PaymentUnavailable, apply_payment, close_order, platform_origin, record_refund
from app.config import settings
from app.core.types import PaymentEvent


def _client():
    return stripe.StripeClient(secret_file(settings.STRIPE_SECRET_KEY_FILE).decode().strip(),
        stripe_version=settings.STRIPE_API_VERSION, max_network_retries=0)


def _id(value):
    return value.get('id') if isinstance(value, dict) else value


def create_checkout(order):
    client = _client()
    price_id = order.sku_snapshot.get('stripe_price_id')
    if not price_id:
        raise PaymentUnavailable()
    price = client.v1.prices.retrieve(price_id).to_dict()
    if not price.get('active') or (price.get('currency', '').upper(), price.get('unit_amount')) != (order.currency, order.amount_minor):
        raise PaymentMismatch()
    recurring = price.get('recurring')
    if order.period:
        if not recurring or recurring.get('interval') != {'MONTH': 'month', 'YEAR': 'year'}[order.period] or recurring.get('interval_count') != 1:
            raise PaymentMismatch()
    elif recurring:
        raise PaymentMismatch()
    return_url = platform_origin() + '/billing/orders/' + order.id
    # Stripe requires at least 30 minutes at request time, including API latency.
    order.expires_at = max(order.expires_at, datetime.now(timezone.utc) + timedelta(minutes=31))
    params = dict(mode='subscription' if order.period else 'payment', line_items=[{'price': price_id, 'quantity': 1}],
        client_reference_id=order.id, metadata={'order_id': order.id}, success_url=return_url, cancel_url=return_url,
        expires_at=int(order.expires_at.timestamp()))
    if order.period:
        params['subscription_data'] = {'metadata': {'order_id': order.id}}
    result = client.v1.checkout.sessions.create(params, options={'idempotency_key': 'checkout:' + order.id}).to_dict()
    url = result.get('url', '')
    if urlsplit(url).scheme != 'https' or urlsplit(url).hostname != 'checkout.stripe.com':
        raise PaymentMismatch()
    order.provider_checkout_id = result['id']
    return url, 'REDIRECT'


def create_stripe_checkout(order, recurring):
    if recurring != bool(order.period):
        raise PaymentMismatch()
    return create_checkout(order)[0]


def _checkout(order, client):
    if not order.provider_checkout_id:
        raise PaymentUnavailable()
    obj = client.v1.checkout.sessions.retrieve(order.provider_checkout_id).to_dict()
    if obj.get('client_reference_id') != order.id or obj.get('mode') != ('subscription' if order.period else 'payment'):
        raise PaymentMismatch()
    return obj


def _payment_event(order, checkout, client, event_id):
    if checkout.get('status') != 'complete' or checkout.get('payment_status') != 'paid':
        return None
    items = client.v1.checkout.sessions.line_items.list(checkout['id']).to_dict()
    lines = items.get('data', [])
    if items.get('has_more') or len(lines) != 1 or lines[0].get('quantity') != 1 or _id(lines[0].get('price')) != order.sku_snapshot.get('stripe_price_id'):
        raise PaymentMismatch()
    if (checkout.get('currency', '').upper(), checkout.get('amount_total')) != (order.currency, order.amount_minor) or not checkout.get('customer') or not checkout.get('payment_intent'):
        raise PaymentMismatch()
    return PaymentEvent(provider='stripe', event_id=event_id, order_id=order.id,
        transaction_id=_id(checkout['payment_intent']), amount_minor=checkout['amount_total'], currency=checkout['currency'].upper(),
        paid_at=datetime.now(timezone.utc), grant_key='checkout:' + checkout['id'])


def _bind_subscription(session, obj, client):
    provider_id, customer = obj['id'], _id(obj.get('customer'))
    existing = session.scalar(select(Subscription).where(Subscription.provider_subscription_id == provider_id))
    order_id = existing.payment_order_id if existing else (obj.get('metadata') or {}).get('order_id')
    order = session.get(PaymentOrder, order_id) if order_id else None
    if not order or order.provider != 'stripe' or not order.period or not customer:
        raise PaymentMismatch()
    lock_account(session, order.user_id)
    session.refresh(order, with_for_update=True)
    # Re-read after the account lock to fence concurrent invoices.
    existing = session.scalar(select(Subscription).where(Subscription.provider_subscription_id == provider_id).execution_options(populate_existing=True))
    checkout = _checkout(order, client)
    if _id(checkout.get('subscription')) != provider_id or _id(checkout.get('customer')) != customer:
        raise PaymentMismatch()
    if existing:
        if existing.payer_id != order.user_id or existing.provider_customer_id != customer:
            raise PaymentMismatch()
        return existing, order
    now = datetime.now(timezone.utc)
    subscription = Subscription(payer_id=order.user_id, sku_id=order.sku_id, provider='stripe', status='PENDING',
        period_start=now, period_end=now, cancelled=bool(obj.get('cancel_at_period_end')),
        payment_order_id=order.id, provider_subscription_id=provider_id, provider_customer_id=customer)
    session.add(subscription)
    session.flush()
    return subscription, order


def normalize_paid_invoice(session, invoice, client, event_id):
    details = invoice.get('parent') or {}
    provider_id = _id((details.get('subscription_details') or {}).get('subscription'))
    if details.get('type') != 'subscription_details' or not provider_id or invoice.get('status') != 'paid' or not invoice.get('paid'):
        raise PaymentMismatch()
    provider = client.v1.subscriptions.retrieve(provider_id).to_dict()
    subscription, original = _bind_subscription(session, provider, client)
    lines = (invoice.get('lines') or {}).get('data') or []
    if (invoice.get('lines') or {}).get('has_more') or len(lines) != 1:
        raise PaymentMismatch()
    line = lines[0]
    price_id = _id(((line.get('pricing') or {}).get('price_details') or {}).get('price'))
    if price_id != original.sku_snapshot.get('stripe_price_id') or line.get('quantity') != 1:
        raise PaymentMismatch()
    if (invoice.get('currency', '').upper(), invoice.get('amount_paid'), invoice.get('total'), _id(invoice.get('customer'))) != (
        original.currency, original.amount_minor, original.amount_minor, subscription.provider_customer_id):
        raise PaymentMismatch()
    period = line.get('period') or {}
    start = datetime.fromtimestamp(period['start'], timezone.utc)
    end = datetime.fromtimestamp(period['end'], timezone.utc)
    if end <= start:
        raise PaymentMismatch()
    cycle = f'stripe-cycle:{provider_id}:{period["start"]}'
    order = session.scalar(select(PaymentOrder).where(PaymentOrder.user_id == original.user_id, PaymentOrder.operation_id == cycle))
    if not order:
        if original.status == 'CREATED' or original.period_start == start:
            order = original
        else:
            order = PaymentOrder(user_id=original.user_id, operation_id=cycle, sku_id=original.sku_id,
                sku_snapshot=dict(original.sku_snapshot), provider='stripe', currency=original.currency,
                amount_minor=original.amount_minor, units=original.units, period=original.period,
                expires_at=end, checkout_state='READY', checkout_kind='REDIRECT')
            session.add(order)
            session.flush()
    if order.period_start is not None and (order.period_start != start or order.period_end != end):
        raise PaymentMismatch()
    order.period_start, order.period_end = start, end
    event = PaymentEvent(provider='stripe', event_id=event_id, order_id=order.id, transaction_id=invoice['id'],
        amount_minor=invoice['amount_paid'], currency=invoice['currency'].upper(),
        paid_at=datetime.fromtimestamp(invoice['status_transitions']['paid_at'], timezone.utc), grant_key=cycle)
    apply_payment(session, event)
    if subscription.status == 'PENDING' or end > subscription.period_end:
        subscription.period_start, subscription.period_end = start, end
        subscription.status = 'ACTIVE'
    subscription.cancelled = bool(provider.get('cancel_at_period_end')) or provider.get('status') == 'canceled'
    return event


def handle_stripe_event(raw_body, signature, session):
    try:
        event = stripe.Webhook.construct_event(raw_body, signature, secret_file(settings.STRIPE_WEBHOOK_SECRET_FILE).decode().strip(), tolerance=300).to_dict()
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise PaymentMismatch() from exc
    client = _client()
    try:
        kind, object_id = event['type'], event['data']['object']['id']
        if kind in {'checkout.session.completed', 'checkout.session.async_payment_succeeded'}:
            checkout = client.v1.checkout.sessions.retrieve(object_id).to_dict()
            order = session.get(PaymentOrder, checkout.get('client_reference_id'))
            if not order or order.provider != 'stripe' or order.provider_checkout_id != object_id:
                raise PaymentMismatch()
            if order.period:
                _bind_subscription(session, client.v1.subscriptions.retrieve(_id(checkout['subscription'])).to_dict(), client)
                return None  # Subscription credits come only from a paid invoice.
            payment = _payment_event(order, checkout, client, event['id'])
            if payment:
                apply_payment(session, payment)
            return payment
        if kind == 'invoice.paid':
            invoice = client.v1.invoices.retrieve(object_id).to_dict()
            return normalize_paid_invoice(session, invoice, client, event['id'])
        if kind == 'checkout.session.expired':
            checkout = client.v1.checkout.sessions.retrieve(object_id).to_dict()
            order = session.get(PaymentOrder, checkout.get('client_reference_id'))
            if not order or order.provider != 'stripe' or order.provider_checkout_id != object_id:
                raise PaymentMismatch()
            if checkout.get('status') == 'expired':
                close_order(session, order, event['id'])
            return None
        if kind == 'charge.refunded':
            charge = client.v1.charges.retrieve(object_id).to_dict()
            payment_intent = _id(charge.get('payment_intent'))
            if not payment_intent:
                raise PaymentMismatch()
            receipt = session.scalar(select(PaymentReceipt).where(PaymentReceipt.provider == 'stripe', PaymentReceipt.transaction_id == payment_intent))
            if not receipt:
                payments = client.v1.invoice_payments.list({'payment': {'type': 'payment_intent', 'payment_intent': payment_intent}, 'limit': 2}).to_dict()
                if payments.get('has_more') or len(payments.get('data', [])) != 1:
                    raise PaymentMismatch()
                invoice_id = _id(payments['data'][0]['invoice'])
                receipt = session.scalar(select(PaymentReceipt).where(PaymentReceipt.provider == 'stripe', PaymentReceipt.transaction_id == invoice_id))
            order = session.get(PaymentOrder, receipt.order_id) if receipt else None
            if not order or (charge.get('currency', '').upper(), charge.get('amount')) != (order.currency, order.amount_minor):
                raise PaymentMismatch()
            amount = charge['amount_refunded']
            record_refund(session, order, f'stripe-refund:{object_id}:{amount}', amount, cumulative=True)
            return None
        if kind in {'customer.subscription.updated', 'customer.subscription.deleted'}:
            provider = client.v1.subscriptions.retrieve(object_id).to_dict()
            subscription, _ = _bind_subscription(session, provider, client)
            subscription.cancelled = bool(provider.get('cancel_at_period_end')) or provider.get('status') == 'canceled'
            if provider.get('status') == 'canceled':
                subscription.status = 'CANCELLED'
            return None
        return None
    except stripe.StripeError as exc:
        raise PaymentUnavailable() from exc
    except (KeyError, ValueError, TypeError) as exc:
        raise PaymentMismatch() from exc


def query_payment(order):
    if order.period:
        return None  # Webhook invoice settlement is authoritative for subscriptions.
    try:
        client = _client()
        return _payment_event(order, _checkout(order, client), client, 'query:' + order.provider_checkout_id)
    except stripe.StripeError as exc:
        raise PaymentUnavailable() from exc


def cancel_subscription(session, user_id, operation_id):
    lock_account(session, user_id)
    subscription = session.scalar(select(Subscription).where(Subscription.payer_id == user_id).order_by(Subscription.period_end.desc()).with_for_update())
    if not subscription:
        raise PaymentMismatch()
    if subscription.cancelled:
        return subscription
    if subscription.provider == 'stripe':
        if not subscription.provider_subscription_id:
            raise PaymentMismatch()
        try:
            client = _client()
            provider = client.v1.subscriptions.update(subscription.provider_subscription_id,
                {'cancel_at_period_end': True}, options={'idempotency_key': 'cancel:' + subscription.id + ':' + operation_id}).to_dict()
            if _id(provider.get('customer')) != subscription.provider_customer_id or not provider.get('cancel_at_period_end'):
                raise PaymentMismatch()
        except stripe.StripeError as exc:
            raise PaymentUnavailable() from exc
    subscription.cancelled = True
    session.commit()
    return subscription
