from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class GenerationTaskArtifactVersion(Base):
    """多智能体构建产物版本表"""

    __tablename__ = "generation_task_artifact_versions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(String, ForeignKey("generation_tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False, index=True)
    artifact_version = Column(String, nullable=True, index=True)
    iteration_count = Column(Integer, nullable=True)
    is_approved = Column(Boolean, nullable=True)
    dockerfile_content = Column(Text, nullable=True)
    current_configs = Column(JSON, nullable=True)
    review_history = Column(JSON, nullable=True)
    security_reports = Column(JSON, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    generation_task = relationship("GenerationTask", primaryjoin="GenerationTaskArtifactVersion.task_id == GenerationTask.task_id")
    deployment = relationship("Deployment")
