from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .repo import RepoFactSummary
from .request import UserIntentSummary


class EvaluationResult(BaseModel):
    candidate_decision: str = "unknown"
    evaluation_score: int | None = None
    decision: str = "D"
    reason: str = "unknown"
    why_not_A: list[str] = Field(default_factory=list)
    repair_targets: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    requires_user_confirmation: bool = False

    model_config = ConfigDict(extra="ignore")


class ClassifyResponse(BaseModel):
    user_intent_summary: UserIntentSummary
    repo_fact_summary: RepoFactSummary
    evaluation_result: EvaluationResult
    hu_generation_request: dict[str, Any] | None = None

    model_config = ConfigDict(extra="ignore")

