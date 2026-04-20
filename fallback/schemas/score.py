from pydantic import BaseModel, ConfigDict, Field


class ScoreReason(BaseModel):
    code: str
    message: str

    model_config = ConfigDict(extra="ignore")


class DecisionSignals(BaseModel):
    a_signals: list[str] = Field(default_factory=list)
    b_signals: list[str] = Field(default_factory=list)
    c_signals: list[str] = Field(default_factory=list)
    d_signals: list[str] = Field(default_factory=list)
    blocking_signals: list[str] = Field(default_factory=list)
    repair_signals: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class DeployabilityScore(BaseModel):
    score: int | None = None
    reasons: list[ScoreReason] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")

