from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, String, Text
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
