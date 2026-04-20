from __future__ import annotations

from copy import deepcopy
from typing import Any

from fallback.async_tasks.redis_state import TaskStateStore, get_state_store
from fallback.async_tasks.task_schema import ArtifactResponse, TaskCreateResponse, TaskState
from fallback.async_tasks.tasks import get_task_artifact, get_task_status, submit_fallback_task
from fallback.schemas.request import FallbackRequest

from .schemas import (
    FallbackArtifactResponse,
    FallbackRepairRequest,
    FallbackRepairSubmitResponse,
    FallbackTaskStatusResponse,
    FallbackTaskSubmitRequest,
    FallbackTaskSubmitResponse,
    PreferredStack,
    RequiredEnvVar,
)


class ContractMappingError(ValueError):
    pass


def _build_target_app_type(preferred_stack: PreferredStack) -> str:
    if preferred_stack.frontend and preferred_stack.backend:
        return "fullstack"
    if preferred_stack.backend:
        return "backend_api"
    if preferred_stack.frontend:
        return "frontend_web"
    return "unknown"


def _require(value: Any, *, field_name: str) -> Any:
    if value is None:
        raise ContractMappingError(f"Missing required field for external contract: {field_name}.")
    return value


def to_fallback_request(payload: FallbackTaskSubmitRequest | dict[str, Any]) -> FallbackRequest:
    request = payload if isinstance(payload, FallbackTaskSubmitRequest) else FallbackTaskSubmitRequest.model_validate(payload)
    constraint_payload = request.constraints.model_dump(exclude_none=True)
    constraint_payload.update(
        {
            "trigger_reason": request.trigger_reason.value,
            "generation_mode": request.generation_mode.value,
            "preferred_stack": request.preferred_stack.model_dump(exclude_none=True),
            "repo_profile": request.repo_profile.model_dump(exclude_none=True),
        }
    )
    if request.evaluation_score is not None:
        constraint_payload["evaluation_score"] = request.evaluation_score
    if request.missing_components:
        constraint_payload["missing_components"] = list(request.missing_components)

    preferred_language = request.repo_profile.detected_languages[0] if request.repo_profile.detected_languages else None
    preferred_framework = request.preferred_stack.backend or request.preferred_stack.frontend

    return FallbackRequest(
        raw_query=request.original_prompt,
        user_intent={
            "target_output_type": "deployable_artifact",
            "target_app_type": _build_target_app_type(request.preferred_stack),
            "preferred_language": preferred_language,
            "preferred_framework": preferred_framework,
            "constraints": constraint_payload,
        },
        repo_info={
            "repo_url": request.repo_profile.source_repo_url,
            "description": request.repo_profile.readme_summary,
        },
        project_id=request.project_id,
        deployment_id=request.deployment_id,
        request_id=request.request_id,
        force_fallback=request.trigger_reason.value == "FORCE_FALLBACK",
        repair_exhausted=request.trigger_reason.value == "REPAIR_EXHAUSTED",
    )


def to_submit_response(payload: TaskCreateResponse | dict[str, Any]) -> FallbackTaskSubmitResponse:
    create_response = payload if isinstance(payload, TaskCreateResponse) else TaskCreateResponse.model_validate(payload)
    return FallbackTaskSubmitResponse.model_validate(create_response.model_dump(mode="json"))


def to_status_response(payload: TaskState | dict[str, Any]) -> FallbackTaskStatusResponse:
    state = payload if isinstance(payload, TaskState) else TaskState.model_validate(payload)
    return FallbackTaskStatusResponse(
        task_id=state.task_id,
        project_id=_require(state.project_id, field_name="project_id"),
        deployment_id=_require(state.deployment_id, field_name="deployment_id"),
        status=state.status,
        current_stage=state.current_stage,
        progress_message=state.progress_message,
        artifact_ready=state.artifact_ready,
        updated_at=state.updated_at,
        error_code=state.error_code,
        error_message=state.error_message,
        recoverable=state.recoverable,
    )


