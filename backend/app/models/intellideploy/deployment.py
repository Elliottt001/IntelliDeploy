from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    # 部署状态
    status = Column(String, nullable=False)  # pending/building/running/failed/success

    # Sealos/K8s信息
    sealos_app_id = Column(String, nullable=True)  # Sealos应用ID
    runtime_name = Column(String, nullable=False)
    namespace = Column(String, nullable=True)  # K8s命名空间

    # 访问信息
    ingress_domain = Column(String, nullable=True)
    access_url = Column(String, nullable=True)  # 完整访问URL

    # 数据库信息
    database_name = Column(String, nullable=True)

    # 部署配置
    dockerfile_content = Column(Text, nullable=True)  # 使用的Dockerfile
    env_vars = Column(Text, nullable=True)  # JSON格式的环境变量

    # 错误和重试
    retry_count = Column(Integer, default=0, nullable=False)  # 重试次数
    error_message = Column(Text, nullable=True)  # 错误信息
    error_type = Column(String, nullable=True)  # 错误类型

    # 日志
    log = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    started_at = Column(DateTime, nullable=True)  # 开始部署时间
    finished_at = Column(DateTime, nullable=True)  # 完成时间
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # 关系
    project = relationship("Project", back_populates="deployments")
