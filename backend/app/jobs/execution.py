"""Default worker assembly. Model/tool effects and their fees share the job lease."""

from __future__ import annotations

import hashlib
import inspect
import json
import time
from pathlib import Path

from sqlalchemy import func, select

from app.agent.deepseek import DeepSeekClient, UpstreamUnavailable
from app.agent.requirements import (
    compile_requirement,
    persist_requirement,
    validate_revision,
)
from app.apps.models import App, Message, RequirementRecord
from app.billing.ledger import InsufficientQuota, record_usage, reserve
from app.billing.models import Reservation, UnknownUsage
from app.billing.pricing import resolve_price
from app.config import settings
from app.core.types import ModelTurn, Requirement, UsageInput
from app.database import SessionLocal
from app.jobs.models import JobEvent
from app.jobs.store import leased_job
from app.runtime.models import ResourceRecord
from app.runtime.artifacts import source_archive


class WaitingForUser(RuntimeError):
    pass


class UncertainModelCall(UpstreamUnavailable):
    pass


def request_hash(value):
    return hashlib.sha256(
        json.dumps(
            value, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        ).encode()
    ).hexdigest()


class DurableModel:
    def __init__(self, execution, phase, start=0):
        self.execution = execution
        self.phase = phase
        self.position = start

    async def complete(self, messages, tools, model):
        execution = self.execution
        prefix = settings.DEEPSEEK_PRICE_PREFIX
        operation = f"model:{execution.job_id}:{self.phase}:{self.position}"
        self.position += 1
        payload = {
            "messages": messages,
            "tools": tools,
            "model": settings.DEEPSEEK_MODEL,
        }
        digest = request_hash(payload)
        with execution.sessions() as session:
            job = execution.job(session)
            parent = execution.reservation(session, job)
            for kind in (
                f"{prefix}.input",
                f"{prefix}.cached_input",
                f"{prefix}.output",
            ):
                resolve_price(kind, settings.PRICE_VERSION, session)
            record = session.scalar(
                select(ResourceRecord)
                .where(
                    ResourceRecord.type == "MODEL_CALL",
                    ResourceRecord.operation_id == operation,
                )
                .with_for_update()
            )
            if record:
                if record.metadata_json["request_hash"] != digest:
                    raise ValueError("model operation was reused with different input")
                if record.state in {"REQUESTED", "UNKNOWN"}:
                    raise UncertainModelCall("模型请求或用量待核对，不能自动重复执行")
                turn = ModelTurn.model_validate(record.metadata_json["response"])
                if record.state == "METERED":
                    return turn
            else:
                count = session.scalar(
                    select(func.count())
                    .select_from(ResourceRecord)
                    .where(
                        ResourceRecord.type == "MODEL_CALL",
                        ResourceRecord.job_id == job.id,
                    )
                )
                if count >= settings.MAX_JOB_MODEL_CALLS:
                    raise ValueError("模型调用总次数已达到上限")
                # UTF-8 bytes conservatively bound ordinary tokenizer input plus framing.
                input_bound = (
                    len(json.dumps(payload, ensure_ascii=False).encode()) * 2 + 1024
                )
                n, d = resolve_price(f"{prefix}.input", settings.PRICE_VERSION, session)
                output_n, output_d = resolve_price(
                    f"{prefix}.output", settings.PRICE_VERSION, session
                )
                bound = (input_bound * n + d - 1) // d + (
                    settings.DEEPSEEK_MAX_OUTPUT_TOKENS * output_n + output_d - 1
                ) // output_d
                if parent.used_units + bound > parent.max_units:
                    raise InsufficientQuota()
                record = ResourceRecord(
                    type="MODEL_CALL",
                    job_id=job.id,
                    app_id=job.app_id,
                    operation_id=operation,
                    state="REQUESTED",
                    reference=operation,
                    metadata_json={
                        "request_hash": digest,
                        "model": settings.DEEPSEEK_MODEL,
                        "price_version": settings.PRICE_VERSION,
                        "price_prefix": prefix,
                        "reservation_operation_id": parent.operation_id,
                    },
                )
                session.add(record)
            session.commit()
            saved_response = record.metadata_json.get("response")
        if not saved_response:
            try:
                turn = await execution.raw_model.complete(
                    messages, tools, settings.DEEPSEEK_MODEL
                )
            except Exception as exc:
                with execution.sessions() as session:
                    execution.job(session)
                    record = session.scalar(
                        select(ResourceRecord)
                        .where(
                            ResourceRecord.operation_id == operation,
                            ResourceRecord.type == "MODEL_CALL",
                        )
                        .with_for_update()
                    )
                    # A response cannot be inferred from a lost connection or worker.
                    record.state = "UNKNOWN"
                    record.metadata_json = {
                        **record.metadata_json,
                        "failure_type": type(exc).__name__,
                    }
                    session.commit()
                raise UncertainModelCall("模型请求结果未确认，已保存核对记录") from exc
            with execution.sessions() as session:
                execution.job(session)
                record = session.scalar(
                    select(ResourceRecord)
                    .where(
                        ResourceRecord.operation_id == operation,
                        ResourceRecord.type == "MODEL_CALL",
                    )
                    .with_for_update()
                )
                record.state = "RECEIVED"
                record.metadata_json = {
                    **record.metadata_json,
                    "response": turn.model_dump(mode="json"),
                }
                session.commit()
        with execution.sessions() as session:
            job = execution.job(session)
            record = session.scalar(
                select(ResourceRecord)
                .where(
                    ResourceRecord.operation_id == operation,
                    ResourceRecord.type == "MODEL_CALL",
                )
                .with_for_update()
            )
            if not turn.usage_known:
                record.state = "UNKNOWN"
                session.add(
                    UnknownUsage(
                        operation_id=operation,
                        payer_id=job_owner(session, job),
                        kind="model.chat",
                        metadata_json={
                            "reservation_operation_id": record.metadata_json[
                                "reservation_operation_id"
                            ]
                        },
                    )
                )
                session.commit()
                raise UncertainModelCall("模型用量缺失，不能记录为免费或继续无限调用")
            parent = session.scalar(
                select(Reservation).where(
                    Reservation.operation_id
                    == record.metadata_json["reservation_operation_id"]
                )
            )
            if parent.status != "OPEN":
                parent = execution.reservation(session, job)
                record.metadata_json = {
                    **record.metadata_json,
                    "reservation_operation_id": parent.operation_id,
                }
            prefix = record.metadata_json.get("price_prefix", prefix)
            price_version = record.metadata_json.get(
                "price_version", settings.PRICE_VERSION
            )
            values = [
                (
                    "input",
                    f"{prefix}.input",
                    max(0, turn.input_tokens - turn.cached_input_tokens),
                ),
                ("cached", f"{prefix}.cached_input", turn.cached_input_tokens),
                ("output", f"{prefix}.output", turn.output_tokens),
            ]
            for suffix, kind, units in values:
                if units:
                    record_usage(
                        session,
                        UsageInput(
                            operation_id=operation + ":" + suffix,
                            payer_id=parent.payer_id,
                            kind=kind,
                            units=units,
                            price_version=price_version,
                            reservation_operation_id=parent.operation_id,
                        ),
                    )
            execution.sync_usage(session, job)
            record.state = "METERED"
            session.commit()
        return turn


