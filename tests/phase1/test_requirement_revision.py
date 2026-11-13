import pytest
from app.core.types import AcceptanceItem, DemandFact, Requirement, RequirementDraft
from app.agent.requirements import validate_revision, RequirementCoverageError


def original():
    return Requirement(
        prompt="保存笔记",
        acceptance=[
            AcceptanceItem(
                id="save",
                action="保存并重读笔记",
                expected="笔记仍在",
                private_data=True,
            )
        ],
        revision=1,
        source_message_ids=["m1"],
    )


def messages():
    return [
        {"id": "m1", "sequence": 1, "role": "user", "content": "保存笔记"},
        {"id": "m2", "sequence": 2, "role": "user", "content": "增加联网搜索"},
    ]


def draft(items):
    return RequirementDraft(
        prompt="笔记与搜索",
        acceptance=items,
        facts=[
            DemandFact(
                id="f1",
                source_message_id="m2",
                quote="增加联网搜索",
                kind="FUNCTION",
                acceptance_ids=["search"],
            )
        ],
    )


def test_adjustment_preserves_old_acceptance_and_original_business_messages():
    old = original()
    updated = draft(
        [
            *old.acceptance,
            AcceptanceItem(id="search", action="搜索", expected="返回实际来源"),
        ]
    )
    result = validate_revision(old, updated, messages())
    assert result.revision == 2
    assert {i.id for i in result.acceptance} == {"save", "search"}
    assert "保存笔记" in result.prompt and "增加联网搜索" in result.prompt


@pytest.mark.parametrize("kind", ["missing", "changed", "invented_quote", "unmapped"])
def test_invalid_or_silently_reduced_revision_is_rejected(kind):
    old = original()
    updated = draft(
        [
            *old.acceptance,
            AcceptanceItem(id="search", action="搜索", expected="真实结果"),
        ]
    )
    if kind == "missing":
        updated.acceptance = updated.acceptance[1:]
    if kind == "changed":
        updated.acceptance[0] = AcceptanceItem(
            id="save", action="显示首页", expected="200"
        )
    if kind == "invented_quote":
        updated.facts[0].quote = "公开全部记录"
    if kind == "unmapped":
        updated.facts[0].acceptance_ids = []
    with pytest.raises(RequirementCoverageError):
        validate_revision(old, updated, messages())


def test_explicit_removal_must_be_supported_by_new_user_message():
    old = original()
    updated = draft([AcceptanceItem(id="search", action="搜索", expected="实际结果")])
    updated.explicit_removals = ["save"]
    updated.removal_evidence = {"save": "删除保存笔记功能"}
    with pytest.raises(RequirementCoverageError):
        validate_revision(old, updated, messages())
    rows = [
        *messages(),
        {"id": "m3", "sequence": 3, "role": "user", "content": "删除保存笔记功能"},
    ]
    assert [i.id for i in validate_revision(old, updated, rows).acceptance] == [
        "search"
    ]


def test_adjustment_keeps_existing_fact_traceability():
    old = original()
    old.facts = [
        DemandFact(
            id="old-save",
            source_message_id="m1",
            quote="保存笔记",
            kind="FUNCTION",
            acceptance_ids=["save"],
        )
    ]
    updated = draft(
        [
            *old.acceptance,
            AcceptanceItem(id="search", action="搜索", expected="实际来源"),
        ]
    )
    revised = validate_revision(old, updated, messages())
    assert {fact.id for fact in revised.facts} == {"old-save", "f1"}


@pytest.mark.asyncio
async def test_compile_reviews_coverage_and_corrects_missing_features():
    import json
    from app.core.types import ModelTurn
    from app.agent.requirements import compile_requirement

    valid = draft(
        [
            *original().acceptance,
            AcceptanceItem(id="search", action="搜索", expected="真实来源"),
        ]
    )

    class Model:
        def __init__(self):
            self.calls = 0

        async def complete(self, messages, tools, model):
            self.calls += 1
            if self.calls == 3:
                assert "缺少搜索" in messages[1]["content"]
            content = (
                valid.model_dump(mode="json")
                if self.calls % 2
                else {"missing": ["缺少搜索"] if self.calls == 2 else []}
            )
            return ModelTurn(
                assistant_message={
                    "role": "assistant",
                    "content": json.dumps(content, ensure_ascii=False),
                },
                input_tokens=10,
                output_tokens=10,
            )

    model = Model()
    result = await compile_requirement(messages(), original(), model)
    assert model.calls == 4
    assert {i.id for i in result.acceptance} == {"save", "search"}


@pytest.mark.asyncio
async def test_invalid_model_json_stops_after_two_corrections():
    from app.core.types import ModelTurn
    from app.agent.requirements import compile_requirement, RequirementInvalid

    class Model:
        calls = 0

        async def complete(self, *args):
            self.calls += 1
            return ModelTurn(
                assistant_message={"role": "assistant", "content": "invalid json"}
            )

    model = Model()
    with pytest.raises(RequirementInvalid):
        await compile_requirement(messages(), None, model)
    assert model.calls == 3


