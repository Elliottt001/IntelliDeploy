from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from .common import CONTRACT_VERSION, ContractBaseModel, StageName


class AsyncTaskSubmitRequest(ContractBaseModel):
    contract_version: str = Field(default=CONTRACT_VERSION)
    task_type: Literal["fallback", "build", "heal"]
    request_id: str
    payload: dict = Field(default_factory=dict)


class AsyncTaskState(ContractBaseModel):
    contract_version: str = Field(default=CONTRACT_VERSION)
    task_id: str
    status: Literal["queued", "running", "succeeded", "failed"]
    stage: StageName | None = None
    progress_message: str = ""
    updated_at: datetime
    result: dict = Field(default_factory=dict)
