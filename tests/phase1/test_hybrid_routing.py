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


@pytest.mark.asyncio
async def test_route_model_receives_schema_and_corrects_invalid_route():
    import json
    from app.agent.routing import choose_route
    from app.core.types import ModelTurn

    class RouteModel:
        def __init__(self):
            self.requests = []

        async def complete(self, messages, tools, model):
            self.requests.append(messages)
            value = ({"route": "build_from_scratch"} if len(self.requests) == 1
                     else route_plan("GENERATE_APP").model_dump(mode="json"))
            return ModelTurn(assistant_message={"content": json.dumps(value)}, calls=[])

    model = RouteModel()
    plan = await choose_route(notes_requirement(), retrieval(rejections=[{"reason": "no candidates"}]), [], [], model)
    assert plan.route == "GENERATE_APP"
    assert len(model.requests) == 2
    payload = json.loads(model.requests[0][1]["content"])
    assert payload["schema"] == RoutePlan.model_json_schema()
    assert "feedback" in json.loads(model.requests[1][1]["content"])


@pytest.mark.asyncio
async def test_invalid_route_model_is_bounded_and_upstream_errors_propagate():
    from app.agent.routing import choose_route
    from app.core.types import ModelTurn

    class InvalidModel:
        count = 0
        async def complete(self, *args):
            self.count += 1
            return ModelTurn(assistant_message={"content": '{"route":"build_from_scratch"}'}, calls=[])

    model = InvalidModel()
    with pytest.raises(ValueError):
        await choose_route(notes_requirement(), retrieval(rejections=[{"reason": "no candidates"}]), [], [], model)
    assert model.count == 3

    class OfflineModel:
        async def complete(self, *args):
            raise RuntimeError("upstream unavailable")

    with pytest.raises(RuntimeError, match="upstream unavailable"):
        await choose_route(notes_requirement(), retrieval(rejections=[{"reason": "no candidates"}]), [], [], OfflineModel())


@pytest.mark.asyncio
async def test_route_payload_compacts_material_without_changing_source_evidence():
    import json, hashlib
    from app.agent.routing import choose_route
    from app.core.types import ModelTurn
    item = source()
    search = retrieval(item,rejections=[{'reason':'missing persistence'}])
    original_readme = 'private notes details ' * 25000
    search.candidates[0].key_files = {'README.md':original_readme,'LICENSE':'MIT','Dockerfile':'FROM node:24\nCMD ["node","app.js"]'}
    search.candidates[0].file_tree = [f'src/file-{i}.ts' for i in range(500)]
    class CapturingModel:
        payload = None
        async def complete(self,messages,tools,model):
            self.payload=json.loads(messages[1]['content'])
            return ModelTurn(assistant_message={'content':route_plan('GENERATE_APP').model_dump_json()})
    model=CapturingModel()
    result=await choose_route(notes_requirement(),search,[profile(item)],[evaluation(item,eligible=False)],model)
    assert result.route=='GENERATE_APP'
    compact=model.payload['candidates'][0]
    assert len(compact['key_files']['README.md']) <= 4096
    assert compact['key_files']['LICENSE']=='MIT'
    assert len(compact['file_tree']) <= 200
    assert compact['file_tree_count']==500
    assert compact['key_file_evidence']['README.md']['sha256']==hashlib.sha256(original_readme.encode()).hexdigest()
    assert search.candidates[0].key_files['README.md']==original_readme
    assert len(search.candidates[0].file_tree)==500
    assert len(json.dumps(model.payload)) < 60000
