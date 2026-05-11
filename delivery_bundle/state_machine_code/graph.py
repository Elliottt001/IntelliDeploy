"""状态机主编排层。

该文件负责串联 Builder、Reviewer、Security、Router，形成可运行的多智能体闭环。
"""

from __future__ import annotations

from agent_state import AgentEvent, AgentState, StageName
from builder_agent import merge_builder_output, run_builder
from reviewer_agent import append_review_history, run_reviewer
from router import decide_next_stage
from security_agent import append_security_reports, run_security


def append_event(
    state: AgentState,
    event_type: str,
    message: str,
    *,
    agent_name: str = "graph",
    stage: StageName | None = None,
    is_terminal: bool = False,
    payload: dict | None = None,
) -> AgentState:
    """向事件流追加一条结构化事件。"""

    event_stream = list(state.get("event_stream", []))
    event_stream.append(
        AgentEvent(
            session_id=state.get("session_id"),
            agent_name=agent_name,  # type: ignore[arg-type]
            stage=stage or state.get("stage", "THINKING"),
            event_type=event_type,
            message=message,
            iteration_count=state.get("iteration_count", 0),
            is_terminal=is_terminal,
            payload=payload or {},
        ).model_dump(mode="json")
    )
    state["event_stream"] = event_stream
    return state


def update_stage(state: AgentState, next_stage: StageName) -> AgentState:
    """统一更新当前阶段字段。"""

    state["stage"] = next_stage
    stage_message_map = {
        "THINKING": "正在准备任务上下文。",
        "BUILDING": "正在生成部署产物。",
        "REVIEWING": "正在进行质量审查。",
        "SECURITY_CHECK": "正在进行安全检查。",
        "HEALING": "正在根据审查意见进入下一轮修复。",
        "APPROVED": "产物已通过多智能体审查。",
        "FAILED": "当前链路执行失败。",
    }
    state["status_message"] = stage_message_map.get(next_stage, next_stage)
    append_event(state, "stage_changed", state["status_message"], agent_name="graph", stage=next_stage)
    return state


def sync_latest_results(state: AgentState) -> AgentState:
    """从历史数组中同步最近一轮结果到便捷字段。"""

    review_history = state.get("review_history", [])
    security_reports = state.get("security_reports", [])
    state["latest_review_result"] = review_history[-1] if review_history else None
    state["latest_security_result"] = security_reports[-1] if security_reports else None
    return state


def run_single_iteration(state: AgentState) -> AgentState:
    """执行单轮 Builder -> Reviewer -> Security 流程。"""

    if state.get("iteration_count", 0) > 0:
        update_stage(state, "HEALING")
        append_event(
            state,
            "iteration_restarted",
            f"开始第 {state.get('iteration_count', 0) + 1} 轮修复。",
            agent_name="graph",
            payload={"next_iteration": state.get("iteration_count", 0) + 1},
        )

    update_stage(state, "BUILDING")
    append_event(state, "agent_started", "Builder 开始生成部署产物。", agent_name="builder")
    build_result = run_builder(state)
    merge_builder_output(state, build_result)
    append_event(
        state,
        "agent_finished",
        f"Builder 已生成版本 {build_result.artifact_version or 'unknown'}。",
        agent_name="builder",
        payload={
            "artifact_version": build_result.artifact_version,
            "build_summary": build_result.build_summary,
            "build_warnings": build_result.build_warnings,
        },
    )

    update_stage(state, "REVIEWING")
    append_event(state, "agent_started", "Reviewer 开始审查当前产物。", agent_name="reviewer")
    review_result = run_reviewer(state)
    append_review_history(state, review_result)
    append_event(
        state,
        "agent_finished",
        review_result.summary,
        agent_name="reviewer",
        payload={
            "passed": review_result.passed,
            "score": review_result.score,
            "artifact_version": review_result.artifact_version,
            "improvement_suggestions": review_result.improvement_suggestions,
            "risk_findings": review_result.risk_findings,
        },
    )

    update_stage(state, "SECURITY_CHECK")
    append_event(state, "agent_started", "Security 开始检查当前产物。", agent_name="security")
    security_result = run_security(state)
    append_security_reports(state, security_result)
    append_event(
        state,
        "agent_finished",
        security_result.summary,
        agent_name="security",
        payload={
            "passed": security_result.passed,
            "risk_score": security_result.risk_score,
            "issues": [issue.model_dump() for issue in security_result.issues],
        },
    )

    sync_latest_results(state)
    return state


def run_graph(state: AgentState) -> AgentState:
    """执行整条主流程。"""

    state.setdefault("review_history", [])
    state.setdefault("security_reports", [])
    state.setdefault("event_stream", [])
    state.setdefault("deployment_logs", [])
    state.setdefault("iteration_count", 0)
    state.setdefault("max_iteration_limit", 3)
    state.setdefault("is_approved", False)
    state.setdefault("failure_reason", None)
    state.setdefault("last_error", None)
    state.setdefault("status_message", None)
    state.setdefault("stage", "THINKING")

    try:
        update_stage(state, "THINKING")
        append_event(state, "graph_started", "多智能体流程已启动。", agent_name="graph")
        while True:
            run_single_iteration(state)
            next_stage = decide_next_stage(state)
            append_event(
                state,
                "router_decision",
                f"Router 判定下一阶段为 {next_stage}。",
                agent_name="router",
                payload={"next_stage": next_stage},
            )
            update_stage(state, next_stage)

            if next_stage == "APPROVED":
                append_event(
                    state,
                    "graph_finished",
                    "多智能体流程已通过。",
                    agent_name="graph",
                    is_terminal=True,
                    payload={"is_approved": True},
                )
                return state

            if next_stage == "FAILED":
                append_event(
                    state,
                    "graph_finished",
                    state.get("failure_reason") or "多智能体流程失败。",
                    agent_name="graph",
                    is_terminal=True,
                    payload={"is_approved": False, "failure_reason": state.get("failure_reason")},
                )
                return state

            state["iteration_count"] = state.get("iteration_count", 0) + 1
    except Exception as error:  # pragma: no cover
        state["last_error"] = str(error)
        state["is_approved"] = False
        state["failure_reason"] = str(error)
        update_stage(state, "FAILED")
        append_event(
            state,
            "graph_error",
            str(error),
            agent_name="graph",
            is_terminal=True,
            payload={"failure_reason": str(error)},
        )
        return state


__all__ = [
    "append_event",
    "run_graph",
    "run_single_iteration",
    "sync_latest_results",
    "update_stage",
]
