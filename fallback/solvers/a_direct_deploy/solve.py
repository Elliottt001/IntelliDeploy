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

    # ASSUMED + required env 仅作软提示,不阻塞 deploy_ready。
    # 设计原则: plan.deploy_ready 只表达 "plan 本身能生成可部署 artifact"
    # (docker_spec 齐 + 必要补丁齐),其它部署期行为由 validator + HealthCheck +
    # healing 负责。"猜测出的必填 env" 属于运行期判定,如果硬阻塞会:
    #   (1) 违反 Zero-Trust 用户代码原则——逼用户在部署前手动补 env
    #   (2) 与 validator 形成两套真理源——validator 放行了 solver 又秘密否决
    # 真正缺关键 env 时 Sealos 创建后 readinessProbe 会失败,自然进入 healing。
    assumed_required_envs = [ev.name for ev in env_vars if ev.source == "ASSUMED" and ev.required]
    if assumed_required_envs:
        warnings.append(
            "Inferred required env vars (verify before deploy, will not block): "
            + ", ".join(sorted(dict.fromkeys(assumed_required_envs)))
        )

    return FallbackPlan(
        decision="A",
        generated_files=generated_files,
        modified_files=[],
        docker_spec=docker_spec,
        env_vars=env_vars,
        artifact_type="STITCHED_PROJECT",
        warnings=warnings,
        summary="Original repository can be deployed directly after packaging normalization.",
        deploy_ready=True,
        next_action="DEPLOY",
        source_repo_url=classify_response.repo_fact_summary.repo_url,
    )

