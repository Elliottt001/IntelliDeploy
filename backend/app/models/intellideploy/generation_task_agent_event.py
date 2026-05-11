from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class GenerationTaskAgentEvent(Base):
    """多智能体执行事件表"""

    __tablename__ = "generation_task_agent_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(String, ForeignKey("generation_tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False, index=True)
    iteration_count = Column(Integer, nullable=True)
    agent_name = Column(String, nullable=False, index=True)
    stage = Column(String, nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    message = Column(Text, nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    generation_task = relationship("GenerationTask", primaryjoin="GenerationTaskAgentEvent.task_id == GenerationTask.task_id")
    deployment = relationship("Deployment")
