from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from .common import CONTRACT_VERSION, ContractBaseModel, StageName


class WebSocketEvent(ContractBaseModel):
    contract_version: str = Field(default=CONTRACT_VERSION)
    event_id: str = Field(description="Unique websocket event id")
    deployment_id: str = Field(description="Deployment identifier")
    event_type: Literal["status", "log", "agent_state", "error"]
    stage: StageName | None = None
    message: str = Field(default="")
    timestamp: datetime = Field(description="ISO8601 UTC timestamp")
    data: dict = Field(default_factory=dict)
