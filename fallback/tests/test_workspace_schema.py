from pathlib import Path

from fallback.schemas.plan import DockerSpec, EnvVarSpec, FallbackPlan, GeneratedFile, ModifiedFile
from fallback.schemas.validation import ValidationCheck, ValidationError, ValidationResult
from fallback.schemas.workspace import ArtifactManifest, WorkspacePaths


def test_workspace_paths_for_task_builds_expected_layout() -> None:
    paths = WorkspacePaths.for_task(
        task_id="task-123",
        workspaces_root=Path("workspaces"),
        artifacts_root=Path("artifacts"),
    )

    assert paths.source_path == Path("workspaces/task-123/source")
    assert paths.workspace_path == Path("workspaces/task-123/workspace")
    assert paths.logs_path == Path("workspaces/task-123/logs")
    assert paths.artifact_path == Path("artifacts/task-123")
    assert paths.metadata_path == Path("workspaces/task-123/metadata.json")


def test_artifact_manifest_from_plan_captures_runtime_and_validation_summary() -> None:
    plan = FallbackPlan(
        decision="B",
        artifact_type="STITCHED_PROJECT",
        source_repo_url="https://github.com/example/repo",
        docker_spec=DockerSpec(
            dockerfile_content="FROM python:3.11-slim",
            start_command="uvicorn main:app --host 0.0.0.0 --port 8000",
            exposed_port=8000,
        ),
        env_vars=[EnvVarSpec(name="OPENAI_API_KEY")],
        generated_files=[GeneratedFile(path="Dockerfile", content="FROM python:3.11-slim")],
        modified_files=[ModifiedFile(path="main.py", patch="...")],
        warnings=["dockerfile generated"],
    )
    validation = ValidationResult(
        passed=False,
        checks=[ValidationCheck(name="output", passed=True)],
        errors=[ValidationError(code="ENTRYPOINT_INVALID", message="main.py missing app object")],
    )

    manifest = ArtifactManifest.from_plan(
        plan=plan,
        validation_result=validation,
        project_root=Path("artifacts/task-123"),
        dockerfile_path=Path("artifacts/task-123/Dockerfile"),
        source_type="REPO_PATCHED",
        commit_sha="abc123",
    )

    assert manifest.start_command == "uvicorn main:app --host 0.0.0.0 --port 8000"
    assert manifest.exposed_port == 8000
    assert manifest.generated_files == ["Dockerfile"]
    assert manifest.modified_files == ["main.py"]
    assert manifest.required_envs[0].name == "OPENAI_API_KEY"
    assert manifest.validation_summary.final_status == "FAIL"
    assert manifest.validation_summary.blocking_error_count == 1
    assert manifest.validation_summary.errors == ["main.py missing app object"]
