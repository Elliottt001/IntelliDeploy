from __future__ import annotations

from fallback.schemas.plan import FallbackPlan, GeneratedFile
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse

from .command_resolver import build_env_specs, render_env_example
from .dockerfile_generate import generate_docker_spec
from .dockerfile_reuse import reuse_existing_dockerfile


def solve_direct_deploy(request: FallbackRequest, classify_response: ClassifyResponse) -> FallbackPlan:
    docker_spec = reuse_existing_dockerfile(request, classify_response)
    generated_files: list[GeneratedFile] = []
    warnings = list(classify_response.repo_fact_summary.warnings)

    if docker_spec is None:
        docker_spec = generate_docker_spec(request, classify_response)
        generated_files.append(GeneratedFile(path="Dockerfile", content=docker_spec.dockerfile_content))
        warnings.append("Repository Dockerfile missing or not reusable; generated a standard deployment Dockerfile.")

    env_vars = build_env_specs(classify_response)
    if env_vars and ".env.example" not in request.key_files:
        generated_files.append(GeneratedFile(path=".env.example", content=render_env_example(env_vars)))

    deploy_ready = not any(env_var.source == "ASSUMED" and env_var.required for env_var in env_vars)
    return FallbackPlan(
        decision="A",
        generated_files=generated_files,
        modified_files=[],
        docker_spec=docker_spec,
        env_vars=env_vars,
        artifact_type="STITCHED_PROJECT",
        warnings=warnings,
        summary="Original repository can be deployed directly after packaging normalization.",
        deploy_ready=deploy_ready,
        next_action="DEPLOY" if deploy_ready else "MANUAL_REVIEW",
        source_repo_url=classify_response.repo_fact_summary.repo_url,
    )

