from __future__ import annotations

from typing import Any


class Propagator:
    def __init__(self, max_recur_limit: int = 40) -> None:
        self.max_recur_limit = max_recur_limit

    def create_initial_state(
        self,
        *,
        flow_id: str,
        user_intent: str,
        repo_profile: dict[str, Any],
        max_attempts: int = 2,
    ) -> dict[str, Any]:
        return {
            "flow_id": flow_id,
            "user_intent": user_intent,
            "repo_profile": repo_profile,
            "stage": "Thinking",
            "attempt": 0,
            "max_attempts": max_attempts,
            "final_status": "IN_PROGRESS",
            "rendered_prompts": {},
            "llm_used": {},
            "fallback_reasons": [],
            "builder_result": {},
            "reviewer_result": {},
            "security_result": {},
            "consensus_result": {},
            "reviewer_decision": "UNKNOWN",
            "reviewer_feedback": "",
            "security_decision": "UNKNOWN",
            "security_feedback": "",
            "trace": [],
            "node_durations_ms": {},
        }

    def get_graph_args(self, *, use_progress_callback: bool = False) -> dict[str, Any]:
        return {
            "stream_mode": "updates" if use_progress_callback else "values",
            "config": {"recursion_limit": self.max_recur_limit},
        }

