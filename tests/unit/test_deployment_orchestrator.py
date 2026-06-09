from __future__ import annotations

import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app import models as _models  # noqa: F401,E402
from app.database import Base  # noqa: E402
from app.models.intellideploy.deployment import Deployment  # noqa: E402
from app.models.intellideploy.project import Project  # noqa: E402
from app.schemas.fallback import (  # noqa: E402
    ArtifactType,
    GetArtifactResultResponse,
    RuntimeInfo,
)
from app.services import deployment_orchestrator as orchestrator_module  # noqa: E402
from app.services.deployment_orchestrator import (  # noqa: E402
    DeploymentOrchestrator,
    collect_artifact_context_files,
)


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_collect_artifact_context_files_includes_generated_source(tmp_path):
    artifact_path = tmp_path / "artifact"
    artifact_path.mkdir()
    (artifact_path / "Dockerfile").write_text("FROM node:20-alpine\n", encoding="utf-8")
    (artifact_path / "package.json").write_text('{"scripts":{"start":"vite"}}', encoding="utf-8")
    src = artifact_path / "src"
    src.mkdir()
    (src / "App.jsx").write_text("export default function App() { return null }", encoding="utf-8")

    context_files = collect_artifact_context_files(str(artifact_path))

    assert context_files["package.json"] == '{"scripts":{"start":"vite"}}'
    assert context_files["src/App.jsx"].startswith("export default")
    assert "Dockerfile" not in context_files


