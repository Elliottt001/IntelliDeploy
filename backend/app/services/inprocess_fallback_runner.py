"""
进程内降级生成执行器

替代独立的 fallback HTTP 服务，直接在后端进程中调用
`fallback.services.fallback_service.FallbackService.run_pipeline`，
将 backend.app.schemas.fallback 与 fallback.schemas 之间做翻译，
并用模块级 dict 缓存任务结果以支撑后续 status/artifact 查询。
"""
from __future__ import annotations

import asyncio
import logging
import threading
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from app.schemas.fallback import (
    ArtifactType,
    DeployFailureFeedbackRequest,
    DeployFailureFeedbackResponse,
    EnvSource,
    ErrorCode,
    GetArtifactResultResponse,
    NextAction,
    QueryTaskStatusResponse,
    RequiredEnv,
    RuntimeInfo,
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
    TaskStatus,
    TriggerReason,
)

logger = logging.getLogger(__name__)


@dataclass
class _TaskRecord:
    task_id: str
    project_id: str
    deployment_id: str
    status: TaskStatus
    queued_at: datetime
    updated_at: datetime
    current_stage: Optional[str] = None
    progress_message: Optional[str] = None
    artifact_ready: bool = False
    error_code: Optional[ErrorCode] = None
    error_message: Optional[str] = None
    recoverable: Optional[bool] = None
    pipeline_result: dict[str, Any] = field(default_factory=dict)


