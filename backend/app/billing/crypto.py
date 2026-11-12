import base64
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from app.billing.orders import PaymentMismatch, PaymentUnavailable


def secret_file(path):
    try:
        if not path:
            raise OSError()
        return Path(path).read_bytes()
    except OSError as exc:
        raise PaymentUnavailable() from exc


def sign(payload, path):
    try:
        key = serialization.load_pem_private_key(secret_file(path), password=None)
        return base64.b64encode(key.sign(payload, padding.PKCS1v15(), hashes.SHA256())).decode()
    except (ValueError, TypeError) as exc:
        raise PaymentUnavailable() from exc


def verify(payload, signature, path):
    try:
        material = secret_file(path)
        key = x509.load_pem_x509_certificate(material).public_key() if b'BEGIN CERTIFICATE' in material else serialization.load_pem_public_key(material)
        key.verify(base64.b64decode(signature, validate=True), payload, padding.PKCS1v15(), hashes.SHA256())
    except PaymentUnavailable:
        raise
    except Exception as exc:
        raise PaymentMismatch() from exc
