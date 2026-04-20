from __future__ import annotations

from fallback.schemas.response import ClassifyResponse


def collect_missing_components(classify_response: ClassifyResponse) -> list[str]:
    ordered = []
    for item in (
        list(classify_response.evaluation_result.repair_targets)
        + list(classify_response.repo_fact_summary.missing_components)
        + list(classify_response.repo_fact_summary.missing_items)
    ):
        if item and item not in ordered:
            ordered.append(item)

    if not ordered and not classify_response.repo_fact_summary.has_valid_dockerfile:
        ordered.append("Dockerfile")
    return ordered

