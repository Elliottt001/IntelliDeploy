from pydantic import BaseModel, ConfigDict, Field


class GeneratedFile(BaseModel):
    path: str
    content: str


class ModifiedFile(BaseModel):
    path: str
    patch: str
    rationale: str | None = None


class DockerSpec(BaseModel):
    dockerfile_content: str
    start_command: str
    exposed_port: int
    base_image: str | None = None
    package_manager: str | None = None
    install_command: str | None = None
    healthcheck_path: str | None = None


class EnvVarSpec(BaseModel):
    name: str
    required: bool = True
    example_value: str | None = None
    description: str | None = None
    source: str = "DETECTED"


class FallbackPlan(BaseModel):
    decision: str
    generated_files: list[GeneratedFile] = Field(default_factory=list)
    modified_files: list[ModifiedFile] = Field(default_factory=list)
    docker_spec: DockerSpec | None = None
    env_vars: list[EnvVarSpec] = Field(default_factory=list)
    artifact_type: str | None = None
    artifact_path: str | None = None
    warnings: list[str] = Field(default_factory=list)
    summary: str | None = None
    deploy_ready: bool = False
    next_action: str | None = None
    missing_information: list[str] = Field(default_factory=list)
    request_id: str | None = None
    project_id: str | None = None
    deployment_id: str | None = None
    source_repo_url: str | None = None
    task_id: str | None = None

    model_config = ConfigDict(extra="ignore")
