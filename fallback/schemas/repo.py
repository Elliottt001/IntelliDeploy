from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FileTreeNode(BaseModel):
    path: str
    type: str = "file"
    children: list["FileTreeNode"] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class KeyFile(BaseModel):
    path: str
    content: str


class RepoInfo(BaseModel):
    rank: int | None = None
    retrieval_score: float | None = None
    repo_url: str | None = None
    default_branch: str | None = None
    description: str | None = None
    topics: list[str] = Field(default_factory=list)
    stars: int | None = None
    is_archived: bool = False
    last_commit_at: str | None = None

    model_config = ConfigDict(extra="ignore")


class RuntimeChainObservations(BaseModel):
    start_script_points_to_existing_entry: str = "unknown"
    entry_contains_runnable_object: str = "unknown"
    dependencies_cover_detected_framework: str = "unknown"
    build_command_matches_project_type: str = "unknown"
    port_detected: str = "unknown"
    host_binding_observed: str = "unknown"
    env_vars_required: list[str] = Field(default_factory=list)
    readme_scripts_conflict: str = "unknown"
    dockerfile_entry_conflict: str = "unknown"

    model_config = ConfigDict(extra="ignore")


class EnvVarDetail(BaseModel):
    name: str
    required: bool = True
    example_value: str | None = None
    description: str | None = None
    source: str = "DETECTED"

    model_config = ConfigDict(extra="ignore")


class RepoProfile(BaseModel):
    source_repo_url: str | None = None
    detected_languages: list[str] = Field(default_factory=list)
    detected_frameworks: list[str] = Field(default_factory=list)
    package_manager: str | None = None
    entrypoints: list[str] = Field(default_factory=list)
    dependency_files: list[str] = Field(default_factory=list)
    has_valid_dockerfile: bool | None = None
    readme_summary: str | None = None

    model_config = ConfigDict(extra="ignore")


class RepoFactSummary(BaseModel):
    repo_url: str | None = None
    rank: int | None = None
    retrieval_score: float | None = None
    description: str | None = None
    topics: list[str] = Field(default_factory=list)
    stars: int | None = None
    is_archived: bool = False
    last_commit_at: str | None = None
    repo_material_state: str = "insufficient"
    has_real_code: bool = False
    has_dependency_file: bool = False
    dependency_files: list[str] = Field(default_factory=list)
    dependency_summary: str | None = None
    package_manager: str = "unknown"
    lock_files: list[str] = Field(default_factory=list)
    package_manager_confidence: str = "low"
    has_entry_file: bool = False
    entry_candidates: list[str] = Field(default_factory=list)
    entry_summary: str | None = None
    has_start_script: bool = False
    detected_start_commands: list[str] = Field(default_factory=list)
    has_build_script: bool = False
    detected_build_commands: list[str] = Field(default_factory=list)
    has_dockerfile: bool = False
    has_valid_dockerfile: bool = False
    dockerfile_summary: str | None = None
    has_docker_compose: bool = False
    compose_summary: str | None = None
    has_config_file: bool = False
    config_files: list[str] = Field(default_factory=list)
    detected_language: str = "unknown"
    detected_languages: list[str] = Field(default_factory=list)
    detected_framework: str = "unknown"
    detected_frameworks: list[str] = Field(default_factory=list)
    detected_project_type_by_rule: str = "unknown"
    detected_project_type_by_semantics: str = "unknown"
    preferred_stack: dict[str, str | None] = Field(
        default_factory=lambda: {
            "frontend": None,
            "backend": None,
            "database": None,
            "runtime": None,
        }
    )
    detected_ports: list[int] = Field(default_factory=list)
    target_port_candidates: list[int] = Field(default_factory=list)
    detected_env_vars: list[str] = Field(default_factory=list)
    env_var_sources: dict[str, str] = Field(default_factory=dict)
    env_var_details: list[EnvVarDetail] = Field(default_factory=list)
    readme_summary: str | None = None
    missing_items: list[str] = Field(default_factory=list)
    missing_components: list[str] = Field(default_factory=list)
    conflict_items: list[str] = Field(default_factory=list)
    risk_items: list[str] = Field(default_factory=list)
    repo_empty_or_near_empty: bool = False
    only_docs_or_notes_or_template: bool = False
    runtime_chain_observations: RuntimeChainObservations = Field(default_factory=RuntimeChainObservations)
    warnings: list[str] = Field(default_factory=list)
    uncertain_points: list[str] = Field(default_factory=list)
    ai_extraction_required: bool = False
    ai_extraction_reason: list[str] = Field(default_factory=list)
    framework_evidence: list[str] = Field(default_factory=list)
    env_warnings: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")

    @classmethod
    def from_repo_info(cls, repo_info: RepoInfo) -> "RepoFactSummary":
        return cls(
            repo_url=repo_info.repo_url,
            rank=repo_info.rank,
            retrieval_score=repo_info.retrieval_score,
            description=repo_info.description,
            topics=list(repo_info.topics),
            stars=repo_info.stars,
            is_archived=repo_info.is_archived,
            last_commit_at=repo_info.last_commit_at,
        )


class ExtractionSummary(BaseModel):
    user_intent_summary: dict[str, Any]
    repo_fact_summary: RepoFactSummary

