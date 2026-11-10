from sqlalchemy import BigInteger, Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from app.database import Base
from app.apps.models import new_id, utcnow


class Publication(Base):
    __tablename__ = 'publications'
    __table_args__ = (UniqueConstraint('app_id'), CheckConstraint('sponsor_limit_units > 0'))
    id = Column(String, primary_key=True, default=new_id)
    app_id = Column(String, ForeignKey('apps.id'), nullable=False)
    instance_id = Column(String, ForeignKey('instances.id'), nullable=False)
    version_id = Column(String, ForeignKey('app_versions.id'), nullable=False)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    payer_policy = Column(String, nullable=False)
    sponsor_period = Column(String, nullable=False, default='DAY')
    sponsor_limit_units = Column(BigInteger, nullable=False, default=100)
    visible = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class Favorite(Base):
    __tablename__ = 'publication_favorites'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    publication_id = Column(String, ForeignKey('publications.id'), primary_key=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class RecentUse(Base):
    __tablename__ = 'publication_recent_uses'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    publication_id = Column(String, ForeignKey('publications.id'), primary_key=True)
    instance_id = Column(String, ForeignKey('instances.id'), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class SponsorReservation(Base):
    __tablename__ = 'sponsor_reservations'
    operation_id = Column(String, ForeignKey('quota_reservations.operation_id'), primary_key=True)
    publication_id = Column(String, ForeignKey('publications.id'), nullable=False, index=True)
    period_start = Column(DateTime(timezone=True), nullable=False)
