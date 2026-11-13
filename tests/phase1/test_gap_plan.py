import pytest
from algorithm_plan_fixtures import requirement, profile, route, source
from app.agent.ranking import rank_candidate
from app.agent.gaps import deterministic_gap_plan, validate_gap_plan, finalize_route_with_gaps


def test_missing_acceptance_is_local_and_satisfied_work_is_preserved():
    req = requirement()
    facts = profile(source(), covered=["save"])
    gaps = deterministic_gap_plan(req, route(), [facts], [rank_candidate(facts, req)])
    by_id = {g.acceptance_id: g for g in gaps.gaps}
    assert by_id["save"].status == "SATISFIED"
    assert by_id["search"].status == "LOCAL_REPAIR"
    assert "save" in by_id["search"].preserve


def test_heuristic_matching_is_not_verified_coverage():
    req = requirement()
    facts = profile(source())
    gaps = deterministic_gap_plan(req, route(), [facts], [rank_candidate(facts, req)])
    assert all(g.status == "LOCAL_REPAIR" for g in gaps.gaps)


def test_unknown_provider_or_acceptance_is_rejected():
    req = requirement()
    facts = profile(source(), covered=["save"])
    gaps = deterministic_gap_plan(req, route(), [facts], [rank_candidate(facts, req)])
    gaps.gaps[0].acceptance_id = "invented"
    with pytest.raises(ValueError, match="acceptance"):
        validate_gap_plan(gaps, req, route(), [facts], [])


def test_provider_requires_contract_and_known_cheaper_cost():
    from app.agent.contracts import CompositionCost, IntegrationContract
    from app.core.types import RetrievalCandidate, RetrievalResult
    principal, provider = source(), source("search", "b")
    req = requirement()
    profiles = [profile(principal, ["save"]), profile(provider, ["search"])]
    evaluations = [rank_candidate(p, req) for p in profiles]
    gaps = deterministic_gap_plan(req, route(), profiles, evaluations)
    gap = gaps.gaps[1]
    gap.status, gap.provider_source, gap.evidence_refs = "COMPONENT_SOURCE", provider, ["coverage:search"]
    retrieval = RetrievalResult(completed=True, queries=["notes"], candidates=[
        RetrievalCandidate(repo_url=s.url, commit=s.commit) for s in (principal, provider)])
    contract = IntegrationContract(
        components=[{"source": s, "role": s.role} for s in (principal, provider)],
        identity_owner="principal", data_owners={"notes": "principal"},
        api_mappings=[{"acceptance_ids": ["save"], "provider_role": "principal", "operation": "save"},
                      {"acceptance_ids": ["search"], "provider_role": "search", "operation": "search"}],
        acceptance_coverage={"save": ["principal"], "search": ["search"]})
    assert finalize_route_with_gaps(route(), gaps.model_copy(deep=True), retrieval, profiles,
        evaluations, req, integration_contract=contract).route == "MODIFY_EXISTING"
    gaps.composition_cost = CompositionCost(local_units=1000, composition_units=500,
                                            evidence_refs=["price:dev-v1", "coverage:search"])
    assert finalize_route_with_gaps(route(), gaps, retrieval, profiles, evaluations, req,
        integration_contract=contract).route == "COMPOSE_COMPONENTS"


@pytest.mark.asyncio
async def test_invalid_integration_contract_never_persists_route_c():
    import json
    from app.agent.contracts import AlgorithmCheckpoint
    from app.agent.orchestrator import AlgorithmOrchestrator
    from app.core.types import ModelTurn, RetrievalCandidate, RetrievalResult
    req = requirement()
    principal, provider = source(), source("search", "b")
    profiles = [profile(principal, ["save"]), profile(provider, ["search"])]
    evaluations = [rank_candidate(p, req) for p in profiles]
    retrieval = RetrievalResult(queries=["notes"], completed=True,
        candidates=[RetrievalCandidate(repo_url=s.url, commit=s.commit) for s in (principal, provider)])
    class Execution:
        def __init__(self):
            self.state = AlgorithmCheckpoint.empty(1, "hybrid")
            self.saved_routes = []
        def algorithm_checkpoint(self):
            return self.state.model_copy(deep=True)
        def save_algorithm_checkpoint(self, checkpoint):
            self.state = checkpoint.model_copy(deep=True)
            self.saved_routes.append(checkpoint.route.route)
        def model(self, phase):
            return self
        async def complete(self, messages, tools, model):
            if model == "gap-plan":
                payload = json.loads(messages[1]["content"])["base"]
                payload["gaps"][1].update(status="COMPONENT_SOURCE", provider_source=provider.model_dump(),
                    evidence_refs=["coverage:search"])
                payload["composition_cost"] = {"local_units": 1000, "composition_units": 100,
                                                 "evidence_refs": ["price:dev-v1", "coverage:search"]}
            else:
                payload = {}
            return ModelTurn(assistant_message={"role": "assistant", "content": json.dumps(payload)})
    execution = Execution()
    final, gaps = await AlgorithmOrchestrator(execution).plan_gaps_and_finalize_route(
        req, route(), retrieval, profiles, evaluations)
    assert final.route == "MODIFY_EXISTING"
    assert execution.saved_routes == ["MODIFY_EXISTING"]
    assert gaps.gaps[1].status == "LOCAL_REPAIR"


def test_a_without_bound_coverage_becomes_local_b_instead_of_rewriting_business():
    from app.core.types import RetrievalCandidate, RetrievalResult
    s = source("complete_application")
    facts = profile(s)
    req = requirement()
    provisional = route("DEPLOY_EXISTING", [s])
    gaps = deterministic_gap_plan(req, provisional, [facts], [rank_candidate(facts, req)])
    retrieval = RetrievalResult(completed=True, queries=["notes"], candidates=[RetrievalCandidate(repo_url=s.url, commit=s.commit)])
    final = finalize_route_with_gaps(provisional, gaps, retrieval, [facts], [rank_candidate(facts, req)], req)
    assert final.route == "MODIFY_EXISTING"
    assert final.sources[0].role == "principal"


@pytest.mark.asyncio
async def test_model_cannot_schedule_rewrite_of_already_satisfied_acceptance():
    import json
    from app.agent.gaps import plan_acceptance_gaps
    from app.core.types import ModelTurn
    req = requirement()
    facts = profile(source(), ["save"])
    class Model:
        async def complete(self, messages, tools, model):
            payload = json.loads(messages[1]["content"])["base"]
            payload["gaps"][0].update(status="LOCAL_REPAIR", required_changes=["rewrite notes"])
            payload["gaps"][1]["preserve"] = []
            return ModelTurn(assistant_message={"role": "assistant", "content": json.dumps(payload)})
    gaps = await plan_acceptance_gaps(req, route(), [facts], [rank_candidate(facts, req)], Model())
    assert gaps.gaps[0].status == "SATISFIED"
    assert "save" in gaps.gaps[1].preserve


def test_composition_cost_rejects_unknown_or_stale_price_evidence():
    from app.agent.contracts import CompositionCost
    from app.agent.gaps import cost_is_supported
    cost = CompositionCost(local_units=1000, composition_units=100, evidence_refs=["invented-price"])
    assert not cost_is_supported(cost, [profile(source(), ["save"])])
