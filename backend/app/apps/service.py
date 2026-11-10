import hashlib
import json
from pathlib import Path

from sqlalchemy import func, select, text

from app.apps.models import (
    App,
    AppVersion,
    Conversation,
    Instance,
    InstanceOperation,
    Message,
    RequestRecord,
    RequirementRecord,
)
from app.config import settings
from app.core.errors import abort
from app.core.types import (
    AppDetail,
    AppPage,
    AppSummary,
    ConversationMessage,
    DeliveryResult,
    JobRef,
    JobReport,
    JobSnapshot,
    ReportCheck,
    Requirement,
    ValidationReport,
)
from app.jobs.models import ACTIVE_STATUSES, Job, JobEvent


def owned_app(session, app_id, owner_id, lock=False):
    query = select(App).where(App.id == app_id, App.owner_id == owner_id)
    app = session.scalar(query.with_for_update() if lock else query)
    if app is None:
        abort("NOT_FOUND", "应用不存在或无权访问", 404)
    return app


def owned_job(session, job_id, owner_id, lock=False):
    query = (
        select(Job)
        .join(App, App.id == Job.app_id)
        .where(Job.id == job_id, App.owner_id == owner_id)
    )
    job = session.scalar(query.with_for_update(of=Job) if lock else query)
    if job is None:
        abort("NOT_FOUND", "任务不存在或无权访问", 404)
    return job


def replay(session, owner_id, action, key, payload):
    # Transaction advisory lock serializes identical requests across API processes.
    identity = json.dumps([owner_id, action, key], ensure_ascii=False)
    lock_id = int.from_bytes(
        hashlib.sha256(identity.encode()).digest()[:8], "big", signed=True
    )
    session.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": lock_id})
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()
    record = session.scalar(
        select(RequestRecord).where(
            RequestRecord.user_id == owner_id,
            RequestRecord.action == action,
            RequestRecord.key == key,
        )
    )
    if record and record.payload_hash != digest:
        abort("IDEMPOTENCY_CONFLICT", "相同请求标识对应了不同内容")
    return record, digest


def remember(session, owner_id, action, key, digest, response):
    session.add(
        RequestRecord(
            user_id=owner_id,
            action=action,
            key=key,
            payload_hash=digest,
            response=response,
        )
    )
    session.commit()


def select_budget(requested=None, session=None, owner_id=None):
    budget = requested if requested is not None else settings.DEFAULT_BUDGET_UNITS
    if budget <= 0 or budget > settings.HARD_CAP_UNITS:
        abort("BUDGET_INVALID", "执行额度超出平台上限", 422)
    if session is not None and owner_id is not None:
        from app.billing.ledger import balance, InsufficientQuota

        available = balance(session, owner_id)["available_units"]
        if requested is None:
            budget = min(budget, available)
        if budget <= 0 or budget > available:
            raise InsufficientQuota()
    return budget


def create_app(
    session,
    owner_id,
    prompt,
    operation_id,
    budget_units=None,
    evaluation_target_id=None,
):
    payload = {
        "prompt": prompt,
        "budget_units": budget_units,
        "evaluation_target_id": evaluation_target_id,
    }
    record, digest = replay(session, owner_id, "create", operation_id, payload)
    if record:
        return session.get(App, record.response["app_id"]), session.get(
            Job, record.response["job_id"]
        )
    if evaluation_target_id is not None:
        from app.models.user import User
        from app.runtime.models import DeploymentTarget

        user = session.get(User, owner_id)
        if not settings.ENABLE_EVALUATION_UI or not getattr(
            user, "is_developer", False
        ):
            abort("DEVELOPER_REQUIRED", "该参数仅供授权评测使用", 403)
        target = session.get(DeploymentTarget, evaluation_target_id)
        if target is None or not target.enabled or target.health != "HEALTHY":
            abort("TARGET_UNAVAILABLE", "评测目标不可用", 503, True)
    app = App(owner_id=owner_id, name=prompt[:60], prompt=prompt)
    session.add(app)
    session.flush()
    session.add_all(
        [
            Conversation(app_id=app.id),
            Message(app_id=app.id, sequence=1, role="user", content=prompt),
        ]
    )
    job = Job(
        app_id=app.id,
        kind="GENERATE",
        operation_id=f"{owner_id}:create:{digest}:{operation_id}",
        budget_units=select_budget(budget_units, session, owner_id),
        checkpoint={"evaluation_target_id": evaluation_target_id}
        if evaluation_target_id
        else {},
    )
    session.add(job)
    session.flush()
    remember(
        session,
        owner_id,
        "create",
        operation_id,
        digest,
        {"app_id": app.id, "job_id": job.id, "status": job.status},
    )
    return app, job


