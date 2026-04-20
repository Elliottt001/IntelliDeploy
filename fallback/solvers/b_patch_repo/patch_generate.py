from __future__ import annotations

from fallback.schemas.plan import DockerSpec, FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.services.template_loader import render_template

from fallback.solvers.a_direct_deploy.command_resolver import build_env_specs, render_env_example
from fallback.solvers.a_direct_deploy.dockerfile_generate import generate_docker_spec

from .patch_apply_plan import split_patch_outputs


def generate_patch_plan(
    request: FallbackRequest,
    classify_response: ClassifyResponse,
    missing_components: list[str],
) -> FallbackPlan:
    patch_items: list[tuple[str, str, str]] = []
    existing_paths = set(request.key_files)
    warnings: list[str] = []
    docker_spec: DockerSpec | None = None

    if "Dockerfile" in missing_components or not classify_response.repo_fact_summary.has_valid_dockerfile:
        docker_spec = generate_docker_spec(request, classify_response)
        patch_items.append(("Dockerfile", docker_spec.dockerfile_content, "Provide a deployment-ready Dockerfile."))

    env_vars = build_env_specs(classify_response)
    if env_vars and ".env.example" in missing_components or (env_vars and ".env.example" not in existing_paths):
        patch_items.append((".env.example", render_env_example(env_vars), "Document required environment variables."))

    if "start_script" in missing_components and docker_spec:
        patch_items.append(
            (
                "start.sh",
                render_template("common", "start.sh.template", {"start_command": docker_spec.start_command}),
                "Provide an explicit startup script for deployment platforms.",
            )
        )

    unsupported = [item for item in missing_components if item not in {"Dockerfile", ".env.example", "start_script", "env_example"}]
    if unsupported:
        warnings.append(f"Unsupported repair targets kept as manual patch suggestions: {', '.join(unsupported)}")

    generated_files, modified_files = split_patch_outputs(patch_items, existing_paths)
    if docker_spec is None and "Dockerfile" in request.key_files:
        docker_spec = generate_docker_spec(request, classify_response)

    deploy_ready = docker_spec is not None and not unsupported and not any(
        env_var.source == "ASSUMED" and env_var.required for env_var in env_vars
    )
    return FallbackPlan(
        decision="B",
        generated_files=generated_files,
        modified_files=modified_files,
        docker_spec=docker_spec,
        env_vars=env_vars,
        artifact_type="STITCHED_PROJECT",
        warnings=warnings,
        summary="Repository kept as the primary base; deployment gaps are repaired via a structured patch plan.",
        deploy_ready=deploy_ready,
        next_action="DEPLOY" if deploy_ready else "MANUAL_REVIEW",
        source_repo_url=classify_response.repo_fact_summary.repo_url,
    )