class InProcessFallbackRunner:
    """在后端进程中直接驱动 FallbackService.run_pipeline"""

    def __init__(self) -> None:
        self._store: dict[str, _TaskRecord] = {}
        self._lock = threading.Lock()

    # ==================== 接口 A ====================

    async def start_fallback_task(
        self, request: StartFallbackTaskRequest
    ) -> StartFallbackTaskResponse:
        task_id = request.request_id or str(uuid4())
        now = datetime.now()

        record = _TaskRecord(
            task_id=task_id,
            project_id=request.project_id,
            deployment_id=request.deployment_id,
            status=TaskStatus.RUNNING,
            queued_at=now,
            updated_at=now,
            current_stage="classifying",
            progress_message="降级生成任务已开始（in-process）",
        )
        with self._lock:
            self._store[task_id] = record

        try:
            pipeline_result = await asyncio.to_thread(self._run_pipeline_sync, task_id, request)
        except Exception as exc:  # noqa: BLE001 — fallback library can raise many error types
            logger.exception("in-process fallback pipeline failed: %s", exc)
            with self._lock:
                rec = self._store[task_id]
                rec.status = TaskStatus.FAILED
                rec.error_code = ErrorCode.UNKNOWN
                rec.error_message = str(exc) or exc.__class__.__name__
                rec.recoverable = False
                rec.updated_at = datetime.now()
                rec.progress_message = "降级生成执行失败"
            return StartFallbackTaskResponse(
                accepted=True,
                task_id=task_id,
                status=TaskStatus.FAILED,
                queued_at=now,
                message=f"In-process pipeline failed: {exc}",
            )

        plan = pipeline_result.get("plan")
        artifact = pipeline_result.get("artifact")
        validation = pipeline_result.get("validation")

        artifact_ready = bool(artifact is not None and getattr(artifact, "ready_for_deploy", False))
        validation_failed = validation is not None and getattr(validation, "final_status", "PASS") == "FAIL"
        decision_is_d = bool(plan and plan.decision == "D")

        with self._lock:
            rec = self._store[task_id]
            rec.pipeline_result = pipeline_result
            rec.updated_at = datetime.now()
            rec.artifact_ready = artifact_ready
            if decision_is_d:
                # Decision D 不是崩溃，是"探针/信号还不够，需要用户或上游补信息"
                # 的优雅降级出口。solve_manual_required 已经构造了带
                # missing_information 的 FallbackPlan（deploy_ready=False,
                # next_action=MANUAL_REVIEW）。这里把它当作"SUCCEEDED 但产物
                # 未就绪"对外提供，让 full_pipeline_runner 的 ARTIFACT_NOT_READY
                # 分支处理"需要用户确认"UI——绝不再向上抛 RuntimeError 把整条
                # 流水线炸掉（Zero-Trust 用户代码：让 IntelliDeploy 变聪明，
                # 而不是要求用户把仓库改"标准"）。
                missing_info = list(getattr(plan, "missing_information", []) or [])
                summary = (
                    getattr(plan, "summary", None)
                    or "Need additional user or repository information before generation can proceed."
                )
                rec.status = TaskStatus.SUCCEEDED
                rec.current_stage = "needs_user_input"
                rec.progress_message = summary
                rec.error_code = ErrorCode.MISSING_RUNTIME_INFO
                rec.error_message = "; ".join(missing_info) if missing_info else summary
                rec.recoverable = True
            elif not artifact_ready and validation_failed:
                # validator 命中 blocking 错误 ≠ pipeline 崩溃。FallbackPlan +
                # DeployArtifact 都已经被 run_pipeline 完整产出（plan.deploy_ready
                # / artifact.ready_for_deploy 已被置 False，validation.errors 里
                # 携带了具体 blocking 原因，如 FRAMEWORK_CONFIG_MISSING_VUE_PLUGIN
                # / DOCKERFILE_INVALID 等）。这就是上游 full_pipeline_runner
                # ARTIFACT_NOT_READY 分支的标准输入：让它通过结构化 artifact
                # 把可读的 summary + warnings 推给前端，引导用户审阅/补丁，
                # 而不是再用 RuntimeError 把同一份信息以崩溃形式吞回去。
                # 这是 Decision D 优雅降级的同构推广：FAILED 仅保留给"pipeline
                # 抛异常导致没有任何 plan/artifact"这一种真崩溃场景（已由
                # 上方 try/except 兜底）。
                blocking_messages: list[str] = []
                for err in getattr(validation, "errors", []) or []:
                    if getattr(err, "severity", None) == "blocking":
                        blocking_messages.append(
                            f"{getattr(err, 'code', 'BLOCKING')}: {getattr(err, 'message', '')}".strip(": ")
                        )
                summary = (
                    getattr(plan, "summary", None)
                    or getattr(validation, "summary", None)
                    or "Validation did not pass; artifact is not deploy-ready."
                )
                rec.status = TaskStatus.SUCCEEDED
                rec.current_stage = "validation"
                rec.progress_message = summary
                rec.error_code = ErrorCode.MISSING_RUNTIME_INFO
                rec.error_message = "; ".join(blocking_messages) if blocking_messages else summary
                rec.recoverable = True
            else:
                rec.status = TaskStatus.SUCCEEDED
                rec.current_stage = "packaging"
                rec.progress_message = getattr(plan, "summary", None) or "降级生成产物已就绪"

        return StartFallbackTaskResponse(
            accepted=True,
            task_id=task_id,
            status=self._store[task_id].status,
            queued_at=now,
            message=self._store[task_id].progress_message,
        )

    # ==================== 接口 B ====================

    async def query_task_status(self, task_id: str) -> QueryTaskStatusResponse:
        rec = self._get_record(task_id)
        return QueryTaskStatusResponse(
            task_id=rec.task_id,
            project_id=rec.project_id,
            deployment_id=rec.deployment_id,
            status=rec.status,
            current_stage=rec.current_stage,
            progress_message=rec.progress_message,
            artifact_ready=rec.artifact_ready,
            updated_at=rec.updated_at,
            error_code=rec.error_code,
            error_message=rec.error_message,
            recoverable=rec.recoverable,
        )

    # ==================== 接口 C ====================

    async def get_artifact_result(self, task_id: str) -> GetArtifactResultResponse:
        rec = self._get_record(task_id)
        # 只有 FAILED 或完全没有 pipeline_result 时才向上抛。
        # SUCCEEDED 包括 Decision D（deploy_ready=False, next_action=MANUAL_REVIEW）：
        # 这种"产物已就绪但未达到部署条件"的情况要把 artifact 正常吐出去，
        # 让上游 full_pipeline_runner 经 artifact.deploy_ready 分支引导用户补信息。
        if rec.status == TaskStatus.FAILED or not rec.pipeline_result:
            raise RuntimeError(
                f"Artifact for task {task_id} is not available (status={rec.status.value})."
            )
        return _build_artifact_response(task_id, rec.pipeline_result)

    # ==================== 接口 D ====================

    async def send_deploy_failure_feedback(
        self, request: DeployFailureFeedbackRequest
    ) -> DeployFailureFeedbackResponse:
        # 简化实现：重新走一遍 pipeline（force_fallback=True）
        source_rec = self._get_record(request.source_task_id)
        new_task_id = str(uuid4())
        now = datetime.now()
        new_rec = _TaskRecord(
            task_id=new_task_id,
            project_id=source_rec.project_id,
            deployment_id=source_rec.deployment_id,
            status=TaskStatus.QUEUED,
            queued_at=now,
            updated_at=now,
            current_stage="queued",
            progress_message="已接收部署失败反馈，等待重新生成",
        )
        with self._lock:
            self._store[new_task_id] = new_rec

        return DeployFailureFeedbackResponse(
            accepted=True,
            task_id=new_task_id,
            status=TaskStatus.QUEUED,
            message="Regeneration request accepted (in-process)",
        )

    # ==================== 内部方法 ====================

    def _get_record(self, task_id: str) -> _TaskRecord:
        with self._lock:
            rec = self._store.get(task_id)
        if rec is None:
            raise RuntimeError(f"Task {task_id} not found in in-process store.")
        return rec

    def _run_pipeline_sync(
        self, task_id: str, request: StartFallbackTaskRequest
    ) -> dict[str, Any]:
        # 延迟导入：避免在 backend 启动时强制加载 fallback 模块
        from fallback.schemas.request import FallbackRequest, UserIntentInput
        from fallback.schemas.repo import RepoInfo
        from fallback.services.fallback_service import FallbackService

        fb_request = _to_fallback_request(request, task_id, FallbackRequest, UserIntentInput, RepoInfo)
        service = FallbackService()
        return service.run_pipeline(fb_request)


