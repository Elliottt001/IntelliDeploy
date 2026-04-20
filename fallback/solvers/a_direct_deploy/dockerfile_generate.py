from __future__ import annotations

from fallback.schemas.plan import DockerSpec
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.services.template_loader import render_template

from .command_resolver import (
    resolve_base_image,
    resolve_container_port,
    resolve_healthcheck_path,
    resolve_install_command,
    resolve_start_command,
    resolve_template_family,
)


def generate_docker_spec(request: FallbackRequest, classify_response: ClassifyResponse) -> DockerSpec:
    template_family = resolve_template_family(classify_response)
    port = resolve_container_port(request, classify_response)
    start_command = resolve_start_command(request, classify_response, port=port)
    install_command = resolve_install_command(classify_response) or ""
    base_image = resolve_base_image(classify_response)
    healthcheck_path = resolve_healthcheck_path(request, classify_response)

    dockerfile_content = render_template(
        template_family,
        "Dockerfile.template",
        {
            "base_image": base_image,
            "port": port,
            "start_command": start_command,
            "install_command": install_command,
            "healthcheck_path": healthcheck_path or "/",
        },
    )
    return DockerSpec(
        dockerfile_content=dockerfile_content,
        start_command=start_command,
        exposed_port=port,
        base_image=base_image,
        package_manager=classify_response.repo_fact_summary.package_manager,
        install_command=install_command,
        healthcheck_path=healthcheck_path,
    )

