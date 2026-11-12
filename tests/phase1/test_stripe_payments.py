import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import pytest
import stripe
from sqlalchemy import select

from app.billing.models import ProductSku, QuotaGrant, Subscription
from app.config import settings


@pytest.fixture
def stripe_context(api_client, owner_headers, session_factory, tmp_path, monkeypatch):
    from app.billing import stripe_payments
    key = tmp_path / 'stripe.key'
    key.write_text('sk_test_fixture')
    secret = tmp_path / 'webhook.key'
    secret.write_text('whsec_fixture')
    monkeypatch.setattr(settings, 'STRIPE_SECRET_KEY_FILE', str(key))
    monkeypatch.setattr(settings, 'STRIPE_WEBHOOK_SECRET_FILE', str(secret))
    monkeypatch.setattr(settings, 'PAYMENT_PLATFORM_ORIGIN', 'https://platform.test')
    with session_factory() as db:
        db.add_all([
            ProductSku(id='stripe-pack', name='美元额度', provider='stripe', currency='USD', amount_minor=990, units=5000, stripe_price_id='price_pack'),
            ProductSku(id='stripe-month', name='月度额度', provider='stripe', currency='USD', amount_minor=1900, units=10000, period='MONTH', stripe_price_id='price_month'),
        ])
        db.commit()
    state = {'requests': [], 'order_id': '', 'mode': 'payment', 'amount': 990, 'price': 'price_pack', 'paid': False, 'refunded': 990,
        'start': int(time.time()) - 10, 'end': int(time.time()) + 2592000, 'cancelled': False}
    class ProviderHttp(stripe.HTTPClient):
        name = 'fixture'
        def request(self, method, url, headers=None, post_data=None, **kw):
            path = urlsplit(url).path
            state['requests'].append((method, path, headers, post_data))
            if path.startswith('/v1/prices/'):
                price = path.rsplit('/', 1)[1]
                recurring = {'interval': 'month', 'interval_count': 1} if price == 'price_month' else None
                value = {'id': price, 'object': 'price', 'active': True, 'currency': 'usd', 'unit_amount': 1900 if recurring else 990, 'recurring': recurring}
            elif path == '/v1/checkout/sessions' and method == 'post':
                params = parse_qs(post_data)
                assert int(params['expires_at'][0]) >= int(time.time()) + 1800
                state.update(order_id=params['client_reference_id'][0], mode=params['mode'][0], price=params['line_items[0][price]'][0])
                state['amount'] = 1900 if state['mode'] == 'subscription' else 990
                value = {'id': 'cs_fixture', 'object': 'checkout.session', 'url': 'https://checkout.stripe.com/c/pay/test'}
            elif path.startswith('/v1/checkout/sessions/') and path.endswith('/line_items'):
                value = {'object': 'list', 'data': [{'id': 'li_1', 'quantity': 1, 'price': {'id': state['price']}}], 'has_more': False}
            elif path == '/v1/checkout/sessions/cs_fixture':
                value = {'id': 'cs_fixture', 'object': 'checkout.session', 'mode': state['mode'], 'client_reference_id': state['order_id'],
                    'customer': 'cus_fixture', 'subscription': 'sub_fixture' if state['mode'] == 'subscription' else None,
                    'status': 'complete' if state['paid'] else 'open', 'payment_status': 'paid' if state['paid'] else 'unpaid',
                    'currency': 'usd', 'amount_total': state['amount'], 'payment_intent': 'pi_fixture', 'created': int(time.time())}
            elif path.startswith('/v1/subscriptions/'):
                value = {'id': 'sub_fixture', 'object': 'subscription', 'customer': 'cus_fixture', 'status': 'active',
                    'cancel_at_period_end': state['cancelled'], 'metadata': {'order_id': state['order_id']},
                    'items': {'data': [{'price': {'id': 'price_month'}}]}}
                if method == 'post':
                    state['cancelled'] = True
                    value['cancel_at_period_end'] = True
            elif path.startswith('/v1/invoices/'):
                value = {'id': path.rsplit('/',1)[1], 'object': 'invoice', 'status': 'paid', 'paid': True,
                    'customer': 'cus_fixture', 'parent': {'type': 'subscription_details', 'subscription_details': {'subscription': 'sub_fixture'}},
                    'currency': 'usd', 'amount_paid': state['amount'], 'total': state['amount'],
                    'status_transitions': {'paid_at': int(time.time())},
                    'lines': {'has_more': False, 'data': [{'quantity': 1, 'pricing': {'price_details': {'price': 'price_month'}}, 'period': {'start': state['start'], 'end': state['end']}}]}}
            elif path.startswith('/v1/charges/'):
                value = {'id': 'ch_fixture', 'object': 'charge', 'payment_intent': 'pi_fixture', 'amount': state['amount'], 'currency': 'usd', 'amount_refunded': state['refunded']}
            elif path == '/v1/invoice_payments':
                value = {'object': 'list', 'data': [{'invoice': 'in_first'}], 'has_more': False}
            else:
                raise AssertionError(f'unexpected provider request: {method} {path}')
            return json.dumps(value), 200, {'request-id': 'req_fixture'}
    monkeypatch.setattr(stripe_payments, '_client', lambda: stripe.StripeClient('sk_test_fixture', stripe_version='2025-03-31.basil', http_client=ProviderHttp()))
    return api_client, owner_headers, session_factory, state


