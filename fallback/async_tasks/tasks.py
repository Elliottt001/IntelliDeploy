from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import ValidationError as PydanticValidationError

from fallback.schemas.request import FallbackRequest
from fallback.schemas.workspace import DeployArtifact, MaterializeResult
from fallback.services.fallback_service import FallbackService

from .celery_app import CeleryUnavailableError, celery_app, get_celery_app, is_async_enabled
from .redis_state import TaskStateStore, get_state_store
from .task_schema import (
    ArtifactResponse,
    ArtifactRuntime,
    TaskCreateResponse,
    TaskStage,
    TaskState,
    TaskStatus,
)


TASK_NAME = "fallback.async_tasks.run_fallback_task"
_CELERY_RUN_FALLBACK_TASK = None


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _normalize_request(payload: FallbackRequest | dict[str, Any]) -> FallbackRequest:
    return payload if isinstance(payload, FallbackRequest) else FallbackRequest.model_validate(payload)


def _recoverable_error_details(exc: Exception) -> tuple[str, bool]:
    if isinstance(exc, PydanticValidationError):
        return "INVALID_REQUEST", False
    if isinstance(exc, CeleryUnavailableError):
        return "ASYNC_UNAVAILABLE", False
    if isinstance(exc, TimeoutError):
        return "TIMEOUT", True
    if isinstance(exc, (ConnectionError, OSError)):
        return "TRANSIENT_IO_ERROR", True
    return exc.__class__.__name__.upper(), True


def _read_dockerfile_content(artifact: DeployArtifact) -> str | None:
    dockerfile_path = artifact.dockerfile_path
    if dockerfile_path is None:
        return None
    path = Path(dockerfile_path)
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def _build_artifact_response(task_id: str, artifact: DeployArtifact, *, plan_runtime: ArtifactRuntime, required_envs: list[Any], summary: str | None, next_action: str | None) -> ArtifactResponse:
    return ArtifactResponse(
        task_id=task_id,
        artifact_type=artifact.artifact_type,
        artifact_path=str(artifact.artifact_path),
        dockerfile_content=_read_dockerfile_content(artifact),
        runtime=plan_runtime,
        required_envs=list(required_envs),
        warnings=list(artifact.warnings),
        summary=summary,
        deploy_ready=artifact.ready_for_deploy,
        next_action=next_action,
    )


def _build_runtime(plan: Any) -> ArtifactRuntime:
    docker_spec = getattr(plan, "docker_spec", None)
    if docker_spec is None:
        return ArtifactRuntime()
    return ArtifactRuntime(
        base_image=docker_spec.base_image,
        package_manager=docker_spec.package_manager,
        install_command=docker_spec.install_command,
        start_command=docker_spec.start_command,
        exposed_port=docker_spec.exposed_port,
        healthcheck_path=docker_spec.healthcheck_path,
    )


def _manual_required_message(plan: Any) -> str:
    if getattr(plan, "missing_information", None):
        return "Manual input required: " + "; ".join(plan.missing_information)
    return plan.summary or "Manual input is required before fallback can continue."


def _enqueue_fallback_task(task_id: str, request: FallbackRequest) -> None:
    app = get_celery_app()
    if _CELERY_RUN_FALLBACK_TASK is not None:
        _CELERY_RUN_FALLBACK_TASK.delay(task_id, request.model_dump(mode="json"))
        return
    app.send_task(TASK_NAME, args=[task_id, request.model_dump(mode="json")])


def submit_fallback_task(
    payload: FallbackRequest | dict[str, Any],
    *,
    store: TaskStateStore | None = None,
) -> TaskCreateResponse:
    request = _normalize_request(payload)
    task_id = str(uuid4())
    state_store = store or get_state_store()
    queued_at = _now()
    state = TaskState(
        task_id=task_id,
        project_id=request.project_id,
        deployment_id=request.deployment_id,
        status=TaskStatus.QUEUED.value,
        current_stage=TaskStage.QUEUED.value,
        progress_message="Fallback task accepted.",
        artifact_ready=False,
        updated_at=queued_at,
    )
    state_store.save_task(task_id, state.model_dump(mode="json"))
    state_store.save_request(task_id, request.model_dump(mode="json"))

    message = "Fallback task queued."
    if is_async_enabled():
        _enqueue_fallback_task(task_id, request)
    else:
        message = "Fallback task queued; async dispatch unavailable, run with local/synchronous execution."

    return TaskCreateResponse(
        task_id=task_id,
        status=TaskStatus.QUEUED.value,
        queued_at=queued_at,
        message=message,
    )


