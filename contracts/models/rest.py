from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from .common import CONTRACT_VERSION, ContractBaseModel


class RestMeta(ContractBaseModel):
    contract_version: str = Field(default=CONTRACT_VERSION)
    request_id: str = Field(description="Client or server generated request id")
    timestamp: datetime = Field(description="ISO8601 UTC timestamp")


class RestError(ContractBaseModel):
    code: str = Field(description="Stable machine-readable error code")
    message: str = Field(description="Human-readable error message")


class RestResponse(ContractBaseModel):
    meta: RestMeta
    status: Literal["ok", "error"]
    data: dict = Field(default_factory=dict)
    error: RestError | None = None