def notice(kind, identifier='evt_1', object_id='cs_fixture'):
    body = json.dumps({'id': identifier, 'object': 'event', 'type': kind, 'data': {'object': {'id': object_id}}}).encode()
    stamp = str(int(time.time()))
    signature = hmac.new(b'whsec_fixture', stamp.encode() + b'.' + body, hashlib.sha256).hexdigest()
    return body, {'Stripe-Signature': f't={stamp},v1={signature}'}


def buy(context, sku='stripe-pack'):
    client, headers, _, _ = context
    response = client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'stripe-' + sku}, json={'sku_id': sku, 'provider': 'stripe'})
    assert response.status_code == 201, response.text
    return response.json()


def deliver(context, kind, identifier='evt_1', object_id='cs_fixture'):
    client, _, _, _ = context
    body, headers = notice(kind, identifier, object_id)
    return client.post('/api/quota/payments/stripe/notify', content=body, headers=headers)


def test_checkout_uses_snapshot_and_browser_return_never_grants(stripe_context):
    client, headers, factory, state = stripe_context
    order = buy(stripe_context)
    assert order['checkout_url'].startswith('https://checkout.stripe.com/')
    assert client.get('/api/quota/orders/' + order['order_id'], headers=headers).json()['status'] == 'CREATED'
    with factory() as db:
        assert not list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'PURCHASE')))
    create = next(item for item in state['requests'] if item[0] == 'post' and item[1] == '/v1/checkout/sessions')
    assert create[2]['Idempotency-Key'] == 'checkout:' + order['order_id']
    assert parse_qs(create[3])['success_url'][0] == 'https://platform.test/billing/orders/' + order['order_id']


def test_official_sdk_builds_the_checkout_request(stripe_context):
    from app.billing.orders import create_order
    from app.billing.stripe_payments import create_checkout
    from app.models.user import User
    _, _, factory, _ = stripe_context
    with factory() as db:
        user = db.scalar(select(User).where(User.username == 'owner'))
        order = create_order(db, user.id, 'stripe-pack', 'stripe', 'sdk')
        order.expires_at = datetime.now(timezone.utc) + timedelta(minutes=29)
        assert create_checkout(order)[1] == 'REDIRECT'


def test_checkout_paid_webhook_verifies_supplier_and_grants_once(stripe_context):
    client, headers, factory, state = stripe_context
    order = buy(stripe_context)
    state['paid'] = True
    assert deliver(stripe_context, 'checkout.session.completed').status_code == 200
    assert deliver(stripe_context, 'checkout.session.completed', 'evt_2').status_code == 200
    assert client.get('/api/quota/orders/' + order['order_id'], headers=headers).json()['status'] == 'PAID'
    with factory() as db:
        assert len(list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'PURCHASE')))) == 1


