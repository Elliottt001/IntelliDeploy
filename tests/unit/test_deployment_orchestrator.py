from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
import sys

import pytest
from pydantic import BaseModel


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.schemas.fallback import (  # noqa: E402
    ArtifactType,
    GetArtifactResultResponse,
    RequiredEnv,
    RuntimeInfo,
)
from app.services.deployment_orchestrator import DeploymentOrchestrator  # noqa: E402


class RequiredEnvStub(BaseModel):
    name: str
    required: bool = False
    example_value: str | None = None


class DeploymentStub:
    id = 1
    project_id = 1
    runtime_name = "app-1"
    dockerfile_content = ""
    sealos_app_id = None
    namespace = None
    ingress_domain = None
    access_url = None
    error_message = None
    error_type = None
    status = "pending"
    started_at = None
    finished_at = None
    database_name = None
    env_vars = None


class QueryStub:
    def __init__(self, deployment: DeploymentStub):
        self.deployment = deployment

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.deployment


class SessionStub:
    def __init__(self):
        self.deployment = DeploymentStub()
        self.events = []
        self.commits = 0

    def query(self, model):
        return QueryStub(self.deployment)

    def add(self, item):
        self.events.append(item)

    def commit(self):
        self.commits += 1


class BuilderStub:
    def __init__(self, delay: float = 0.0, fail: bool = False):
        self.delay = delay
        self.fail = fail
        self.calls = []

    async def build_image(self, **kwargs):
        self.calls.append(kwargs)
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.fail:
            return {"status": "failed", "error": "build failed"}
        return {"status": "success", "image": kwargs["image_name"] + ":" + kwargs["image_tag"]}

    async def push_image(self, image_name, registry=None):
        return {"status": "success", "image": image_name}


class SealosStub:
    def __init__(self):
        self.create_calls = []
        self.health_calls = []

    async def create_app(self, **kwargs):
        self.create_calls.append(kwargs)
        return {
            "app_id": "app-ok",
            "namespace": "default",
            "ingress_domain": "app.example.com",
            "access_url": "https://app.example.com",
            "database_name": "app-1-db" if kwargs.get("needs_database") else None,
        }

    async def health_check(self, url, timeout=30, expected_keywords=None):
        self.health_calls.append(
            {"url": url, "timeout": timeout, "expected_keywords": expected_keywords or []}
        )
        return {
            "healthy": True,
            "status_code": 200,
            "response_snippet": '{"ok":true}',
            "expected_keywords": expected_keywords or [],
            "keyword_hits": ["ok"],
        }


class HealingStub:
    async def parallel_healing(self, deployment_id: int, error_logs: str, failed_stage: str):
        return ["slow-task", "fast-task"]


class GenerationStub:
    async def query_task_status(self, task_id: str):
        return type(
            "Status",
            (),
            {
                "artifact_ready": True,
                "status": "SUCCEEDED",
                "error_message": None,
            },
        )()

    async def get_artifact_result(self, task_id: str):
        return artifact_response(
            dockerfile=f"FROM nginx\n# {task_id}",
            context_files={"index.html": task_id},
        )


def artifact_response(
    *,
    artifact_path: str | None = None,
    context_files: dict[str, str] | None = None,
    dockerfile: str = "FROM node:20-alpine",
    runtime: RuntimeInfo | None = None,
    required_envs: list[RequiredEnv] | None = None,
) -> GetArtifactResultResponse:
    return GetArtifactResultResponse(
        task_id="task-1",
        artifact_type=ArtifactType.TEMPLATE_PROJECT,
        artifact_path=artifact_path,
        context_files=context_files,
        dockerfile_content=dockerfile,
        runtime=runtime or RuntimeInfo(start_command="npm start", exposed_port=3000),
        required_envs=required_envs or [],
        deploy_ready=True,
    )


def build_orchestrator(session: SessionStub) -> DeploymentOrchestrator:
    orchestrator = DeploymentOrchestrator.__new__(DeploymentOrchestrator)
    orchestrator.db = session
    orchestrator.sealos_client = SealosStub()
    orchestrator.healing_engine = HealingStub()
    orchestrator.generation_service = GenerationStub()
    return orchestrator


def test_extract_context_files_prefers_artifact_payload_and_directory(tmp_path, monkeypatch):
    session = SessionStub()
    orchestrator = build_orchestrator(session)
    artifact_dir = tmp_path / "artifact"
    artifact_dir.mkdir()
    (artifact_dir / "package.json").write_text('{"scripts":{"start":"vite"}}', encoding="utf-8")
    (artifact_dir / "Dockerfile").write_text("FROM node:20", encoding="utf-8")

    artifact = artifact_response(
        artifact_path=str(artifact_dir),
        context_files={"src/App.jsx": "export default function App() {}", "../escape": "bad"},
    )

    context = orchestrator._extract_context_files(artifact)

    assert context["src/App.jsx"].startswith("export default")
    assert context["package.json"].startswith("{")
    assert "Dockerfile" not in context
    assert "../escape" not in context


