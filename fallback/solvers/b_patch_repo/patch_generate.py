from __future__ import annotations

from fallback.schemas.plan import DockerSpec, FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.services.template_loader import render_template

from fallback.solvers.a_direct_deploy.command_resolver import build_env_specs, render_env_example
from fallback.solvers.a_direct_deploy.dockerfile_generate import generate_docker_spec

from .missing_component import classify_missing_component
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
    if env_vars and ".env.example" not in existing_paths:
        patch_items.append((".env.example", render_env_example(env_vars), "Document required environment variables."))

    if "start_script" in missing_components and docker_spec:
        patch_items.append(
            (
                "start.sh",
                render_template("common", "start.sh.template", {"start_command": docker_spec.start_command}),
                "Provide an explicit startup script for deployment platforms.",
            )
        )

    # 把 missing_components 按语义分桶,而不是用反向白名单一票否决:
    #   REPAIR_REQUIRED 缺失且没修出来 -> 真·阻塞部署
    #   REPAIR_SUPPORTED 缺失           -> 上面已经按规则补好(或本来就不需要)
    #   OPTIONAL_OR_INFORMATIONAL       -> 仅以 warning 透出,不阻塞 (典型:
    #                                      docker_compose / healthcheck /
    #                                      build_script / entry_file / dependency_file)
    #   UNKNOWN                         -> 透出 warning 提示扩充分类规则,不阻塞
    # 这是 "探针 + 拼图 + Fallback" 理念在 Decision B 出口的具体落地。
    optional_missing: list[str] = []
    unknown_missing: list[str] = []
    required_unrepaired: list[str] = []
    for item in missing_components:
        bucket = classify_missing_component(item)
        if bucket == "REPAIR_REQUIRED":
            # Dockerfile 是当前唯一的 REPAIR_REQUIRED;只有当 docker_spec 未生成
            # (生成器抛错或不满足前置条件)时才算未修复。
            if item == "Dockerfile" and docker_spec is None:
                required_unrepaired.append(item)
        elif bucket == "REPAIR_SUPPORTED":
            continue
        elif bucket == "OPTIONAL_OR_INFORMATIONAL":
            optional_missing.append(item)
        else:
            unknown_missing.append(item)

    if optional_missing:
        warnings.append(
            "Optional components missing (kept as warnings, not blocking deploy): "
            + ", ".join(sorted(dict.fromkeys(optional_missing)))
        )
    if unknown_missing:
        warnings.append(
            "Unrecognized missing components downgraded to warning; consider extending "
            "classify_missing_component: " + ", ".join(sorted(dict.fromkeys(unknown_missing)))
        )
    if required_unrepaired:
        warnings.append(
            "Required components could not be repaired automatically: "
            + ", ".join(sorted(dict.fromkeys(required_unrepaired)))
        )

    generated_files, modified_files = split_patch_outputs(patch_items, existing_paths)
    if docker_spec is None and "Dockerfile" in request.key_files:
        docker_spec = generate_docker_spec(request, classify_response)

    # ASSUMED + required env 仅作软提示,不阻塞 deploy_ready。详见
    # a_direct_deploy/solve.py 的同名注释——plan.deploy_ready 必须保持
    # "plan 自身能生成可部署 artifact" 的纯结构语义,运行期 env 缺失由
    # validator + HealthCheck + healing 负责;否则会让 validator 放行的
    # 产物被 solver 内的 softer 启发式秘密否决(Yacht 这一类 Decision B
    # 走 ARTIFACT_NOT_READY 的 root cause 就是这里)。
    assumed_required_envs = [ev.name for ev in env_vars if ev.source == "ASSUMED" and ev.required]
    if assumed_required_envs:
        warnings.append(
            "Inferred required env vars (verify before deploy, will not block): "
            + ", ".join(sorted(dict.fromkeys(assumed_required_envs)))
        )

    deploy_ready = docker_spec is not None and not required_unrepaired
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
