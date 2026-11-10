from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


def new_id():
    return str(uuid4())


def utcnow():
    return datetime.now(timezone.utc)


class App(Base):
    __tablename__ = 'apps'
    id = Column(String, primary_key=True, default=new_id)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String, nullable=False)
    prompt = Column(Text, nullable=False)
    active_version_id = Column(String)
    source_version_id = Column(String)
    candidate_version_id = Column(String)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class Conversation(Base):
    __tablename__ = 'conversations'
    id = Column(String, primary_key=True, default=new_id)
    app_id = Column(String, ForeignKey('apps.id'), nullable=False, unique=True)


class Message(Base):
    __tablename__ = 'messages'
    __table_args__ = (UniqueConstraint('app_id', 'sequence'),)
    id = Column(String, primary_key=True, default=new_id)
    app_id = Column(String, ForeignKey('apps.id'), nullable=False)
    sequence = Column(BigInteger, nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class RequirementRecord(Base):
    __tablename__ = 'requirement_records'
    __table_args__ = (UniqueConstraint('app_id', 'revision'),)
    id = Column(String, primary_key=True, default=new_id)
    app_id = Column(String, ForeignKey('apps.id'), nullable=False)
    revision = Column(Integer, nullable=False)
    requirement = Column(JSONB, nullable=False)
    review = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class AppVersion(Base):
    __tablename__ = 'app_versions'
    id = Column(String, primary_key=True, default=new_id)
    app_id = Column(String, ForeignKey('apps.id'), nullable=False, index=True)
    requirement_revision = Column(Integer, nullable=False)
    sources = Column(JSONB, nullable=False, default=list)
    template_version = Column(String)
    manifest = Column(JSONB, nullable=False)
    validation = Column(JSONB, nullable=False)
    artifact_path = Column(Text)
    immutable = Column(Boolean, default=True, nullable=False)
    delivery = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class Instance(Base):
    __tablename__ = 'instances'
    id = Column(String, primary_key=True, default=new_id)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    app_id = Column(String, ForeignKey('apps.id'), nullable=False, index=True)
    version_id = Column(String, ForeignKey('app_versions.id'))
    target_id = Column(String, ForeignKey('deployment_targets.id'))
    status = Column(String, nullable=False, default='PENDING')
    url = Column(Text)
    data_namespace = Column(String, unique=True)
    secret_ref = Column(String)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class RequestRecord(Base):
    __tablename__ = 'request_records'
    __table_args__ = (UniqueConstraint('user_id', 'action', 'key'),)
    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String, nullable=False)
    key = Column(String, nullable=False)
    payload_hash = Column(String, nullable=False)
    response = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