def job_owner(session, job):
    return session.get(App, job.app_id).owner_id


class JobExecution:
    def __init__(
        self,
        job_id,
        worker_id,
        generation,
        *,
        session_factory=SessionLocal,
        model_client=None,
        runner=None,
    ):
        self.job_id = job_id
        self.worker_id = worker_id
        self.generation = generation
        self.sessions = session_factory
        self.raw_model = model_client
        self.runner = runner

    def job(self, session):
        return leased_job(session, self.job_id, self.worker_id, self.generation)

    def model(self, phase, start=0):
        if self.raw_model is None:
            self.raw_model = DeepSeekClient()
        return DurableModel(self, phase, start)

    def reservation(self, session, job):
        parent = (
            session.get(Reservation, job.reservation_id) if job.reservation_id else None
        )
        if parent is None:
            parent = reserve(
                session,
                job_owner(session, job),
                f"job:{job.id}",
                max(1, job.budget_units - job.used_units),
            )
            job.reservation_id = parent.id
        if parent.status != "OPEN" or parent.used_units >= parent.max_units:
            raise InsufficientQuota()
        return parent

    def sync_usage(self, session, job):
        from app.billing.models import UsageEntry
        from sqlalchemy import or_

        job.used_units = session.scalar(
            select(func.coalesce(func.sum(UsageEntry.cost_units), 0))
            .join(Reservation, Reservation.id == UsageEntry.reservation_id)
            .where(
                or_(
                    Reservation.operation_id == f"job:{job.id}",
                    Reservation.operation_id.startswith(
                        f"job:{job.id}:resume:", autoescape=True
                    ),
                )
            )
        )

    async def ensure_requirement(self):
        with self.sessions() as session:
            job = self.job(session)
            messages = [
                {
                    "id": m.id,
                    "sequence": m.sequence,
                    "role": m.role,
                    "content": m.content,
                }
                for m in session.scalars(
                    select(Message)
                    .where(Message.app_id == job.app_id)
                    .order_by(Message.sequence)
                )
            ]
            stamp = max(m["sequence"] for m in messages if m["role"] == "user")
            if job.requirement_revision and (
                job.kind == "COPY"
                or job.checkpoint.get("requirements_source_sequence") == stamp
            ):
                from app.agent.checkpoint import load_algorithm_checkpoint

                record = session.scalar(
                    select(RequirementRecord).where(
                        RequirementRecord.app_id == job.app_id,
                        RequirementRecord.revision == job.requirement_revision,
                    )
                )
                algorithm = load_algorithm_checkpoint(
                    dict(job.checkpoint or {}), record.revision
                )
                if record.revision != algorithm.requirement_revision:
                    raise ValueError(
                        "frozen requirement revision differs from algorithm checkpoint"
                    )
                return Requirement.model_validate(record.requirement)
            previous = session.scalar(
                select(RequirementRecord)
                .where(RequirementRecord.app_id == job.app_id)
                .order_by(RequirementRecord.revision.desc())
                .limit(1)
            )
            previous = (
                Requirement.model_validate(previous.requirement) if previous else None
            )
            job.phase = "clarifying"
            session.commit()
        draft = await compile_requirement(
            messages, previous, self.model(f"requirements:{stamp}")
        )
        if draft.questions or draft.unsupported:
            self.wait_for_user(
                "\n".join(draft.questions or ["一期支持Web应用，是否接受以Web交付？"])
            )
        requirement = validate_revision(previous, draft, messages)
        if requirement.revision != self.algorithm_checkpoint().requirement_revision:
            raise ValueError(
                "compiled requirement revision differs from algorithm checkpoint"
            )
        with self.sessions() as session:
            job = self.job(session)
            persist_requirement(
                session,
                job.id,
                requirement,
                worker_id=self.worker_id,
                generation=self.generation,
            )
            job.checkpoint = {**job.checkpoint, "requirements_source_sequence": stamp}
            session.commit()
        return requirement

    def wait_for_user(self, question):
        with self.sessions() as session:
            job = self.job(session)
            sequence = (
                session.scalar(
                    select(func.max(Message.sequence)).where(
                        Message.app_id == job.app_id
                    )
                )
                or 0
            ) + 1
            session.add(
                Message(
                    app_id=job.app_id,
                    sequence=sequence,
                    role="assistant",
                    content=question,
                )
            )
            job.status = "WAITING_USER"
            job.phase = "clarifying"
            job.question = question
            job.lease_owner = None
            job.lease_until = None
            event = JobEvent(
                job_id=job.id,
                kind="question",
                public_payload={
                    "id": 0,
                    "kind": "question",
                    "message": question,
                    "status": "WAITING_USER",
                    "phase": "clarifying",
                    "usage_units": job.used_units,
                },
            )
            session.add(event)
            session.flush()
            event.public_payload = {**event.public_payload, "id": event.id}
            session.commit()
        raise WaitingForUser(question)

    async def close(self):
        if self.raw_model and hasattr(self.raw_model, "client"):
            value = self.raw_model.client.close()
            if inspect.isawaitable(value):
                await value
        if self.runner and hasattr(self.runner, "close"):
            await self.runner.close()

    def checkpoint(self):
        with self.sessions() as session:
            return dict(self.job(session).checkpoint or {})

    def algorithm_checkpoint(self):
        from app.agent.checkpoint import load_algorithm_checkpoint

        with self.sessions() as session:
            job = self.job(session)
            raw = dict(job.checkpoint or {})
            stored = raw.get("algorithm") or {}
            revision = (
                stored.get("requirement_revision")
                or job.requirement_revision
                or 1
            )
            return load_algorithm_checkpoint(raw, int(revision))

    def save_algorithm_checkpoint(self, checkpoint):
        from app.agent.checkpoint import save_algorithm_checkpoint

        with self.sessions() as session:
            job = self.job(session)
            job.checkpoint = save_algorithm_checkpoint(
                dict(job.checkpoint or {}), checkpoint
            )
            session.commit()

    def save(self, **changes):
        with self.sessions() as session:
            job = self.job(session)
            job.checkpoint = {**job.checkpoint, **changes}
            session.commit()

    async def choose_sources(self, requirement):
        from app.agent.orchestrator import AlgorithmOrchestrator

        return await AlgorithmOrchestrator(self).select_sources(requirement)

    async def select_sources_baseline(self, requirement):
        from app.agent.retrieval import retrieve_sources, SearchUnavailable
        from app.agent.repository_index import load_index
        from app.agent.routing import choose_route, score_candidate

        result = await retrieve_sources(
            requirement,
            repository_index=load_index(Path(settings.REPOSITORY_INDEX_PATH)),
        )
        if not result.completed:
            raise SearchUnavailable("仓库检索未完成，不能直接生成")
        from app.agent.compatibility import assess_compatibility

        evaluations = []
        for candidate in result.candidates:
            candidate["compatibility"] = assess_compatibility(
                candidate, requirement
            ).status
            evaluations.append(score_candidate(candidate, requirement))
        if not result.candidates:
            result.reuse_rejections = [{"reason": "完整检索后未发现可复用候选"}]
        else:
            result.reuse_rejections = [
                {
                    "repo_url": item.repo_url,
                    "missing": item.missing_core,
                    "unknown": item.unknown_fields,
                    "compatibility": item.compatibility,
                }
                for item in evaluations
                if not item.eligible_a
            ]
        checkpoint = self.algorithm_checkpoint()
        checkpoint.retrieval = result
        checkpoint.evaluations = evaluations
        self.save_algorithm_checkpoint(checkpoint)
        return await choose_route(
            requirement,
            result,
            evaluations,
            self.model(f"route:{requirement.revision}"),
        )

    async def select_sources_hybrid(self, requirement):
        from app.agent.checkpoint import stage_input_hash
        from app.agent.contracts import AlgorithmStageRecord
        from app.agent.profiling import profile_repository
        from app.agent.query import plan_queries
        from app.agent.ranking import rank_candidate
        from app.agent.repository_index import load_index
        from app.agent.retrieval import retrieve_sources
        from app.agent.routing import choose_route

        with self.sessions() as session:
            job = self.job(session)
            job.phase = "retrieving"
            session.commit()

        checkpoint = self.algorithm_checkpoint()
        started = time.monotonic()
        query_plan = await plan_queries(
            requirement,
            self.model(f"query:{requirement.revision}")
            if checkpoint.mode == "hybrid"
            else None,
        )
        checkpoint.query_plan = query_plan
        checkpoint.stages.append(
            AlgorithmStageRecord(
                operation_id=(
                    f"job:{self.job_id}:query:r{requirement.revision}:fusion-v1"
                ),
                stage="QUERY_PLAN",
                input_hash=stage_input_hash(requirement),
                implementation_version="fusion-v1",
                status="SUCCEEDED",
                output_ref=stage_input_hash(query_plan),
                attempt=1,
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        )

        retrieval_record = AlgorithmStageRecord(
            operation_id=(
                f"job:{self.job_id}:retrieval:{stage_input_hash(query_plan)}"
            ),
            stage="RETRIEVAL",
            input_hash=stage_input_hash(query_plan),
            implementation_version="fusion-v1",
            status="REQUESTED",
            attempt=1,
        )
        checkpoint.stages.append(retrieval_record)
        self.save_algorithm_checkpoint(checkpoint)
        started = time.monotonic()
        try:
            retrieval = await retrieve_sources(
                requirement,
                query_plan,
                repository_index=load_index(
                    Path(settings.REPOSITORY_INDEX_PATH)
                ),
            )
        except Exception as exc:
            retrieval_record.status = "FAILED"
            retrieval_record.duration_ms = int((time.monotonic() - started) * 1000)
            retrieval_record.error_code = type(exc).__name__
            self.save_algorithm_checkpoint(checkpoint)
            raise
        retrieval_record.status = "SUCCEEDED" if retrieval.completed else "FAILED"
        retrieval_record.duration_ms = int((time.monotonic() - started) * 1000)
        retrieval_record.output_ref = stage_input_hash(retrieval)
        retrieval_record.error_code = None if retrieval.completed else "SEARCH_INCOMPLETE"
        checkpoint.retrieval = retrieval

        started = time.monotonic()
        profiles = []
        for candidate in retrieval.candidates:
            if candidate.commit:
                try:
                    profiles.append(profile_repository(candidate, requirement))
                except ValueError:
                    continue
        checkpoint.profiles = profiles
        evaluations = [rank_candidate(profile, requirement) for profile in profiles]
        checkpoint.evaluations = evaluations
        checkpoint.stages.append(
            AlgorithmStageRecord(
                operation_id=(
                    f"job:{self.job_id}:profile:{stage_input_hash(retrieval)}"
                ),
                stage="PROFILE",
                input_hash=stage_input_hash(retrieval),
                implementation_version="profile-v1",
                status="SUCCEEDED",
                output_ref=stage_input_hash(profiles),
                attempt=1,
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        )

        if retrieval.candidates:
            retrieval.reuse_rejections = [
                {
                    "repo_url": evaluation.repo_url,
                    "reasons": evaluation.rejection_reasons,
                    "missing_core": evaluation.missing_core,
                    "unknown_fields": evaluation.unknown_fields,
                }
                for evaluation in evaluations
                if evaluation.rejection_reasons
                or evaluation.missing_core
                or evaluation.unknown_fields
            ]
        else:
            retrieval.reuse_rejections = [
                {"reason": "complete search found no reusable candidates"}
            ]
        checkpoint.retrieval = retrieval
        route_record = AlgorithmStageRecord(
            operation_id=(
                f"job:{self.job_id}:route:r{requirement.revision}:"
                f"{stage_input_hash(evaluations)}"
            ),
            stage="ROUTE",
            input_hash=stage_input_hash(
                {
                    "retrieval": retrieval,
                    "profiles": profiles,
                    "evaluations": evaluations,
                }
            ),
            implementation_version="fusion-v1",
            status="REQUESTED",
            attempt=1,
        )
        checkpoint.stages.append(route_record)
        self.save_algorithm_checkpoint(checkpoint)
        started = time.monotonic()
        model = (
            self.model(f"route:{requirement.revision}")
            if checkpoint.mode == "hybrid"
            else None
        )
        try:
            route = await choose_route(
                requirement,
                retrieval,
                profiles,
                evaluations,
                model,
            )
            if route.route == "COMPOSE_COMPONENTS":
                from app.agent.integration import build_integration_contract

                contract = await build_integration_contract(
                    requirement,
                    route,
                    profiles,
                    self.model(f"integration:{requirement.revision}"),
                )
                checkpoint.integration_contract = contract
        except Exception as exc:
            route_record.status = "FAILED"
            route_record.duration_ms = int((time.monotonic() - started) * 1000)
            route_record.error_code = type(exc).__name__
            self.save_algorithm_checkpoint(checkpoint)
            raise
        route_record.status = "SUCCEEDED"
        route_record.duration_ms = int((time.monotonic() - started) * 1000)
        route_record.output_ref = stage_input_hash(route)
        checkpoint.selected_sources = list(route.sources)
        self.save_algorithm_checkpoint(checkpoint)
        return route

    async def generate_candidate(
        self, *, job_id, job, requirement, attempt_index, repair_evidence
    ):
        from app.agent.workspace import WorkspaceManager
        from app.agent.scaffold import prepare_scaffold
        from app.agent.routing import prepare_sources
        from app.agent.loop import run_generation
        from app.core.types import (
            Checkpoint,
            AppManifest,
            RoutePlan,
            RepoSource,
            ToolResult,
        )
        from app.apps.models import AppVersion
        from app.jobs.pipeline import CandidateDraft, PipelineFailure, PauseQuota
        from app.runtime.artifacts import unpack_source

        self.attempt_index = attempt_index
        saved = self.checkpoint()
        workspace = Path(
            WorkspaceManager(settings.AGENT_WORKSPACE_ROOT).create_workspace(job_id)
        )
        from app.runtime.cleanup import register_resource
        with self.sessions() as session:
            current=self.job(session)
            register_resource(session,'WORKSPACE','workspace:'+job_id,str(workspace),job_id=job_id,app_id=current.app_id,
                metadata={'remote_uploaded':bool(saved.get('workspace_uploaded'))})
            session.commit()
        if saved.get("workspace_uploaded"):
            await self.runner.snapshot(job_id, workspace, self.generation)
            checkpoint = Checkpoint.model_validate(saved.get("loop") or {})
        else:
            with self.sessions() as session:
                app = session.get(App, job.app_id)
                previous = (
                    session.get(AppVersion, app.active_version_id)
                    if app.active_version_id
                    else None
                )
            if previous:
                unpack_source(Path(previous.artifact_path).read_bytes(), workspace)
                plan = RoutePlan(
                    route="MODIFY_EXISTING" if previous.sources else "GENERATE_APP",
                    sources=[
                        RepoSource.model_validate(item) for item in previous.sources
                    ],
                    template_version=previous.template_version,
                    steps=["在当前源码上修改并保留全部既有验收"],
                    reason="沿用当前验证版本及持久数据",
                )
            else:
                plan = await self.choose_sources(requirement)
                if plan.route == "GENERATE_APP":
                    root = (
                        Path(__file__).resolve().parents[3] / "scaffolds/nextjs-prisma"
                    )
                    plan.template_version = prepare_scaffold(
                        str(workspace), root, app.name
                    )
                else:
                    await __import__("asyncio").to_thread(
                        prepare_sources, str(workspace), plan
                    )
            await self.runner.upload(job_id, workspace, self.generation)
            with self.sessions() as session:
                row=register_resource(session,'WORKSPACE','workspace:'+job_id,str(workspace),job_id=job_id,app_id=job.app_id)
                row.metadata_json={**row.metadata_json,'remote_uploaded':True}; session.commit()
            checkpoint = Checkpoint(
                workspace=str(workspace),
                route=plan,
                requirement_revision=requirement.revision,
            )
            instruction = (
                Path(__file__).resolve().parents[3]
                / "prompts/generation"
                / (
                    {
                        "DEPLOY_EXISTING": "deploy_existing",
                        "MODIFY_EXISTING": "modify_existing",
                        "COMPOSE_COMPONENTS": "compose_components",
                        "GENERATE_APP": "generate_app",
                    }[plan.route]
                    + ".md"
                )
            ).read_text()
            checkpoint.messages = [
                {
                    "role": "system",
                    "content": instruction
                    + "\n只提交实际源码对应的AppManifest。应用身份/数据/文件/AI/搜索使用平台服务端适配；不得生成演示数据代替业务。",
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "requirement": requirement.model_dump(mode="json"),
                            "plan": plan.model_dump(mode="json"),
                            "manifest_schema": AppManifest.model_json_schema(),
                        },
                        ensure_ascii=False,
                    ),
                },
            ]
            self.save(
                workspace_uploaded=True,
                loop=checkpoint.model_dump(mode="json"),
                sources=[item.model_dump(mode="json") for item in plan.sources],
                template_version=plan.template_version,
            )
        checkpoint.requirement_revision = requirement.revision
        if (
            saved.get("generation_manifest")
            and saved.get("implementation_attempt") == attempt_index
        ):
            manifest = AppManifest.model_validate(saved["generation_manifest"])
        else:
            if repair_evidence:
                checkpoint.messages.append(
                    {
                        "role": "user",
                        "content": "候选未通过平台验证，保留需求和已有业务并依据这些证据修复："
                        + json.dumps(repair_evidence, ensure_ascii=False),
                    }
                )
            if checkpoint.pending_calls:
                for call in checkpoint.pending_calls:
                    if call.id not in checkpoint.completed_calls:
                        response = await self.runner.tool_result(
                            job_id, call.id, self.generation
                        )
                        if response.get("state") != "COMPLETED":
                            raise PipelineFailure("工具副作用结果待核对，不能盲目重放")
                        self.record_resource(
                            "tool:" + call.id,
                            "execution.millis",
                            response["result"].get("duration_ms"),
                        )
                        checkpoint.completed_calls[call.id] = ToolResult.model_validate(
                            response["result"]["result"]
                        )
                    if not any(
                        m.get("tool_call_id") == call.id for m in checkpoint.messages
                    ):
                        checkpoint.messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": call.id,
                                "content": checkpoint.completed_calls[call.id].content,
                            }
                        )
                checkpoint.pending_calls = []
            model = self.model(
                f"implementation:{attempt_index}:r{requirement.revision}",
                sum(m.get("role") == "assistant" for m in checkpoint.messages),
            )
            output = await run_generation(
                job_id,
                checkpoint,
                model,
                self.execute_tool,
                lambda cp: self.save(loop=cp.model_dump(mode="json")),
                lambda _: None,
            )
            if output.question:
                self.wait_for_user(output.question)
            if output.manifest is None:
                with self.sessions() as session:
                    current = self.job(session)
                    if current.used_units >= current.budget_units:
                        raise PauseQuota("执行额度已耗尽")
                raise PipelineFailure("生成未形成可验证的运行清单")
            manifest = output.manifest
            self.save(
                generation_manifest=manifest.model_dump(mode="json"),
                implementation_attempt=attempt_index,
            )
        files = await self.runner.snapshot(job_id, workspace, self.generation)
        return CandidateDraft(str(workspace), manifest, files)

    async def execute_tool(self, call):
        from app.core.types import ToolResult, RoutePlan, RepoSource
        from app.agent.routing import prepare_sources
        from app.agent.retrieval import normalize_candidate
        from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient
        from app.agent.workspace import safe_path
        import asyncio
        if call.name=='run_command':
            from app.runtime.cleanup import register_resource
            operation=self.job_id+'-'+hashlib.sha256(call.id.encode()).hexdigest()
            name='id-exec-'+hashlib.sha256(operation.encode()).hexdigest()[:32]
            with self.sessions() as session:
                job=self.job(session)
                register_resource(session,'EXECUTION_CONTAINER',operation,name,job_id=job.id,app_id=job.app_id)
                session.commit()

        if call.name in {"search_repositories", "fetch_repository"}:
            saved = self.checkpoint()
            if call.name == "search_repositories":
                client = GitHubRepositorySearchClient()
                rows = await client.search_repositories(
                    call.arguments["query"],
                    per_page=min(20, int(call.arguments.get("limit", 10))),
                )
                candidates = [
                    normalize_candidate(await client.enrich_repository(row))
                    for row in rows
                ]
                known = {
                    item["repo_url"]: item
                    for item in (saved.get("retrieval") or {}).get("candidates", [])
                }
                known.update({item["repo_url"]: item for item in candidates})
                self.save(
                    retrieval={
                        **(saved.get("retrieval") or {}),
                        "candidates": list(known.values()),
                    }
                )
                return ToolResult(
                    call_id=call.id,
                    ok=True,
                    content=json.dumps(candidates, ensure_ascii=False)[:65536],
                )
            known = {
                item["repo_url"]: item
                for item in (saved.get("retrieval") or {}).get("candidates", [])
            }
            url = call.arguments["url"]
            commit = call.arguments["commit"]
            if url not in known or known[url].get("commit") != commit:
                raise ValueError("source was not retrieved at this commit")
            if saved.get("route_switches", 0) >= 2:
                raise ValueError("source switch limit reached")
            workspace = Path(settings.AGENT_WORKSPACE_ROOT) / self.job_id
            destination = safe_path(workspace, call.arguments["destination"])
            destination.mkdir(parents=True, exist_ok=True)
            source = RepoSource(url=url, commit=commit, role="component")
            await asyncio.to_thread(
                prepare_sources,
                str(destination),
                RoutePlan(
                    route="MODIFY_EXISTING",
                    sources=[source],
                    steps=["准备已检索组件"],
                    reason="controlled source tool",
                ),
            )
            # Synchronization uses a distinct registered operation; runner refuses a changed initial upload.
            await self.runner.import_source(
                self.job_id,
                source_archive(destination),
                call.arguments["destination"],
                call.id,
                self.generation,
            )
            self.save(
                sources=[*(saved.get("sources") or []), source.model_dump(mode="json")],
                route_switches=saved.get("route_switches", 0) + 1,
            )
            return ToolResult(call_id=call.id, ok=True, content="已准备固定提交的组件")
        self.admit_resource(
            "execution.millis", int(call.arguments.get("timeout", 60)) * 1000
        )
        response = await self.runner.tool(self.job_id, call, self.generation)
        self.job_check()
        self.record_resource(
            "tool:" + call.id, "execution.millis", response.get("duration_ms")
        )
        return ToolResult.model_validate(response["result"])

    def job_check(self):
        with self.sessions() as session:
            job = self.job(session)
            self.sync_usage(session, job)
            session.commit()

    def admit_resource(self, kind, max_units):
        with self.sessions() as session:
            job = self.job(session)
            parent = self.reservation(session, job)
            n, d = resolve_price(kind, settings.PRICE_VERSION, session)
            if parent.used_units + (max_units * n + d - 1) // d > parent.max_units:
                raise InsufficientQuota()

    def admit_stage(self, stage, estimated_upper_units):
        from app.agent.policy import StageBudgetPolicy, budget_group

        if estimated_upper_units < 0:
            raise ValueError("estimated_upper_units must be non-negative")
        with self.sessions() as session:
            job = self.job(session)
            parent = self.reservation(session, job)
            group = budget_group(stage)
            raw_algorithm = (job.checkpoint or {}).get("algorithm") or {}
            used_units = sum(
                int(record.get("usage_units") or 0)
                for record in raw_algorithm.get("stages") or []
                if budget_group(str(record.get("stage") or "")) == group
            )
            policy = StageBudgetPolicy(parent.max_units)
            if not policy.allows(
                group,
                used_units=used_units,
                estimated_upper_units=estimated_upper_units,
            ):
                raise InsufficientQuota()
            if parent.used_units + estimated_upper_units > parent.max_units:
                raise InsufficientQuota()

    def admit_candidate_race(self, specs):
        from app.runtime.candidate_race import validate_candidate_race

        total = sum(item.estimated_upper_units for item in specs)
        validate_candidate_race(specs, remaining_budget=total)
        self.admit_stage("BUILD", total)

    def record_resource(self, action, kind, units):
        if units is None or not isinstance(units, int) or units < 0:
            raise UncertainModelCall("执行资源用量待核对")
        with self.sessions() as session:
            job = self.job(session)
            parent = self.reservation(session, job)
            record_usage(
                session,
                UsageInput(
                    operation_id=f"job:{job.id}:{action}",
                    payer_id=parent.payer_id,
                    kind=kind,
                    units=units,
                    price_version=settings.PRICE_VERSION,
                    reservation_operation_id=parent.operation_id,
                ),
            )
            self.sync_usage(session, job)
            session.commit()

    async def review_candidate(self, attempt_id, draft, requirement):
        from app.agent.orchestrator import AlgorithmOrchestrator
        from app.agent.contracts import EvidenceRef
        from app.core.types import RoutePlan
        from app.runtime.manifest import manifest_hash

        checkpoint = self.algorithm_checkpoint()
        digest = manifest_hash(draft.manifest)
        existing = [
            report
            for report in checkpoint.reviews
            if report.attempt_id == attempt_id and report.manifest_hash == digest
        ]
        if existing:
            return existing
        route = checkpoint.route or RoutePlan(
            route="GENERATE_APP",
            steps=["generate"],
            reason="candidate review fallback",
            confidence="LOW",
        )
        orchestrator = AlgorithmOrchestrator(self)
        policy = checkpoint.orchestration or orchestrator.decide_orchestration(
            requirement, route, checkpoint.profiles, []
        )
        profile = checkpoint.profiles[0] if checkpoint.profiles else None
        review_model = None
        security_model = None
        if policy.require_llm_review:
            review_model = self.model(f"review:{attempt_id}:{digest}")
        if policy.require_security_llm:
            source_digest = profile.commit if profile is not None else digest
            security_model = self.model(
                f"security:{attempt_id}:{source_digest}"
            )
        reports = await orchestrator.review_candidate(
            attempt_id,
            draft,
            requirement,
            route,
            profile,
            policy,
            model=review_model,
            security_model=security_model,
        )
        evidence_root = Path(settings.ARTIFACTS_ROOT) / "reviews" / self.job_id
        evidence_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        checkpoint = self.algorithm_checkpoint()
        checkpoint.orchestration = policy
        for report in reports:
            payload = report.model_dump_json(indent=2).encode("utf-8")
            path = evidence_root / f"{attempt_id}-{report.reviewer_kind.lower()}.json"
            temporary = path.with_suffix(path.suffix + ".tmp")
            temporary.write_bytes(payload)
            temporary.chmod(0o600)
            temporary.replace(path)
            path.chmod(0o600)
            checkpoint.evidence_refs.append(
                EvidenceRef(
                    kind=(
                        "SECURITY"
                        if report.reviewer_kind == "SECURITY_RULES"
                        else "REVIEW"
                    ),
                    reference=str(path),
                    digest=hashlib.sha256(payload).hexdigest(),
                    access="DEVELOPER",
                )
            )
            checkpoint.reviews.append(report)
        self.save_algorithm_checkpoint(checkpoint)
        return reports

    async def compile_checks(self, requirement, source_tree, model=None):
        from app.runtime.check_plan import compile_browser_checks

        workspace = Path(settings.AGENT_WORKSPACE_ROOT) / self.job_id
        evidence = []
        remaining = 64000
        for path in sorted(workspace.rglob("*")):
            if (
                path.is_file()
                and not path.is_symlink()
                and path.suffix in {".tsx", ".ts", ".py", ".html", ".js", ".vue"}
                and remaining > 0
            ):
                text = path.read_text(errors="replace")[: min(8000, remaining)]
                remaining -= len(text)
                evidence.append(str(path.relative_to(workspace)) + "\n" + text)
        return await compile_browser_checks(
            requirement,
            evidence,
            self.model(
                f"checks:{getattr(self, 'attempt_index', 0)}:r{requirement.revision}"
            ),
        )

    async def build_candidate(self, workspace, manifest, attempt):
        from app.core.types import AppManifest

        manifest = self.candidates.prepare_manifest(manifest)
        self.candidates.production_instance(manifest)
        self.admit_resource("build.millis", 600000)
        result = await self.runner.build(
            self.job_id, attempt, manifest, self.generation
        )
        self.job_check()
        self.record_resource(
            "build:" + attempt, "build.millis", result.get("duration_ms")
        )
        return AppManifest.model_validate(result["manifest"])

    async def deploy(self, **kwargs):
        from app.runtime.linux import deploy_linux
        from app.runtime.kubernetes import deploy_kubernetes
        import asyncio

        target = kwargs.pop("target")
        manifest = kwargs["manifest"]
        instance_id = kwargs["instance_id"]
        gateway_image = target.capacity.get("gateway_image")
        from app.runtime.manifest import digest_pinned

        if not gateway_image or not digest_pinned(gateway_image):
            from app.jobs.pipeline import TargetUnavailable

            raise TargetUnavailable("目标尚未登记固定digest的应用入口网关")
        url = f"https://{instance_id}.{target.domain_suffix}"
        values = await asyncio.to_thread(
            self.candidates.configuration.bundle, instance_id, manifest, url
        )
        with self.sessions() as session:
            job = self.job(session)
            app = session.get(App, job.app_id)
            from app.models.user import User
            from app.utils.security import get_password_hash

            actors = [
                User(
                    username="live-" + __import__("uuid").uuid4().hex,
                    email=__import__("uuid").uuid4().hex + "@validation.invalid",
                    hashed_password=get_password_hash(
                        __import__("secrets").token_urlsafe(32)
                    ),
                    is_active=True,
                )
                for _ in range(2)
            ]
            session.add_all(actors)
            session.flush()
            parent = self.reservation(session, job)
            grant = ResourceRecord(
                type="LIVE_VALIDATION",
                job_id=job.id,
                app_id=app.id,
                operation_id="live:" + kwargs["operation_id"],
                reference=instance_id,
                state="RUNNING",
                metadata_json={
                    "owner_id": app.owner_id,
                    "test_owner_id": actors[0].id,
                    "other_id": actors[1].id,
                    "worker_id": self.worker_id,
                    "generation": self.generation,
                    "reservation_operation_id": parent.operation_id,
                    "anonymous_allowed": False,
                },
            )
            session.add(grant)
            session.commit()
            actor_ids = [actor.id for actor in actors]

        async def validate(base_url, requirement, checks, **options):
            from app.runtime.validation import validate_application
            from app.runtime.candidate_execution import CandidateController
            from app.capabilities.identity import issue_app_identity
            from app.core.types import CandidateRuntime

            tokens = {
                "owner": issue_app_identity(actor_ids[0], self.app_id(), instance_id),
                "other": issue_app_identity(actor_ids[1], self.app_id(), instance_id),
            }
            runtime = CandidateRuntime(
                id=instance_id,
                base_url=base_url,
                manifest_hash=__import__(
                    "app.runtime.manifest", fromlist=["manifest_hash"]
                ).manifest_hash(manifest),
                data_namespace=instance_id,
                identity_refs=tokens,
            )
            controller = CandidateController(self.runner, runtime)
            options["manifest_hash"] = runtime.manifest_hash
            report = await validate_application(
                base_url, requirement, checks, controller, **options
            )
            if getattr(self, "migration_proof", None) is not None:
                safe = await __import__("asyncio").to_thread(
                    self.candidates.configuration.data_manager.data_proof,
                    instance_id,
                    self.migration_proof,
                )
                if not safe:
                    from app.core.types import CheckResult

                    report.checks.append(
                        CheckResult(
                            id="data-preservation",
                            status="FAIL",
                            evidence="migration changed or removed pre-existing data",
                        )
                    )
            self.job_check()
            return report

        try:
            if target.kind == "LINUX":
                result = await deploy_linux(
                    target_id=target.id,
                    secret_values=values,
                    gateway_image=gateway_image,
                    validator=validate,
                    **kwargs,
                )
            elif target.kind in {"SEALOS", "KUBERNETES"}:
                result = await deploy_kubernetes(
                    target_id=target.id,
                    secrets=values,
                    gateway_image=gateway_image,
                    validator=validate,
                    **kwargs,
                )
            else:
                raise ValueError("unsupported registered deployment target")
            self.job_check()
            if getattr(self, "migration_record", None):
                with self.sessions() as session:
                    session.get(
                        ResourceRecord, self.migration_record
                    ).state = "SUCCEEDED"
                    session.commit()
            return result
        except Exception:
            if getattr(self, "migration_snapshot", None):
                from app.runtime.operations import DatabaseTargetAdapter

                with self.sessions() as session:
                    instance = session.get(
                        __import__("app.apps.models", fromlist=["Instance"]).Instance,
                        instance_id,
                    )
                try:
                    await DatabaseTargetAdapter(self.sessions).stop(instance)
                    await asyncio.to_thread(
                        self.candidates.configuration.data_manager.restore,
                        instance_id,
                        self.migration_snapshot,
                    )
                    await DatabaseTargetAdapter(self.sessions).start(instance)
                    with self.sessions() as session:
                        session.get(
                            ResourceRecord, self.migration_record
                        ).state = "ROLLED_BACK"
                        session.commit()
                except Exception:
                    from app.apps.models import Instance

                    with self.sessions() as session:
                        session.get(
                            ResourceRecord, self.migration_record
                        ).state = "UNKNOWN"
                        current = session.get(Instance, instance_id)
                        current.status = "FAILED"
                        current.stop_reason = "ERROR"
                        session.commit()
                    raise
            raise
        finally:
            with self.sessions() as session:
                session.get(ResourceRecord, grant.id).state = "STOPPED"
                for id in actor_ids:
                    session.get(User, id).is_active = False
                session.commit()

    def app_id(self):
        with self.sessions() as session:
            return self.job(session).app_id

    async def migrate(self, instance_id, migrations, operation_id, use_data_copy=True):
        from app.jobs.pipeline import TargetUnavailable

        with self.sessions() as session:
            job = self.job(session)
            app = session.get(App, job.app_id)
            if app.active_version_id is None:
                return {"fresh_instance": True, "operation_id": operation_id}
        manager = self.candidates.configuration.data_manager
        if manager is None:
            raise TargetUnavailable(
                "现有数据后端未配置可核对的安全迁移/恢复，拒绝自动发布"
            )
        import asyncio, shutil

        if not shutil.which("pg_dump") or not shutil.which("pg_restore"):
            raise TargetUnavailable("PostgreSQL迁移恢复工具尚未准备")
        from app.apps.models import Instance
        from app.runtime.operations import DatabaseTargetAdapter

        with self.sessions() as session:
            job = self.job(session)
            existing = session.scalar(
                select(ResourceRecord).where(
                    ResourceRecord.type == "MIGRATION_GUARD",
                    ResourceRecord.job_id == job.id,
                    ResourceRecord.reference == instance_id,
                    ResourceRecord.state.in_(["PREPARING", "APPLYING", "UNKNOWN"]),
                )
            )
            if existing:
                raise UncertainModelCall("迁移结果待核对，不能自动再次执行")
            record = ResourceRecord(
                type="MIGRATION_GUARD",
                job_id=job.id,
                app_id=job.app_id,
                operation_id=operation_id,
                reference=instance_id,
                state="PREPARING",
                metadata_json={},
            )
            session.add(record)
            session.commit()
            self.migration_record = record.id
            instance = session.get(Instance, instance_id)
        await DatabaseTargetAdapter(self.sessions).stop(instance)
        try:
            self.migration_snapshot = await asyncio.to_thread(
                manager.snapshot, instance_id, operation_id
            )
            self.migration_proof = await asyncio.to_thread(
                manager.data_proof, instance_id
            )
            with self.sessions() as session:
                self.job(session)
                guard = session.get(ResourceRecord, record.id)
                guard.state = "APPLYING"
                guard.metadata_json = {
                    "snapshot_ref": str(self.migration_snapshot),
                    "proof": self.migration_proof,
                }
                session.commit()
        except Exception:
            await DatabaseTargetAdapter(self.sessions).start(instance)
            with self.sessions() as session:
                session.get(ResourceRecord, record.id).state = "ROLLED_BACK"
                session.commit()
            raise
        return {
            "snapshot": str(self.migration_snapshot),
            "operation_id": operation_id,
            "use_data_copy": True,
        }


