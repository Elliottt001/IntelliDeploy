from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class DeploymentEvent(Base):
    """部署事件/日志摘要表"""
    __tablename__ = "deployment_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False, index=True)

    # 事件信息
    phase = Column(String, nullable=False)  # build / run / health_check / heal
    level = Column(String, nullable=False, default="info")  # info / warning / error
    message = Column(Text, nullable=False)
    error_type = Column(String, nullable=True)

    # 时间戳
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # 关系
    deployment = relationship("Deployment")
