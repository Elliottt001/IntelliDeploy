from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base
from app.apps.models import new_id, utcnow


class PriceRule(Base):
    __tablename__ = "price_rules"
    __table_args__ = (CheckConstraint("numerator >= 0 AND denominator > 0"),)
    kind = Column(String, primary_key=True)
    version = Column(String, primary_key=True)
    numerator = Column(BigInteger, nullable=False)
    denominator = Column(BigInteger, nullable=False)


class QuotaGrant(Base):
    __tablename__ = "quota_grants"
    __table_args__ = (
        UniqueConstraint("payer_id", "grant_key"),
        CheckConstraint(
            "balance_units >= 0 AND reserved_units >= 0 AND balance_units >= reserved_units"
        ),
    )
    id = Column(String, primary_key=True, default=new_id)
    payer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    grant_key = Column(String, nullable=False)
    units = Column(BigInteger, nullable=False)
    balance_units = Column(BigInteger, nullable=False)
    reserved_units = Column(BigInteger, nullable=False, default=0)
    source = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class Reservation(Base):
    __tablename__ = "quota_reservations"
    __table_args__ = (
        CheckConstraint(
            "max_units > 0 AND used_units >= 0 AND used_units <= max_units"
        ),
    )
    id = Column(String, primary_key=True, default=new_id)
    payer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    operation_id = Column(String, nullable=False, unique=True)
    max_units = Column(BigInteger, nullable=False)
    used_units = Column(BigInteger, nullable=False, default=0)
    status = Column(String, nullable=False, default="OPEN")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class ReservationAllocation(Base):
    __tablename__ = "reservation_allocations"
    __table_args__ = (UniqueConstraint("reservation_id", "grant_id"),)
    id = Column(String, primary_key=True, default=new_id)
    reservation_id = Column(String, ForeignKey("quota_reservations.id"), nullable=False)
    grant_id = Column(String, ForeignKey("quota_grants.id"), nullable=False)
    remaining_units = Column(BigInteger, nullable=False)
    sequence = Column(Integer, nullable=False)


class UsageEntry(Base):
    __tablename__ = "usage_entries"
    id = Column(String, primary_key=True, default=new_id)
    operation_id = Column(String, nullable=False, unique=True)
    payer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reservation_id = Column(String, ForeignKey("quota_reservations.id"))
    kind = Column(String, nullable=False)
    units = Column(BigInteger, nullable=False)
    cost_units = Column(BigInteger, nullable=False)
    price_version = Column(String, nullable=False)
    metadata_json = Column(JSONB, nullable=False, default=dict)
    allocations = Column(JSONB, nullable=False, default=list)
    reversal_of = Column(String, ForeignKey("usage_entries.id"), unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class UnknownUsage(Base):
    __tablename__ = "unknown_usage"
    id = Column(String, primary_key=True, default=new_id)
    operation_id = Column(String, nullable=False, unique=True)
    payer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    kind = Column(String, nullable=False)
    status = Column(String, nullable=False, default="UNKNOWN")
    metadata_json = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class ProductSku(Base):
    __tablename__ = "product_skus"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    currency = Column(String, nullable=False)
    amount_minor = Column(BigInteger, nullable=False)
    units = Column(BigInteger, nullable=False)
    period = Column(String)
    enabled = Column(Boolean, nullable=False, default=True)


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(String, primary_key=True, default=new_id)
    payer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sku_id = Column(String, ForeignKey("product_skus.id"), nullable=False)
    provider = Column(String, nullable=False)
    status = Column(String, nullable=False)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    cancelled = Column(Boolean, nullable=False, default=False)
