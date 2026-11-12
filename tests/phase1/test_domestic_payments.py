import base64
import json
import time
from datetime import datetime, timezone

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import select

from app.billing.models import ProductSku, QuotaGrant
from app.config import settings
from app.core.types import PaymentEvent


@pytest.fixture
def payment_context(api_client, owner_headers, session_factory):
    with session_factory() as db:
        db.add_all([
            ProductSku(id='pack', name='额度包', provider='alipay', currency='CNY', amount_minor=990, units=5000),
            ProductSku(id='month', name='月度套餐', provider='wechat', currency='CNY', amount_minor=1900, units=10000, period='MONTH'),
        ])
        db.commit()
    return api_client, owner_headers, session_factory


@pytest.fixture(autouse=True)
def platform_url(monkeypatch):
    monkeypatch.setattr(settings, 'PAYMENT_PLATFORM_ORIGIN', 'https://platform.test')


def event(order, **changes):
    return PaymentEvent(**dict(dict(provider=order.provider, event_id='notice-1', order_id=order.id,
        transaction_id='trade-1', amount_minor=order.amount_minor, currency=order.currency,
        paid_at=datetime.now(timezone.utc), grant_key='untrusted-key'), **changes))


def test_amount_mismatch_and_conflicting_replay_never_grant(payment_context):
    from app.billing.orders import create_order, apply_payment, PaymentMismatch
    _, _, factory = payment_context
    from app.models.user import User
    with factory() as db:
        owner = db.scalar(select(User).where(User.username == 'owner'))
        order = create_order(db, owner.id, 'pack', 'alipay', 'once')
        with pytest.raises(PaymentMismatch):
            apply_payment(db, event(order, amount_minor=1))
        assert not list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'PURCHASE')))
        apply_payment(db, event(order))
        apply_payment(db, event(order, event_id='different-notice'))
        with pytest.raises(PaymentMismatch):
            apply_payment(db, event(order, transaction_id='other-trade'))
        db.commit()
        grants = list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'PURCHASE')))
        assert len(grants) == 1 and grants[0].units == 5000


def test_order_replay_preserves_snapshot_and_checks_owner(payment_context, other_headers, monkeypatch):
    from app.billing import orders
    client, headers, factory = payment_context
    monkeypatch.setattr(orders, 'provider_checkout', lambda order: ('https://pay.example/qr', 'QR'))
    response = client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'once'}, json={'sku_id': 'pack', 'provider': 'alipay'})
    assert response.status_code == 201
    order_id = response.json()['order_id']
    with factory() as db:
        db.get(ProductSku, 'pack').units = 1
        db.commit()
    replay = client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'once'}, json={'sku_id': 'pack', 'provider': 'alipay'})
    assert replay.json()['order_id'] == order_id and replay.json()['units'] == 5000
    assert client.get('/api/quota/orders/' + order_id, headers=other_headers).status_code == 404
    assert client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'once'}, json={'sku_id': 'month', 'provider': 'wechat'}).status_code == 409
    assert client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'bad'}, json={'sku_id': 'pack', 'provider': 'alipay', 'units': 999999}).status_code == 422


