import json
from pathlib import Path

from fallback.async_tasks.celery_app import CeleryUnavailableError, get_celery_app, is_async_enabled
from fallback.async_tasks.redis_state import InMemoryTaskStateStore
from fallback.async_tasks.tasks import get_task_artifact, get_task_status, run_fallback_task, submit_fallback_task


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def test_async_task_lifecycle() -> None:
    store = InMemoryTaskStateStore()
    payload = _load_fixture("fastapi_good.json")

    create_response = submit_fallback_task(payload, store=store)
    assert create_response.status == "QUEUED"
    if not is_async_enabled():
        assert "async dispatch unavailable" in (create_response.message or "")

    run_fallback_task(create_response.task_id, payload, store=store)

    status = get_task_status(create_response.task_id, store=store)
    artifact = get_task_artifact(create_response.task_id, store=store)

    assert status is not None
    assert status.status == "SUCCEEDED"
    assert status.current_stage == "completed"
    assert artifact is not None
    assert artifact.runtime.start_command == "uvicorn main:app --host 0.0.0.0 --port 8000"


def test_async_task_manual_required_flow() -> None:
    store = InMemoryTaskStateStore()
    payload = _load_fixture("missing_info.json")

    create_response = submit_fallback_task(payload, store=store)
    run_fallback_task(create_response.task_id, payload, store=store)

    status = get_task_status(create_response.task_id, store=store)
    artifact = get_task_artifact(create_response.task_id, store=store)

    assert status is not None
    assert status.status == "SUCCEEDED"
    assert status.current_stage == "manual_required"
    assert artifact is None


def test_get_celery_app_raises_when_async_is_disabled() -> None:
    if is_async_enabled():
        app = get_celery_app()
        assert app is not None
        return

    try:
        get_celery_app()
    except CeleryUnavailableError:
        pass
    else:
        raise AssertionError("Expected CeleryUnavailableError when async is disabled.")
