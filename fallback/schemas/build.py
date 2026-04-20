from pydantic import BaseModel, ConfigDict


class BuildError(BaseModel):
    failed_stage: str
    error_summary: str

    model_config = ConfigDict(extra="ignore")


class BuildContext(BaseModel):
    attempted: bool = False
    retry_count: int = 0
    failed_stage: str | None = None
    error_summary: str | None = None

    model_config = ConfigDict(extra="ignore")

