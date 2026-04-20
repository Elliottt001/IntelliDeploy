from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ValidationError(BaseModel):
    code: str
    message: str
    file_path: str | None = None
    severity: str = "blocking"

    model_config = ConfigDict(extra="ignore")


class ValidationCheck(BaseModel):
    name: str
    passed: bool
    severity: str = "info"
    details: str | None = None
    file_path: str | None = None
    code: str | None = None

    model_config = ConfigDict(extra="ignore")


class ValidationResult(BaseModel):
    passed: bool
    checks: list[ValidationCheck] = Field(default_factory=list)
    errors: list[ValidationError] = Field(default_factory=list)
    final_status: str = "PASS"
    blocking_error_count: int = 0
    warning_count: int = 0
    summary: str | None = None
    error_context: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="ignore")
