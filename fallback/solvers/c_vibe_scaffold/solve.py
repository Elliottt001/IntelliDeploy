from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse

from .component_reassembly import component_reassembly
from .scaffold_generate import scaffold_generate
from .scaffold_postprocess import postprocess_scaffold
from .scaffold_router import route_scaffold_strategy


def solve_vibe_scaffold(request: FallbackRequest, classify_response: ClassifyResponse) -> FallbackPlan:
    route = route_scaffold_strategy(request, classify_response)
    if route["strategy"] == "component_reassembly":
        plan = component_reassembly(request, classify_response, template_family=route["template_family"])
    else:
        plan = scaffold_generate(request, classify_response, template_family=route["template_family"])
    plan.artifact_type = route["artifact_type"]
    return postprocess_scaffold(plan)