async def build_default_dependencies(job_id, worker_id, generation, session_factory):
    from app.jobs.pipeline import TargetUnavailable
    from app.runner.client import RunnerClient, RunnerUnavailable
    from app.runtime.candidate_execution import CandidateExecution
    from app.jobs.pipeline import PipelineDependencies

    if not worker_id or generation is None:
        raise TargetUnavailable("默认执行需要有效Worker租约")
    with session_factory() as session:
        job = leased_job(session, job_id, worker_id, generation)
        if job.kind != "COPY" and not settings.DEEPSEEK_API_KEY:
            raise TargetUnavailable("模型服务尚未配置")
    if (
        not settings.APP_IDENTITY_PRIVATE_KEY
        or not settings.APP_IDENTITY_PUBLIC_KEY
        or not settings.PLATFORM_CAPABILITY_URL
    ):
        raise TargetUnavailable("应用身份与受控能力入口尚未配置")
    runner = None
    try:
        runner = RunnerClient.from_settings()
        health = await runner.health()
        if (
            not health.get("ready")
            or not health.get("builder_ready")
            or not health.get("runtimes_ready")
        ):
            raise RunnerUnavailable("执行、构建和候选运行后端未通过预检")
        from app.runtime.models import DeploymentTarget

        with session_factory() as session:
            targets = list(
                session.scalars(
                    select(DeploymentTarget).where(
                        DeploymentTarget.enabled.is_(True),
                        DeploymentTarget.health == "HEALTHY",
                    )
                )
            )
        if not targets:
            raise RunnerUnavailable("没有已登记且健康的部署目标")
        execution = JobExecution(
            job_id,
            worker_id,
            generation,
            session_factory=session_factory,
            runner=runner,
        )
        execution.candidates = CandidateExecution(execution)
        from app.runtime.validation import validate_application

        dependencies = PipelineDependencies(
            generate_candidate=execution.generate_candidate,
            review_candidate=execution.review_candidate,
            build_candidate=execution.build_candidate,
            compile_checks=execution.compile_checks,
            start_candidate=execution.candidates.start,
            stop_candidate=execution.candidates.stop,
            validate_candidate=validate_application,
            runtime_controller=execution.candidates.controller,
            deployer=execution.deploy,
            migration_runner=execution.migrate,
        )
        return dependencies, execution
    except RunnerUnavailable as exc:
        if runner:
            await runner.close()
        raise TargetUnavailable(str(exc)) from exc