def test_frozen_revision_is_immutable_and_old_worker_cannot_write(
    job_factory, session_factory
):
    from datetime import datetime, timedelta, timezone
    from app.apps.models import Message, RequirementRecord
    from app.jobs.models import Job
    from app.jobs.store import claim_job, LeaseLost
    from app.agent.requirements import persist_requirement

    job = job_factory()
    request = RequirementDraft(
        prompt="保存笔记",
        acceptance=original().acceptance,
        facts=[
            DemandFact(
                id="save-fact",
                source_message_id="m1",
                quote="保存笔记",
                kind="FUNCTION",
                acceptance_ids=["save"],
            )
        ],
    )
    requirement = validate_revision(None, request, messages()[:1])
    with session_factory() as session:
        session.add(
            Message(
                id="m1", app_id=job.app_id, sequence=1, role="user", content="保存笔记"
            )
        )
        session.commit()
        leased = claim_job(session, "old")
        generation = leased.lease_generation
        assert (
            persist_requirement(
                session, job.id, requirement, worker_id="old", generation=generation
            )
            == 1
        )
        session.get(Job, job.id).lease_until = datetime.now(timezone.utc) - timedelta(
            seconds=1
        )
        session.commit()
        replacement = claim_job(session, "new")
        with pytest.raises(LeaseLost):
            persist_requirement(
                session, job.id, requirement, worker_id="old", generation=generation
            )
        session.rollback()
        with pytest.raises(RequirementCoverageError):
            persist_requirement(
                session,
                job.id,
                requirement.model_copy(update={"prompt": "changed"}),
                worker_id="new",
                generation=replacement.lease_generation,
            )


def private_notes_messages():
    return [{'id': 'notes-message', 'sequence': 1, 'role': 'user',
             'content': '保存私人笔记，删除后刷新和重启不复活，其他账号不能修改笔记'}]


def private_notes_draft(*ids, review_missing=None, questions=None):
    return RequirementDraft(
        prompt=private_notes_messages()[0]['content'],
        acceptance=[AcceptanceItem(id=id, action=id, expected=id+' verified', private_data=True) for id in ids],
        facts=[DemandFact(id='notes-fact', source_message_id='notes-message',
                          quote='保存私人笔记', kind='FUNCTION', acceptance_ids=list(ids))],
        review_missing=review_missing or [], questions=questions or [],
    )


class RecordedRequirementModel:
    def __init__(self, values):
        self.values = iter(values)
        self.requests = []

    async def complete(self, messages, tools, model):
        import json
        from app.core.types import ModelTurn
        self.requests.append(messages)
        try:
            value = next(self.values)
        except StopIteration:
            raise AssertionError('unexpected model call after sufficient review or a necessary question') from None
        if isinstance(value, RequirementDraft):
            value = value.model_dump(mode='json')
        return ModelTurn(assistant_message={'role': 'assistant', 'content': json.dumps(value, ensure_ascii=False)})


@pytest.mark.asyncio
async def test_correction_preserves_prior_draft_and_rejects_lost_fixed_acceptance():
    import json
    from app.agent.requirements import compile_requirement
    original_draft = private_notes_draft('save', 'delete-persist')
    lost = private_notes_draft('save', 'isolation')
    complete = private_notes_draft('save', 'delete-persist', 'isolation')
    model = RecordedRequirementModel([
        original_draft, {'missing': ['cross account modification not checked']},
        lost, complete, {'missing': []},
    ])
    result = await compile_requirement(private_notes_messages(), None, model)
    assert {item.id for item in result.acceptance} == {'save', 'delete-persist', 'isolation'}
    retry = json.loads(model.requests[2][1]['content'])
    assert retry['current_draft'] == original_draft.model_dump(mode='json')
    assert retry['review_history'][0]['missing'] == ['cross account modification not checked']
    assert 'delete-persist' in json.loads(model.requests[3][1]['content'])['correction']


@pytest.mark.asyncio
async def test_current_review_closes_stale_issue_only_with_current_acceptance_evidence():
    from app.agent.requirements import compile_requirement
    issue = 'cross-account writes must be rejected'
    candidate = private_notes_draft('save', 'isolation', review_missing=[issue])
    model = RecordedRequirementModel([candidate, {
        'missing': [], 'resolved': [{'issue': issue, 'acceptance_ids': ['isolation'],
                                   'evidence': 'isolation checks cross-account writes'}],
    }])
    result = await compile_requirement(private_notes_messages(), None, model)
    assert result.review_missing == []
    assert {item.id for item in result.acceptance} == {'save', 'isolation'}


@pytest.mark.asyncio
@pytest.mark.parametrize('resolution', [[], [{'issue': 'unresolved', 'acceptance_ids': ['invented'], 'evidence': 'claim'}],
                                       [{'issue': 'unresolved', 'acceptance_ids': ['save'], 'evidence': ''}]])
async def test_stale_issue_cannot_close_without_valid_current_evidence(resolution):
    from app.agent.requirements import compile_requirement, RequirementInvalid
    candidate = private_notes_draft('save', review_missing=['unresolved'])
    model = RecordedRequirementModel([candidate, {'missing': [], 'resolved': resolution}] * 3)
    with pytest.raises(RequirementInvalid):
        await compile_requirement(private_notes_messages(), None, model)
    assert len(model.requests) == 6


@pytest.mark.asyncio
async def test_business_question_returns_before_review_can_discard_it():
    from app.agent.requirements import compile_requirement
    candidate = private_notes_draft('save', questions=['是否允许公开分享笔记？'])
    model = RecordedRequirementModel([candidate])
    result = await compile_requirement(private_notes_messages(), None, model)
    assert result.questions == ['是否允许公开分享笔记？']
    assert len(model.requests) == 1


@pytest.mark.asyncio
async def test_requirement_failure_persists_last_draft_and_specific_issue():
    from app.agent.requirements import compile_requirement, RequirementInvalid
    candidate = private_notes_draft('save')
    model = RecordedRequirementModel([candidate, {'missing': ['delete persistence is missing']}] * 3)
    snapshots = []
    with pytest.raises(RequirementInvalid):
        await compile_requirement(private_notes_messages(), None, model, persist=snapshots.append)
    final = snapshots[-1]
    assert final['status'] == 'FAILED'
    assert final['attempt_count'] == 3
    assert final['draft']['acceptance'][0]['id'] == 'save'
    assert final['unresolved_issues'] == ['delete persistence is missing']
