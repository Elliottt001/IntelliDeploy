import json

from sqlalchemy import select

from app.apps.models import App
from app.jobs.models import Job, JobEvent
from app.models.user import User
from app.runtime.models import DeploymentTarget, ResourceRecord


def _create_app(client, headers, key="evaluation-create"):
    response = client.post(
        "/api/apps",
        headers={**headers, "Idempotency-Key": key},
        json={"prompt": "保存私有笔记并验证刷新后仍可读取", "budget_units": 100},
    )
    assert response.status_code == 201
    return response.json()


def _set_developer(session_factory, username):
    with session_factory() as session:
        user = session.scalar(select(User).where(User.username == username))
        user.is_developer = True
        session.commit()


def _algorithm_diagnostic_checkpoint():
    return {
        "algorithm": {
            "schema_version": 1,
            "requirement_revision": 1,
            "mode": "hybrid",
            "algorithm_version": "fusion-v1",
            "retrieval": {
                "queries": ["private notes web app"],
                "completed": True,
                "index_version": "idx-1",
                "candidates": [],
            },
            "route": {
                "route": "GENERATE_APP",
                "sources": [],
                "steps": ["generate"],
                "reason": "no reusable source",
                "confidence": "MEDIUM",
            },
            "profiles": [],
            "evaluations": [],
            "reviews": [
                {
                    "attempt_id": "attempt-1",
                    "requirement_revision": 1,
                    "manifest_hash": "a" * 64,
                    "reviewer_kind": "DETERMINISTIC",
                    "findings": [
                        {
                            "id": "missing:save-note",
                            "severity": "BLOCKING",
                            "category": "REQUIREMENT",
                            "message": "核心保存验收尚未映射",
                            "evidence_ref": "private:evidence:one",
                            "acceptance_ids": ["save-note"],
                        },
                        {
                            "id": "warning:refresh",
                            "severity": "WARNING",
                            "category": "DATA",
                            "message": "刷新验证证据不足",
                            "evidence_ref": "private:evidence:two",
                        },
                    ],
                }
            ],
            "healing": [
                {
                    "failure_class": "BUILD",
                    "strategy": "REPAIR_SERIAL",
                    "candidate_count": 1,
                    "reasons": ["parallel_not_admitted"],
                    "evidence_refs": [],
                }
            ],
            "selected_sources": [],
            "evidence_refs": [],
            "stages": [],
        },
        "system_prompt": "must-not-leak",
        "source_excerpt": "must-not-leak",
    }


def test_only_developer_evaluation_endpoint_can_choose_hybrid(
    api_client, owner_headers, other_headers, session_factory, monkeypatch
):
    monkeypatch.setattr("app.config.settings.ENABLE_EVALUATION_UI", True)
    _set_developer(session_factory, "owner")
    body = {"prompt": "创建私有笔记", "algorithm_mode": "hybrid"}
    assert (
        api_client.post("/api/evaluation/runs", headers=other_headers, json=body).status_code
        == 404
    )
    created = api_client.post(
        "/api/evaluation/runs",
        headers={**owner_headers, "Idempotency-Key": "hybrid-run"},
        json=body,
    )
    assert created.status_code == 201
    with session_factory() as session:
        job = session.get(Job, created.json()["job_id"])
        assert job.checkpoint["algorithm"]["mode"] == "hybrid"