def add_message(session, app_id, owner_id, content, operation_id, budget_units=None):
    action = "message:" + app_id
    record, digest = replay(
        session,
        owner_id,
        action,
        operation_id,
        {"content": content, "budget_units": budget_units},
    )
    app = owned_app(session, app_id, owner_id, lock=True)
    if record:
        return JobRef.model_validate(record.response)
    active_operation = session.scalar(
        select(InstanceOperation.id)
        .join(Instance, Instance.id == InstanceOperation.instance_id)
        .where(
            Instance.app_id == app.id,
            InstanceOperation.status.in_(("QUEUED", "RUNNING")),
        )
    )
    if active_operation is not None:
        abort(
            "ACTIVE_INSTANCE_OPERATION",
            "该应用正在执行实例操作",
        )
    active = session.scalar(
        select(Job).where(Job.app_id == app_id, Job.status.in_(ACTIVE_STATUSES))
    )
    if active and active.status != "WAITING_USER":
        abort("ACTIVE_JOB_EXISTS", "该应用正在处理上一项任务")
    sequence = (
        session.scalar(
            select(func.max(Message.sequence)).where(Message.app_id == app_id)
        )
        or 0
    )
    session.add(
        Message(app_id=app_id, sequence=sequence + 1, role="user", content=content)
    )
    if active:
        active.status = "QUEUED"
        active.question = None
        active.lease_owner = None
        active.lease_until = None
        job = active
    else:
        job = Job(
            app_id=app_id,
            kind="ADJUST",
            operation_id=f"{owner_id}:{action}:{operation_id}",
            budget_units=select_budget(budget_units, session, owner_id),
            checkpoint={},
        )
        session.add(job)
    app.updated_at = func.now()
    session.flush()
    response = JobRef(app_id=app_id, job_id=job.id, status=job.status)
    remember(
        session,
        owner_id,
        action,
        operation_id,
        digest,
        response.model_dump(mode="json"),
    )
    return response


