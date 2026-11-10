from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String, Text

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


class InstanceDataSpace(Base):
    __tablename__ = "instance_data_spaces"

    instance_id = Column(String, ForeignKey("instances.id"), primary_key=True)
    database_name = Column(String, nullable=False, unique=True)
    role_name = Column(String, nullable=False, unique=True)
    secret_ref = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    destroyed_at = Column(DateTime(timezone=True))


class FileRecord(Base):
    __tablename__ = "file_records"

    id = Column(String, primary_key=True, default=_id)
    instance_id = Column(String, ForeignKey("instances.id"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    path = Column(Text, nullable=False)
    filename = Column(Text, nullable=False)
    content_type = Column(String, nullable=False)
    public = Column(Boolean, nullable=False, default=False)
    size = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

