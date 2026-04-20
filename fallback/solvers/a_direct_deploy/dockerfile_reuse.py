from __future__ import annotations

from fallback.schemas.plan import DockerSpec
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.validators.dockerfile_validator import validate_dockerfile

from .command_resolver import (
    resolve_base_image,
    resolve_container_port,
    resolve_healthcheck_path,
    resolve_install_command,
    resolve_start_command,
)


def reuse_existing_dockerfile(
    request: FallbackRequest,
    classify_response: ClassifyResponse,
) -> DockerSpec | None:
    dockerfile_content = request.key_files.get("Dockerfile")
    if not dockerfile_content:
        return None

    report = validate_dockerfile(dockerfile_content)
    if not report["is_valid"]:
        return None

    port = report["exposed_ports"][0] if report["exposed_ports"] else resolve_container_port(request, classify_response)
    start_command = report["command"] or resolve_start_command(request, classify_response, port=port)
    return DockerSpec(
        dockerfile_content=dockerfile_content,
        start_command=start_command,
        exposed_port=port,
        base_image=report["base_image"] or resolve_base_image(classify_response),
        package_manager=classify_response.repo_fact_summary.package_manager,
        install_command=resolve_install_command(classify_response),
        healthcheck_path=resolve_healthcheck_path(request, classify_response),
    )

