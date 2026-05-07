from __future__ import annotations

from typing import Literal

from typing_extensions import Annotated, TypedDict


def merge_list(left: list[str], right: list[str]) -> list[str]:
    return left + right


def merge_int_dict(left: dict[str, int], right: dict[str, int]) -> dict[str, int]:
    merged = dict(left)
    merged.update(right)
    return merged


def merge_str_dict(left: dict[str, str], right: dict[str, str]) -> dict[str, str]:
    merged = dict(left)
    merged.update(right)
    return merged


Stage = Literal["Thinking", "Building", "Reviewing", "SecurityCheck", "Healing", "Finalize"]
Decision = Literal["APPROVE", "REVISE", "REJECT", "UNKNOWN"]


class AgentState(TypedDict):
    flow_id: str
    user_intent: str
    repo_profile: dict
    stage: Stage
    attempt: int
    max_attempts: int
    final_status: Literal["SUCCESS", "FAILED", "IN_PROGRESS"]
    rendered_prompts: Annotated[dict[str, str], merge_str_dict]
    llm_used: Annotated[dict[str, str], merge_str_dict]
    fallback_reasons: Annotated[list[str], merge_list]
    builder_result: dict
    reviewer_result: dict
    security_result: dict
    consensus_result: dict
    reviewer_decision: Decision
    reviewer_feedback: str
    security_decision: Decision
    security_feedback: str
    trace: Annotated[list[str], merge_list]
    node_durations_ms: Annotated[dict[str, int], merge_int_dict]

