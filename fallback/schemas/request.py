from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .repo import RepoInfo


class UserIntentInput(BaseModel):
    target_output_type: str = "unknown"
    target_app_type: str = "unknown"
    expected_features: list[str] = Field(default_factory=list)
    preferred_language: str | None = None
    preferred_framework: str | None = None
    constraints: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="ignore")


class UserIntentSummary(UserIntentInput):
    raw_query: str = ""
    user_intent_state: str = "unclear"


class FallbackRequest(BaseModel):
    raw_query: str = ""
    user_intent: UserIntentInput = Field(default_factory=UserIntentInput)
    repo_info: RepoInfo = Field(default_factory=RepoInfo)
    file_tree: list[Any] = Field(default_factory=list)
    key_files: dict[str, str] = Field(default_factory=dict)
    project_id: str | None = None
    deployment_id: str | None = None
    request_id: str | None = None
    force_fallback: bool = False
    repair_exhausted: bool = False

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value

        data = dict(value)
        if "user_intent" not in data:
            data["user_intent"] = {
                "target_output_type": data.get("target_output_type", "unknown"),
                "target_app_type": data.get("target_app_type", "unknown"),
                "expected_features": data.get("expected_features", []),
                "preferred_language": data.get("preferred_language"),
                "preferred_framework": data.get("preferred_framework"),
                "constraints": data.get("constraints", {}),
            }

        if "repo_info" not in data:
            data["repo_info"] = {
                "rank": data.get("rank"),
                "retrieval_score": data.get("retrieval_score"),
                "repo_url": data.get("repo_url"),
                "default_branch": data.get("default_branch"),
                "description": data.get("description"),
                "topics": data.get("topics", []),
                "stars": data.get("stars"),
                "is_archived": data.get("is_archived", False),
                "last_commit_at": data.get("last_commit_at"),
            }

        data["file_tree"] = data.get("file_tree", [])
        data["key_files"] = data.get("key_files", {})
        return data

