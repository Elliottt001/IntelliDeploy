from __future__ import annotations

from src.agents.graph.state import AgentState


class ConditionalLogic:
    def consensus_route(self, state: AgentState) -> str:
        # 之前这行只打了 reviewer=REVISE / security=APPROVE 的结论标签，
        # reviewer 抱怨的具体内容（reviewer_feedback）完全被吞掉 —— 一旦
        # multi-agent reject deployment，运维只能干瞪眼。把 feedback 截断
        # 后一起打出来，至少能在日志里看到「为什么要 REVISE」。
        reviewer_fb = (state.get("reviewer_feedback") or "").strip().replace("\n", " ")
        security_fb = (state.get("security_feedback") or "").strip().replace("\n", " ")
        print(
            "[route] attempt=%s reviewer=%s security=%s status=%s"
            " reviewer_feedback=%r security_feedback=%r"
            % (
                state["attempt"],
                state["reviewer_decision"],
                state["security_decision"],
                state["final_status"],
                reviewer_fb[:400],
                security_fb[:400],
            )
        )
        if state["final_status"] == "SUCCESS":
            return "finalize"
        if state["attempt"] < state["max_attempts"]:
            return "healing"
        return "finalize"

    def healing_route(self, state: AgentState) -> str:
        return "builder"

