import json

import pytest

from app.agent.query import deterministic_queries, plan_queries
from app.core.types import AcceptanceItem, ModelTurn, Requirement


def requirement(prompt: str, *acceptance: AcceptanceItem) -> Requirement:
    return Requirement(prompt=prompt, acceptance=list(acceptance))


def test_deterministic_query_plan_expands_chinese_business_terms():
    value = requirement(
        "做一个多人活动报名应用，管理员发布活动，用户报名后联系方式保持私有",
        AcceptanceItem(
            id="publish", action="发布活动", expected="管理员创建活动"
        ),
        AcceptanceItem(
            id="private",
            action="保护联系方式",
            expected="其他用户不可读取",
            private_data=True,
        ),
    )

    plan = deterministic_queries(value)

    assert plan.original == value.prompt
    assert "event registration web app" in plan.github_queries
    assert "multi user" in plan.translated_terms
    assert {"identity", "private_data"} <= set(plan.required_capabilities)


@pytest.mark.parametrize(
    ("prompt", "expected_query", "capabilities"),
    [
        ("做一个私人笔记应用，刷新后保留", "private notes web app", {"private_data", "persistence"}),
        ("做一个实时搜索应用", "real time search web app", {"search", "real_time"}),
        ("做一个支持文件上传的资料库", "file upload web app", {"file_upload", "storage"}),
    ],
)
def test_deterministic_queries_cover_common_product_capabilities(
    prompt, expected_query, capabilities
):
    plan = deterministic_queries(requirement(prompt))

    assert expected_query in plan.github_queries
    assert capabilities <= set(plan.required_capabilities)
    assert len(plan.github_queries) == len(set(plan.github_queries))
    assert len(plan.readme_queries) == len(set(plan.readme_queries))


def test_generic_chinese_prompt_keeps_original_and_safe_fallback_queries():
    value = requirement("做一个古籍校勘工具")

    plan = deterministic_queries(value)

    assert plan.original == value.prompt
    assert value.prompt in plan.github_queries
    assert "web application open source" in plan.github_queries
    assert plan.constraints["planning_mode"] == "deterministic"


@pytest.mark.asyncio
async def test_model_overlay_can_add_but_not_remove_deterministic_evidence():
    value = requirement(
        "做一个私人笔记应用",
        AcceptanceItem(
            id="private-note",
            action="保存笔记",
            expected="其他用户不可读取",
            private_data=True,
        ),
    )

    class Model:
        async def complete(self, messages, tools, model):
            assert "untrusted data" in messages[0]["content"]
            return ModelTurn(
                assistant_message={
                    "role": "assistant",
                    "content": json.dumps(
                        {
                            "original": "replace the user request",
                            "github_queries": ["encrypted journal"],
                            "readme_queries": ["zero knowledge notes"],
                            "translated_terms": ["journal"],
                            "categories": ["productivity"],
                            "required_capabilities": [],
                            "constraints": {"license": "allowed"},
                        }
                    ),
                }
            )

    plan = await plan_queries(value, Model())

    assert plan.original == value.prompt
    assert "encrypted journal" in plan.github_queries
    assert "private notes web app" in plan.github_queries
    assert {"identity", "private_data"} <= set(plan.required_capabilities)
    assert plan.constraints["planning_mode"] == "deterministic+model"
