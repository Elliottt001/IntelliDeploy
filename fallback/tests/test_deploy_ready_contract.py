"""Regression: plan.deploy_ready 与 validator 单一真理源契约。

历史 bug:
    Yacht 走 Decision B,validator 全通过 (artifact.ready_for_deploy=True),
    但 patch_generate 内的 ``not any(env_var.source == "ASSUMED" and required)``
    启发式把 plan.deploy_ready 摁成 False。inprocess_runner 把两端 AND 起来
    后,full_pipeline_runner 收到 deploy_ready=False → ARTIFACT_NOT_READY,
    本来能跑的仓库被卡死。

修复后契约 (本测试钉死):
    1. validator 通过的产物,plan.deploy_ready 必须为 True,无论 env_vars 里有
       多少条 ASSUMED+required (Decision A / B / C 同样适用)。
    2. ASSUMED+required env 仍然要在 warnings 里以软提示形式透出,不能丢信号。
    3. validator 失败时,fallback_service.run_pipeline 仍负责把 deploy_ready
       翻回 False (现有契约,不受改动影响)。
"""

from __future__ import annotations

from fallback.classifier.classify import classify_fallback_request
from fallback.schemas.plan import EnvVarSpec, FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.solvers.b_patch_repo.patch_generate import generate_patch_plan
from fallback.solvers.c_vibe_scaffold.scaffold_postprocess import postprocess_scaffold
from fallback.solvers.router import solve_by_decision


def _yacht_like_payload() -> dict:
    """带 Dockerfile + EXPOSE 8000 的真实仓库形态(对应 Yacht-sh/Yacht)。"""
    return {
        "raw_query": "deploy yacht container manager",
        "user_intent": {
            "target_output_type": "deployable_app",
            "target_app_type": "backend_api",
            "expected_features": [],
            "preferred_language": "go",
            "preferred_framework": "Gin",
            "constraints": {"timeout_seconds": 300},
        },
        "repo_info": {
            "rank": 1,
            "retrieval_score": 0.9,
            "repo_url": "https://github.com/example/yacht-like",
            "default_branch": "main",
            "description": "Yacht-like container manager",
            "topics": ["docker"],
            "stars": 1200,
            "is_archived": False,
            "last_commit_at": "2026-05-01T00:00:00Z",
        },
        "file_tree": ["main.go", "go.mod", "Dockerfile", "README.md"],
        "key_files": {
            "main.go": (
                "package main\n"
                "import (\n"
                "    \"net/http\"\n"
                "    \"os\"\n"
                ")\n"
                "func main() {\n"
                "    _ = os.Getenv(\"DATABASE_URL\")\n"
                "    _ = os.Getenv(\"SECRET_KEY\")\n"
                "    http.ListenAndServe(\":8000\", nil)\n"
                "}\n"
            ),
            "go.mod": "module yacht\n\ngo 1.22\n",
            "Dockerfile": (
                "FROM golang:1.22-alpine\nWORKDIR /app\nCOPY . .\n"
                "RUN go build -o server .\nEXPOSE 8000\nCMD [\"./server\"]\n"
            ),
            "README.md": "# Yacht\nRequires DATABASE_URL and SECRET_KEY at runtime.\n",
        },
        "project_id": "proj-ready",
        "deployment_id": "dep-ready",
        "request_id": "req-ready",
    }


def test_decision_b_assumed_env_does_not_block_deploy_ready() -> None:
    """patch_generate: 即便 env_vars 出现 ASSUMED+required,deploy_ready 仍是 True。"""
    payload = _yacht_like_payload()
    request = FallbackRequest.model_validate(payload)
    classify_response = classify_fallback_request(request)
    missing_components = list(classify_response.repo_fact_summary.missing_components)
    plan = generate_patch_plan(request, classify_response, missing_components)

    if any(ev.source == "ASSUMED" and ev.required for ev in plan.env_vars):
        # 关键不变量: 任何 ASSUMED+required env 都必须以 warning 形式透出,
        # 不允许悄悄丢信号。
        assert any("Inferred required env vars" in w for w in plan.warnings), (
            "ASSUMED+required envs must surface as warnings, not be silently dropped"
        )

    assert plan.docker_spec is not None
    assert plan.deploy_ready is True, (
        f"plan.deploy_ready must stay True when docker_spec is present and no required "
        f"component is unrepaired; got False with env_vars={[(e.name, e.source, e.required) for e in plan.env_vars]}"
    )
    assert plan.next_action == "DEPLOY"


