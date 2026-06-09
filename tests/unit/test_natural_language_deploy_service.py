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
from app.models.intellideploy.generation_task import GenerationTask  # noqa: E402
from app.models.intellideploy.project import Project  # noqa: E402
from app.models.user import User  # noqa: E402
from app.schemas.natural_language_deploy import NaturalLanguageDeployRequest  # noqa: E402
from app.schemas.retrieval import ReadmeCorpusItem  # noqa: E402
from app.services.natural_language_deploy_service import (  # noqa: E402
    NaturalLanguageDeployService,
)
from app.services.retrieval_service import RetrievalService  # noqa: E402


class EmptyGitHubSearchClient:
    async def search_repositories(self, query: str, per_page: int = 20):
        return []

    async def enrich_repository(self, candidate):
        return candidate


def fastapi_readme_corpus() -> list[ReadmeCorpusItem]:
    return [
        ReadmeCorpusItem(
            repo_id="example/fastapi-good",
            full_name="example/fastapi-good",
            description="Sample FastAPI service",
            readme_content=(
                "FastAPI service with /health endpoint, requirements.txt, "
                "Dockerfile, and uvicorn start command."
            ),
            metadata={
                "html_url": "https://github.com/example/fastapi-good",
                "stars": 42,
                "language": "Python",
                "pushed_at": "2026-04-10T12:00:00Z",
                "topics": ["fastapi", "api"],
                "files": ["main.py", "requirements.txt", "Dockerfile", "README.md"],
                "file_tree": ["main.py", "requirements.txt", "Dockerfile", "README.md"],
                "key_files": {
                    "main.py": (
                        "from fastapi import FastAPI\n"
                        "app = FastAPI()\n\n"
                        "@app.get('/health')\n"
                        "def health():\n"
                        "    return {'ok': True}\n"
                    ),
                    "requirements.txt": "fastapi==0.115.0\nuvicorn==0.30.0\n",
                    "Dockerfile": (
                        "FROM python:3.11-slim\n"
                        "WORKDIR /app\n"
                        "COPY requirements.txt ./\n"
                        "RUN pip install -r requirements.txt\n"
                        "COPY . .\n"
                        "EXPOSE 8000\n"
                        "CMD uvicorn main:app --host 0.0.0.0 --port 8000\n"
                    ),
                    "README.md": "# FastAPI Service\n",
                },
            },
        )
    ]


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


def create_user(db_session, username: str = "tester") -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        hashed_password="not-used",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_natural_language_request_creates_artifact_ready_deployment(db_session):
    user = create_user(db_session)
    retrieval_service = RetrievalService(github_client=EmptyGitHubSearchClient())
    service = NaturalLanguageDeployService(
        db_session,
        retrieval_service=retrieval_service,
    )
    request = NaturalLanguageDeployRequest(
        natural_language_query="Deploy a FastAPI API service",
        deploy=False,
        readme_corpus=fastapi_readme_corpus(),
    )

    response = await service.run(request, current_user=user)

    assert response.status == "artifact_ready"
    assert response.selected_repository is not None
    assert response.selected_repository.full_name == "example/fastapi-good"
    assert response.project_id is not None
    assert response.deployment_id is not None
    assert response.task_id is not None
    assert response.artifact is not None
    assert response.artifact.deploy_ready is True
    assert response.artifact.runtime.exposed_port == 8000

    assert db_session.query(Project).count() == 1
    assert db_session.query(Deployment).count() == 1
    assert db_session.query(GenerationTask).count() == 1


@pytest.mark.asyncio
async def test_natural_language_request_deploys_when_kubeconfig_is_present(db_session):
    user = create_user(db_session, username="deployer")
    deploy_calls: list[dict] = []

    class FakeOrchestrator:
        async def start_deployment(self, *, deployment_id, artifact, kubeconfig):
            deploy_calls.append(
                {
                    "deployment_id": deployment_id,
                    "artifact_ready": artifact.deploy_ready,
                    "kubeconfig": kubeconfig,
                }
            )
            return {"status": "running", "access_url": "https://example.test"}

    service = NaturalLanguageDeployService(
        db_session,
        retrieval_service=RetrievalService(github_client=EmptyGitHubSearchClient()),
        orchestrator_factory=lambda kubeconfig: FakeOrchestrator(),
    )
    request = NaturalLanguageDeployRequest(
        natural_language_query="Deploy a FastAPI API service",
        deploy=True,
        kubeconfig="apiVersion: v1\nclusters: []\n",
        readme_corpus=fastapi_readme_corpus(),
    )

    response = await service.run(request, current_user=user)

    assert response.status == "deployed"
    assert response.deployment_result == {
        "status": "running",
        "access_url": "https://example.test",
    }
    assert len(deploy_calls) == 1
    assert deploy_calls[0]["artifact_ready"] is True
    assert deploy_calls[0]["kubeconfig"] == "apiVersion: v1\nclusters: []\n"
