from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse

from .a_direct_deploy.solve import solve_direct_deploy
from .b_patch_repo.solve import solve_patch_repo
from .c_vibe_scaffold.solve import solve_vibe_scaffold
from .d_manual_required.solve import solve_manual_required


def solve_by_decision(request: FallbackRequest, classify_response: ClassifyResponse) -> FallbackPlan:
    decision = classify_response.evaluation_result.decision
    if decision == "A":
        return solve_direct_deploy(request, classify_response)
    if decision == "B":
        return solve_patch_repo(request, classify_response)
    if decision == "C":
        return solve_vibe_scaffold(request, classify_response)
    return solve_manual_required(request, classify_response)

