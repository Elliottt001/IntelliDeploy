import json
import hashlib
import inspect
import re
from pathlib import Path

from sqlalchemy import func, select
from pydantic import BaseModel, ConfigDict, Field

from app.apps.models import App, Message, RequirementRecord
from app.core.types import Requirement, RequirementDraft, DeliveryPolicy
from app.jobs.store import leased_job


class RequirementCoverageError(ValueError):
    pass


class RequirementInvalid(ValueError):
    def __init__(self, message, details=None):
        self.details = details or {}
        super().__init__(message)


class ResolvedRequirementIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")
    issue: str = Field(min_length=1)
    acceptance_ids: list[str] = Field(min_length=1)
    evidence: str = Field(min_length=1)


class RequirementReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    missing: list[str]
    resolved: list[ResolvedRequirementIssue] = Field(default_factory=list)


class RequirementNeedsAnswer(ValueError):
    def __init__(self, questions):
        self.questions = questions
        super().__init__("business clarification required")


def delivery_policy_from_messages(messages, previous=None):
    policy = previous.delivery_policy.model_copy() if previous else DeliveryPolicy()
    for message in sorted(messages, key=lambda m: m['sequence']):
        if message.get('role') != 'user' or (previous and message['id'] in previous.source_message_ids):
            continue
        text = message['content'].lower()
        if any(x in text for x in ('自托管', '独立部署', '平台管理', 'self-host', 'self host')):
            policy.preference = 'SELF_HOSTED'
        if any(x in text for x in ('直接给链接', '官方服务链接', 'use official service')):
            policy.preference = 'EXISTING_SERVICE_FIRST'
        if re.search(r'(不要|不能|不允许).{0,4}(生成|从零)|do not.{0,15}(generat|scratch)', text):
            policy.allow_generation = False
        elif any(x in text for x in ('从零生成', '直接生成', '不要复用', 'from scratch', '允许从头生成', '接受从头生成')):
            policy.allow_generation = True
    return policy


def validate_revision(previous, draft, messages):
    if draft.questions or draft.unsupported:
        raise RequirementNeedsAnswer(
            draft.questions or ["首期支持Web应用，是否接受以Web交付？"]
        )
    originals = {m["id"]: m for m in messages if m.get("role") == "user"}
    for item in draft.acceptance:
        if item.importance == 'PREFERENCE' and (item.private_data or re.search(
            r'隔离|持久|重启|权限|越权|必须|isolation|persist|permission', item.action + item.expected, re.I)):
            raise RequirementCoverageError('core data/access requirement cannot be a preference')
    ids = [i.id for i in draft.acceptance]
    facts = [f.id for f in draft.facts]
    if (
        not ids
        or len(set(ids)) != len(ids)
        or not facts
        or len(set(facts)) != len(facts)
        or draft.review_missing
    ):
        raise RequirementCoverageError("acceptance or facts are missing or duplicated")
    for fact in draft.facts:
        message = originals.get(fact.source_message_id)
        if not message or not fact.quote or fact.quote not in message["content"]:
            raise RequirementCoverageError(
                "fact quote is not in the original user message"
            )
        if not fact.acceptance_ids or not set(fact.acceptance_ids) <= set(ids):
            raise RequirementCoverageError("fact has no valid acceptance mapping")
    if previous:
        old = {i.id: i for i in previous.acceptance}
        new = {i.id: i for i in draft.acceptance}
        removed = set(old) - set(new)
        if removed - set(draft.explicit_removals):
            raise RequirementCoverageError("previous acceptance was silently removed")
        for key in set(old) & set(new):
            if old[key].model_dump() != new[key].model_dump():
                raise RequirementCoverageError("existing acceptance was rewritten")
        current_messages = [
            m["content"]
            for id, m in originals.items()
            if id not in previous.source_message_ids
        ]
        for key in removed:
            quote = draft.removal_evidence.get(key, "")
            explicit = any(
                word in quote.lower()
                for word in [
                    "删除",
                    "移除",
                    "去掉",
                    "替换",
                    "改为",
                    "换成",
                    "remove",
                    "delete",
                    "replace",
                ]
            )
            negated = any(
                word in quote.lower()
                for word in [
                    "不要删除",
                    "不要移除",
                    "不能删除",
                    "保留",
                    "do not delete",
                    "keep",
                ]
            )
            if (
                not quote
                or not any(quote in text for text in current_messages)
                or not explicit
                or negated
            ):
                raise RequirementCoverageError(
                    "removal lacks explicit current user evidence"
                )
    merged_facts = {fact.id: fact for fact in draft.facts}
    if previous:
        for fact in previous.facts:
            retained = [id for id in fact.acceptance_ids if id in ids]
            if retained:
                preserved = fact.model_copy(update={"acceptance_ids": retained})
                if (
                    fact.id in merged_facts
                    and merged_facts[fact.id].model_dump() != preserved.model_dump()
                ):
                    raise RequirementCoverageError("existing fact source was rewritten")
                merged_facts[fact.id] = preserved
    return Requirement(
        prompt="\n".join(
            m["content"]
            for m in sorted(originals.values(), key=lambda m: m["sequence"])
        ),
        acceptance=draft.acceptance,
        revision=previous.revision + 1 if previous else 1,
        facts=list(merged_facts.values()),
        source_message_ids=list(originals),
        delivery_policy=delivery_policy_from_messages(messages, previous),
    )


