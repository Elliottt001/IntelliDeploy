from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Boolean, JSON, func
from sqlalchemy.orm import relationship

from app.database import Base


class GenerationTask(Base):
    """降级生成任务表"""
    __tablename__ = "generation_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(String, unique=True, nullable=False, index=True)  # Celery任务ID
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False, index=True)

    # 触发信息
    trigger_reason = Column(String, nullable=False)  # LOW_SCORE_ALL / REPAIR_EXHAUSTED / FORCE_FALLBACK
    generation_mode = Column(String, nullable=False)  # AUTO / VIBE / COMPONENT_REASSEMBLY

    # 任务状态
    status = Column(String, nullable=False, default="QUEUED")  # QUEUED / RUNNING / GENERATING / STITCHING / PACKAGING / SUCCEEDED / FAILED
    current_stage = Column(String, nullable=True)
    progress_message = Column(String, nullable=True)

    # 输入参数(JSON存储)
    original_prompt = Column(Text, nullable=False)
    repo_profile = Column(JSON, nullable=True)
    preferred_stack = Column(JSON, nullable=True)
    constraints = Column(JSON, nullable=True)
    evaluation_score = Column(Integer, nullable=True)
    missing_components = Column(JSON, nullable=True)

    # 产物信息
    artifact_ready = Column(Boolean, default=False, nullable=False)
    artifact_type = Column(String, nullable=True)  # TEMPLATE_PROJECT / STITCHED_PROJECT
    artifact_path = Column(String, nullable=True)
    artifact_uri = Column(String, nullable=True)
    dockerfile_content = Column(Text, nullable=True)

    # 运行时信息(JSON存储)
    runtime_info = Column(JSON, nullable=True)
    required_envs = Column(JSON, nullable=True)

    # 错误信息
    error_code = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    recoverable = Column(Boolean, nullable=True)

    # 其他
    warnings = Column(JSON, nullable=True)
    summary = Column(Text, nullable=True)
    deploy_ready = Column(Boolean, default=False, nullable=False)

    # 时间戳
    queued_at = Column(DateTime, server_default=func.now(), nullable=False)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # 关系
    project = relationship("Project")
    deployment = relationship("Deployment")
