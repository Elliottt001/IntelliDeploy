import json
from pathlib import Path

from sqlalchemy import func, select

from app.apps.models import App, Message, RequirementRecord
from app.core.types import Requirement, RequirementDraft
from app.jobs.store import leased_job


class RequirementCoverageError(ValueError):
    pass


class RequirementInvalid(ValueError):
    pass


class RequirementNeedsAnswer(ValueError):
    def __init__(self, questions):
        self.questions = questions
        super().__init__("business clarification required")


def validate_revision(previous, draft, messages):
    if draft.questions or draft.unsupported:
        raise RequirementNeedsAnswer(
            draft.questions or ["首期支持Web应用，是否接受以Web交付？"]
        )
    originals = {m["id"]: m for m in messages if m.get("role") == "user"}
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
    )


async def compile_requirement(messages, previous, model_client):
    from app.config import settings

    instructions = (
        Path(__file__).resolve().parents[3] / "prompts/generation/requirements.md"
    ).read_text()
    source = {
        "messages": messages,
        "previous": previous.model_dump(mode="json") if previous else None,
        "schema": RequirementDraft.model_json_schema(),
    }
    correction = ""
    for attempt in range(3):
        try:
            turn = await model_client.complete(
                [
                    {"role": "system", "content": instructions},
                    {
                        "role": "user",
                        "content": json.dumps(source, ensure_ascii=False) + correction,
                    },
                ],
                [],
                settings.DEEPSEEK_MODEL,
            )
            draft = RequirementDraft.model_validate(
                json.loads(turn.assistant_message["content"])
            )
            review = await model_client.complete(
                [
                    {
                        "role": "system",
                        "content": '按用户原文和上版要求审阅draft。只输出JSON {"missing": [遗漏项]}，检查隐式删除、漏功能和范围。',
                    },
                    {
                        "role": "user",
                        "content": json.dumps(
                            {**source, "draft": draft.model_dump(mode="json")},
                            ensure_ascii=False,
                        ),
                    },
                ],
                [],
                settings.DEEPSEEK_MODEL,
            )
            missing = json.loads(review.assistant_message["content"]).get("missing")
            if not isinstance(missing, list) or missing:
                raise RequirementCoverageError(
                    "review identified missing requirements: "
                    + json.dumps(missing, ensure_ascii=False)
                )
            if draft.questions or draft.unsupported:
                return draft
            validate_revision(previous, draft, messages)
            return draft
        except (ValueError, KeyError, TypeError) as exc:
            correction = "\n上次输出未通过核对，请补齐并重新输出完整JSON：" + str(exc)
    raise RequirementInvalid("模型未能整理完整且可核对的需求")


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