@pytest.mark.asyncio
async def test_start_deployment_falls_back_to_source_mount_when_image_build_fails(
    db_session, monkeypatch, tmp_path
):
    project = Project(
        name="generated",
        repo_url="generated://test",
        repo_owner="generated",
        repo_name="generated",
        visibility="generated",
        default_branch="main",
        user_id=1,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    deployment = Deployment(
        project_id=project.id,
        status="pending",
        runtime_name="generated-app",
    )
    db_session.add(deployment)
    db_session.commit()
    db_session.refresh(deployment)

    artifact_path = tmp_path / "artifact"
    artifact_path.mkdir()
    (artifact_path / "package.json").write_text('{"scripts":{"start":"node server.js"}}')
    (artifact_path / "server.js").write_text("console.log('ready')")

    artifact = GetArtifactResultResponse(
        task_id="task-1",
        artifact_type=ArtifactType.TEMPLATE_PROJECT,
        artifact_path=str(artifact_path),
        dockerfile_content="FROM node:20-alpine\n",
        runtime=RuntimeInfo(
            base_image="node:20-alpine",
            install_command="npm ci",
            start_command="node server.js",
            exposed_port=8000,
        ),
        required_envs=[],
        deploy_ready=True,
    )

    class FakeBuilder:
        async def build_image(self, **kwargs):
            return {"status": "failed", "error": "docker unavailable"}

    class FakeSealosClient:
        def __init__(self):
            self.calls = []

        async def create_source_app(self, **kwargs):
            self.calls.append(kwargs)
            return {
                "app_id": kwargs["name"],
                "namespace": "ns-test",
                "ingress_domain": "generated.example.test",
                "access_url": "https://generated.example.test",
            }

    monkeypatch.setattr(
        orchestrator_module,
        "get_image_builder",
        lambda method: FakeBuilder(),
    )

    sealos_client = FakeSealosClient()
    monkeypatch.setattr(
        orchestrator_module,
        "get_sealos_client",
        lambda kubeconfig=None: sealos_client,
    )
    orchestrator = DeploymentOrchestrator(db_session, kubeconfig="kubeconfig")
    orchestrator.sealos_client = sealos_client

    result = await orchestrator.start_deployment(
        deployment_id=deployment.id,
        artifact=artifact,
        kubeconfig="kubeconfig",
    )

    assert result["status"] == "running"
    assert result["source_deploy"] is True
    assert sealos_client.calls[0]["runtime_image"] == "node:20-alpine"
    assert sealos_client.calls[0]["install_command"] == "npm install --omit=dev"
    assert "server.js" in sealos_client.calls[0]["source_files"]


@pytest.mark.asyncio
async def test_start_deployment_fails_when_source_mount_fallback_fails(
    db_session, monkeypatch, tmp_path
):
    project = Project(
        name="generated",
        repo_url="generated://test",
        repo_owner="generated",
        repo_name="generated",
        visibility="generated",
        default_branch="main",
        user_id=1,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    deployment = Deployment(
        project_id=project.id,
        status="pending",
        runtime_name="generated-app",
    )
    db_session.add(deployment)
    db_session.commit()
    db_session.refresh(deployment)

    artifact_path = tmp_path / "artifact"
    artifact_path.mkdir()
    (artifact_path / "package.json").write_text('{"scripts":{"start":"node server.js"}}')
    (artifact_path / "server.js").write_text("console.log('ready')")

    artifact = GetArtifactResultResponse(
        task_id="task-1",
        artifact_type=ArtifactType.TEMPLATE_PROJECT,
        artifact_path=str(artifact_path),
        dockerfile_content="FROM node:20-alpine\n",
        runtime=RuntimeInfo(
            base_image="node:20-alpine",
            install_command="npm ci",
            start_command="node server.js",
            exposed_port=8000,
        ),
        required_envs=[],
        deploy_ready=True,
    )

    class FakeBuilder:
        async def build_image(self, **kwargs):
            return {"status": "failed", "error": "docker unavailable"}

    class FakeSealosClient:
        async def create_source_app(self, **kwargs):
            raise Exception("deploy: Forbidden")

    monkeypatch.setattr(
        orchestrator_module,
        "get_image_builder",
        lambda method: FakeBuilder(),
    )

    sealos_client = FakeSealosClient()
    monkeypatch.setattr(
        orchestrator_module,
        "get_sealos_client",
        lambda kubeconfig=None: sealos_client,
    )
    orchestrator = DeploymentOrchestrator(db_session, kubeconfig="kubeconfig")
    orchestrator.sealos_client = sealos_client

    with pytest.raises(Exception, match="source deployment fallback failed"):
        await orchestrator.start_deployment(
            deployment_id=deployment.id,
            artifact=artifact,
            kubeconfig="kubeconfig",
        )

    db_session.refresh(deployment)
    assert deployment.status == "failed"
    assert "docker unavailable" in deployment.error_message
    assert "deploy: Forbidden" in deployment.error_message


@pytest.mark.asyncio
async def test_start_deployment_preflights_kubeconfig_before_build(
    db_session, monkeypatch
):
    project = Project(
        name="generated",
        repo_url="generated://test",
        repo_owner="generated",
        repo_name="generated",
        visibility="generated",
        default_branch="main",
        user_id=1,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    deployment = Deployment(
        project_id=project.id,
        status="pending",
        runtime_name="generated-app",
    )
    db_session.add(deployment)
    db_session.commit()
    db_session.refresh(deployment)

    artifact = GetArtifactResultResponse(
        task_id="task-1",
        artifact_type=ArtifactType.TEMPLATE_PROJECT,
        artifact_path=None,
        dockerfile_content="FROM node:20-alpine\n",
        runtime=RuntimeInfo(
            base_image="node:20-alpine",
            install_command="npm ci",
            start_command="node server.js",
            exposed_port=8000,
        ),
        required_envs=[],
        deploy_ready=True,
    )

    class FakeBuilder:
        called = False

        async def build_image(self, **kwargs):
            self.called = True
            return {"status": "success", "image": "demo:latest"}

    class FakeSealosClient:
        def validate_deploy_permissions(self):
            raise Exception("missing create permission: deployments.apps")

    fake_builder = FakeBuilder()
    monkeypatch.setattr(
        orchestrator_module,
        "get_image_builder",
        lambda method: fake_builder,
    )
    monkeypatch.setattr(
        orchestrator_module,
        "get_sealos_client",
        lambda kubeconfig=None: FakeSealosClient(),
    )

    orchestrator = DeploymentOrchestrator(db_session, kubeconfig="kubeconfig")
    healing_called = False

    async def fake_trigger_healing_if_needed(*args, **kwargs):
        nonlocal healing_called
        healing_called = True

    monkeypatch.setattr(
        orchestrator,
        "_trigger_healing_if_needed",
        fake_trigger_healing_if_needed,
    )

    with pytest.raises(Exception, match="Kubeconfig preflight failed"):
        await orchestrator.start_deployment(
            deployment_id=deployment.id,
            artifact=artifact,
            kubeconfig="kubeconfig",
        )

    db_session.refresh(deployment)
    assert fake_builder.called is False
    assert deployment.status == "failed"
    assert deployment.error_type == "KUBECONFIG_PERMISSION_DENIED"
    assert "deployments.apps" in deployment.error_message
    assert healing_called is False
