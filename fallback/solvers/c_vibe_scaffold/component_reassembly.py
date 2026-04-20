from __future__ import annotations

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse

from .component_decompose import decompose_user_intent
from .scaffold_generate import build_template_project


def component_reassembly(
    request: FallbackRequest,
    classify_response: ClassifyResponse,
    *,
    template_family: str,
) -> FallbackPlan:
    decomposition = decompose_user_intent(request, classify_response)
    return build_template_project(
        request,
        classify_response,
        template_family=template_family,
        components=list(decomposition["components"]),
        assumed_env_vars=list(decomposition["assumed_env_vars"]),
        artifact_type="STITCHED_PROJECT",
        summary="Reassembled a runnable scaffold from decomposed user-intent components.",
    )