def run_fallback_task(
    task_id: str,
    payload: FallbackRequest | dict[str, Any],
    *,
    store: TaskStateStore | None = None,
    service: FallbackService | None = None,
) -> dict[str, Any]:
    state_store = store or get_state_store()
    service = service or FallbackService()

    try:
        request = _normalize_request(payload)

        state_store.update_task(
            task_id,
            status=TaskStatus.RUNNING.value,
            current_stage=TaskStage.CLASSIFYING.value,
            progress_message="Evaluating repository and user intent.",
        )
        classify_response = service.evaluate(request)

        state_store.update_task(
            task_id,
            status=TaskStatus.RUNNING.value,
            current_stage=TaskStage.SOLVING.value,
            progress_message="Building fallback plan.",
        )
        plan = service.solve_plan(request, classify_response=classify_response)
        plan.task_id = task_id

        materialize_result: MaterializeResult | None = None
        if plan.decision in {"A", "B", "C"}:
            state_store.update_task(
                task_id,
                status=TaskStatus.RUNNING.value,
                current_stage=TaskStage.MATERIALIZING.value,
                progress_message="Materializing workspace.",
            )
            materialize_result = service.materialize(request, plan=plan, classify_response=classify_response)

        state_store.update_task(
            task_id,
            status=TaskStatus.RUNNING.value,
            current_stage=TaskStage.VALIDATING.value,
            progress_message="Validating fallback output.",
        )
        validation = service.validate(
            plan,
            materialize_result=materialize_result,
            classify_response=classify_response,
        )

        artifact_response: ArtifactResponse | None = None
        packaged_artifact: DeployArtifact | None = None
        if plan.decision in {"A", "B", "C"}:
            state_store.update_task(
                task_id,
                status=TaskStatus.RUNNING.value,
                current_stage=TaskStage.PACKAGING.value,
                progress_message="Packaging deploy artifact.",
            )
            packaged_artifact = service.package(
                plan=plan,
                materialize_result=materialize_result,
                validation_result=validation,
            )
            if packaged_artifact is not None:
                artifact_response = _build_artifact_response(
                    task_id,
                    packaged_artifact,
                    plan_runtime=_build_runtime(plan),
                    required_envs=plan.env_vars,
                    summary=plan.summary or validation.summary,
                    next_action=plan.next_action,
                )
                state_store.save_artifact(task_id, artifact_response.model_dump(mode="json"))

        if plan.decision == "D":
            state_store.update_task(
                task_id,
                status=TaskStatus.SUCCEEDED.value,
                current_stage=TaskStage.MANUAL_REQUIRED.value,
                progress_message=_manual_required_message(plan),
                artifact_ready=False,
                error_code=None,
                error_message=None,
                recoverable=True,
            )
        elif validation.final_status == "FAIL":
            state_store.update_task(
                task_id,
                status=TaskStatus.FAILED.value,
                current_stage=TaskStage.FAILED.value,
                progress_message=validation.summary,
                artifact_ready=artifact_response is not None,
                error_code=validation.errors[0].code if validation.errors else "VALIDATION_FAILED",
                error_message=validation.errors[0].message if validation.errors else validation.summary,
                recoverable=True,
            )
        else:
            state_store.update_task(
                task_id,
                status=TaskStatus.SUCCEEDED.value,
                current_stage=TaskStage.COMPLETED.value,
                progress_message=plan.summary or validation.summary,
                artifact_ready=artifact_response is not None,
                error_code=None,
                error_message=None,
                recoverable=False,
            )

        return {
            "classification": classify_response,
            "plan": plan,
            "materialize_result": materialize_result,
            "validation": validation,
            "artifact": packaged_artifact,
        }
    except Exception as exc:
        error_code, recoverable = _recoverable_error_details(exc)
        try:
            state_store.update_task(
                task_id,
                status=TaskStatus.FAILED.value,
                current_stage=TaskStage.FAILED.value,
                progress_message=str(exc),
                artifact_ready=False,
                error_code=error_code,
                error_message=str(exc),
                recoverable=recoverable,
            )
        except KeyError:
            state_store.save_task(
                task_id,
                TaskState(
                    task_id=task_id,
                    status=TaskStatus.FAILED.value,
                    current_stage=TaskStage.FAILED.value,
                    progress_message=str(exc),
                    artifact_ready=False,
                    error_code=error_code,
                    error_message=str(exc),
                    recoverable=recoverable,
                ).model_dump(mode="json"),
            )
        raise


def get_task_status(task_id: str, *, store: TaskStateStore | None = None) -> TaskState | None:
    payload = (store or get_state_store()).get_task(task_id)
    return TaskState.model_validate(payload) if payload else None


def get_task_artifact(task_id: str, *, store: TaskStateStore | None = None) -> ArtifactResponse | None:
    payload = (store or get_state_store()).get_artifact(task_id)
    return ArtifactResponse.model_validate(payload) if payload else None


if celery_app is not None:
    @celery_app.task(name=TASK_NAME)
    def _celery_run_fallback_task(task_id: str, payload: dict[str, Any]) -> None:
        run_fallback_task(task_id, payload)

    _CELERY_RUN_FALLBACK_TASK = _celery_run_fallback_task
else:
    _CELERY_RUN_FALLBACK_TASK = None