def to_artifact_response(payload: ArtifactResponse | dict[str, Any]) -> FallbackArtifactResponse:
    artifact = payload if isinstance(payload, ArtifactResponse) else ArtifactResponse.model_validate(payload)
    runtime = artifact.runtime
    return FallbackArtifactResponse(
        task_id=artifact.task_id,
        artifact_type=artifact.artifact_type,
        artifact_path=artifact.artifact_path,
        artifact_uri=artifact.artifact_uri,
        artifact_key=artifact.artifact_key,
        dockerfile_content=_require(artifact.dockerfile_content, field_name="dockerfile_content"),
        runtime={
            "base_image": runtime.base_image,
            "package_manager": runtime.package_manager,
            "install_command": runtime.install_command,
            "start_command": _require(runtime.start_command, field_name="runtime.start_command"),
            "exposed_port": _require(runtime.exposed_port, field_name="runtime.exposed_port"),
            "healthcheck_path": runtime.healthcheck_path,
        },
        required_envs=[RequiredEnvVar.model_validate(item.model_dump(mode="json")) for item in artifact.required_envs],
        warnings=list(artifact.warnings),
        summary=artifact.summary,
        deploy_ready=artifact.deploy_ready,
        next_action=artifact.next_action,
    )


def submit_external_fallback_task(
    payload: FallbackTaskSubmitRequest | dict[str, Any],
    *,
    store: TaskStateStore | None = None,
) -> FallbackTaskSubmitResponse:
    internal_request = to_fallback_request(payload)
    create_response = submit_fallback_task(internal_request, store=store)
    return to_submit_response(create_response)


def get_external_task_status(
    task_id: str,
    *,
    store: TaskStateStore | None = None,
) -> FallbackTaskStatusResponse | None:
    state = get_task_status(task_id, store=store)
    return to_status_response(state) if state is not None else None


def get_external_task_artifact(
    task_id: str,
    *,
    store: TaskStateStore | None = None,
) -> FallbackArtifactResponse | None:
    artifact = get_task_artifact(task_id, store=store)
    return to_artifact_response(artifact) if artifact is not None else None


def _repair_request_id(base_request: FallbackRequest, repair_request: FallbackRepairRequest) -> str | None:
    if base_request.request_id:
        return f"{base_request.request_id}-repair-{repair_request.retry_count + 1}"
    return None


def submit_repair_task(
    payload: FallbackRepairRequest | dict[str, Any],
    *,
    store: TaskStateStore | None = None,
) -> FallbackRepairSubmitResponse:
    repair_request = payload if isinstance(payload, FallbackRepairRequest) else FallbackRepairRequest.model_validate(payload)
    state_store = store or get_state_store()
    original_request_payload = state_store.get_request(repair_request.source_task_id)
    if original_request_payload is None:
        raise ContractMappingError(
            f"Cannot create repair task because source request snapshot for task {repair_request.source_task_id} was not found."
        )

    base_request = FallbackRequest.model_validate(original_request_payload)
    updated_constraints = deepcopy(base_request.user_intent.constraints)
    updated_constraints["repair_context"] = {
        "source_task_id": repair_request.source_task_id,
        "failed_stage": repair_request.failed_stage.value,
        "error_type": repair_request.error_type,
        "sanitized_error_log": repair_request.sanitized_error_log,
        "last_dockerfile_content": repair_request.last_dockerfile_content,
        "healthcheck_result": repair_request.healthcheck_result.model_dump(exclude_none=True),
        "retry_count": repair_request.retry_count,
        "regen_mode": repair_request.regen_mode.value,
        "constraints": repair_request.constraints.model_dump(exclude_none=True),
    }
    base_request.user_intent.constraints = updated_constraints
    base_request.project_id = repair_request.project_id
    base_request.deployment_id = repair_request.deployment_id
    base_request.request_id = _repair_request_id(base_request, repair_request)
    base_request.force_fallback = repair_request.regen_mode.value == "REGENERATE"
    base_request.repair_exhausted = repair_request.regen_mode.value == "REGENERATE"

    create_response = submit_fallback_task(base_request, store=state_store)
    return FallbackRepairSubmitResponse(
        accepted=create_response.accepted,
        task_id=create_response.task_id,
        status=create_response.status,
        message=create_response.message,
    )
