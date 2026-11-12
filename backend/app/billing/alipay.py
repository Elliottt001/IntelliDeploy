import json
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import httpx

from app.billing.crypto import sign, verify
from app.billing.orders import PaymentMismatch, PaymentUnavailable, notification_url
from app.config import settings
from app.core.types import PaymentEvent


def _canonical(data):
    return '&'.join(f'{k}={v}' for k, v in sorted(data.items()) if k not in {'sign', 'sign_type'} and v != '').encode()


def _amount(value, *, allow_zero=False):
    try:
        amount = Decimal(str(value)) * 100
        if not amount.is_finite() or amount < 0 or (amount == 0 and not allow_zero) or amount != amount.to_integral_value():
            raise ValueError()
        return int(amount)
    except (ValueError, InvalidOperation) as exc:
        raise PaymentMismatch() from exc


def _event(data, event_id=None):
    if data.get('trade_status') not in {'TRADE_SUCCESS', 'TRADE_FINISHED'}:
        raise PaymentMismatch()
    paid = data.get('gmt_payment') or data.get('send_pay_date')
    paid_at = datetime.strptime(paid, '%Y-%m-%d %H:%M:%S').replace(tzinfo=ZoneInfo('Asia/Shanghai')) if paid else datetime.now(timezone.utc)
    return PaymentEvent(provider='alipay', event_id=event_id or data['notify_id'], order_id=data['out_trade_no'],
        transaction_id=data['trade_no'], amount_minor=_amount(data['total_amount']), currency='CNY',
        paid_at=paid_at, grant_key='provider-notice')


def verify_notification(data):
    if not settings.ALIPAY_APP_ID or not settings.ALIPAY_SELLER_ID:
        raise PaymentUnavailable()
    verify(_canonical(data), data.get('sign', ''), settings.ALIPAY_PUBLIC_KEY_FILE)
    if data.get('sign_type') != 'RSA2' or data.get('app_id') != settings.ALIPAY_APP_ID or data.get('seller_id') != settings.ALIPAY_SELLER_ID:
        raise PaymentMismatch()


def parse_notification(data):
    verify_notification(data)
    try:
        return _event(data)
    except (KeyError, ValueError) as exc:
        raise PaymentMismatch() from exc


def _request(method, business, notify=False):
    gateway = urlsplit(settings.ALIPAY_GATEWAY)
    if gateway.scheme != 'https' or gateway.hostname not in {'openapi.alipay.com', 'openapi-sandbox.dl.alipaydev.com'} or not settings.ALIPAY_APP_ID or not settings.ALIPAY_SELLER_ID:
        raise PaymentUnavailable()
    data = dict(app_id=settings.ALIPAY_APP_ID, method=method, format='JSON', charset='utf-8', sign_type='RSA2',
        timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'), version='1.0', biz_content=json.dumps(business, ensure_ascii=False, separators=(',', ':')))
    if notify:
        data['notify_url'] = notification_url('alipay')
    # Request signing includes sign_type; callback verification excludes it.
    data['sign'] = sign('&'.join(f'{k}={v}' for k, v in sorted(data.items())).encode(), settings.ALIPAY_PRIVATE_KEY_FILE)
    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(settings.ALIPAY_GATEWAY, data=data)
        response.raise_for_status()
        raw = response.text
        key = method.replace('.', '_') + '_response'
        match = re.search('"' + re.escape(key) + '"\\s*:\\s*', raw)
        if not match:
            raise PaymentMismatch()
        result, length = json.JSONDecoder().raw_decode(raw[match.end():])
        verify(raw[match.end():match.end() + length].encode(), response.json().get('sign', ''), settings.ALIPAY_PUBLIC_KEY_FILE)
        if result.get('code') == '40004' and result.get('sub_code') == 'ACQ.TRADE_NOT_EXIST':
            return None
        if result.get('code') != '10000':
            raise PaymentUnavailable()
        return result
    except (httpx.HTTPError, ValueError) as exc:
        raise PaymentUnavailable() from exc


def create_checkout(order):
    result = _request('alipay.trade.precreate', {'out_trade_no': order.id, 'total_amount': f'{Decimal(order.amount_minor) / 100:.2f}',
        'subject': order.sku_snapshot['name'], 'timeout_express': '30m'}, notify=True)
    if not result or result.get('out_trade_no') != order.id or not result.get('qr_code'):
        raise PaymentMismatch()
    return result['qr_code'], 'QR'


def query_payment(order):
    result = _request('alipay.trade.query', {'out_trade_no': order.id})
    if not result or result.get('trade_status') == 'WAIT_BUYER_PAY':
        return None
    if result.get('out_trade_no') != order.id:
        raise PaymentMismatch()
    if result.get('trade_status') == 'TRADE_CLOSED':
        # Caller owns the DB transaction and saves the verified closure.
        order.status = 'CANCELLED' if order.status == 'CREATED' else order.status
        order.audit = {**(order.audit or {}), 'provider-close': {'kind': 'CLOSED'}}
        return None
    return _event(result, 'query:' + result['trade_no'])
