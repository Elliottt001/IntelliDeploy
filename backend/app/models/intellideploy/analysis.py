from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False)
    runtime = Column(String, nullable=False)
    base_image = Column(String, nullable=False)
    install_cmd = Column(String, nullable=False)
    start_cmd = Column(String, nullable=False)
    ports = Column(String, nullable=False)
    needs_database = Column(Boolean, default=False, nullable=False)
    needs_ingress = Column(Boolean, default=True, nullable=False)
    env_vars = Column(JSON, nullable=False)
    raw_response = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    project = relationship("Project", back_populates="analysis")
