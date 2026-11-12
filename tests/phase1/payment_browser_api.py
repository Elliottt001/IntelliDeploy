"""Browser integration fixture: real API/PG/crypto, substituted payment provider only."""
import os
import re
import sys
from pathlib import Path

from sqlalchemy.engine import make_url

url = make_url(os.environ['DATABASE_URL'])
if (url.drivername != 'postgresql+psycopg'
        or url.host not in {'127.0.0.1', 'localhost'}
        or url.port != 55432
        or url.username != 'intellideploy'
        or not re.fullmatch(r'intellideploy_(?:test(?:_[a-z0-9_]+)?|mobile_figma_[a-z0-9_]+)', url.database or '')
        or dict(url.query) not in ({}, {'gssencmode': 'disable'})):
    raise RuntimeError('Payment browser fixture requires a local IntelliDeploy test database')

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

root = Path(__file__).resolve().parents[2]
keys = root / 'artifacts/payment-browser-fixture'
keys.mkdir(parents=True, exist_ok=True, mode=0o700)
private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
key_path = keys / 'private.pem'
descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(descriptor, 'wb') as file:
    file.write(private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
public_path = keys / 'public.pem'
public_path.write_bytes(private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
os.environ.update(ALIPAY_APP_ID='browser-test-app', ALIPAY_SELLER_ID='browser-test-seller', ALIPAY_PUBLIC_KEY_FILE=str(public_path),
    ALIPAY_PRIVATE_KEY_FILE=str(key_path), PAYMENT_PLATFORM_ORIGIN='https://platform.test')

from app.billing import orders, alipay
from app.main import app
import uvicorn

# Only this test entrypoint substitutes an external channel. Production has no fixture switch.
orders.provider_checkout = lambda order: ('https://qr.alipay.com/browser-fixture', 'QR')
alipay.query_payment = lambda order: None
uvicorn.run(app, host='127.0.0.1', port=int(sys.argv[1]))
