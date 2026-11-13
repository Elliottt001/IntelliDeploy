from __future__ import annotations

import asyncio
import inspect
import json

from app.billing.ledger import InsufficientQuota
from app.agent.tools import CommandArgs
from app.agent.deepseek import ModelProtocolError
from app.config import settings
from app.core.types import AppManifest, Checkpoint, GenerationOutput, ToolCall, ToolResult, UsageInput


class UncertainToolResult(RuntimeError):
    pass


TOOLS = [
    {"type": "function", "function": {"name": "list_files", "description": "列出工作区文件", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "read_file", "description": "读取工作区文件", "parameters": {"type": "object", "required": ["path"], "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "write_file", "description": "写入工作区文件", "parameters": {"type": "object", "required": ["path", "content"], "properties": {"path": {"type": "string"}, "content": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "apply_patch", "description": "精确替换文件内容", "parameters": {"type": "object", "required": ["path", "old_text", "new_text"], "properties": {"path": {"type": "string"}, "old_text": {"type": "string"}, "new_text": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "run_command", "description": "在隔离执行器运行命令，timeout单位为秒", "parameters": CommandArgs.model_json_schema()}},
    {"type": "function", "function": {"name": "search_repositories", "description": "通过受控代理检索公开GitHub仓库", "parameters": {"type": "object", "required": ["query"], "properties": {"query": {"type": "string"}, "limit": {"type": "integer"}}}}},
    {"type": "function", "function": {"name": "fetch_repository", "description": "获取已检索仓库的固定commit", "parameters": {"type": "object", "required": ["url", "commit", "destination"], "properties": {"url": {"type": "string"}, "commit": {"type": "string"}, "destination": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "web_search", "description": "通过受控能力检索实时公开网页并保留来源", "parameters": {"type": "object", "required": ["query"], "properties": {"query": {"type": "string", "minLength": 1, "maxLength": 128}, "count": {"type": "integer", "minimum": 1, "maximum": 50}}}}},
    {"type": "function", "function": {"name": "fetch_page", "description": "通过受控能力获取HTTP(S)网页正文", "parameters": {"type": "object", "required": ["url"], "properties": {"url": {"type": "string", "minLength": 1, "maxLength": 2048}}}}},
    {"type": "function", "function": {"name": "ask_user", "description": "追问必要的业务信息", "parameters": {"type": "object", "required": ["question"], "properties": {"question": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "finish_implementation", "description": "提交候选运行清单，不表示交付成功", "parameters": {"type": "object", "required": ["manifest"], "properties": {"manifest": {"type": "object"}}}}},
]

DEFAULT_WORKER_TOOLS = [
    tool for tool in TOOLS
    if tool["function"]["name"] not in {"web_search", "fetch_page"}
]


async def _call(callback, *args):
    if inspect.iscoroutinefunction(callback) or inspect.iscoroutinefunction(getattr(callback, "__call__", None)):
        return await callback(*args)
    return await asyncio.to_thread(callback, *args)


def _has_tool_message(checkpoint: Checkpoint, call_id: str) -> bool:
    return any(message.get("role") == "tool" and message.get("tool_call_id") == call_id for message in checkpoint.messages)


async def _record_model_usage(job_id, round_number, turn, record_usage, payer_id,
                              reservation_operation_id, price_version):
    if not turn.usage_known or payer_id is None:
        return
    values = [
        ("input", "model.flash.input", max(0, turn.input_tokens - turn.cached_input_tokens)),
        ("cached", "model.flash.cached_input", turn.cached_input_tokens),
        ("output", "model.flash.output", turn.output_tokens),
    ]
    for suffix, kind, units in values:
        if units:
            await _call(record_usage, UsageInput(operation_id=f"job:{job_id}:model:{round_number}:{suffix}",
                payer_id=payer_id, kind=kind, units=units, price_version=price_version,
                reservation_operation_id=reservation_operation_id))


async def run_generation(job_id: str, checkpoint: Checkpoint, model, execute_tool,
                         persist, record_usage, *, payer_id: int | None = None,
                         reservation_operation_id: str | None = None,
                         price_version: str | None = None, max_rounds: int = 20,
                         tools=None, finalize_last_round=False) -> GenerationOutput:
    price_version = price_version or settings.PRICE_VERSION
    tools = TOOLS if tools is None else tools
    if any(call.id not in checkpoint.completed_calls for call in checkpoint.pending_calls):
        # A prior process may have crossed the external-effect boundary. D6 must
        # reconcile the recorded call before the generation loop can continue.
        return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                                requirement_revision=checkpoint.requirement_revision)
    last_failure = None
    extra_finalization_turn = False
    for round_number in range(max_rounds + 1):
        if round_number == max_rounds and not extra_finalization_turn:
            break
        recorded = getattr(model, "has_recorded_turn", lambda: False)()
        if finalize_last_round and round_number == max_rounds - 1 and not recorded and checkpoint.generation_phase != "FINALIZE":
            checkpoint.generation_phase = "FINALIZE"
            checkpoint.messages.append({"role": "user", "content": "源码阶段结束。不要再搭建临时数据库或浏览器自测；平台负责真实验证。现在必须调用finish_implementation提交当前源码对应的AppManifest、真实BuildSpec及平台环境引用，候选提交不代表交付成功。"})
            await _call(persist, checkpoint)
        offered_tools = ([tool for tool in tools if tool["function"]["name"] == "finish_implementation"]
                         if checkpoint.generation_phase == "FINALIZE" else tools)
        try:
            turn = await model.complete(checkpoint.messages, offered_tools, settings.DEEPSEEK_MODEL)
        except ModelProtocolError as exc:
            if (exc.turn is None or not exc.turn.usage_known or str(exc) not in {
                "MODEL_OUTPUT_TRUNCATED", "MODEL_OUTPUT_EMPTY", "invalid model tool arguments",
            }):
                raise
            checkpoint.model_protocol_failures += 1
            raw = dict(exc.turn.assistant_message)
            calls = raw.get("tool_calls") or []
            if any(not call.get("id") for call in calls):
                raise
            if not raw.get("content") and not calls:
                raw["content"] = "上轮未收到可执行的工具参数，未执行任何工具。"
            checkpoint.messages.append(raw)
            for call in calls:
                checkpoint.messages.append({"role": "tool", "tool_call_id": call["id"],
                    "content": "输出截断或参数不完整，未执行该工具。"})
            checkpoint.messages.append({"role": "user", "content": "上轮输出未执行；请分批写入，每次只提交少量文件和完整参数，避免超过输出上限。源码完成后调用finish_implementation。"})
            await _record_model_usage(job_id, round_number, exc.turn, record_usage, payer_id,
                                      reservation_operation_id, price_version)
            await _call(persist, checkpoint)
            if checkpoint.model_protocol_failures >= 3:
                return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                                        requirement_revision=checkpoint.requirement_revision)
            continue
        checkpoint.messages.append(turn.assistant_message)
        checkpoint.pending_calls = turn.calls
        await _call(persist, checkpoint)
        try:
            await _record_model_usage(job_id, round_number, turn, record_usage, payer_id,
                                      reservation_operation_id, price_version)
        except InsufficientQuota:
            return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                                    requirement_revision=checkpoint.requirement_revision)
        if not turn.calls:
            return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                                    requirement_revision=checkpoint.requirement_revision)
        rejected_finalization = (checkpoint.generation_phase == "FINALIZE"
                                 and any(call.name != "finish_implementation" for call in turn.calls))
        if rejected_finalization:
            checkpoint.pending_calls = []
            for call in turn.calls:
                checkpoint.messages.append({"role": "tool", "tool_call_id": call.id,
                    "content": "收尾阶段未执行本轮工具；请仅调用finish_implementation提交候选。"})
            if checkpoint.finalization_corrections >= 1:
                await _call(persist, checkpoint)
                return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                                        requirement_revision=checkpoint.requirement_revision)
            checkpoint.finalization_corrections += 1
            extra_finalization_turn = True
            checkpoint.messages.append({"role": "user", "content":
                "收尾阶段不会执行额外命令，也不会返回实现阶段。请直接调用finish_implementation提交当前源码清单。"})
            await _call(persist, checkpoint)
            continue
        for call in turn.calls:
            previous_arguments = checkpoint.call_arguments.get(call.id)
            if previous_arguments is not None and previous_arguments != call.arguments:
                raise ValueError("tool call id was reused with different arguments")
            checkpoint.call_arguments[call.id] = call.arguments
            if call.name == "ask_user":
                question = call.arguments.get("question")
                if not isinstance(question, str) or not question.strip():
                    raise ValueError("ask_user requires a business question")
                checkpoint.pending_calls = []
                checkpoint.messages.append({'role':'tool','tool_call_id':call.id,'content':'等待用户业务回答'})
                await _call(persist, checkpoint)
                return GenerationOutput(checkpoint=checkpoint, question=question.strip(),
                                        requirement_revision=checkpoint.requirement_revision)
            if call.name == "finish_implementation":
                manifest = AppManifest.model_validate(call.arguments.get("manifest"))
                checkpoint.pending_calls = []
                checkpoint.messages.append({'role':'tool','tool_call_id':call.id,'content':'候选已提交，等待平台验证'})
                await _call(persist, checkpoint)
                return GenerationOutput(checkpoint=checkpoint, manifest=manifest,
                                        requirement_revision=checkpoint.requirement_revision)
            result = checkpoint.completed_calls.get(call.id)
            if result is None:
                await _call(persist, checkpoint)  # pending call is durable before effect
                try:
                    result = await _call(execute_tool, call)
                except UncertainToolResult:
                    return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                                            requirement_revision=checkpoint.requirement_revision)
                result = result.model_copy(update={"call_id": call.id})
                checkpoint.completed_calls[call.id] = result
                await _call(persist, checkpoint)
            if not _has_tool_message(checkpoint, call.id):
                checkpoint.messages.append({"role": "tool", "tool_call_id": call.id, "content": result.content})
            signature = (call.name, result.ok, result.content)
            if result.ok:
                checkpoint.stalled_rounds = 0
                last_failure = None
            elif signature == last_failure:
                checkpoint.stalled_rounds += 1
            else:
                checkpoint.stalled_rounds = 1
                last_failure = signature
            argv = call.arguments.get("argv") if call.name == "run_command" else None
            production_build = (
                isinstance(argv, list)
                and (
                    tuple(argv[:3]) in {
                        ("npm", "run", "build"),
                        ("pnpm", "run", "build"),
                        ("yarn", "run", "build"),
                    }
                    or tuple(argv[:2]) in {("pnpm", "build"), ("yarn", "build")}
                )
            )
            if (finalize_last_round and result.ok and production_build
                    and call.id == turn.calls[-1].id
                    and checkpoint.generation_phase != "FINALIZE"):
                checkpoint.generation_phase = "FINALIZE"
                checkpoint.messages.append({"role": "user", "content":
                    "生产构建已成功。停止继续修改或添加自测；现在直接调用finish_implementation提交当前源码清单。"})
            await _call(persist, checkpoint)
            if checkpoint.stalled_rounds >= 3:
                return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                                        requirement_revision=checkpoint.requirement_revision)
        checkpoint.pending_calls = []
        await _call(persist, checkpoint)
    return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                            requirement_revision=checkpoint.requirement_revision)