def test_evaluation_run_rejects_unhealthy_target(
    api_client, owner_headers, session_factory, monkeypatch
):
    monkeypatch.setattr("app.config.settings.ENABLE_EVALUATION_UI", True)
    _set_developer(session_factory, "owner")
    response = api_client.post(
        "/api/evaluation/runs",
        headers={**owner_headers, "Idempotency-Key": "missing-target"},
        json={
            "prompt": "创建私有笔记",
            "algorithm_mode": "baseline",
            "target_id": "missing",
        },
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "TARGET_UNAVAILABLE"


def test_public_create_cannot_choose_algorithm_mode(
    api_client, owner_headers, session_factory, monkeypatch
):
    monkeypatch.setattr("app.config.settings.ALGORITHM_MODE", "baseline")
    created = api_client.post(
        "/api/apps",
        headers={**owner_headers, "Idempotency-Key": "public-mode"},
        json={"prompt": "创建私有笔记", "algorithm_mode": "hybrid"},
    )
    assert created.status_code == 201
    with session_factory() as session:
        job = session.get(Job, created.json()["job_id"])
        assert job.checkpoint["algorithm"]["mode"] == "baseline"


def test_diagnostics_expose_algorithm_summary_but_not_private_evidence(
    api_client, owner_headers, session_factory, monkeypatch
):
    monkeypatch.setattr("app.config.settings.ENABLE_EVALUATION_UI", True)
    _set_developer(session_factory, "owner")
    created = _create_app(api_client, owner_headers, key="algorithm-diagnostics")
    with session_factory() as session:
        job = session.get(Job, created["job_id"])
        job.checkpoint = _algorithm_diagnostic_checkpoint()
        session.commit()

    response = api_client.get(
        f"/api/jobs/{created['job_id']}/diagnostics", headers=owner_headers
    )
    assert response.status_code == 200
    algorithm = response.json()["algorithm"]
    assert algorithm == {
        "mode": "hybrid",
        "version": "fusion-v1",
        "route": "GENERATE_APP",
        "route_confidence": "MEDIUM",
        "retrieval_complete": True,
        "review": {"blocking_count": 1, "warning_count": 1, "info_count": 0},
        "healing": {
            "attempt_count": 1,
            "candidate_count": 1,
            "reasons": ["parallel_not_admitted"],
        },
    }
    serialized = json.dumps(response.json())
    assert "private:evidence" not in serialized
    assert "system_prompt" not in serialized
    assert "source_excerpt" not in serialized
    assert "must-not-leak" not in serialized


def test_evaluation_targets_require_enabled_developer(
    api_client, owner_headers, session_factory, monkeypatch
):
    monkeypatch.setattr("app.config.settings.ENABLE_EVALUATION_UI", True)
    with session_factory() as session:
        session.add_all(
            [
                DeploymentTarget(
                    id="linux-ready",
                    kind="LINUX",
                    enabled=True,
                    health="HEALTHY",
                    capacity={"name": "Linux 验收节点"},
                ),
                DeploymentTarget(
                    id="disabled",
                    kind="KUBERNETES",
                    enabled=False,
                    health="HEALTHY",
                    capacity={"name": "停用节点"},
                ),
                DeploymentTarget(
                    id="unknown",
                    kind="SEALOS",
                    enabled=True,
                    health="UNKNOWN",
                    capacity={"name": "待核对节点"},
                ),
            ]
        )
        session.commit()

    assert api_client.get("/api/evaluation/targets", headers=owner_headers).status_code == 404
    _set_developer(session_factory, "owner")
    response = api_client.get("/api/evaluation/targets", headers=owner_headers)
    assert response.status_code == 200
    assert response.json() == [
        {"target_id": "linux-ready", "name": "Linux 验收节点", "kind": "LINUX"}
    ]


def test_diagnostics_requires_feature_flag_developer_and_owner(
    api_client, owner_headers, other_headers, session_factory, monkeypatch
):
    created = _create_app(api_client, owner_headers)
    _set_developer(session_factory, "owner")

    monkeypatch.setattr("app.config.settings.ENABLE_EVALUATION_UI", False)
    assert (
        api_client.get(
            f"/api/jobs/{created['job_id']}/diagnostics", headers=owner_headers
        ).status_code
        == 404
    )

    monkeypatch.setattr("app.config.settings.ENABLE_EVALUATION_UI", True)
    assert (
        api_client.get(
            f"/api/jobs/{created['job_id']}/diagnostics", headers=other_headers
        ).status_code
        == 404
    )

    _set_developer(session_factory, "other")
    assert (
        api_client.get(
            f"/api/jobs/{created['job_id']}/diagnostics", headers=other_headers
        ).status_code
        == 404
    )


def test_developer_can_override_only_a_registered_healthy_target(
    api_client, owner_headers, session_factory, monkeypatch
):
    monkeypatch.setattr("app.config.settings.ENABLE_EVALUATION_UI", True)
    _set_developer(session_factory, "owner")
    with session_factory() as session:
        session.add(
            DeploymentTarget(
                id="linux-ready",
                kind="LINUX",
                enabled=True,
                health="HEALTHY",
                capacity={"name": "Linux 验收节点"},
            )
        )
        session.commit()

    accepted = api_client.post(
        "/api/apps",
        headers={**owner_headers, "Idempotency-Key": "target-ready"},
        json={
            "prompt": "保存私有笔记",
            "budget_units": 100,
            "evaluation_target_id": "linux-ready",
        },
    )
    assert accepted.status_code == 201
    with session_factory() as session:
        job = session.get(Job, accepted.json()["job_id"])
        assert job.checkpoint["evaluation_target_id"] == "linux-ready"

    rejected = api_client.post(
        "/api/apps",
        headers={**owner_headers, "Idempotency-Key": "target-missing"},
        json={
            "prompt": "保存另一份私有笔记",
            "budget_units": 100,
            "evaluation_target_id": "arbitrary-host",
        },
    )
    assert rejected.status_code == 503
    assert rejected.json()["error"]["code"] == "TARGET_UNAVAILABLE"


def test_diagnostics_are_server_derived_and_sanitized(
    api_client, owner_headers, session_factory, monkeypatch
):
    monkeypatch.setattr("app.config.settings.ENABLE_EVALUATION_UI", True)
    monkeypatch.setattr("app.config.settings.DEEPSEEK_MODEL", "current-model")
    _set_developer(session_factory, "owner")
    created = _create_app(api_client, owner_headers)

    with session_factory() as session:
        job = session.get(Job, created["job_id"])
        app = session.get(App, created["app_id"])
        job.status = "RUNNING"
        job.phase = "retrieving"
        job.used_units = 12
        job.checkpoint = {
            "evaluation_target_id": "linux-ready",
            "routing_mode": "automatic",
            "retrieval": {
                "queries": ["private notes web app"],
                "completed": True,
                "index_version": "idx-1",
                "candidates": [
                    {
                            "repo_url": "https://secret-token@github.com/example/notes",
                        "commit": "a" * 40,
                        "stars": 42,
                        "key_files": {".env": "TOKEN=must-not-leak"},
                    },
                    {
                        "repo_url": "javascript:alert('must-not-render')",
                        "commit": "b" * 40,
                    },
                ],
            },
            "evaluations": [
                {
                    "repo_url": "https://secret-token@github.com/example/notes",
                    "match_score": 91,
                    "deploy_score": 82,
                    "quality_score": 70,
                }
            ],
            "sources": [
                {
                    "url": "https://secret-token@github.com/example/notes",
                    "commit": "a" * 40,
                    "role": "主体",
                },
                {
                    "url": "javascript:alert('must-not-render')",
                    "commit": "b" * 40,
                    "role": "恶意来源",
                },
            ],
            "private_token": "must-not-leak",
        }
        session.add(
            JobEvent(
                job_id=job.id,
                kind="phase",
                public_payload={
                    "id": 0,
                    "kind": "phase",
                    "message": "开始检索",
                    "status": "RUNNING",
                    "phase": "retrieving",
                    "usage_units": 12,
                },
            )
        )
        session.add(
            ResourceRecord(
                type="MODEL_CALL",
                app_id=app.id,
                job_id=job.id,
                operation_id="model:evaluation:0",
                state="METERED",
                reference="model:evaluation:0",
                metadata_json={
                    "price_version": "dev-v1",
                    "model": "persisted-model",
                    "api_key": "must-not-leak",
                },
            )
        )
        session.commit()

    response = api_client.get(
        f"/api/jobs/{created['job_id']}/diagnostics", headers=owner_headers
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["job_id"] == created["job_id"]
    assert payload["app_id"] == created["app_id"]
    assert payload["routing_mode"] == "automatic"
    assert payload["target_id"] == "linux-ready"
    assert payload["target_override"] is True
    assert payload["source_mode"] == "fixture"
    assert payload["cost_units"] is None
    assert payload["cost_status"] == "unknown"
    assert payload["model"] == "persisted-model"
    assert payload["evidence_gate"] == {
        "status": "NOT_RUN",
        "reasons": [
            "JOB_NOT_TERMINAL",
            "REAL_RELEASE_EVIDENCE_MISSING",
            "COST_UNKNOWN",
        ],
    }
    assert payload["retrieval"]["candidates"] == [
        {
            "repo_url": "https://github.com/example/notes",
            "commit": "a" * 40,
            "rank": 1,
            "stars": 42,
            "match_score": 91.0,
            "deploy_score": 82.0,
            "quality_score": 70.0,
        }
    ]
    assert payload["sources"][0]["url"] == "https://github.com/example/notes"
    assert "secret-token" not in response.text
    assert "must-not-leak" not in response.text
    assert "javascript:" not in response.text


def test_developer_flag_defaults_false_and_cannot_be_registered(
    api_client, session_factory
):
    response = api_client.post(
        "/auth/register",
        json={
            "username": "attempted-admin",
            "email": "attempted-admin@test",
            "password": "a-secure-test-password",
            "is_developer": True,
        },
    )
    assert response.status_code == 422
    response = api_client.post(
        "/auth/register",
        json={
            "username": "ordinary",
            "email": "ordinary@test",
            "password": "a-secure-test-password",
        },
    )
    assert response.status_code == 201
    with session_factory() as session:
        user = session.scalar(select(User).where(User.username == "ordinary"))
        assert user.is_developer is False
