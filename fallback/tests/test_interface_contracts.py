import json
from pathlib import Path

from fallback.async_tasks.redis_state import InMemoryTaskStateStore
from fallback.async_tasks.tasks import run_fallback_task, submit_fallback_task
from fallback.interfaces import (
    ContractMappingError,
    get_external_task_artifact,
    get_external_task_status,
    submit_external_fallback_task,
    submit_repair_task,
)


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def _build_external_submit_request() -> dict:
    fixture = _load_fixture("fastapi_good.json")
    return {
        "project_id": "proj-123",
        "deployment_id": "dep-456",
        "request_id": "req-789",
        "trigger_reason": "LOW_SCORE_ALL",
        "original_prompt": fixture["raw_query"],
        "generation_mode": "AUTO",
        "preferred_stack": {
            "backend": "FastAPI",
            "runtime": "python3.11",
        },
        "repo_profile": {
            "source_repo_url": fixture["repo_info"]["repo_url"],
            "detected_languages": ["Python"],
            "detected_frameworks": ["FastAPI"],
            "package_manager": "pip",
            "entrypoints": ["main.py"],
            "dependency_files": ["requirements.txt"],
            "has_valid_dockerfile": True,
            "readme_summary": fixture["repo_info"]["description"],
        },
        "constraints": {
            "timeout_seconds": 60,
            "target_port": 8000,
            "must_provide_dockerfile": True,
            "must_provide_healthcheck": True,
        },
    }


def test_external_submit_status_and_artifact_contracts() -> None:
    store = InMemoryTaskStateStore()

    submit_response = submit_external_fallback_task(_build_external_submit_request(), store=store)
    assert submit_response.accepted is True
    assert submit_response.status == "QUEUED"

    saved_request = store.get_request(submit_response.task_id)
    assert saved_request is not None

    run_fallback_task(submit_response.task_id, saved_request, store=store)

    status = get_external_task_status(submit_response.task_id, store=store)
    artifact = get_external_task_artifact(submit_response.task_id, store=store)

    assert status is not None
    assert status.project_id == "proj-123"
    assert status.deployment_id == "dep-456"
    assert status.status == "SUCCEEDED"

    assert artifact is not None
    assert artifact.artifact_type in {"TEMPLATE_PROJECT", "STITCHED_PROJECT"}
    assert artifact.dockerfile_content.startswith("FROM")
    assert artifact.runtime.start_command == "uvicorn main:app --host 0.0.0.0 --port 8000"
    assert artifact.runtime.exposed_port == 8000


def test_external_status_contract_rejects_missing_required_ids() -> None:
    store = InMemoryTaskStateStore()
    payload = {"raw_query": "deploy a simple app"}

    create_response = submit_fallback_task(payload, store=store)

    try:
        get_external_task_status(create_response.task_id, store=store)
    except ContractMappingError:
        pass
    else:
        raise AssertionError("Expected ContractMappingError when project_id/deployment_id are missing.")


def test_submit_repair_task_reuses_saved_request_context() -> None:
    store = InMemoryTaskStateStore()
    submit_response = submit_external_fallback_task(_build_external_submit_request(), store=store)

    repair_response = submit_repair_task(
        {
            "project_id": "proj-123",
            "deployment_id": "dep-999",
            "source_task_id": submit_response.task_id,
            "failed_stage": "HEALTHCHECK",
            "error_type": "PORT_MISMATCH",
            "sanitized_error_log": "Service listened on 3000 instead of 8000.",
            "last_dockerfile_content": "FROM python:3.11-slim",
            "healthcheck_result": {
                "status_code": 503,
                "response_snippet": "connection refused",
            },
            "retry_count": 1,
            "regen_mode": "REGENERATE",
            "constraints": {
                "timeout_seconds": 45,
            },
        },
        store=store,
    )

    saved_request = store.get_request(repair_response.task_id)
    assert saved_request is not None
    assert saved_request["deployment_id"] == "dep-999"
    assert saved_request["force_fallback"] is True
    assert saved_request["repair_exhausted"] is True
    assert (
        saved_request["user_intent"]["constraints"]["repair_context"]["source_task_id"] == submit_response.task_id
    )
