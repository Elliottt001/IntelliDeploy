from __future__ import annotations

from contracts.models import ConsensusState


def test_consensus_state_minimum_shape() -> None:
    payload = {
        "contract_version": "1.0.0",
        "flow_id": "flow-abc",
        "stage": "REVIEWING",
        "votes": [
            {"agent": "BUILDER", "decision": "APPROVE", "reason": "build is runnable"},
            {"agent": "REVIEWER", "decision": "REVISE", "reason": "needs healthcheck"},
            {"agent": "SECURITY", "decision": "APPROVE", "reason": "no critical risk"}
        ],
        "final_decision": "REVISE",
        "rationale": "Reviewer requested changes",
        "updated_at": "2026-05-07T10:00:00Z"
    }
    model = ConsensusState.model_validate(payload)
    assert model.final_decision == "REVISE"
    assert len(model.votes) == 3
