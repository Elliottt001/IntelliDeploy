from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.billing.models import ProductSku
from app.core.types import QuotaSku
from app.database import get_db

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def list_enabled_skus(db: Session) -> list[QuotaSku]:
    rows = db.scalars(
        select(ProductSku).where(ProductSku.enabled.is_(True)).order_by(ProductSku.id)
    )
    return [
        QuotaSku(
            id=row.id,
            name=row.name,
            provider=row.provider,
            currency=row.currency,
            amount_minor=row.amount_minor,
            units=row.units,
            period=row.period,
        )
        for row in rows
    ]


@router.get("/skus", response_model=list[QuotaSku])
def public_skus(db: Session = Depends(get_db)):
    return list_enabled_skus(db)
