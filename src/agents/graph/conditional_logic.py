from __future__ import annotations

from src.agents.graph.state import AgentState


class ConditionalLogic:
    def consensus_route(self, state: AgentState) -> str:
        print(
            "[route] attempt=%s reviewer=%s security=%s status=%s"
            % (state["attempt"], state["reviewer_decision"], state["security_decision"], state["final_status"])
        )
        if state["final_status"] == "SUCCESS":
            return "finalize"
        if state["attempt"] < state["max_attempts"]:
            return "healing"
        return "finalize"

    def healing_route(self, state: AgentState) -> str:
        return "builder"

