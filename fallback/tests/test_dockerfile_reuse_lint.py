from __future__ import annotations

import json
from pathlib import Path

from fallback.schemas.request import FallbackRequest
from fallback.classifier.classify import classify_fallback_request
from fallback.solvers.a_direct_deploy.dockerfile_reuse import reuse_existing_dockerfile


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


def _load_request(name: str) -> FallbackRequest:
    return FallbackRequest.model_validate(json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8")))


def test_reused_dockerfile_is_normalized_for_cloud_runtime() -> None:
    request = _load_request("fastapi_good.json")
    payload = request.model_dump(mode="python")
    payload["key_files"]["Dockerfile"] = (
        "FROM python:3.11-slim\n"
        "COPY requirements.txt ./\n"
        "RUN pip install -r requirements.txt\n"
        "COPY . .\n"
        "EXPOSE 5000\n"
        "CMD uvicorn main:app --reload --port 5000\n"
    )
    request = FallbackRequest.model_validate(payload)
    classify_response = classify_fallback_request(request)

    spec = reuse_existing_dockerfile(request, classify_response)

    assert spec is not None
    assert "WORKDIR /app" in spec.dockerfile_content
    assert "EXPOSE 8000" in spec.dockerfile_content
    assert "--host 0.0.0.0 --port 8000" in spec.dockerfile_content
    assert "--reload" not in spec.dockerfile_content
