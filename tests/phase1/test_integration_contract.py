import json

import pytest

from app.agent.integration import build_integration_contract
from app.core.types import AcceptanceItem, ModelTurn, RepoSource, Requirement, RoutePlan
from test_hybrid_routing import profile


def record_search_requirement():
    return Requirement(
        prompt="私有记录与来源搜索",
        acceptance=[
            AcceptanceItem(id="create-private-record", action="创建记录", expected="保存"),
            AcceptanceItem(id="search-with-source", action="搜索", expected="显示来源"),
            AcceptanceItem(id="save-search-result", action="保存结果", expected="进入记录"),
            AcceptanceItem(id="deny-other-user", action="隔离用户", expected="不可读取", private_data=True),
        ],
    )


def component_route():
    return RoutePlan(
        route="COMPOSE_COMPONENTS",
        sources=[
            RepoSource(url="https://github.com/example/records", commit="a" * 40, role="records"),
            RepoSource(url="https://github.com/example/search", commit="b" * 40, role="search"),
        ],
        steps=["integrate"],
        reason="two evidence-bound components",
        confidence="MEDIUM",
    )


def valid_contract_json():
    return {
        "components": [
            {"source": component_route().sources[0].model_dump(), "role": "records", "owned_capabilities": ["identity", "records"]},
            {"source": component_route().sources[1].model_dump(), "role": "search", "owned_capabilities": ["search"]},
        ],
        "service_boundaries": [
            {"provider_role": "search", "consumer_role": "records", "protocol": "HTTP", "data_contract_ref": "search-result-v1"}
        ],
        "identity_owner": "records",
        "data_owners": {"records": "records", "search_index": "search"},
        "api_mappings": [
            {"acceptance_ids": ["search-with-source"], "provider_role": "search", "operation": "search"},
            {"acceptance_ids": ["create-private-record", "save-search-result", "deny-other-user"], "provider_role": "records", "operation": "records"},
        ],
        "shared_capabilities": ["identity"],
        "acceptance_coverage": {
            "create-private-record": ["records"],
            "search-with-source": ["search"],
            "save-search-result": ["records", "search"],
            "deny-other-user": ["records"],
        },
    }


class FakeContractModel:
    def __init__(self, payload):
        self.payload = payload

    async def complete(self, messages, tools, model):
        return ModelTurn(
            assistant_message={"role": "assistant", "content": json.dumps(self.payload)}
        )


@pytest.mark.asyncio
async def test_component_route_requires_complete_integration_contract():
    route = component_route()
    contract = await build_integration_contract(
        record_search_requirement(),
        route,
        [profile(route.sources[0]), profile(route.sources[1])],
        model=FakeContractModel(valid_contract_json()),
    )

    assert contract.identity_owner == "records"
    assert set(contract.acceptance_coverage) == {
        "create-private-record",
        "search-with-source",
        "save-search-result",
        "deny-other-user",
    }
    assert {component.role for component in contract.components} == {"records", "search"}


@pytest.mark.asyncio
async def test_contract_rejects_unselected_provider_and_missing_acceptance():
    payload = valid_contract_json()
    payload["api_mappings"][0]["provider_role"] = "unselected"
    payload["acceptance_coverage"].pop("deny-other-user")
    route = component_route()

    with pytest.raises(ValueError, match="acceptance coverage|selected component role"):
        await build_integration_contract(
            record_search_requirement(),
            route,
            [profile(route.sources[0]), profile(route.sources[1])],
            model=FakeContractModel(payload),
        )


@pytest.mark.asyncio
async def test_contract_rejects_duplicate_source_with_rewritten_role():
    payload = valid_contract_json()
    duplicate = dict(payload["components"][0])
    duplicate["role"] = "audit"
    payload["components"].append(duplicate)
    route = component_route()

    with pytest.raises(ValueError, match="exactly once with its selected role"):
        await build_integration_contract(
            record_search_requirement(),
            route,
            [profile(route.sources[0]), profile(route.sources[1])],
            model=FakeContractModel(payload),
        )
