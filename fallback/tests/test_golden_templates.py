from __future__ import annotations

import json
from pathlib import Path

from fallback.classifier.classify import classify_fallback_request
from fallback.schemas.request import FallbackRequest
from fallback.solvers.a_direct_deploy.command_resolver import resolve_template_family
from fallback.solvers.c_vibe_scaffold.scaffold_generate import build_template_project
from fallback.validators.dockerfile_validator import validate_dockerfile


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


def _base_payload() -> dict:
    payload = json.loads((FIXTURE_DIR / "unusable_repo.json").read_text(encoding="utf-8"))
    payload["repo_info"]["repo_url"] = "https://github.com/example/empty"
    payload["file_tree"] = []
    payload["key_files"] = {}
    return payload


def _request_for(framework: str, language: str, app_type: str = "backend_api") -> tuple[FallbackRequest, object]:
    payload = _base_payload()
    payload["raw_query"] = f"create {framework} app"
    payload["user_intent"]["preferred_framework"] = framework
    payload["user_intent"]["preferred_language"] = language
    payload["user_intent"]["target_app_type"] = app_type
    request = FallbackRequest.model_validate(payload)
    return request, classify_fallback_request(request)


def test_resolver_covers_expanded_golden_template_families() -> None:
    cases = [
        ("Spring Boot", "java", "backend_api", "java_springboot"),
        ("Go Gin", "go", "backend_api", "go_gin"),
        ("Django", "python", "backend_api", "python_django"),
        ("Vue", "javascript", "frontend_web", "vue_vite"),
        ("", "", "static_site", "static_site"),
        ("", "python", "automation_tool", "python_worker"),
    ]

    for framework, language, app_type, expected in cases:
        _request, classify_response = _request_for(framework, language, app_type)
        assert resolve_template_family(classify_response) == expected


def test_expanded_golden_templates_materialize_valid_docker_specs() -> None:
    cases = [
        ("Spring Boot", "java", "backend_api"),
        ("Go Gin", "go", "backend_api"),
        ("Django", "python", "backend_api"),
        ("Vue", "javascript", "frontend_web"),
        ("", "", "static_site"),
        ("", "python", "automation_tool"),
    ]

    for framework, language, app_type in cases:
        request, classify_response = _request_for(framework, language, app_type)
        family = resolve_template_family(classify_response)
        plan = build_template_project(
            request,
            classify_response,
            template_family=family,
            summary=f"test {family}",
        )

        assert any(file.path == "Dockerfile" for file in plan.generated_files)
        assert plan.docker_spec is not None
        report = validate_dockerfile(plan.docker_spec.dockerfile_content)
        assert report["is_valid"], (family, report)
