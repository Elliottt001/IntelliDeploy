from sqlalchemy import BigInteger, Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base
from app.apps.models import new_id, utcnow

ACTIVE_STATUSES = ('QUEUED', 'RUNNING', 'WAITING_USER', 'PAUSED_QUOTA')


class Job(Base):
    __tablename__ = 'jobs'
    __table_args__ = (
        Index('one_active_job_per_app', 'app_id', unique=True, postgresql_where=text("status IN ('QUEUED','RUNNING','WAITING_USER','PAUSED_QUOTA')")),
        CheckConstraint('budget_units > 0 AND used_units >= 0'),
    )
    id = Column(String, primary_key=True, default=new_id)
    app_id = Column(String, ForeignKey('apps.id'), nullable=False)
    operation_id = Column(String, unique=True, nullable=False)
    kind = Column(String, nullable=False)
    status = Column(String, nullable=False, default='QUEUED')
    phase = Column(String, nullable=False, default='clarifying')
    lease_owner = Column(String)
    lease_until = Column(DateTime(timezone=True))
    lease_generation = Column(BigInteger, nullable=False, default=0)
    checkpoint = Column(JSONB, nullable=False, default=dict)
    requirement_revision = Column(Integer)
    reservation_id = Column(String)
    budget_units = Column(BigInteger, nullable=False)
    used_units = Column(BigInteger, nullable=False, default=0)
    question = Column(Text)
    error = Column(JSONB)
    result = Column(JSONB)
    cancel_requested = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class JobEvent(Base):
    __tablename__ = 'job_events'
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    job_id = Column(String, ForeignKey('jobs.id'), nullable=False, index=True)
    kind = Column(String, nullable=False)
    public_payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class ToolCallRecord(Base):
    __tablename__ = 'tool_call_records'
    __table_args__ = (UniqueConstraint('job_id', 'call_id'),)
    id = Column(String, primary_key=True, default=new_id)
    job_id = Column(String, ForeignKey('jobs.id'), nullable=False)
    call_id = Column(String, nullable=False)
    status = Column(String, nullable=False)
    input_summary = Column(JSONB, nullable=False)
    result = Column(JSONB)
    usage = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class MaintenanceLease(Base):
    __tablename__ = 'maintenance_leases'
    name = Column(String, primary_key=True)
    owner = Column(String)
    lease_until = Column(DateTime(timezone=True))
    generation = Column(BigInteger, nullable=False, default=0)
    last_success = Column(DateTime(timezone=True))
    retry_after = Column(DateTime(timezone=True))
    error = Column(JSONB)
