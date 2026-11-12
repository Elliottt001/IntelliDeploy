import pytest

from app.agent.contracts import EvidenceRef, RepositoryProfile
from app.agent.routing import validate_route_plan
from app.core.types import (
    AcceptanceItem,
    CandidateEvaluation,
    CompatibilityReport,
    RepoSource,
    Requirement,
    RetrievalCandidate,
    RetrievalResult,
    RoutePlan,
)


def notes_requirement(prompt="创建并保存私人笔记"):
    return Requirement(
        prompt=prompt,
        acceptance=[
            AcceptanceItem(id="create-note", action="创建笔记", expected="可查看"),
            AcceptanceItem(id="persist-note", action="保存笔记", expected="刷新保留"),
        ],
    )


def source(url="https://github.com/example/notes", commit="a" * 40, role="principal"):
    return RepoSource(url=url, commit=commit, role=role)


def route_plan(route, *sources, confidence="HIGH"):
    return RoutePlan(
        route=route,
        sources=list(sources),
        steps=["validate"],
        reason="test",
        confidence=confidence,
    )


def retrieval(*sources, completed=True, rejections=None):
    return RetrievalResult(
        queries=["notes app"],
        completed=completed,
        candidates=[
            RetrievalCandidate(
                repo_url=item.url,
                commit=item.commit,
                description="notes app",
                stars=1,
                sources=["github"],
                enrichment_status="COMPLETE",
            )
            for item in sources
        ],
        reuse_rejections=rejections or [],
    )


def profile(item, *, project_type="web_app", license_status="ALLOWED"):
    return RepositoryProfile(
        repo_url=item.url,
        commit=item.commit,
        languages=["typescript"],
        frameworks=["Next.js"],
        project_type=project_type,
        dependency_files=["package.json"],
        lock_files=["pnpm-lock.yaml"],
        package_manager="pnpm",
        entrypoints=["app/page.tsx"],
        start_commands=["npm start"],
        build_commands=["npm run build"],
        license_status=license_status,
        compatibility=CompatibilityReport(status="SUPPORTED", runtime="node"),
        evidence_refs=[
            EvidenceRef(
                kind="PROFILE",
                reference="profile",
                digest="f" * 64,
                access="PRIVATE",
            )
        ],
    )


def evaluation(item, *, eligible=True, roles=None):
    return CandidateEvaluation(
        repo_url=item.url,
        match_score=95 if eligible else 40,
        deploy_score=90,
        quality_score=80,
        is_web_app=eligible,
        missing_core=[] if eligible else ["persist-note"],
        evidence={"profile": "bound"},
        compatibility="SUPPORTED",
        reuse_roles=roles or (["complete_application"] if eligible else ["component"]),
        rejection_reasons=[] if eligible else ["missing_core_requirements"],
    )


def test_route_a_requires_complete_application_evidence():
    item = source("https://github.com/example/ui")
    with pytest.raises(ValueError, match="route A requires complete core coverage"):
        validate_route_plan(
            route_plan("DEPLOY_EXISTING", item),
            retrieval(item),
            [profile(item, project_type="library")],
            [evaluation(item, eligible=False)],
            notes_requirement(),
        )


def test_route_d_requires_explicit_generation_or_reuse_rejections():
    item = source()
    with pytest.raises(ValueError, match="generation requires rejection evidence"):
        validate_route_plan(
            route_plan("GENERATE_APP"),
            retrieval(item),
            [profile(item)],
            [evaluation(item)],
            notes_requirement(),
        )


def test_user_requested_generation_can_select_d_without_candidates():
    plan = validate_route_plan(
        route_plan("GENERATE_APP"),
        retrieval(),
        [],
        [],
        notes_requirement("不要复用仓库，直接从零生成私人笔记"),
    )
    assert plan.route == "GENERATE_APP"


def test_route_c_requires_two_distinct_component_roles():
    item = source("https://github.com/example/one", role="records")
    with pytest.raises(ValueError, match="two distinct component roles"):
        validate_route_plan(
            route_plan("COMPOSE_COMPONENTS", item),
            retrieval(item),
            [profile(item)],
            [evaluation(item, eligible=False, roles=["records"])],
            notes_requirement(),
        )


@pytest.mark.parametrize(
    ("plan", "message"),
    [
        (route_plan("MODIFY_EXISTING", source(role="helper")), "principal source"),
        (route_plan("DEPLOY_EXISTING", source(commit="short")), "full commit"),
        (
            route_plan("DEPLOY_EXISTING", source("https://github.com/example/other")),
            "retrieved evidence",
        ),
        (route_plan("DEPLOY_EXISTING", source(), confidence="LOW"), "high confidence"),
    ],
)
def test_route_source_and_confidence_invariants(plan, message):
    item = source()
    with pytest.raises(ValueError, match=message):
        validate_route_plan(
            plan,
            retrieval(item),
            [profile(item)],
            [evaluation(item)],
            notes_requirement(),
        )


def test_blocked_license_and_incomplete_search_are_rejected():
    item = source()
    with pytest.raises(ValueError, match="search is incomplete"):
        validate_route_plan(
            route_plan("DEPLOY_EXISTING", item),
            retrieval(item, completed=False),
            [profile(item)],
            [evaluation(item)],
            notes_requirement(),
        )
    with pytest.raises(ValueError, match="allowed license"):
        validate_route_plan(
            route_plan("DEPLOY_EXISTING", item),
            retrieval(item),
            [profile(item, license_status="BLOCKED")],
            [evaluation(item)],
            notes_requirement(),
        )
