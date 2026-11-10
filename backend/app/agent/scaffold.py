import hashlib
import json
import shutil
from pathlib import Path

from app.core.types import Requirement, RoutePlan


def template_version(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        if path.is_file() and "node_modules" not in path.parts and path.name != ".DS_Store":
            digest.update(str(path.relative_to(root)).encode())
            digest.update(path.read_bytes())
    return "nextjs-prisma-" + digest.hexdigest()[:16]


def prepare_scaffold(workspace_id: str, template_root: Path, app_name: str) -> str:
    destination = Path(workspace_id).resolve()
    if any(destination.iterdir()):
        raise ValueError("new generation workspace must be empty")
    shutil.copytree(template_root, destination, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("node_modules", ".next", ".env"))
    return template_version(template_root)


def validate_plan(plan: RoutePlan, expected_version: str) -> None:
    if plan.route != "GENERATE_APP" or plan.sources:
        raise ValueError("scaffold plan must be direct generation without repository sources")
    if plan.template_version != expected_version:
        raise ValueError("generation plan uses an unrecognized template version")
    if not plan.steps:
        raise ValueError("generation plan needs business implementation steps")


async def make_generation_plan(requirement: Requirement, version: str, model_client) -> RoutePlan:
    turn = await model_client.complete([
        {"role": "system", "content": "只输出GENERATE_APP RoutePlan JSON；template_version必须保持不变，步骤覆盖页面、API、Prisma迁移及全部验收。"},
        {"role": "user", "content": json.dumps({"requirement": requirement.model_dump(mode="json"), "template_version": version}, ensure_ascii=False)},
    ], [], "generation-plan")
    plan = RoutePlan.model_validate(json.loads(turn.assistant_message["content"]))
    validate_plan(plan, version)
    return plan
