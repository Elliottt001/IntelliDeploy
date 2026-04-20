from __future__ import annotations

from fallback.schemas.plan import FallbackPlan


def postprocess_scaffold(plan: FallbackPlan) -> FallbackPlan:
    unique_files = {}
    for item in plan.generated_files:
        unique_files[item.path] = item
    plan.generated_files = list(unique_files.values())

    if any(env_var.source == "ASSUMED" and env_var.required for env_var in plan.env_vars):
        plan.deploy_ready = False
        plan.next_action = "MANUAL_REVIEW"
        plan.warnings.append("Plan includes assumed environment variables; fill them before deployment.")
    else:
        plan.next_action = "DEPLOY"
    return plan