def _preserve_correction_acceptance(current, proposed):
    if current is None:
        return
    old = {item.id: item for item in current.acceptance}
    new = {item.id: item for item in proposed.acceptance}
    removed = set(old) - set(new)
    if removed:
        raise RequirementCoverageError("correction removed acceptance: " + ", ".join(sorted(removed)))
    changed = [key for key in old if old[key].model_dump() != new[key].model_dump()]
    if changed:
        raise RequirementCoverageError("correction rewrote acceptance: " + ", ".join(sorted(changed)))


async def compile_requirement(messages, previous, model_client, *, persist=None):
    from app.config import settings

    instructions = (
        Path(__file__).resolve().parents[3] / "prompts/generation/requirements.md"
    ).read_text()
    source = {
        "messages": messages,
        "previous": previous.model_dump(mode="json") if previous else None,
        "schema": RequirementDraft.model_json_schema(),
        "platform_defaults": {"identity": "existing application identity; platform SSO only for platform-managed instances", "visibility": "private"},
        "delivery_policy": delivery_policy_from_messages(messages, previous).model_dump(mode='json'),
    }
    source_digest = hashlib.sha256(json.dumps(source, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    correction = ""
    current_draft = None
    draft = None
    history = []
    unresolved = []
    stage = "DRAFT"
    state = {}

    async def save_state(status, attempt, error_code=None):
        nonlocal state
        state = {
            "source_digest": source_digest,
            "status": status,
            "stage": stage,
            "attempt_count": attempt,
            "draft": draft.model_dump(mode="json") if draft else None,
            "review_history": list(history),
            "last_error_code": error_code,
            "unresolved_issues": list(unresolved),
        }
        if persist is not None:
            value = persist(state)
            if inspect.isawaitable(value):
                await value

    for attempt in range(1, 4):
        stage = "DRAFT"
        draft = None
        await save_state("RUNNING", attempt)
        payload = {
            **source,
            "current_draft": current_draft.model_dump(mode="json") if current_draft else None,
            "review_history": list(history),
            "correction": correction,
        }
        try:
            turn = await model_client.complete(
                [
                    {"role": "system", "content": instructions},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ], [], settings.DEEPSEEK_MODEL,
            )
            draft = RequirementDraft.model_validate(json.loads(turn.assistant_message["content"]))
            if draft.questions or draft.unsupported:
                stage = "QUESTION"
                await save_state("WAITING_USER", attempt)
                return draft
            stage = "VALIDATING_DRAFT"
            # Self-reported gaps are reconciled with the independent review below;
            # source/frozen-revision validation remains mandatory first.
            validate_revision(previous, draft.model_copy(update={"review_missing": []}), messages)
            _preserve_correction_acceptance(current_draft, draft)
            current_draft = draft
            stage = "REVIEW"
            draft_hash = hashlib.sha256(draft.model_dump_json().encode()).hexdigest()
            await save_state("RUNNING", attempt)
            review_turn = await model_client.complete(
                [
                    {
                        "role": "system",
                        "content": (
                            "按用户原文和上版要求审阅draft，逐项核对历史遗漏与当前草稿。只输出所附schema的JSON。"
                            "仍有遗漏填写missing；resolved仅填写当前草稿已实际解决的原样issue、具体验收ID及证据。"
                            "检查全部原始功能、数据、权限、删除后刷新/重启持久性；不能因旧标记仍在就判未修，"
                            "也不能因为草稿声称修复就通过。不要加入用户未要求的业务。"
                        ),
                    },
                    {
                        "role": "user",
                        "content": json.dumps({
                            **source,
                            "schema": RequirementReview.model_json_schema(),
                            "draft": draft.model_dump(mode="json"),
                            "draft_hash": draft_hash,
                            "review_history": list(history),
                            "reported_issues": list(dict.fromkeys([*unresolved, *draft.review_missing])),
                        }, ensure_ascii=False),
                    },
                ], [], settings.DEEPSEEK_MODEL,
            )
            review = RequirementReview.model_validate(json.loads(review_turn.assistant_message["content"]))
            history = [*history, {"attempt": attempt, "draft_hash": draft_hash, **review.model_dump(mode="json")}]
            ids = {item.id for item in draft.acceptance}
            known_issues = set(unresolved) | set(draft.review_missing)
            for resolution in review.resolved:
                if (resolution.issue not in known_issues
                        or not set(resolution.acceptance_ids) <= ids
                        or not resolution.evidence.strip()
                        or resolution.issue in review.missing):
                    raise RequirementCoverageError("review resolution lacks valid current acceptance evidence")
            closed = {item.issue for item in review.resolved}
            remaining = [issue for issue in draft.review_missing if issue not in closed]
            unresolved = list(dict.fromkeys([*review.missing, *remaining]))
            if unresolved:
                raise RequirementCoverageError("review identified missing requirements: " + json.dumps(unresolved, ensure_ascii=False))
            draft = draft.model_copy(update={"review_missing": remaining})
            validate_revision(previous, draft, messages)
            current_draft = draft
            stage = "COMPLETE"
            await save_state("SUCCEEDED", attempt)
            return draft
        except (ValueError, KeyError, TypeError) as exc:
            correction = "上次输出未通过核对，请保留已有验收、补齐并重新输出完整JSON：" + str(exc)
            await save_state("CORRECTING", attempt, stage + "_INVALID")
    await save_state("FAILED", 3, state.get("last_error_code"))
    raise RequirementInvalid("模型未能整理完整且可核对的需求", state)


def persist_requirement(
    session, job_id, requirement, *, worker_id, generation, review_metadata=None
):
    job = leased_job(session, job_id, worker_id, generation)
    session.scalar(select(App).where(App.id == job.app_id).with_for_update())
    known = {
        m.id: m
        for m in session.scalars(
            select(Message).where(Message.app_id == job.app_id, Message.role == "user")
        )
    }
    ids = {item.id for item in requirement.acceptance}
    if (
        not ids
        or len(ids) != len(requirement.acceptance)
        or not requirement.facts
        or not set(requirement.source_message_ids) <= set(known)
    ):
        raise RequirementCoverageError("frozen sources or acceptance are incomplete")
    for fact in requirement.facts:
        if (
            not fact.quote
            or fact.source_message_id not in known
            or fact.quote not in known[fact.source_message_id].content
            or not fact.acceptance_ids
            or not set(fact.acceptance_ids) <= ids
        ):
            raise RequirementCoverageError(
                "frozen fact has an invalid source or mapping"
            )
    record = session.scalar(
        select(RequirementRecord).where(
            RequirementRecord.app_id == job.app_id,
            RequirementRecord.revision == requirement.revision,
        )
    )
    data = requirement.model_dump(mode="json")
    if record:
        if record.requirement != data:
            raise RequirementCoverageError("frozen revision cannot be overwritten")
    else:
        latest = (
            session.scalar(
                select(func.max(RequirementRecord.revision)).where(
                    RequirementRecord.app_id == job.app_id
                )
            )
            or 0
        )
        if requirement.revision != latest + 1:
            raise RequirementCoverageError("requirement revision is not consecutive")
        session.add(
            RequirementRecord(
                app_id=job.app_id,
                revision=requirement.revision,
                requirement=data,
                review={"coverage": "VALIDATED", **(review_metadata or {})},
            )
        )
    job.requirement_revision = requirement.revision
    job.checkpoint = {**job.checkpoint, "requirement_revision": requirement.revision}
    session.commit()
    return requirement.revision
