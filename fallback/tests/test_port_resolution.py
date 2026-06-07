"""
Regression: 仓库硬证据 > Agent 猜测 > 框架默认 的端口合约。

历史 bug：multi_agent Builder Agent 会把 LLM 猜出来的 target_port 写进
`request.user_intent.constraints.target_port`，并通过 `resolve_container_port`
盖过仓库自带 Dockerfile 的 `EXPOSE`。结果：

- solver 生成的 `docker_spec.exposed_port` = 8080（Agent 猜）
- `target_port_candidates[0]` = 8000（仓库实际 EXPOSE）
- port_validator 报 `TARGET_PORT_MISMATCH` blocking
- 整管线降级到 ARTIFACT_NOT_READY，本来能直接部署的仓库被拦下

修复：`resolve_container_port` 把 `target_port_candidates`（硬证据）
排到 `constraints.target_port`（Agent 猜测）之前。
"""

from __future__ import annotations

from fallback.classifier.classify import classify_fallback_request
from fallback.schemas.request import FallbackRequest
from fallback.solvers.a_direct_deploy.command_resolver import resolve_container_port
from fallback.solvers.router import solve_by_decision
from fallback.validators.validation_pipeline import validate_fallback_plan


def _yacht_like_payload(constraints_target_port: int | None) -> dict:
    """模拟 Yacht：自带 Dockerfile + EXPOSE 8000，Builder Agent 却塞了别的端口。"""
    constraints: dict = {"timeout_seconds": 300}
    if constraints_target_port is not None:
        constraints["target_port"] = constraints_target_port
    return {
        "raw_query": "deploy yacht container manager",
        "user_intent": {
            "target_output_type": "deployable_app",
            "target_app_type": "backend_api",
            "expected_features": [],
            "preferred_language": "go",
            "preferred_framework": "Gin",
            "constraints": constraints,
        },
        "repo_info": {
            "rank": 1,
            "retrieval_score": 0.9,
            "repo_url": "https://github.com/example/yacht-like",
            "default_branch": "main",
            "description": "Yacht-like fullstack container manager",
            "topics": ["docker", "container"],
            "stars": 1200,
            "is_archived": False,
            "last_commit_at": "2026-05-01T00:00:00Z",
        },
        "file_tree": [
            "main.go",
            "go.mod",
            "Dockerfile",
            "README.md",
        ],
        "key_files": {
            "main.go": (
                "package main\n"
                "import \"net/http\"\n"
                "func main() {\n"
                "    http.ListenAndServe(\":8000\", nil)\n"
                "}\n"
            ),
            "go.mod": "module yacht\n\ngo 1.22\n",
            "Dockerfile": (
                "FROM golang:1.22-alpine\n"
                "WORKDIR /app\n"
                "COPY . .\n"
                "RUN go build -o server .\n"
                "EXPOSE 8000\n"
                "CMD [\"./server\"]\n"
            ),
            "README.md": "# Yacht-like\nListens on port 8000.\n",
        },
        "project_id": "proj-port",
        "deployment_id": "dep-port",
        "request_id": "req-port",
    }


def test_repo_evidence_beats_agent_guess() -> None:
    """Builder Agent 猜 8080 时，仓库 EXPOSE 8000 必须赢。"""
    payload = _yacht_like_payload(constraints_target_port=8080)
    request = FallbackRequest.model_validate(payload)
    classify_response = classify_fallback_request(request)

    assert 8000 in classify_response.repo_fact_summary.target_port_candidates, (
        "extract_facts should pick up EXPOSE 8000 from the repo Dockerfile"
    )
    resolved = resolve_container_port(request, classify_response)
    assert resolved == 8000, (
        f"Repo evidence (Dockerfile EXPOSE 8000) must override Agent guess (8080); got {resolved}"
    )


def test_agent_guess_used_when_repo_has_no_port_evidence() -> None:
    """仓库没有任何端口硬证据时，Agent 猜测应当被尊重为兜底。"""
    payload = _yacht_like_payload(constraints_target_port=8080)
    payload["key_files"]["Dockerfile"] = (
        "FROM alpine:3.20\nCMD [\"sleep\", \"infinity\"]\n"
    )
    payload["key_files"]["main.go"] = "package main\nfunc main() {}\n"
    request = FallbackRequest.model_validate(payload)
    classify_response = classify_fallback_request(request)

    assert not classify_response.repo_fact_summary.target_port_candidates
    resolved = resolve_container_port(request, classify_response)
    assert resolved == 8080, f"With no repo evidence, agent guess should win; got {resolved}"


def test_framework_default_when_nothing_known() -> None:
    """两源皆空时回退到框架默认（backend_api → 8000）。"""
    payload = _yacht_like_payload(constraints_target_port=None)
    payload["key_files"]["Dockerfile"] = (
        "FROM alpine:3.20\nCMD [\"sleep\", \"infinity\"]\n"
    )
    payload["key_files"]["main.go"] = "package main\nfunc main() {}\n"
    request = FallbackRequest.model_validate(payload)
    classify_response = classify_fallback_request(request)

    resolved = resolve_container_port(request, classify_response)
    assert resolved == 8000, f"backend_api framework default should be 8000; got {resolved}"


def test_full_pipeline_port_alignment_no_mismatch() -> None:
    """端到端：solver → docker_spec.exposed_port 必须等于 target_port_candidates[0]，
    port_validator 不再报 TARGET_PORT_MISMATCH。这条不变量是 Layer 1 修复的契约。"""
    payload = _yacht_like_payload(constraints_target_port=8080)
    request = FallbackRequest.model_validate(payload)
    classify_response = classify_fallback_request(request)

    plan = solve_by_decision(request, classify_response)
    assert plan.docker_spec is not None
    assert plan.docker_spec.exposed_port == classify_response.repo_fact_summary.target_port_candidates[0]

    validation = validate_fallback_plan(plan, classify_response=classify_response)
    target_port_errors = [
        err for err in validation.errors if err.code == "TARGET_PORT_MISMATCH"
    ]
    assert not target_port_errors, (
        f"port_validator should not flag mismatch when canonical resolver picks repo evidence; "
        f"got: {[err.message for err in target_port_errors]}"
    )