# ==================== 翻译函数 ====================


def _to_fallback_request(
    req: StartFallbackTaskRequest,
    task_id: str,
    FallbackRequest,
    UserIntentInput,
    RepoInfo,
):
    repo_profile = req.repo_profile
    preferred_stack = req.preferred_stack
    constraints = req.constraints

    constraints_dict: dict[str, Any] = {}
    if constraints is not None:
        for field_name in ("timeout_seconds", "target_port", "must_provide_dockerfile", "must_provide_healthcheck"):
            value = getattr(constraints, field_name, None)
            if value is not None:
                constraints_dict[field_name] = value

    preferred_language: Optional[str] = None
    preferred_framework: Optional[str] = None
    if repo_profile and repo_profile.detected_languages:
        preferred_language = repo_profile.detected_languages[0]
    if repo_profile and repo_profile.detected_frameworks:
        preferred_framework = repo_profile.detected_frameworks[0]
    if preferred_stack is not None:
        if not preferred_framework:
            preferred_framework = preferred_stack.backend or preferred_stack.frontend
        if not preferred_language:
            preferred_language = preferred_stack.runtime

    user_intent = UserIntentInput(
        target_output_type="deployable_app",
        target_app_type="unknown",
        expected_features=[],
        preferred_language=preferred_language,
        preferred_framework=preferred_framework,
        constraints=constraints_dict,
    )

    repo_info = RepoInfo(
        repo_url=repo_profile.source_repo_url if repo_profile else None,
        description=repo_profile.readme_summary if repo_profile else None,
    )

    force_fallback = req.trigger_reason == TriggerReason.FORCE_FALLBACK
    repair_exhausted = req.trigger_reason == TriggerReason.REPAIR_EXHAUSTED

    return FallbackRequest(
        raw_query=req.original_prompt,
        user_intent=user_intent,
        repo_info=repo_info,
        # 真正接通：从 repo_profile 拿 enrichment 抓到的 file_tree / key_files。
        # 之前这两行硬编码为空 → 任何真实仓库都被 extract_facts 判成
        # repo_empty_or_near_empty=True → 必走 Decision C 凭空生成脚手架。
        file_tree=list(repo_profile.file_tree) if repo_profile and repo_profile.file_tree else [],
        key_files=dict(repo_profile.key_files) if repo_profile and repo_profile.key_files else {},
        project_id=req.project_id,
        deployment_id=req.deployment_id,
        request_id=task_id,
        force_fallback=force_fallback,
        repair_exhausted=repair_exhausted,
    )


