"""Security Agent 文件。

该文件负责对 Builder 当前轮产物做结构化安全审查。
"""

from __future__ import annotations

from typing import Any

from agent_state import AgentState, SecurityResult, security_result_json_schema
from prompts import build_security_prompt
from runtime import call_llm
from validators import safe_validate_security_result


def build_security_context(state: AgentState) -> dict[str, Any]:
    """提取安全检查所需上下文。"""

    build_result = state.get("build_result")
    return {
        "project_id": state.get("project_id"),
        "session_id": state.get("session_id"),
        "repo_context": state.get("repo_context", {}),
        "build_result": build_result.model_dump() if build_result else None,
        "iteration_count": state.get("iteration_count", 0),
        "stage": state.get("stage"),
    }


def run_security(state: AgentState) -> SecurityResult:
    """执行 Security 主流程。"""

    if state.get("build_result") is None:
        raise ValueError("build_result is required before running security")
    _ = build_security_context(state)
    security_prompt = build_security_prompt(state)
    raw_output = call_llm(security_prompt, security_result_json_schema())
    validated_security_result, error_info = safe_validate_security_result(raw_output)
    if validated_security_result is None:
        raise ValueError(f"security validation failed: {error_info}")
    if validated_security_result.round_index != state.get("iteration_count", 0) + 1:
        validated_security_result = validated_security_result.model_copy(
            update={"round_index": state.get("iteration_count", 0) + 1}
        )
    return validated_security_result


def append_security_reports(state: AgentState, security_result: SecurityResult) -> AgentState:
    """将当前轮安全结果追加到 security_reports。"""

    reports = list(state.get("security_reports", []))
    reports.append(security_result)
    state["security_reports"] = reports
    state["latest_security_result"] = security_result
    return state


__all__ = [
    "build_security_context",
    "run_security",
    "append_security_reports",
]