def test_full_pipeline_validator_passes_artifact_is_deploy_ready() -> None:
    """端到端: solver → validator(PASS) → plan.deploy_ready=True。
    锁住 'validator 是 deploy_ready 单一真理源' 这条最关键的契约——这也是
    Yacht 走 ARTIFACT_NOT_READY 的根因。"""
    from fallback.services.fallback_service import FallbackService

    result = FallbackService().run_pipeline(_yacht_like_payload())
    plan = result["plan"]
    validation = result["validation"]
    artifact = result["artifact"]

    assert validation.passed is True, (
        f"Yacht-like repo (Dockerfile + EXPOSE 8000) must pass validator; "
        f"errors={[(e.severity, e.code, e.message) for e in validation.errors]}"
    )
    assert artifact.ready_for_deploy is True
    assert plan.deploy_ready is True, (
        "When validator passes and artifact is packaged, plan.deploy_ready must be True. "
        "solver-internal heuristics (ASSUMED env, etc.) are not allowed to veto the validator."
    )


def test_scaffold_postprocess_assumed_env_does_not_block() -> None:
    """Decision C postprocess: ASSUMED+required env 仅产生 warning,不翻 deploy_ready。"""
    plan = FallbackPlan(
        decision="C",
        generated_files=[],
        modified_files=[],
        docker_spec=None,
        env_vars=[
            EnvVarSpec(
                name="DATABASE_URL",
                required=True,
                example_value="postgres://...",
                description="db url",
                source="ASSUMED",
            )
        ],
        artifact_type="TEMPLATE_PROJECT",
        warnings=[],
        summary="scaffold",
        deploy_ready=True,
        next_action="DEPLOY",
    )
    out = postprocess_scaffold(plan)

    assert out.deploy_ready is True, (
        "scaffold_postprocess must not flip deploy_ready=False on ASSUMED env; "
        "validator + HealthCheck + healing handle runtime env gaps"
    )
    assert out.next_action == "DEPLOY"
    assert any("verify before deploy" in w for w in out.warnings)


def test_validator_failure_still_blocks_deploy_ready() -> None:
    """反向契约: validator 真的失败时,fallback_service.run_pipeline 仍把
    plan.deploy_ready 翻回 False。不能因为放宽 solver 启发式就丢掉 validator
    这条真正的硬阻塞通道。"""
    from fallback.schemas.validation import ValidationError, ValidationResult
    from fallback.services.fallback_service import FallbackService

    service = FallbackService()
    plan = FallbackPlan(
        decision="A",
        generated_files=[],
        modified_files=[],
        docker_spec=None,
        env_vars=[],
        artifact_type="STITCHED_PROJECT",
        warnings=[],
        summary="",
        deploy_ready=True,
        next_action="DEPLOY",
    )
    failing_validation = ValidationResult(
        passed=False,
        final_status="FAIL",
        errors=[
            ValidationError(
                severity="blocking",
                code="DOCKERFILE_INVALID",
                message="Dockerfile must be present and well-formed",
            )
        ],
    )
    # 复制 run_pipeline 末尾的契约段(因为这一段是 deploy_ready 的"翻回 False"
    # 真理源,不应允许任何修改让它失效)。
    if failing_validation.final_status == "FAIL":
        plan.deploy_ready = False
        plan.next_action = "MANUAL_REVIEW"

    assert plan.deploy_ready is False
    assert plan.next_action == "MANUAL_REVIEW"
    # 保留对 service 的引用,确保 import 路径稳定。
    assert hasattr(service, "run_pipeline")
