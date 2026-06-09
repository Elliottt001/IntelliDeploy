from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app import models as _models  # noqa: F401,E402
from app.database import Base, get_db  # noqa: E402
from app.models.user import User  # noqa: E402
from app.routers.intellideploy.natural_language import (  # noqa: E402
    get_natural_language_deploy_service,
    router,
)
from app.services.natural_language_deploy_service import (  # noqa: E402
    NaturalLanguageDeployService,
)
from app.services.retrieval_service import RetrievalService  # noqa: E402
from app.utils.security import get_current_user  # noqa: E402


def test_natural_language_deploy_route_returns_artifact_ready_response():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    user = User(username="router", email="router@example.com", hashed_password="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    app = FastAPI()
    app.include_router(router)

    def override_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_natural_language_deploy_service] = (
        lambda: NaturalLanguageDeployService(
            db,
            retrieval_service=RetrievalService(github_client=EmptyGitHubSearchClient()),
        )
    )

    payload = {
        "natural_language_query": "帮我部署一个 FastAPI API 服务",
        "deploy": False,
        "readme_corpus": [
            {
                "repo_id": "example/fastapi-good",
                "full_name": "example/fastapi-good",
                "description": "Sample FastAPI service",
                "readme_content": "FastAPI service with Dockerfile and uvicorn.",
                "metadata": {
                    "html_url": "https://github.com/example/fastapi-good",
                    "language": "Python",
                    "pushed_at": "2026-04-10T12:00:00Z",
                    "topics": ["fastapi", "api"],
                    "files": ["main.py", "requirements.txt", "Dockerfile"],
                    "file_tree": ["main.py", "requirements.txt", "Dockerfile"],
                    "key_files": {
                        "main.py": "from fastapi import FastAPI\napp = FastAPI()\n",
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
                    },
                },
            }
        ],
    }

    response = TestClient(app).post("/api/nl-deploy/start", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "artifact_ready"
    assert body["selected_repository"]["full_name"] == "example/fastapi-good"
    assert body["artifact"]["deploy_ready"] is True
    assert body["project_id"]
    assert body["deployment_id"]
    assert body["task_id"]


class EmptyGitHubSearchClient:
    async def search_repositories(self, query: str, per_page: int = 20):
        return []

    async def enrich_repository(self, candidate):
        return candidate
