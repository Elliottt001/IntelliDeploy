from copy import deepcopy

import pytest

from app.agent.loop import UncertainToolResult, run_generation
from app.billing.ledger import InsufficientQuota
from app.core.types import Checkpoint, ModelTurn, ToolCall, ToolResult


MANIFEST = {"schema_version": 1, "web_service": "web", "services": [{"name": "web", "image": "app@sha256:" + "a" * 64, "port": 3000}]}


class FixedModel:
    def __init__(self, turns): self.turns, self.calls = list(turns), 0
    async def complete(self, *_args):
        self.calls += 1
        return self.turns.pop(0)


class CounterTool:
    def __init__(self, result=None, error=None): self.calls, self.result, self.error = 0, result, error
    async def __call__(self, call):
        self.calls += 1
        if self.error: raise self.error
        return self.result or ToolResult(call_id=call.id, ok=True, content="saved")


def turn(calls=None, content=None, usage=(0, 0, 0)):
    return ModelTurn(assistant_message={"role": "assistant", "content": content}, calls=calls or [],
                     input_tokens=usage[0], cached_input_tokens=usage[1], output_tokens=usage[2])


@pytest.mark.asyncio
async def test_completed_call_is_not_executed_twice_after_crash():
    checkpoint = Checkpoint(completed_calls={"c1": ToolResult(call_id="c1", ok=True, content="saved")})
    model = FixedModel([turn([ToolCall(id="c1", name="read_file", arguments={"path": "README.md"})]),
                        turn([ToolCall(id="done", name="finish_implementation", arguments={"manifest": MANIFEST})])])
    tool = CounterTool(); persisted = []
    result = await run_generation("job", checkpoint, model, tool, lambda value: persisted.append(deepcopy(value)), lambda usage: None)
    assert tool.calls == 0 and result.manifest.web_service == "web"
    assert any(message.get("tool_call_id") == "c1" for message in result.checkpoint.messages)
    assert len(persisted) >= 3


@pytest.mark.asyncio
async def test_checkpoint_is_saved_before_and_after_tool_effect():
    persisted = []
    model = FixedModel([turn([ToolCall(id="w", name="write_file", arguments={"path": "a", "content": "x"})]),
                        turn([ToolCall(id="done", name="finish_implementation", arguments={"manifest": MANIFEST})])])
    tool = CounterTool()
    await run_generation("job", Checkpoint(), model, tool, lambda value: persisted.append(deepcopy(value)), lambda usage: None)
    before = next(value for value in persisted if value.pending_calls and "w" not in value.completed_calls)
    after = next(value for value in persisted if "w" in value.completed_calls)
    assert before.pending_calls[0].id == "w" and after.completed_calls["w"].content == "saved"


@pytest.mark.asyncio
async def test_business_question_returns_waiting_output_without_tool_execution():
    model = FixedModel([turn([ToolCall(id="q", name="ask_user", arguments={"question": "记录是否公开？"})])])
    result = await run_generation("job", Checkpoint(requirement_revision=2), model, CounterTool(), lambda _: None, lambda _: None)
    assert result.question == "记录是否公开？" and result.requirement_revision == 2


@pytest.mark.asyncio
async def test_model_usage_is_split_and_idempotently_named():
    usages = []
    model = FixedModel([turn([ToolCall(id="done", name="finish_implementation", arguments={"manifest": MANIFEST})], usage=(100, 30, 20))])
    await run_generation("job", Checkpoint(), model, CounterTool(), lambda _: None, usages.append, payer_id=7,
                         reservation_operation_id="job:job", price_version="v1")
    assert [(row.operation_id, row.units, row.kind) for row in usages] == [
        ("job:job:model:0:input", 70, "model.flash.input"),
        ("job:job:model:0:cached", 30, "model.flash.cached_input"),
        ("job:job:model:0:output", 20, "model.flash.output"),
    ]