@pytest.fixture
def payment_keys(tmp_path, monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    key = tmp_path / 'merchant.pem'
    public = tmp_path / 'provider.pem'
    key.write_bytes(private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    public.write_bytes(private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
    values = dict(ALIPAY_APP_ID='app-test', ALIPAY_SELLER_ID='seller-test', ALIPAY_PRIVATE_KEY_FILE=str(key),
        ALIPAY_PUBLIC_KEY_FILE=str(public), WECHAT_APP_ID='wx-test', WECHAT_MCH_ID='mch-test',
        WECHAT_PRIVATE_KEY_FILE=str(key), WECHAT_PUBLIC_KEY_FILE=str(public), WECHAT_PLATFORM_SERIAL='serial-test',
        WECHAT_MERCHANT_SERIAL='merchant-test', WECHAT_API_V3_KEY_FILE=str(tmp_path / 'v3.key'))
    (tmp_path / 'v3.key').write_bytes(b'k' * 32)
    for name, value in values.items():
        monkeypatch.setattr(settings, name, value)
    return private


def signed_alipay(private, **changes):
    data = dict(app_id='app-test', seller_id='seller-test', out_trade_no='order-1', trade_no='trade-1',
        total_amount='9.90', trade_status='TRADE_SUCCESS', notify_id='notice-1', sign_type='RSA2')
    data.update(changes)
    payload = '&'.join(f'{k}={v}' for k, v in sorted(data.items()) if k != 'sign_type').encode()
    data['sign'] = base64.b64encode(private.sign(payload, padding.PKCS1v15(), hashes.SHA256())).decode()
    return data


def test_alipay_signature_merchant_and_exact_minor_units(payment_keys):
    from app.billing.alipay import parse_notification
    from app.billing.orders import PaymentMismatch
    parsed = parse_notification(signed_alipay(payment_keys))
    assert parsed.amount_minor == 990 and parsed.order_id == 'order-1'
    bad = signed_alipay(payment_keys)
    bad['total_amount'] = '0.01'
    with pytest.raises(PaymentMismatch):
        parse_notification(bad)
    for changes in [{'seller_id': 'foreign'}, {'total_amount': '0.001'}, {'trade_status': 'WAIT_BUYER_PAY'}]:
        with pytest.raises(PaymentMismatch):
            parse_notification(signed_alipay(payment_keys, **changes))


def wechat_notification(private, timestamp=None, **changes):
    data = dict(appid='wx-test', mchid='mch-test', out_trade_no='order-1', transaction_id='trade-1',
        trade_state='SUCCESS', success_time='2026-11-12T10:00:00+08:00', amount={'total': 1900, 'currency': 'CNY'})
    data.update(changes)
    cipher = AESGCM(b'k' * 32).encrypt(b'nonce-123456', json.dumps(data).encode(), b'transaction')
    body = json.dumps({'id': 'notice-1', 'event_type': 'TRANSACTION.SUCCESS', 'resource': {
        'algorithm': 'AEAD_AES_256_GCM', 'nonce': 'nonce-123456', 'associated_data': 'transaction', 'ciphertext': base64.b64encode(cipher).decode()}}).encode()
    stamp = str(timestamp or int(time.time()))
    signed = stamp.encode() + b'\nrequest-nonce\n' + body + b'\n'
    headers = {'Wechatpay-Timestamp': stamp, 'Wechatpay-Nonce': 'request-nonce', 'Wechatpay-Serial': 'serial-test',
        'Wechatpay-Signature': base64.b64encode(private.sign(signed, padding.PKCS1v15(), hashes.SHA256())).decode()}
    return body, headers


def test_wechat_raw_body_signature_decryption_and_replay_window(payment_keys):
    from app.billing.wechat import parse_notification
    from app.billing.orders import PaymentMismatch
    body, headers = wechat_notification(payment_keys)
    assert parse_notification(body, headers).amount_minor == 1900
    with pytest.raises(PaymentMismatch):
        parse_notification(body + b' ', headers)
    body, headers = wechat_notification(payment_keys, timestamp=int(time.time()) - 600)
    with pytest.raises(PaymentMismatch):
        parse_notification(body, headers)
    body, headers = wechat_notification(payment_keys, mchid='foreign')
    with pytest.raises(PaymentMismatch):
        parse_notification(body, headers)


def test_signed_domestic_callback_commits_once(payment_context, payment_keys, monkeypatch):
    from app.billing import orders
    client, headers, factory = payment_context
    monkeypatch.setattr(orders, 'provider_checkout', lambda order: ('https://pay.example/qr', 'QR'))
    order = client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'callback'}, json={'sku_id': 'pack', 'provider': 'alipay'}).json()
    data = signed_alipay(payment_keys, out_trade_no=order['order_id'], refund_fee='0.00')
    for _ in range(2):
        reply = client.post('/api/quota/payments/alipay/notify', data=data)
        assert reply.status_code == 200 and reply.text == 'success'
    assert client.get('/api/quota/orders/' + order['order_id'], headers=headers).json()['status'] == 'PAID'
    with factory() as db:
        assert len(list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'PURCHASE')))) == 1
    data['sign'] = 'invalid'
    assert client.post('/api/quota/payments/alipay/notify', data=data).status_code == 400