def test_amount_error_and_invalid_raw_signature_never_grant(stripe_context):
    client, _, factory, state = stripe_context
    buy(stripe_context)
    state.update(paid=True, amount=1)
    assert deliver(stripe_context, 'checkout.session.completed').status_code == 400
    body, headers = notice('checkout.session.completed')
    assert client.post('/api/quota/payments/stripe/notify', content=body + b' ', headers=headers).status_code == 400
    with factory() as db:
        assert not list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'PURCHASE')))


def test_expired_signed_notice_cannot_settle_invoice(stripe_context):
    client, _, factory, state = stripe_context
    buy(stripe_context, 'stripe-month')
    state['paid'] = True
    body, _ = notice('invoice.paid', object_id='in_first')
    stamp = str(int(time.time()) - 600)
    signature = hmac.new(b'whsec_fixture', stamp.encode() + b'.' + body, hashlib.sha256).hexdigest()
    response = client.post('/api/quota/payments/stripe/notify', content=body, headers={'Stripe-Signature': f't={stamp},v1={signature}'})
    assert response.status_code == 400
    with factory() as db:
        assert not list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'SUBSCRIPTION')))


def test_stripe_refund_notifications_reclaim_each_paid_order_once(stripe_context):
    _, _, factory, state = stripe_context
    order = buy(stripe_context)
    state['paid'] = True
    assert deliver(stripe_context, 'checkout.session.completed').status_code == 200
    for identifier in ['evt_refund', 'evt_refund_again']:
        assert deliver(stripe_context, 'charge.refunded', identifier, 'ch_fixture').status_code == 200
    with factory() as db:
        grant = db.scalar(select(QuotaGrant).where(QuotaGrant.grant_key == 'payment:' + order['order_id']))
        assert grant.balance_units == 0


def test_stripe_subscription_refund_is_bound_to_the_paid_invoice(stripe_context):
    _, _, factory, state = stripe_context
    order = buy(stripe_context, 'stripe-month')
    state.update(paid=True, refunded=1900)
    assert deliver(stripe_context, 'invoice.paid', object_id='in_first').status_code == 200
    assert deliver(stripe_context, 'charge.refunded', 'evt_refund', 'ch_fixture').status_code == 200
    with factory() as db:
        credit = db.scalar(select(QuotaGrant).where(QuotaGrant.grant_key == 'payment:' + order['order_id']))
        assert credit.balance_units == 0


def test_invoice_paid_before_checkout_event_grants_each_cycle_once_and_keeps_paid_credits_on_cancel(stripe_context):
    client, headers, factory, state = stripe_context
    buy(stripe_context, 'stripe-month')
    state['paid'] = True
    assert deliver(stripe_context, 'invoice.paid', object_id='in_first').status_code == 200
    assert deliver(stripe_context, 'invoice.paid', 'evt_repeat', 'in_first').status_code == 200
    assert deliver(stripe_context, 'checkout.session.completed', 'evt_checkout').status_code == 200
    first_start = state['start']
    state.update(start=state['end'], end=state['end'] + 2592000)
    assert deliver(stripe_context, 'invoice.paid', 'evt_second', 'in_second').status_code == 200
    # Delayed old invoice must not move subscription backwards.
    second_end = state['end']
    state.update(start=first_start, end=state['start'])
    assert deliver(stripe_context, 'invoice.paid', 'evt_old', 'in_first').status_code == 200
    response = client.post('/api/quota/subscription/cancel', headers={**headers, 'Idempotency-Key': 'cancel'})
    assert response.status_code == 200 and response.json()['cancelled']
    assert client.post('/api/quota/subscription/cancel', headers={**headers, 'Idempotency-Key': 'cancel'}).status_code == 200
    with factory() as db:
        grants = list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'SUBSCRIPTION')))
        assert len(grants) == 2 and sum(g.units for g in grants) == 20000
        subscription = db.scalar(select(Subscription).where(Subscription.provider == 'stripe'))
        assert int(subscription.period_end.timestamp()) == second_end
