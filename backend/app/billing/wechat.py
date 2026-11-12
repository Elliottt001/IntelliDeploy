import base64
import json
import time
from datetime import datetime
from uuid import uuid4
from urllib.parse import quote

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.billing.crypto import secret_file, sign, verify
from app.billing.orders import PaymentMismatch, PaymentUnavailable, notification_url
from app.config import settings
from app.core.types import PaymentEvent


def _verify(body, headers):
    headers = {k.lower(): v for k, v in headers.items()}
    try:
        stamp, nonce = headers['wechatpay-timestamp'], headers['wechatpay-nonce']
        if abs(time.time() - int(stamp)) > 300 or not settings.WECHAT_PLATFORM_SERIAL or headers['wechatpay-serial'] != settings.WECHAT_PLATFORM_SERIAL:
            raise PaymentMismatch()
        verify(stamp.encode() + b'\n' + nonce.encode() + b'\n' + body + b'\n', headers['wechatpay-signature'], settings.WECHAT_PUBLIC_KEY_FILE)
    except (KeyError, ValueError) as exc:
        raise PaymentMismatch() from exc


def _event(data, event_id):
    if not settings.WECHAT_APP_ID or not settings.WECHAT_MCH_ID:
        raise PaymentUnavailable()
    if data.get('appid') != settings.WECHAT_APP_ID or data.get('mchid') != settings.WECHAT_MCH_ID or data.get('trade_state') != 'SUCCESS':
        raise PaymentMismatch()
    amount = data['amount']
    if type(amount.get('total')) is not int or amount['total'] <= 0:
        raise PaymentMismatch()
    return PaymentEvent(provider='wechat', event_id=event_id, order_id=data['out_trade_no'],
        transaction_id=data['transaction_id'], amount_minor=amount['total'], currency=amount['currency'],
        paid_at=datetime.fromisoformat(data['success_time']), grant_key='provider-notice')


def _resource(body, headers, event_type):
    _verify(body, headers)
    try:
        notice = json.loads(body)
        resource = notice['resource']
        if notice.get('event_type') != event_type or resource.get('algorithm') != 'AEAD_AES_256_GCM':
            raise PaymentMismatch()
        key = secret_file(settings.WECHAT_API_V3_KEY_FILE).strip()
        data = AESGCM(key).decrypt(resource['nonce'].encode(), base64.b64decode(resource['ciphertext'], validate=True), resource.get('associated_data', '').encode())
        return json.loads(data), notice['id']
    except PaymentUnavailable:
        raise
    except Exception as exc:
        raise PaymentMismatch() from exc


def parse_notification(body, headers):
    data, event_id = _resource(body, headers, 'TRANSACTION.SUCCESS')
    try:
        return _event(data, event_id)
    except (KeyError, ValueError) as exc:
        raise PaymentMismatch() from exc


def parse_refund(body, headers):
    data, _ = _resource(body, headers, 'REFUND.SUCCESS')
    if not settings.WECHAT_MCH_ID or data.get('mchid') != settings.WECHAT_MCH_ID or data.get('refund_status') != 'SUCCESS':
        raise PaymentMismatch()
    return data


def _request(method, path, data=None):
    if not settings.WECHAT_MCH_ID or not settings.WECHAT_APP_ID or not settings.WECHAT_MERCHANT_SERIAL:
        raise PaymentUnavailable()
    body = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode() if data is not None else b''
    stamp, nonce = str(int(time.time())), uuid4().hex
    payload = method.encode() + b'\n' + path.encode() + b'\n' + stamp.encode() + b'\n' + nonce.encode() + b'\n' + body + b'\n'
    signature = sign(payload, settings.WECHAT_PRIVATE_KEY_FILE)
    authorization = f'WECHATPAY2-SHA256-RSA2048 mchid="{settings.WECHAT_MCH_ID}",nonce_str="{nonce}",timestamp="{stamp}",serial_no="{settings.WECHAT_MERCHANT_SERIAL}",signature="{signature}"'
    try:
        with httpx.Client(timeout=20) as client:
            response = client.request(method, 'https://api.mch.weixin.qq.com' + path, content=body,
                headers={'Authorization': authorization, 'Content-Type': 'application/json', 'Accept': 'application/json'})
        _verify(response.content, response.headers)
        if response.status_code == 404 and response.json().get('code') == 'ORDER_NOT_EXIST':
            return None
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise PaymentUnavailable() from exc


def create_checkout(order):
    result = _request('POST', '/v3/pay/transactions/native', dict(appid=settings.WECHAT_APP_ID, mchid=settings.WECHAT_MCH_ID,
        description=order.sku_snapshot['name'], out_trade_no=order.id, notify_url=notification_url('wechat'),
        time_expire=order.expires_at.isoformat(), amount={'total': order.amount_minor, 'currency': order.currency}))
    if not result or not result.get('code_url', '').startswith('weixin://wxpay/'):
        raise PaymentMismatch()
    return result['code_url'], 'QR'


def query_payment(order):
    result = _request('GET', '/v3/pay/transactions/out-trade-no/' + quote(order.id, safe='') + '?mchid=' + quote(settings.WECHAT_MCH_ID, safe=''))
    if not result or result.get('trade_state') in {'NOTPAY', 'USERPAYING', 'CLOSED', 'REVOKED'}:
        if result and result.get('trade_state') in {'CLOSED', 'REVOKED'}:
            order.status = 'CANCELLED' if order.status == 'CREATED' else order.status
            order.audit = {**(order.audit or {}), 'provider-close': {'kind': 'CLOSED'}}
        return None
    return _event(result, 'query:' + result['transaction_id'])