def test_new_paid_subscription_is_not_granted_again_by_maintenance(payment_context):
    from app.billing.orders import create_order, apply_payment
    from app.jobs.maintenance import issue_periodic_grants
    from app.models.user import User
    _, _, factory = payment_context
    now = datetime.now(timezone.utc)
    with factory() as db:
        user = db.scalar(select(User).where(User.username == 'owner'))
        order = create_order(db, user.id, 'month', 'wechat', 'monthly')
        apply_payment(db, event(order))
        db.commit()
    issue_periodic_grants(now, session_factory=factory)
    issue_periodic_grants(now, session_factory=factory)
    with factory() as db:
        rows = list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'SUBSCRIPTION')))
        assert len(rows) == 1 and rows[0].units == 10000


def test_alipay_checkout_signs_request_and_verifies_provider_response(payment_context, payment_keys, monkeypatch):
    import httpx
    from app.billing.alipay import create_checkout
    from app.billing.orders import create_order
    from app.models.user import User
    from urllib.parse import parse_qs
    _, _, factory = payment_context
    monkeypatch.setattr(settings, 'PAYMENT_NOTIFY_BASE_URL', 'https://api.platform.test')
    def upstream(request):
        fields = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
        signature = fields.pop('sign')
        payment_keys.public_key().verify(base64.b64decode(signature), '&'.join(f'{k}={v}' for k,v in sorted(fields.items())).encode(), padding.PKCS1v15(), hashes.SHA256())
        business = json.loads(fields['biz_content'])
        assert business['total_amount'] == '9.90' and fields['notify_url'] == 'https://api.platform.test/api/quota/payments/alipay/notify'
        payload = json.dumps({'code': '10000', 'out_trade_no': business['out_trade_no'], 'qr_code': 'https://qr.alipay.com/test'}, separators=(',', ':'))
        signature = base64.b64encode(payment_keys.sign(payload.encode(), padding.PKCS1v15(), hashes.SHA256())).decode()
        return httpx.Response(200, content='{"alipay_trade_precreate_response":' + payload + ',"sign":"' + signature + '"}')
    original = httpx.Client
    monkeypatch.setattr(httpx, 'Client', lambda **kw: original(transport=httpx.MockTransport(upstream), **kw))
    with factory() as db:
        user = db.scalar(select(User).where(User.username == 'owner'))
        assert create_checkout(create_order(db, user.id, 'pack', 'alipay', 'protocol')) == ('https://qr.alipay.com/test', 'QR')


def test_uncertain_checkout_is_saved_and_never_automatically_reissued(payment_context, monkeypatch):
    from app.billing import orders
    client, headers, factory = payment_context
    calls = []
    def unavailable(order):
        calls.append(order.id)
        raise orders.PaymentUnavailable()
    monkeypatch.setattr(orders, 'provider_checkout', unavailable)
    for _ in range(2):
        response = client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'uncertain'}, json={'sku_id': 'pack', 'provider': 'alipay'})
        assert response.status_code == 503
    from app.billing.models import PaymentOrder
    with factory() as db:
        assert db.scalar(select(PaymentOrder).where(PaymentOrder.operation_id == 'uncertain')).checkout_state == 'UNKNOWN'
        assert len(calls) == 1


def test_order_history_can_recover_a_lost_create_response(payment_context, other_headers, monkeypatch):
    from app.billing import orders
    client, headers, _ = payment_context
    monkeypatch.setattr(orders, 'provider_checkout', lambda order: ('https://pay.example/qr', 'QR'))
    created = client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'history'}, json={'sku_id': 'pack', 'provider': 'alipay'}).json()
    response = client.get('/api/quota/orders', headers=headers)
    assert response.status_code == 200 and response.json()[0]['order_id'] == created['order_id']
    assert client.get('/api/quota/orders', headers=other_headers).json() == []


def test_concurrent_callback_delivery_and_wrong_currency_do_not_duplicate_credits(payment_context):
    from concurrent.futures import ThreadPoolExecutor
    from app.billing.orders import create_order, apply_payment, PaymentMismatch
    from app.billing.models import PaymentOrder
    from app.models.user import User
    _, _, factory = payment_context
    with factory() as db:
        user = db.scalar(select(User).where(User.username == 'owner'))
        order = create_order(db, user.id, 'pack', 'alipay', 'concurrent')
        order_id = order.id
        with pytest.raises(PaymentMismatch):
            apply_payment(db, event(order, currency='USD'))
        db.commit()
    def callback(index):
        with factory() as db:
            order = db.get(PaymentOrder, order_id)
            apply_payment(db, event(order, event_id='parallel-' + str(index)))
            db.commit()
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(callback, range(2)))
    with factory() as db:
        assert len(list(db.scalars(select(QuotaGrant).where(QuotaGrant.source == 'PURCHASE')))) == 1


