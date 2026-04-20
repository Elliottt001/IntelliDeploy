from __future__ import annotations

from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse


def build_missing_information(request: FallbackRequest, classify_response: ClassifyResponse) -> list[str]:
    missing_information = list(classify_response.evaluation_result.missing_information)
    if classify_response.user_intent_summary.user_intent_state == "unclear":
        missing_information.append("clarify target app type and expected outcome")
    if not request.key_files:
        missing_information.append("provide repository key files such as README, dependency file, entry file, or Dockerfile")
    if not request.file_tree:
        missing_information.append("provide repository file tree")
    return list(dict.fromkeys(missing_information))

