from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base


def _id() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AppLoginCode(Base):
    __tablename__ = "app_login_codes"

    id = Column(String, primary_key=True, default=_id)
    code_hash = Column(String, nullable=False, unique=True, index=True)
    instance_id = Column(String, ForeignKey("instances.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    callback = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class InstanceCredential(Base):
    __tablename__ = "instance_credentials"

    instance_id = Column(String, ForeignKey("instances.id"), primary_key=True)
    token_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    revoked_at = Column(DateTime(timezone=True))

