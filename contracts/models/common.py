from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


CONTRACT_VERSION = "1.0.0"


class ContractBaseModel(BaseModel):
    """Base model for all contract payloads."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ContractEnvelope(ContractBaseModel):
    """Unified envelope for frontend-backend communication."""

    contract_version: str = Field(default=CONTRACT_VERSION, description="Contract schema version")
    message_id: str = Field(description="Unique message id")
    timestamp: datetime = Field(description="ISO8601 UTC timestamp")
    source: Literal["frontend", "backend", "worker", "agent"] = Field(description="Message source")
    payload: dict[str, Any] = Field(default_factory=dict, description="Typed payload body")


class StageName(str, Enum):
    THINKING = "THINKING"
    BUILDING = "BUILDING"
    REVIEWING = "REVIEWING"
    SECURITY_CHECK = "SECURITY_CHECK"
    HEALING = "HEALING"
    FINALIZE = "FINALIZE"


class AgentRole(str, Enum):
    BUILDER = "BUILDER"
    REVIEWER = "REVIEWER"
    SECURITY = "SECURITY"


class Decision(str, Enum):
    APPROVE = "APPROVE"
    REVISE = "REVISE"
    REJECT = "REJECT"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
