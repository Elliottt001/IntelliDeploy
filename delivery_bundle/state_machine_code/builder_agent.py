"""Builder Agent 文件。

该文件负责根据共享状态生成当前轮部署产物。
"""

from __future__ import annotations

from typing import Any

from agent_state import AgentState, BuildResult, build_result_json_schema
from prompts import build_builder_prompt
from runtime import call_llm
from validators import safe_validate_build_result


def build_artifact_from_state(state: AgentState) -> dict[str, Any]:
    """从共享状态中提取 Builder 所需输入。"""

    latest_review_result = state.get("latest_review_result")
    latest_security_result = state.get("latest_security_result")
    return {
        "project_id": state.get("project_id"),
        "session_id": state.get("session_id"),
        "user_prompt": state.get("user_prompt"),
        "repo_context": state.get("repo_context", {}),
        "iteration_count": state.get("iteration_count", 0),
        "latest_review_result": latest_review_result.model_dump() if latest_review_result else None,
        "latest_security_result": latest_security_result.model_dump() if latest_security_result else None,
        "stage": state.get("stage"),
    }


def run_builder(state: AgentState) -> BuildResult:
    """执行 Builder 主流程。"""

    _ = build_artifact_from_state(state)
    builder_prompt = build_builder_prompt(state)
    raw_output = call_llm(builder_prompt, build_result_json_schema())
    validated_build_result, error_info = safe_validate_build_result(raw_output)
    if validated_build_result is None:
        raise ValueError(f"builder validation failed: {error_info}")
    if validated_build_result.round_index != state.get("iteration_count", 0) + 1:
        validated_build_result = validated_build_result.model_copy(
            update={"round_index": state.get("iteration_count", 0) + 1}
        )
    return validated_build_result


def merge_builder_output(state: AgentState, build_result: BuildResult) -> AgentState:
    """将 Builder 输出写回共享状态中的当前产物区。"""

    state["build_result"] = build_result
    state["current_dockerfile"] = build_result.current_dockerfile
    state["current_configs"] = build_result.current_configs
    return state


__all__ = [
    "build_artifact_from_state",
    "run_builder",
    "merge_builder_output",
]
