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
                                            evidence_refs=["fixed-price:dev-v1"])
    assert finalize_route_with_gaps(route(), gaps, retrieval, profiles, evaluations, req,
        integration_contract=contract).route == "COMPOSE_COMPONENTS"