@pytest.mark.asyncio
async def test_quota_and_unknown_effect_stop_without_replaying():
    async def quota(_usage): raise InsufficientQuota()
    model = FixedModel([turn([ToolCall(id="done", name="finish_implementation", arguments={"manifest": MANIFEST})], usage=(10, 0, 0))])
    paused = await run_generation("job", Checkpoint(), model, CounterTool(), lambda _: None, quota, payer_id=1)
    assert paused.exhausted and paused.manifest is None
    uncertain_model = FixedModel([turn([ToolCall(id="cmd", name="run_command", arguments={"argv": ["deploy"]})])])
    tool = CounterTool(error=UncertainToolResult("result unknown"))
    stopped = await run_generation("job", Checkpoint(), uncertain_model, tool, lambda _: None, lambda _: None)
    assert stopped.exhausted and tool.calls == 1

    pending = Checkpoint(pending_calls=[ToolCall(id="old", name="run_command", arguments={"argv": ["deploy"]})])
    model_never_called = FixedModel([])
    tool_never_called = CounterTool()
    recovered = await run_generation("job", pending, model_never_called, tool_never_called, lambda _: None, lambda _: None)
    assert recovered.exhausted and model_never_called.calls == 0 and tool_never_called.calls == 0


@pytest.mark.asyncio
async def test_plain_final_text_and_repeated_no_progress_never_mean_success():
    plain = await run_generation("job", Checkpoint(), FixedModel([turn(content="完成了")]), CounterTool(), lambda _: None, lambda _: None)
    assert plain.exhausted and plain.manifest is None
    repeated = FixedModel([turn([ToolCall(id=f"x{i}", name="read_file", arguments={"path": "missing"})]) for i in range(3)])
    failed_tool = CounterTool(result=ToolResult(call_id="ignored", ok=False, content="same error"))
    stopped = await run_generation("job", Checkpoint(), repeated, failed_tool, lambda _: None, lambda _: None, max_rounds=10)
    assert stopped.exhausted and failed_tool.calls == 3


@pytest.mark.asyncio
async def test_real_ledger_charges_each_model_component_once(session_factory):
    from app.billing.ledger import grant, record_usage, reserve
    from app.billing.models import PriceRule, UsageEntry
    from app.models.user import User
    from sqlalchemy import select

    with session_factory() as session:
        user = User(username="loop-user", email="loop@test", hashed_password="test")
        session.add(user); session.flush()
        grant(session, user.id, "loop-grant", 100, "FREE")
        reserve(session, user.id, "job:ledger-job", 50)
        for kind in ("model.flash.input", "model.flash.cached_input", "model.flash.output"):
            session.add(PriceRule(kind=kind, version="test-v1", numerator=1, denominator=10))
        session.commit(); payer_id = user.id
    def charge(usage):
        with session_factory() as session:
            row = record_usage(session, usage); session.commit(); return row
    model = FixedModel([turn([ToolCall(id="done", name="finish_implementation", arguments={"manifest": MANIFEST})], usage=(100, 30, 20))])
    await run_generation("ledger-job", Checkpoint(), model, CounterTool(), lambda _: None, charge,
                         payer_id=payer_id, reservation_operation_id="job:ledger-job", price_version="test-v1")
    with session_factory() as session:
        rows = list(session.scalars(select(UsageEntry).where(UsageEntry.payer_id == payer_id)))
        assert len(rows) == 3 and sum(row.cost_units for row in rows) == 12


def test_generation_advertises_only_tools_supported_by_default_worker():
    from app.agent.loop import DEFAULT_WORKER_TOOLS

    assert {tool['function']['name'] for tool in DEFAULT_WORKER_TOOLS} == {
        'list_files', 'read_file', 'write_file', 'apply_patch', 'run_command',
        'search_repositories', 'fetch_repository', 'ask_user', 'finish_implementation',
    }


def test_command_schema_declares_seconds_and_matches_validated_arguments():
    from app.agent.loop import TOOLS
    from app.agent.tools import CommandArgs
    schema = next(t['function']['parameters'] for t in TOOLS if t['function']['name'] == 'run_command')
    assert schema == CommandArgs.model_json_schema()
    assert 'seconds' in schema['properties']['timeout']['description']


@pytest.mark.asyncio
async def test_generation_final_round_is_reserved_for_manifest_submission(tmp_path):
    from app.agent.loop import TOOLS
    class Model:
        calls=0
        async def complete(self,messages,tools,model):
            self.calls+=1
            if self.calls<3:
                assert any(t['function']['name']=='write_file' for t in tools)
                return turn([ToolCall(id=f'w{self.calls}',name='write_file',arguments={'path':'app.py','content':'source'})])
            assert [t['function']['name'] for t in tools]==['finish_implementation']
            assert 'finish_implementation' in messages[-1]['content']
            return turn([ToolCall(id='finish',name='finish_implementation',arguments={'manifest':MANIFEST})])
    model=Model()
    result=await run_generation('job',Checkpoint(),model,CounterTool(),lambda _:None,lambda _:None,
                                max_rounds=3,tools=TOOLS,finalize_last_round=True)
    assert result.manifest.web_service=='web'
    assert model.calls==3


