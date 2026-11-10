from __future__ import annotations

import asyncio
import inspect
import json

from app.billing.ledger import InsufficientQuota
from app.config import settings
from app.core.types import AppManifest, Checkpoint, GenerationOutput, ToolCall, ToolResult, UsageInput


class UncertainToolResult(RuntimeError):
    pass


TOOLS = [
    {"type": "function", "function": {"name": "list_files", "description": "列出工作区文件", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "read_file", "description": "读取工作区文件", "parameters": {"type": "object", "required": ["path"], "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "write_file", "description": "写入工作区文件", "parameters": {"type": "object", "required": ["path", "content"], "properties": {"path": {"type": "string"}, "content": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "apply_patch", "description": "精确替换文件内容", "parameters": {"type": "object", "required": ["path", "old_text", "new_text"], "properties": {"path": {"type": "string"}, "old_text": {"type": "string"}, "new_text": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "run_command", "description": "在隔离执行器运行命令", "parameters": {"type": "object", "required": ["argv"], "properties": {"argv": {"type": "array", "items": {"type": "string"}}, "timeout": {"type": "integer"}}}}},
    {"type": "function", "function": {"name": "ask_user", "description": "追问必要的业务信息", "parameters": {"type": "object", "required": ["question"], "properties": {"question": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "finish_implementation", "description": "提交候选运行清单，不表示交付成功", "parameters": {"type": "object", "required": ["manifest"], "properties": {"manifest": {"type": "object"}}}}},
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
                         price_version: str | None = None, max_rounds: int = 20) -> GenerationOutput:
    price_version = price_version or settings.PRICE_VERSION
    if any(call.id not in checkpoint.completed_calls for call in checkpoint.pending_calls):
        # A prior process may have crossed the external-effect boundary. D6 must
        # reconcile the recorded call before the generation loop can continue.
        return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                                requirement_revision=checkpoint.requirement_revision)
    last_failure = None
    for round_number in range(max_rounds):
        turn = await model.complete(checkpoint.messages, TOOLS, settings.DEEPSEEK_MODEL)
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
                await _call(persist, checkpoint)
                return GenerationOutput(checkpoint=checkpoint, question=question.strip(),
                                        requirement_revision=checkpoint.requirement_revision)
            if call.name == "finish_implementation":
                manifest = AppManifest.model_validate(call.arguments.get("manifest"))
                checkpoint.pending_calls = []
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
            await _call(persist, checkpoint)
            if checkpoint.stalled_rounds >= 3:
                return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                                        requirement_revision=checkpoint.requirement_revision)
        checkpoint.pending_calls = []
        await _call(persist, checkpoint)
    return GenerationOutput(checkpoint=checkpoint, exhausted=True,
                            requirement_revision=checkpoint.requirement_revision)
