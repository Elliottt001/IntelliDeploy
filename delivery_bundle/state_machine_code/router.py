"""路由决策层。

该文件负责根据最新审查结果、安全结果和轮次信息决定状态机下一步流向。
"""

from __future__ import annotations

from agent_state import AgentState, ReviewResult, SecurityResult


def is_review_passed(latest_review_result: ReviewResult | None) -> bool:
    """判断最新质量审查是否通过。"""

    return bool(latest_review_result and latest_review_result.passed)


def is_security_passed(latest_security_result: SecurityResult | None) -> bool:
    """判断最新安全检查是否通过。"""

    return bool(latest_security_result and latest_security_result.passed)


def is_iteration_exceeded(iteration_count: int, max_iteration_limit: int) -> bool:
    """判断是否超过最大轮次。"""

    return iteration_count >= max_iteration_limit


def decide_next_stage(state: AgentState) -> str:
    """根据最新审查结果、安全结果和轮次决定下一步阶段。"""

    latest_review_result = state.get("latest_review_result")
    latest_security_result = state.get("latest_security_result")
    iteration_count = state.get("iteration_count", 0)
    max_iteration_limit = state.get("max_iteration_limit", 3)

    if state.get("last_error") and state.get("stage") == "FAILED":
        state["failure_reason"] = state.get("last_error")
        state["is_approved"] = False
        return "FAILED"

    if is_review_passed(latest_review_result) and is_security_passed(latest_security_result):
        state["is_approved"] = True
        state["failure_reason"] = None
        return "APPROVED"

    if is_iteration_exceeded(iteration_count, max_iteration_limit):
        state["is_approved"] = False
        state["failure_reason"] = "达到最大迭代次数，仍未通过质量或安全审查。"
        return "FAILED"

    state["is_approved"] = False
    state["failure_reason"] = None
    return "HEALING"


__all__ = [
    "decide_next_stage",
    "is_review_passed",
    "is_security_passed",
    "is_iteration_exceeded",
]
