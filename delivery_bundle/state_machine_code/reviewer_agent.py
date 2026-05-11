"""Reviewer Agent 文件。

该文件负责对 Builder 当前轮产物做结构化质量审查。
"""

from __future__ import annotations

from typing import Any

from agent_state import AgentState, ReviewResult, review_result_json_schema
from prompts import build_reviewer_prompt
from runtime import call_llm
from validators import safe_validate_review_result


def build_review_context(state: AgentState) -> dict[str, Any]:
    """提取当前轮审查所需上下文。"""

    build_result = state.get("build_result")
    return {
        "project_id": state.get("project_id"),
        "session_id": state.get("session_id"),
        "user_prompt": state.get("user_prompt"),
        "repo_context": state.get("repo_context", {}),
        "build_result": build_result.model_dump() if build_result else None,
        "iteration_count": state.get("iteration_count", 0),
        "stage": state.get("stage"),
    }


def run_reviewer(state: AgentState) -> ReviewResult:
    """执行 Reviewer 主流程。"""

    if state.get("build_result") is None:
        raise ValueError("build_result is required before running reviewer")
    _ = build_review_context(state)
    reviewer_prompt = build_reviewer_prompt(state)
    raw_output = call_llm(reviewer_prompt, review_result_json_schema())
    validated_review_result, error_info = safe_validate_review_result(raw_output)
    if validated_review_result is None:
        raise ValueError(f"reviewer validation failed: {error_info}")
    if validated_review_result.round_index != state.get("iteration_count", 0) + 1:
        validated_review_result = validated_review_result.model_copy(
            update={"round_index": state.get("iteration_count", 0) + 1}
        )
    return validated_review_result


def append_review_history(state: AgentState, review_result: ReviewResult) -> AgentState:
    """将当前轮审查结果追加到 review_history。"""

    history = list(state.get("review_history", []))
    history.append(review_result)
    state["review_history"] = history
    state["latest_review_result"] = review_result
    return state


__all__ = [
    "build_review_context",
    "run_reviewer",
    "append_review_history",
]
