import json
from pathlib import Path

import pytest

from app.agent.scaffold import make_generation_plan, prepare_scaffold, template_version, validate_plan
from app.core.types import AcceptanceItem, ModelTurn, Requirement, RoutePlan


TEMPLATE = Path(__file__).resolve().parents[2] / "scaffolds/nextjs-prisma"


class Model:
    async def complete(self, *_args):
        return ModelTurn(assistant_message={"role": "assistant", "content": json.dumps({
            "route": "GENERATE_APP", "sources": [], "template_version": template_version(TEMPLATE),
            "steps": ["实现笔记页面", "增加Prisma模型和迁移", "验证保存读取"], "reason": "无合理复用来源"
        }, ensure_ascii=False)})


def test_scaffold_contains_locked_platform_and_database_baseline():
    required = ["package.json", "package-lock.json", "Dockerfile", "prisma/schema.prisma",
                "prisma/migrations/0001_init/migration.sql", "lib/platform/identity.ts",
                "lib/platform/files.ts", "lib/platform/ai.ts", "lib/platform/search.ts"]
    assert all((TEMPLATE / path).is_file() for path in required)
    assert 'provider = "postgresql"' in (TEMPLATE / "prisma/schema.prisma").read_text()
    package = json.loads((TEMPLATE / "package.json").read_text())
    assert package["scripts"]["build"] == "prisma generate && next build"


def test_prepare_scaffold_copies_baseline_and_returns_content_hash(tmp_path):
    workspace = tmp_path / "workspace"; workspace.mkdir()
    version = prepare_scaffold(str(workspace), TEMPLATE, "梦境记录")
    assert version == template_version(TEMPLATE)
    assert (workspace / "app/page.tsx").is_file()
    assert json.loads((workspace / "package.json").read_text())["name"] == "generated-app"


def test_wrong_template_version_and_non_generation_route_are_rejected():
    with pytest.raises(ValueError):
        validate_plan(RoutePlan(route="GENERATE_APP", template_version="other", steps=["实现"], reason="业务"), "locked-v1")
    with pytest.raises(ValueError):
        validate_plan(RoutePlan(route="MODIFY_EXISTING", template_version="locked-v1", steps=["实现"], reason="业务"), "locked-v1")


@pytest.mark.asyncio
async def test_generation_plan_is_bound_to_frozen_acceptance_and_template():
    requirement = Requirement(prompt="保存私有笔记", acceptance=[AcceptanceItem(id="save", action="保存", expected="刷新后可读取")])
    version = template_version(TEMPLATE)
    plan = await make_generation_plan(requirement, version, Model())
    assert plan.template_version == version and plan.route == "GENERATE_APP"
    validate_plan(plan, version)
