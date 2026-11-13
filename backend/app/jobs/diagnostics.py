from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import or_, select

from app.agent.checkpoint import load_algorithm_checkpoint
from app.apps import service
from app.apps.models import App, Instance
from app.billing.models import Reservation, UnknownUsage, UsageEntry
from app.config import settings
from app.evaluation.schemas import (
    EvaluationAlgorithm,
    EvaluationAlgorithmHealing,
    EvaluationAlgorithmReview,
    EvaluationCandidate,
    EvaluationEvidenceGate,
    EvaluationRecord,
    EvaluationRetrieval,
    EvaluationRequirementCompilation,
    EvaluationSource,
    PhaseDuration,
)
from app.jobs.models import Job, JobEvent
from app.runtime.models import ResourceRecord


def _milliseconds(start: datetime, end: datetime) -> int:
    return max(0, int((end - start).total_seconds() * 1000))


def _safe_url(value: str) -> str:
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return ""
        host = parsed.hostname or ""
        if not host:
            return ""
        if ":" in host and not host.startswith("["):
            host = f"[{host}]"
        port = f":{parsed.port}" if parsed.port else ""
        return urlunsplit((parsed.scheme, host + port, parsed.path, "", ""))
    except ValueError:
        return ""


def _phase_durations(session, job: Job) -> list[PhaseDuration]:
    events = list(
        session.scalars(
            select(JobEvent)
            .where(JobEvent.job_id == job.id)
            .order_by(JobEvent.created_at, JobEvent.id)
        )
    )
    totals: dict[str, int] = defaultdict(int)
    phase = "clarifying"
    cursor = job.created_at
    for event in events:
        totals[phase] += _milliseconds(cursor, event.created_at)
        phase = str((event.public_payload or {}).get("phase") or phase)
        cursor = event.created_at
    totals[job.phase or phase] += _milliseconds(cursor, job.updated_at)
    return [
        PhaseDuration(phase=name, duration_ms=duration)
        for name, duration in totals.items()
    ]


def _retrieval(checkpoint: dict) -> EvaluationRetrieval:
    algorithm = load_algorithm_checkpoint(
        checkpoint,
        requirement_revision=int(checkpoint.get("requirement_revision") or 1),
    )
    retrieval = algorithm.retrieval
    evaluations = {
        row.repo_url: row
        for row in algorithm.evaluations
    }
    candidates = []
    for rank, row in enumerate(
        retrieval.candidates if retrieval is not None else [], start=1
    ):
        safe_url = _safe_url(row.repo_url)
        if not safe_url:
            continue
        scores = evaluations.get(row.repo_url)
        candidates.append(
            EvaluationCandidate(
                repo_url=safe_url,
                commit=row.commit,
                rank=rank,
                stars=row.stars,
                match_score=scores.match_score if scores else None,
                deploy_score=scores.deploy_score if scores else None,
                quality_score=scores.quality_score if scores else None,
            )
        )
    return EvaluationRetrieval(
        queries=list(retrieval.queries) if retrieval is not None else [],
        completed=retrieval.completed if retrieval is not None else False,
        index_version=retrieval.index_version if retrieval is not None else None,
        candidates=candidates,
    )


def _sources(checkpoint: dict) -> list[EvaluationSource]:
    algorithm = load_algorithm_checkpoint(
        checkpoint,
        requirement_revision=int(checkpoint.get("requirement_revision") or 1),
    )
    algorithm_sources = [
        row.model_dump(mode="json") for row in algorithm.selected_sources
    ]
    sources = []
    for row in algorithm_sources or checkpoint.get("sources") or []:
        if not isinstance(row, dict):
            continue
        url, commit, role = row.get("url"), row.get("commit"), row.get("role")
        if all(isinstance(value, str) and value for value in (url, commit, role)):
            safe_url = _safe_url(url)
            if not safe_url:
                continue
            sources.append(
                EvaluationSource(url=safe_url, commit=commit, role=role)
            )
    return sources


def _route(checkpoint: dict) -> str | None:
    algorithm = load_algorithm_checkpoint(
        checkpoint,
        requirement_revision=int(checkpoint.get("requirement_revision") or 1),
    )
    return algorithm.route.route if algorithm.route is not None else None


def _algorithm(checkpoint: dict) -> EvaluationAlgorithm:
    algorithm = load_algorithm_checkpoint(
        checkpoint,
        requirement_revision=int(checkpoint.get("requirement_revision") or 1),
    )
    counts = {"BLOCKING": 0, "WARNING": 0, "INFO": 0}
    for report in algorithm.reviews:
        for finding in report.findings:
            counts[finding.severity] += 1
    return EvaluationAlgorithm(
        mode=algorithm.mode,
        version=algorithm.algorithm_version,
        route=algorithm.route.route if algorithm.route is not None else None,
        route_confidence=(
            algorithm.route.confidence if algorithm.route is not None else None
        ),
        retrieval_complete=bool(
            algorithm.retrieval is not None and algorithm.retrieval.completed
        ),
        review=EvaluationAlgorithmReview(
            blocking_count=counts["BLOCKING"],
            warning_count=counts["WARNING"],
            info_count=counts["INFO"],
        ),
        healing=EvaluationAlgorithmHealing(
            attempt_count=len(algorithm.healing),
            candidate_count=sum(row.candidate_count for row in algorithm.healing),
            reasons=list(
                dict.fromkeys(
                    reason for row in algorithm.healing for reason in row.reasons
                )
            ),
        ),
    )


