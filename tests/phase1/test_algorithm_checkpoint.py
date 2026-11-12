from app.agent.checkpoint import (
    load_algorithm_checkpoint,
    save_algorithm_checkpoint,
    stage_input_hash,
)
from app.agent.contracts import AlgorithmCheckpoint
from app.apps.models import App, RequirementRecord
from app.jobs.models import Job


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


def test_created_job_freezes_baseline_algorithm_mode(
    api_client, owner_headers, session_factory, monkeypatch
):
    monkeypatch.setattr("app.apps.service.settings.ALGORITHM_MODE", "baseline")

    created = api_client.post(
        "/api/apps",
        headers={**owner_headers, "Idempotency-Key": "algorithm-mode"},
        json={"prompt": "创建一个私有笔记应用"},
    ).json()

    with session_factory() as session:
        job = session.get(Job, created["job_id"])
        assert job.checkpoint["algorithm"]["mode"] == "baseline"
        assert job.checkpoint["algorithm"]["algorithm_version"] == "fusion-v1"
        assert job.checkpoint["algorithm"]["requirement_revision"] == 1


def test_adjust_job_freezes_current_mode_and_next_requirement_revision(
    api_client, owner_headers, session_factory, monkeypatch
):
    from app.apps.service import add_message

    created = api_client.post(
        "/api/apps",
        headers={**owner_headers, "Idempotency-Key": "algorithm-adjust-source"},
        json={"prompt": "创建一个私有笔记应用"},
    ).json()
    with session_factory() as session:
        original = session.get(Job, created["job_id"])
        original.status = "FAILED"
        session.add(
            RequirementRecord(
                app_id=created["app_id"],
                revision=1,
                requirement={
                    "prompt": "创建一个私有笔记应用",
                    "revision": 1,
                    "acceptance": [
                        {
                            "id": "private-note",
                            "action": "保存笔记",
                            "expected": "其他用户不可读取",
                            "private_data": True,
                        }
                    ],
                },
            )
        )
        session.commit()
        owner_id = session.get(App, created["app_id"]).owner_id

        monkeypatch.setattr("app.apps.service.settings.ALGORITHM_MODE", "hybrid")
        adjusted = add_message(
            session,
            created["app_id"],
            owner_id,
            "新增全文搜索",
            "algorithm-adjust",
        )
        checkpoint = session.get(Job, adjusted.job_id).checkpoint["algorithm"]
        assert checkpoint["mode"] == "hybrid"
        assert checkpoint["requirement_revision"] == 2

        monkeypatch.setattr("app.apps.service.settings.ALGORITHM_MODE", "baseline")
        session.expire_all()
        assert session.get(Job, adjusted.job_id).checkpoint["algorithm"]["mode"] == "hybrid"