@pytest.mark.asyncio
async def test_finalization_checkpoint_resumes_with_only_submission_tool():
    checkpoint=Checkpoint(generation_phase='FINALIZE',messages=[{'role':'user','content':'finish_implementation now'}])
    class Model:
        async def complete(self,messages,tools,model):
            assert [t['function']['name'] for t in tools]==['finish_implementation']
            assert len(messages)==1
            return turn([ToolCall(id='finish',name='finish_implementation',arguments={'manifest':MANIFEST})])
    result=await run_generation('job',checkpoint,Model(),CounterTool(),lambda _:None,lambda _:None,max_rounds=2,finalize_last_round=True)
    assert result.manifest.web_service=='web'


@pytest.mark.asyncio
async def test_received_truncation_retries_in_smaller_batches_without_tool_effects():
    from app.agent.deepseek import ModelProtocolError
    class Model:
        calls=0
        async def complete(self,messages,tools,model):
            self.calls+=1
            if self.calls==1:
                raw={'role':'assistant','content':None,'reasoning_content':'preserved reasoning',
                     'tool_calls':[{'id':'partial','type':'function','function':{'name':'write_file','arguments':'{"path":"app.py","content":"unfinished'}}]}
                raise ModelProtocolError('MODEL_OUTPUT_TRUNCATED',ModelTurn(assistant_message=raw,input_tokens=5,output_tokens=10))
            assert any(m.get('tool_call_id')=='partial' and '未执行' in m['content'] for m in messages)
            assert '分批' in messages[-1]['content']
            assert messages[0]['reasoning_content']=='preserved reasoning'
            return turn([ToolCall(id='finish',name='finish_implementation',arguments={'manifest':MANIFEST})])
    tool=CounterTool();model=Model()
    result=await run_generation('job',Checkpoint(),model,tool,lambda _:None,lambda _:None,max_rounds=3)
    assert result.manifest.web_service=='web'
    assert model.calls==2 and tool.calls==0


@pytest.mark.asyncio
async def test_received_protocol_corrections_stop_after_three_failures():
    from app.agent.deepseek import ModelProtocolError
    class Model:
        calls=0
        async def complete(self,*args):
            self.calls+=1
            raise ModelProtocolError('MODEL_OUTPUT_EMPTY',ModelTurn(assistant_message={'role':'assistant','content':''},input_tokens=1,output_tokens=1))
    model=Model()
    result=await run_generation('job',Checkpoint(),model,CounterTool(),lambda _:None,lambda _:None,max_rounds=10)
    assert result.exhausted is True
    assert model.calls==3


@pytest.mark.asyncio
async def test_finalization_rejects_extra_tool_and_allows_one_correction():
    class Model:
        calls=0
        async def complete(self,messages,tools,model):
            self.calls+=1
            if self.calls==1:
                return turn([ToolCall(id='write',name='write_file',arguments={'path':'app.py','content':'source'})])
            if self.calls==2:
                assert [t['function']['name'] for t in tools]==['finish_implementation']
                return turn([ToolCall(id='cleanup',name='run_command',arguments={'argv':['rm','-f','test.js']})])
            assert any(m.get('tool_call_id')=='cleanup' and '未执行' in m['content'] for m in messages)
            return turn([ToolCall(id='finish',name='finish_implementation',arguments={'manifest':MANIFEST})])
    model=Model();tool=CounterTool()
    result=await run_generation('job',Checkpoint(),model,tool,lambda _:None,lambda _:None,max_rounds=2,finalize_last_round=True)
    assert result.manifest.web_service=='web'
    assert model.calls==3
    assert tool.calls==1


@pytest.mark.asyncio
async def test_finalization_stops_after_one_rejected_tool_correction():
    class Model:
        calls=0
        async def complete(self,messages,tools,model):
            self.calls+=1
            if self.calls==1:
                return turn([ToolCall(id='write',name='write_file',arguments={'path':'app.py','content':'source'})])
            return turn([ToolCall(id=f'cleanup-{self.calls}',name='run_command',arguments={'argv':['rm','-f','test.js']})])
    model=Model();tool=CounterTool()
    result=await run_generation('job',Checkpoint(),model,tool,lambda _:None,lambda _:None,max_rounds=2,finalize_last_round=True)
    assert result.exhausted is True
    assert model.calls==3
    assert tool.calls==1
    assert result.checkpoint.finalization_corrections==1