def test_start_deployment_passes_real_context_to_builder(tmp_path, monkeypatch):
    async def run():
        session = SessionStub()
        orchestrator = build_orchestrator(session)
        builder = BuilderStub()
        monkeypatch.setattr(
            "app.services.deployment_orchestrator.get_image_builder",
            lambda method: builder,
        )

        artifact_dir = tmp_path / "artifact"
        artifact_dir.mkdir()
        (artifact_dir / "package.json").write_text('{"scripts":{"start":"vite"}}', encoding="utf-8")
        artifact = artifact_response(artifact_path=str(artifact_dir))

        result = await orchestrator.start_deployment(1, artifact)

        assert result["status"] in {"running", "success"}
        assert builder.calls[0]["context_files"]["package.json"].startswith("{")

    asyncio.run(run())


def test_start_deployment_preflights_kubeconfig_before_build(monkeypatch):
    async def run():
        session = SessionStub()
        orchestrator = build_orchestrator(session)
        builder = BuilderStub()

        class PreflightSealos(SealosStub):
            def validate_deploy_permissions(self):
                raise Exception("subscription expired")

        monkeypatch.setattr(
            "app.services.deployment_orchestrator.get_sealos_client",
            lambda kubeconfig=None: PreflightSealos(),
        )
        monkeypatch.setattr(
            "app.services.deployment_orchestrator.get_image_builder",
            lambda method: builder,
        )

        with pytest.raises(RuntimeError, match="Kubeconfig preflight failed"):
            await orchestrator.start_deployment(
                1,
                artifact_response(),
                kubeconfig="test-kubeconfig",
            )

        assert builder.calls == []
        assert session.deployment.status == "failed"
        assert session.deployment.error_type == "KUBECONFIG_PERMISSION_DENIED"
        assert "subscription expired" in session.deployment.error_message

    asyncio.run(run())


def test_start_deployment_detects_database_and_injects_env(monkeypatch):
    async def run():
        session = SessionStub()
        orchestrator = build_orchestrator(session)
        builder = BuilderStub()
        monkeypatch.setattr(
            "app.services.deployment_orchestrator.get_image_builder",
            lambda method: builder,
        )

        artifact = artifact_response(
            context_files={
                "requirements.txt": "fastapi\npsycopg[binary]\nredis\n",
                "main.py": "import psycopg\nimport redis\n",
            },
            runtime=RuntimeInfo(
                start_command="uvicorn main:app --host 0.0.0.0 --port 8000",
                exposed_port=8000,
                healthcheck_path="/health",
                package_manager="pip",
                base_image="python:3.11-slim",
            ),
            required_envs=[
                RequiredEnv(name="DATABASE_URL", required=True),
                RequiredEnv(name="REDIS_URL", required=False),
            ],
        )

        await orchestrator.start_deployment(1, artifact)

        call = orchestrator.sealos_client.create_calls[0]
        assert call["needs_database"] is True
        assert call["database_type"] == "postgresql"
        assert call["external_dependencies"] == ["redis"]
        assert call["env_vars"]["DATABASE_URL"].startswith("postgresql://")
        assert call["env_vars"]["REDIS_URL"].startswith("redis://")
        assert session.deployment.database_name == "app-1-db"

    asyncio.run(run())


def test_health_check_uses_l7_keywords(monkeypatch):
    async def run():
        session = SessionStub()
        orchestrator = build_orchestrator(session)
        healthy = await orchestrator._perform_health_check(
            1,
            "https://app.example.com/health",
            trigger_healing=False,
            expected_keywords=["ok"],
        )

        assert healthy is True
        assert orchestrator.sealos_client.health_calls[0]["expected_keywords"] == ["ok"]
        assert session.deployment.status == "success"

    asyncio.run(run())


def test_parallel_healing_race_returns_first_success(monkeypatch):
    async def run():
        session = SessionStub()
        orchestrator = build_orchestrator(session)
        slow_builder = BuilderStub(delay=0.05)
        fast_builder = BuilderStub(delay=0.0)
        builders = [slow_builder, fast_builder]

        monkeypatch.setattr(
            "app.services.deployment_orchestrator.get_image_builder",
            lambda method: builders.pop(0),
        )

        result = await orchestrator.run_parallel_healing_race(
            deployment_id=1,
            error_logs="build failed",
            failed_stage="BUILD",
        )

        assert result["success"] is True
        assert result["task_id"] == "fast-task"
        assert session.deployment.status == "success"

    asyncio.run(run())
