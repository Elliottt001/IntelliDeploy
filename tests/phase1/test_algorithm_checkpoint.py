from app.agent.checkpoint import (
    load_algorithm_checkpoint,
    save_algorithm_checkpoint,
    stage_input_hash,
)
from app.agent.contracts import AlgorithmCheckpoint


def test_new_checkpoint_is_the_only_written_algorithm_state():
    state = AlgorithmCheckpoint.empty(
        requirement_revision=2,
        mode="baseline",
        algorithm_version="fusion-v1",
    )

    raw = save_algorithm_checkpoint(
        {"evaluation_target_id": "linux-one"}, state
    )

    assert raw["evaluation_target_id"] == "linux-one"
    assert raw["algorithm"]["schema_version"] == 1
    assert "retrieval" not in raw
    assert "evaluations" not in raw


def test_legacy_checkpoint_is_read_without_mutating_original_payload():
    raw = {
        "retrieval": {
            "queries": ["notes"],
            "completed": True,
            "candidates": [],
        },
        "evaluations": [],
        "route": {
            "route": "GENERATE_APP",
            "sources": [],
            "steps": ["generate"],
            "reason": "no reusable source",
        },
    }

    restored = load_algorithm_checkpoint(raw, requirement_revision=1)

    assert restored.mode == "baseline"
    assert restored.retrieval is not None
    assert restored.route is not None
    assert "algorithm" not in raw


def test_stage_input_hash_uses_canonical_utf8_json():
    first = {"需求": "私人笔记", "nested": {"b": 2, "a": 1}}
    second = {"nested": {"a": 1, "b": 2}, "需求": "私人笔记"}

    assert stage_input_hash(first) == stage_input_hash(second)
    assert stage_input_hash(first) != stage_input_hash(
        {"需求": "公开笔记", "nested": {"a": 1, "b": 2}}
    )