def _build_artifact_response(
    task_id: str, pipeline_result: dict[str, Any]
) -> GetArtifactResultResponse:
    plan = pipeline_result.get("plan")
    artifact = pipeline_result.get("artifact")
    docker_spec = getattr(plan, "docker_spec", None) if plan else None

    runtime = RuntimeInfo(
        start_command=(docker_spec.start_command if docker_spec else "") or "",
        exposed_port=(docker_spec.exposed_port if docker_spec else 0) or 0,
        base_image=docker_spec.base_image if docker_spec else None,
        package_manager=docker_spec.package_manager if docker_spec else None,
        install_command=docker_spec.install_command if docker_spec else None,
        healthcheck_path=docker_spec.healthcheck_path if docker_spec else None,
    )

    required_envs: list[RequiredEnv] = []
    for ev in (getattr(plan, "env_vars", []) if plan else []):
        source_value = getattr(ev, "source", None)
        env_source: Optional[EnvSource] = None
        if source_value in (EnvSource.DETECTED.value, EnvSource.ASSUMED.value):
            env_source = EnvSource(source_value)
        required_envs.append(
            RequiredEnv(
                name=ev.name,
                required=ev.required,
                example_value=ev.example_value,
                description=ev.description,
                source=env_source,
            )
        )

    dockerfile_content = ""
    if artifact and getattr(artifact, "dockerfile_path", None):
        df_path = Path(artifact.dockerfile_path)
        if df_path.exists():
            try:
                dockerfile_content = df_path.read_text(encoding="utf-8")
            except OSError as exc:  # pragma: no cover — defensive
                logger.warning("read dockerfile %s failed: %s", df_path, exc)
    if not dockerfile_content and docker_spec is not None:
        dockerfile_content = docker_spec.dockerfile_content or ""

    artifact_type_raw = getattr(plan, "artifact_type", None) if plan else None
    if artifact_type_raw not in (ArtifactType.TEMPLATE_PROJECT.value, ArtifactType.STITCHED_PROJECT.value):
        artifact_type_raw = ArtifactType.STITCHED_PROJECT.value

    next_action_raw = getattr(plan, "next_action", None) if plan else None
    next_action: Optional[NextAction] = None
    if next_action_raw in (NextAction.DEPLOY.value, NextAction.MANUAL_REVIEW.value):
        next_action = NextAction(next_action_raw)

    warnings_list: list[str] = []
    if artifact and getattr(artifact, "warnings", None):
        warnings_list.extend(artifact.warnings)
    if plan and getattr(plan, "warnings", None):
        for w in plan.warnings:
            if w not in warnings_list:
                warnings_list.append(w)

    # 把 validation 的 blocking/warning 错误透出来。原本这部分信息留在
    # FallbackPlan 内部、对外只通过 plan.summary 露一句泛泛的
    # "Validation did not pass"——前端/用户根本不知道为什么不能部署。
    # 现在把每条 ValidationError 拼成可读串塞进 warnings，让 WebSocket
    # 事件和 deployment.error_message 都能携带具体修复指引。
    validation = pipeline_result.get("validation")
    validation_blocking: list[str] = []
    if validation is not None:
        for err in getattr(validation, "errors", []) or []:
            severity = getattr(err, "severity", "warning")
            code = getattr(err, "code", "VALIDATION_ERROR")
            message = getattr(err, "message", "") or ""
            entry = f"[{severity}] {code}: {message}".rstrip(": ")
            if entry not in warnings_list:
                warnings_list.append(entry)
            if severity == "blocking":
                validation_blocking.append(f"{code}: {message}".rstrip(": "))

    deploy_ready = bool(
        plan
        and getattr(plan, "deploy_ready", False)
        and artifact is not None
        and getattr(artifact, "ready_for_deploy", False)
    )

    summary = getattr(plan, "summary", None) if plan else None
    if not deploy_ready and validation_blocking:
        # 用第一条 blocking 错的可读信息替换 plan 的泛泛 summary，
        # 这样 full_pipeline_runner 的 ARTIFACT_NOT_READY 分支 _mark_deployment_failed
        # 写库的 error_message 就直接是"package.json declares vue + vite but ..."
        # 这种可执行的修复指引，而不是"生成产物未达到部署条件"。
        summary = f"{validation_blocking[0]}"
        if len(validation_blocking) > 1:
            summary += f" (+{len(validation_blocking) - 1} more blocking issue(s))"

    return GetArtifactResultResponse(
        task_id=task_id,
        artifact_type=ArtifactType(artifact_type_raw),
        artifact_path=str(artifact.artifact_path) if artifact and getattr(artifact, "artifact_path", None) else None,
        artifact_uri=None,
        artifact_key=None,
        context_files=None,
        dockerfile_content=dockerfile_content,
        runtime=runtime,
        required_envs=required_envs,
        warnings=warnings_list or None,
        summary=summary,
        deploy_ready=deploy_ready,
        next_action=next_action,
    )


# ==================== 单例 ====================

_runner: Optional[InProcessFallbackRunner] = None


def get_inprocess_runner() -> InProcessFallbackRunner:
    global _runner
    if _runner is None:
        _runner = InProcessFallbackRunner()
    return _runner
