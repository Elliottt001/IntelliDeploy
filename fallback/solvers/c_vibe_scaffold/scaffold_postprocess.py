from __future__ import annotations

from fallback.schemas.plan import FallbackPlan


def postprocess_scaffold(plan: FallbackPlan) -> FallbackPlan:
    unique_files = {}
    for item in plan.generated_files:
        unique_files[item.path] = item
    plan.generated_files = list(unique_files.values())

    # ASSUMED + required env 仅作软提示,不再阻塞 deploy_ready/next_action。
    # 详见 a_direct_deploy/solve.py 同名注释——保持 plan.deploy_ready 与 validator
    # 单一真理源,避免 solver 内的 softer 启发式秘密推翻 validator 已放行的产物。
    assumed_required = [ev.name for ev in plan.env_vars if ev.source == "ASSUMED" and ev.required]
    if assumed_required:
        plan.warnings.append(
            "Scaffold introduced assumed required env vars (verify before deploy, will not block): "
            + ", ".join(sorted(dict.fromkeys(assumed_required)))
        )
    plan.next_action = "DEPLOY"
    return plan

