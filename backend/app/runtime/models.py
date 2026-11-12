from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base
from app.apps.models import new_id, utcnow


class DeploymentTarget(Base):
    __tablename__ = 'deployment_targets'
    id = Column(String, primary_key=True)
    kind = Column(String, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    health = Column(String, nullable=False, default='UNKNOWN')
    architecture = Column(String, nullable=False, default='amd64')
    capacity = Column(JSONB, nullable=False, default=dict)
    domain_suffix = Column(String)
    secret_ref = Column(Text)


class ResourceRecord(Base):
    __tablename__ = 'resource_records'
    id = Column(String, primary_key=True, default=new_id)
    type = Column(String, nullable=False)
    target_id = Column(String, ForeignKey('deployment_targets.id'))
    app_id = Column(String, ForeignKey('apps.id'))
    job_id = Column(String, ForeignKey('jobs.id'))
    version_id = Column(String, ForeignKey('app_versions.id'))
    operation_id = Column(String, nullable=False, index=True)
    state = Column(String, nullable=False)
    reference = Column(Text, nullable=False)
    metadata_json = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class ResourceObservation(Base):
    __tablename__ = 'resource_observations'
    __table_args__ = (UniqueConstraint('instance_id', 'observed_at'),)
    id = Column(String, primary_key=True, default=new_id)
    instance_id = Column(String, ForeignKey('instances.id'), nullable=False, index=True)
    target_id = Column(String, ForeignKey('deployment_targets.id'))
    observed_at = Column(DateTime(timezone=True), nullable=False)
    state = Column(String, nullable=False)
    compute_state = Column(String, nullable=False)
    resource_spec = Column(JSONB, nullable=False, default=dict)
    storage_mb = Column(BigInteger, nullable=False, default=0)
    evidence = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class AdminAudit(Base):
    __tablename__ = 'admin_audits'
    id = Column(String, primary_key=True, default=new_id)
    actor = Column(String, nullable=False)
    action = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    details = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class PlatformControl(Base):
    __tablename__ = 'platform_controls'
    name = Column(String, primary_key=True)
    value = Column(JSONB, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class CleanupAction(Base):
    __tablename__ = 'cleanup_actions'
    __table_args__ = (UniqueConstraint('resource_id','action_kind'),)
    id = Column(String, primary_key=True, default=new_id)
    resource_id = Column(String, ForeignKey('resource_records.id'),nullable=False)
    action_kind = Column(String,nullable=False,default='REMOVE')
    status = Column(String,nullable=False,default='QUEUED')
    reason = Column(String,nullable=False)
    previous_state = Column(String)
    error_code = Column(String)
    lease_token = Column(String)
    lease_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True),default=utcnow,nullable=False)
    updated_at = Column(DateTime(timezone=True),default=utcnow,nullable=False)