def job_snapshot(session, job):
    cursor = (
        session.scalar(select(func.max(JobEvent.id)).where(JobEvent.job_id == job.id))
        or 0
    )
    return JobSnapshot(
        id=job.id,
        app_id=job.app_id,
        kind=job.kind,
        status=job.status,
        phase=job.phase,
        event_cursor=cursor,
        question=job.question,
        usage_units=job.used_units,
        result=job.result,
        error=job.error,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def app_summary(session, app):
    active = session.scalar(
        select(Job.id).where(Job.app_id == app.id, Job.status.in_(ACTIVE_STATUSES))
    )
    instance = session.scalar(
        select(Instance)
        .where(Instance.app_id == app.id)
        .order_by(Instance.created_at.desc())
        .limit(1)
    )
    status = instance.status if instance else None
    status = {"DEPLOYING": "PENDING", "DELETING": "PENDING"}.get(status, status)
    return AppSummary(
        id=app.id,
        name=app.name,
        updated_at=app.updated_at,
        active_job_id=active,
        instance_status=status,
    )


def list_apps(session, owner_id, cursor=None, limit=20):
    query = select(App).where(App.owner_id == owner_id)
    if cursor:
        query = query.where(App.id > cursor)
    rows = list(session.scalars(query.order_by(App.id).limit(limit + 1)))
    return AppPage(
        items=[app_summary(session, a) for a in rows[:limit]],
        next_cursor=rows[limit - 1].id if len(rows) > limit else None,
    )


def app_detail(session, app):
    req = session.scalar(
        select(RequirementRecord)
        .where(RequirementRecord.app_id == app.id)
        .order_by(RequirementRecord.revision.desc())
        .limit(1)
    )
    jobs = list(
        session.scalars(
            select(Job).where(Job.app_id == app.id).order_by(Job.created_at.desc())
        )
    )
    active = next((j for j in jobs if j.status in ACTIVE_STATUSES), None)
    messages = list(
        session.scalars(
            select(Message).where(Message.app_id == app.id).order_by(Message.sequence)
        )
    )
    version = (
        session.get(AppVersion, app.active_version_id)
        if app.active_version_id
        else None
    )
    instance = session.scalar(
        select(Instance)
        .where(Instance.app_id == app.id)
        .order_by(Instance.created_at.desc())
        .limit(1)
    )
    return AppDetail(
        **app_summary(session, app).model_dump(),
        requirement=Requirement.model_validate(req.requirement)
        if req
        else Requirement(prompt=app.prompt, acceptance=[]),
        conversation=[
            ConversationMessage(
                id=m.id,
                sequence=m.sequence,
                role=m.role,
                content=m.content,
                created_at=m.created_at,
            )
            for m in messages
        ],
        active_job=job_snapshot(session, active) if active else None,
        latest_job=job_snapshot(session, jobs[0]) if jobs else None,
        delivery=DeliveryResult.model_validate(version.delivery)
        if version and version.delivery
        else None,
        candidate_version_id=app.candidate_version_id,
        instance=(
            {
                "id": instance.id,
                "status": {"DEPLOYING": "PENDING", "DELETING": "PENDING"}.get(
                    instance.status, instance.status
                ),
                "desired_state": instance.desired_state,
                "stop_reason": instance.stop_reason,
                "url": instance.url,
                "observed_at": instance.observed_at,
                "active_operation_id": session.scalar(
                    select(InstanceOperation.id).where(
                        InstanceOperation.instance_id == instance.id,
                        InstanceOperation.status.in_(("QUEUED", "RUNNING")),
                    )
                ),
            }
            if instance
            else None
        ),
    )


def job_report(session, job):
    req = session.scalar(
        select(RequirementRecord).where(
            RequirementRecord.app_id == job.app_id,
            RequirementRecord.revision == job.requirement_revision,
        )
    )
    requirement = Requirement.model_validate(req.requirement) if req else None
    app = session.get(App, job.app_id)
    version_id = (job.result or {}).get("version_id") or app.candidate_version_id
    version = session.get(AppVersion, version_id) if version_id else None
    report = (
        ValidationReport.model_validate(version.validation)
        if version and version.validation
        else None
    )
    checkpoint = job.checkpoint or {}
    required = {i.id for i in requirement.acceptance} if requirement else set()
    bound = bool(
        report
        and requirement
        and required
        and report.requirement_revision
        == job.requirement_revision
        == version.requirement_revision
        and report.attempt_id == checkpoint.get("attempt_id")
        and report.attempt_id
        and report.manifest_hash == checkpoint.get("manifest_hash")
        and report.manifest_hash
        and set(report.required_ids) == required
        and len({c.id for c in report.checks}) == len(report.checks)
    )
    results = {c.id: c for c in report.checks} if bound else {}
    checks = (
        [
            ReportCheck(
                id=i.id,
                action=i.action,
                expected=i.expected,
                status=results[i.id].status if i.id in results else "NOT_RUN",
            )
            for i in requirement.acceptance
        ]
        if requirement
        else []
    )
    if bound:
        from app.runtime.models import ResourceRecord

        resources = list(
            session.scalars(
                select(ResourceRecord).where(
                    ResourceRecord.job_id == job.id,
                    ResourceRecord.type == "EVIDENCE",
                    ResourceRecord.state == "READY",
                )
            )
        )
        for check in checks:
            check.evidence_urls = [
                f"/api/jobs/{job.id}/report/evidence/{r.id}"
                for r in resources
                if r.metadata_json.get("check_id") == check.id
                and r.metadata_json.get("attempt_id") == report.attempt_id
            ]
    overall = (
        "FAIL"
        if any(c.status == "FAIL" for c in checks)
        else "PASS"
        if checks and all(c.status == "PASS" for c in checks)
        else "NOT_RUN"
    )
    return JobReport(
        job_id=job.id,
        overall=overall,
        checks=checks,
        requirement_revision=job.requirement_revision,
        attempt_id=report.attempt_id if bound else None,
        manifest_hash=report.manifest_hash if bound else None,
    )


def artifact_path(session, app_id, version_id, owner_id):
    owned_app(session, app_id, owner_id)
    version = session.get(AppVersion, version_id)
    if version is None or version.app_id != app_id:
        abort("NOT_FOUND", "版本不存在或无权访问", 404)
    if not version.artifact_path:
        abort("ARTIFACT_NOT_READY", "源码产物尚未形成")
    path = Path(version.artifact_path).resolve()
    if (
        not path.is_relative_to(Path(settings.ARTIFACTS_ROOT).resolve())
        or not path.is_file()
        or path.suffix != ".zip"
    ):
        abort("ARTIFACT_NOT_READY", "源码产物暂不可用")
    return path


def evidence_path(session, job_id, evidence_id, owner_id):
    from app.runtime.models import ResourceRecord

    owned_job(session, job_id, owner_id)
    resource = session.scalar(
        select(ResourceRecord).where(
            ResourceRecord.id == evidence_id,
            ResourceRecord.job_id == job_id,
            ResourceRecord.type == "EVIDENCE",
            ResourceRecord.state == "READY",
        )
    )
    if resource is None:
        abort("NOT_FOUND", "验证证据不存在或无权访问", 404)
    path = Path(resource.reference).resolve()
    mime = resource.metadata_json.get("content_type")
    if (
        not path.is_relative_to(Path(settings.ARTIFACTS_ROOT).resolve())
        or not path.is_file()
        or mime not in {"image/png", "image/jpeg", "application/json", "text/plain"}
    ):
        abort("NOT_FOUND", "验证证据暂不可用", 404)
    return path, mime