def _cost(session, job: Job) -> tuple[int | None, str, str, str]:
    reservation_filter = or_(
        Reservation.operation_id == f"job:{job.id}",
        Reservation.operation_id.like(f"job:{job.id}:resume:%"),
    )
    entries = list(
        session.scalars(
            select(UsageEntry)
            .join(Reservation, Reservation.id == UsageEntry.reservation_id)
            .where(reservation_filter)
        )
    )
    unknown = session.scalar(
        select(UnknownUsage.id).where(
            UnknownUsage.metadata_json["reservation_operation_id"].astext.like(
                f"job:{job.id}%"
            )
        )
    )
    model_records = list(
        session.scalars(
            select(ResourceRecord).where(
                ResourceRecord.job_id == job.id,
                ResourceRecord.type == "MODEL_CALL",
            ).order_by(ResourceRecord.created_at, ResourceRecord.id)
        )
    )
    models = sorted(
        {
            str(record.metadata_json.get("model"))
            for record in model_records
            if record.metadata_json.get("model")
        }
    )
    model = ", ".join(models) if models else ("UNKNOWN" if model_records else "NOT_RUN")
    price_version = next(
        (entry.price_version for entry in entries),
        next(
            (
                record.metadata_json.get("price_version")
                for record in model_records
                if record.metadata_json.get("price_version")
            ),
            settings.PRICE_VERSION,
        ),
    )
    unresolved = unknown is not None or any(
        record.state in {"REQUESTED", "RECEIVED", "UNKNOWN"}
        for record in model_records
    )
    if unresolved or (model_records and not entries):
        return None, "unknown", price_version, model
    if entries:
        return sum(entry.cost_units for entry in entries), "known", price_version, model
    if job.status in {"SUCCEEDED", "FAILED", "CANCELLED"}:
        return 0, "known", price_version, model
    return None, "unknown", price_version, model


def build_evaluation_record(session, job: Job) -> EvaluationRecord:
    checkpoint = dict(job.checkpoint or {})
    report = service.job_report(session, job)
    result = job.result or None
    version_id = (result or {}).get("version_id")
    release = session.scalar(
        select(ResourceRecord)
        .where(
            ResourceRecord.job_id == job.id,
            ResourceRecord.type == "RELEASE_ATTEMPT",
        )
        .order_by(ResourceRecord.created_at.desc())
        .limit(1)
    )
    target_id = checkpoint.get("evaluation_target_id")
    if not target_id and result and result.get("instance_id"):
        instance = session.get(Instance, result["instance_id"])
        target_id = instance.target_id if instance else None
    if not target_id and release:
        target_id = release.target_id
    is_real = bool(
        job.status == "SUCCEEDED"
        and report.overall == "PASS"
        and result
        and result.get("url")
        and release
        and release.state == "SUCCEEDED"
        and release.target_id
    )
    cost_units, cost_status, price_version, model = _cost(session, job)
    app = session.get(App, job.app_id)
    if app is None:
        raise LookupError("evaluation app not found")
    routing_mode = (
        "forced" if checkpoint.get("routing_mode") == "forced" else "automatic"
    )
    gate_reasons = []
    if job.status not in {"SUCCEEDED", "FAILED", "CANCELLED"}:
        gate_reasons.append("JOB_NOT_TERMINAL")
    if not is_real:
        gate_reasons.append("REAL_RELEASE_EVIDENCE_MISSING")
    if job.status in {"SUCCEEDED", "FAILED", "CANCELLED"} and report.overall != "PASS":
        gate_reasons.append("BUSINESS_VALIDATION_NOT_PASS")
    if cost_status != "known":
        gate_reasons.append("COST_UNKNOWN")
    if not gate_reasons:
        gate_status = "PASS"
    elif job.status in {"FAILED", "CANCELLED"}:
        gate_status = "FAIL"
    else:
        gate_status = "NOT_RUN"
    return EvaluationRecord(
        job_id=job.id,
        app_id=job.app_id,
        version_id=version_id,
        status=job.status,
        route=_route(checkpoint),
        algorithm=_algorithm(checkpoint),
        source_mode="real" if is_real else "fixture",
        routing_mode=routing_mode,
        target_id=target_id,
        target_override=bool(checkpoint.get("evaluation_target_id")),
        model=model,
        price_version=price_version,
        usage_units=job.used_units,
        cost_units=cost_units,
        cost_status=cost_status,
        evidence_gate=EvaluationEvidenceGate(
            status=gate_status,
            reasons=gate_reasons,
        ),
        duration_ms=_milliseconds(job.created_at, job.updated_at),
        phase_durations=_phase_durations(session, job),
        sources=_sources(checkpoint),
        retrieval=_retrieval(checkpoint),
        requirement_compilation=(
            EvaluationRequirementCompilation(
                status=compilation["status"],
                stage=compilation["stage"],
                attempt_count=compilation["attempt_count"],
                source_digest=compilation["source_digest"],
                last_error_code=compilation.get("last_error_code"),
                unresolved_issues=[str(issue)[:1024] for issue in compilation.get("unresolved_issues", [])[:50]],
            ) if (compilation := checkpoint.get("requirement_compilation")) else None
        ),
        result=result,
        report=report,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )
