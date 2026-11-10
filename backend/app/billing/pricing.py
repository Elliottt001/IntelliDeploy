from fastapi import HTTPException
from app.billing.models import PriceRule
from app.database import SessionLocal


def resolve_price(kind, version, session=None):
    if session is None:
        with SessionLocal() as owned:
            return resolve_price(kind, version, owned)
    price = session.get(PriceRule, {"kind": kind, "version": version})
    if price is None:
        raise HTTPException(
            503,
            {
                "code": "PRICE_UNAVAILABLE",
                "message": "该用量价格尚未配置",
                "retryable": True,
            },
        )
    return price.numerator, price.denominator