def test_refund_audit_is_idempotent_and_preserves_consumed_usage(payment_context):
    from app.billing.orders import create_order, apply_payment, record_refund
    from app.models.user import User
    _, _, factory = payment_context
    with factory() as db:
        user = db.scalar(select(User).where(User.username == 'owner'))
        order = create_order(db, user.id, 'pack', 'alipay', 'refund')
        apply_payment(db, event(order))
        grant = db.scalar(select(QuotaGrant).where(QuotaGrant.grant_key == 'payment:' + order.id))
        grant.balance_units = 4000  # 1000 units already consumed; never delete their history.
        record_refund(db, order, 'refund-1', 990)
        record_refund(db, order, 'refund-1', 990)
        db.commit()
        assert grant.balance_units == 0
        assert order.audit['refund-1']['reclaimed_units'] == 4000
        assert order.audit['refund-1']['pending_units'] == 1000
        assert order.status == 'PAID'


def test_signed_alipay_refund_reclaims_only_once(payment_context, payment_keys, monkeypatch):
    from app.billing import orders
    client, headers, factory = payment_context
    monkeypatch.setattr(orders, 'provider_checkout', lambda order: ('https://pay.example/qr', 'QR'))
    order = client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'refund-api'}, json={'sku_id': 'pack', 'provider': 'alipay'}).json()
    data = signed_alipay(payment_keys, out_trade_no=order['order_id'])
    assert client.post('/api/quota/payments/alipay/notify', data=data).status_code == 200
    data = signed_alipay(payment_keys, out_trade_no=order['order_id'], notify_id='refund-notice', refund_fee='9.90')
    for _ in range(2):
        assert client.post('/api/quota/payments/alipay/notify', data=data).status_code == 200
    with factory() as db:
        grant = db.scalar(select(QuotaGrant).where(QuotaGrant.grant_key == 'payment:' + order['order_id']))
        assert grant.balance_units == 0


def test_wechat_signed_refund_validates_transaction_and_reclaims_once(payment_context, payment_keys, monkeypatch):
    from app.billing import orders
    client, headers, factory = payment_context
    monkeypatch.setattr(orders, 'provider_checkout', lambda order: ('weixin://wxpay/test', 'QR'))
    order = client.post('/api/quota/orders', headers={**headers, 'Idempotency-Key': 'wx-refund'}, json={'sku_id': 'month', 'provider': 'wechat'}).json()
    body, signed_headers = wechat_notification(payment_keys, out_trade_no=order['order_id'])
    assert client.post('/api/quota/payments/wechat/notify', content=body, headers=signed_headers).status_code == 200
    data = dict(mchid='mch-test', out_trade_no=order['order_id'], transaction_id='trade-1', refund_id='wx-refund-1',
        refund_status='SUCCESS', amount={'total': 1900, 'refund': 1900, 'currency': 'CNY'})
    cipher = AESGCM(b'k' * 32).encrypt(b'nonce-123456', json.dumps(data).encode(), b'transaction')
    body = json.dumps({'id':'wx-refund-notice', 'event_type':'REFUND.SUCCESS', 'resource': {'algorithm':'AEAD_AES_256_GCM',
        'nonce':'nonce-123456', 'associated_data':'transaction', 'ciphertext':base64.b64encode(cipher).decode()}}).encode()
    stamp = str(int(time.time()))
    payload = stamp.encode() + b'\nrequest-nonce\n' + body + b'\n'
    signed_headers = {'Wechatpay-Timestamp':stamp, 'Wechatpay-Nonce':'request-nonce', 'Wechatpay-Serial':'serial-test',
        'Wechatpay-Signature':base64.b64encode(payment_keys.sign(payload,padding.PKCS1v15(),hashes.SHA256())).decode()}
    for _ in range(2):
        assert client.post('/api/quota/payments/wechat/notify',content=body,headers=signed_headers).status_code == 200
    with factory() as db:
        credit = db.scalar(select(QuotaGrant).where(QuotaGrant.grant_key == 'payment:' + order['order_id']))
        assert credit.balance_units == 0
