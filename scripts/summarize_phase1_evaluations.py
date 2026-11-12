"""Summarize Phase 1 evaluation records without manufacturing missing evidence."""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from pathlib import Path


ROUTES = {
    "DEPLOY_EXISTING",
    "MODIFY_EXISTING",
    "COMPOSE_COMPONENTS",
    "GENERATE_APP",
}
RELEASE_EVIDENCE = {
    "multi_user_privacy",
    "real_ai_search",
    "adjustment_data_retention",
    "community_copy",
    "linux_delivery",
    "sealos_delivery",
    "alipay",
    "wechat",
    "stripe",
    "web_client",
    "ios_client",
    "android_client",
}
EVIDENCE_STATUS = {"PASS", "FAIL", "NOT_RUN"}


def _case_ids(rows: list[dict], *, label: str) -> set[str]:
    values = [row.get("case_id") for row in rows]
    if any(not isinstance(value, str) or not value for value in values):
        raise ValueError(f"{label} require non-empty case ids")
    if len(values) != len(set(values)):
        raise ValueError(f"{label} contain duplicate case ids")
    return set(values)


def _group(records: list[dict], predicate) -> dict:
    selected = [record for record in records if predicate(record)]
    return {
        "attempted": len(selected),
        "passed": sum(bool(record.get("real_delivery_passed")) for record in selected),
        "failed": sum(
            record.get("status") not in {"SUCCEEDED", "NOT_RUN", "PAUSED_QUOTA"}
            or (
                record.get("status") == "SUCCEEDED"
                and not record.get("real_delivery_passed")
            )
            for record in selected
        ),
        "paused": sum(record.get("status") == "PAUSED_QUOTA" for record in selected),
        "not_run": sum(record.get("status") == "NOT_RUN" for record in selected),
    }


def _percentile(values: list[int], percentile: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    position = max(0, math.ceil(percentile * len(ordered)) - 1)
    return ordered[position]


def _merge_release_evidence(records: list[dict]) -> dict[str, str]:
    merged: dict[str, str] = {}
    priority = {"PASS": 0, "NOT_RUN": 1, "FAIL": 2}
    for record in records:
        checks = record.get("release_checks") or {}
        if not isinstance(checks, dict):
            raise ValueError("release_checks must be an object")
        for name, status in checks.items():
            if status not in EVIDENCE_STATUS:
                raise ValueError(f"invalid release evidence status for {name}")
            if name not in merged or priority[status] > priority[merged[name]]:
                merged[name] = status
    return merged


def _validate_reviews(required_ids: set[str], reviews: list[dict]) -> dict[str, dict]:
    review_ids = _case_ids(reviews, label="reviews")
    if review_ids != required_ids:
        raise ValueError("required review case ids must exactly match required cases")
    by_id = {review["case_id"]: review for review in reviews}
    for review in reviews:
        if review.get("requirement_coverage") not in {"PASS", "FAIL"}:
            raise ValueError("review requirement_coverage must be PASS or FAIL")
        if review.get("usability") not in {"PASS", "FAIL"}:
            raise ValueError("review usability must be PASS or FAIL")
        if not isinstance(review.get("reviewer"), str) or not review["reviewer"]:
            raise ValueError("reviewer is required")
        if not isinstance(review.get("evidence"), list) or not review["evidence"]:
            raise ValueError("review evidence is required")
        if not isinstance(review.get("blockers"), list):
            raise ValueError("review blockers must be a list")
    return by_id


def summarize(records: list[dict], reviews: list[dict]) -> dict:
    """Return strict quality metrics for persisted runner records and human reviews."""
    _case_ids(records, label="records")
    required = [record for record in records if record.get("required") is True]
    required_ids = {record["case_id"] for record in required}
    review_by_id = _validate_reviews(required_ids, reviews)

    automatic_records = [
        record
        for record in records
        if record.get("source_mode") == "real"
        and record.get("routing_mode", "automatic") == "automatic"
    ]
    release_evidence = _merge_release_evidence(records)
    actual_routes = Counter(
        record.get("route")
        for record in automatic_records
        if record.get("route") in ROUTES
    )
    required_not_run = sum(record.get("status") == "NOT_RUN" for record in required)
    required_failures = 0
    for record in required:
        review = review_by_id[record["case_id"]]
        if record.get("status") == "NOT_RUN":
            continue
        if (
            not record.get("real_delivery_passed")
            or review["requirement_coverage"] != "PASS"
            or review["usability"] != "PASS"
            or any(blocker != "ROUTE_EXPECTATION_STALE" for blocker in review["blockers"])
        ):
            required_failures += 1

    unknown_cost_count = sum(
        record.get("cost_status") != "known" or record.get("cost_units") is None
        for record in automatic_records
        if record.get("status") != "NOT_RUN"
    )
    durations = [
        int(record["duration_ms"])
        for record in automatic_records
        if record.get("real_delivery_passed")
        and isinstance(record.get("duration_ms"), int)
    ]
    known_cost_units = sum(
        int(record["cost_units"])
        for record in automatic_records
        if record.get("cost_status") == "known"
        and isinstance(record.get("cost_units"), int)
    )
    recalled = []
    for record in automatic_records:
        for repository in record.get("reference_repositories") or []:
            recalled.append(bool(repository.get("recalled")))

    quality_required = [
        record for record in required if record.get("suite", "quality") == "quality"
    ]
    delivered_required = [
        record
        for record in required
        if record.get("real_delivery_passed")
        and review_by_id[record["case_id"]]["requirement_coverage"] == "PASS"
        and review_by_id[record["case_id"]]["usability"] == "PASS"
    ]
    covered_routes = {
        record.get("route")
        for record in delivered_required
        if record.get("route") in ROUTES
    }
    all_evidence_present = RELEASE_EVIDENCE <= set(release_evidence)
    all_evidence_passed = all_evidence_present and all(
        release_evidence[name] == "PASS" for name in RELEASE_EVIDENCE
    )
    release_ready = (
        len(quality_required) >= 12
        and required_not_run == 0
        and required_failures == 0
        and unknown_cost_count == 0
        and len(delivered_required) == len(required)
        and covered_routes == ROUTES
        and all_evidence_passed
    )

    return {
        "automatic": _group(
            records,
            lambda record: record.get("source_mode") == "real"
            and record.get("routing_mode", "automatic") == "automatic",
        ),
        "forced": _group(
            records,
            lambda record: record.get("source_mode") == "real"
            and record.get("routing_mode") == "forced",
        ),
        "fixture": _group(
            records, lambda record: record.get("source_mode") == "fixture"
        ),
        "required_case_count": len(required),
        "required_not_run": required_not_run,
        "required_failures": required_failures,
        "unknown_cost_count": unknown_cost_count,
        "actual_routes": dict(sorted(actual_routes.items())),
        "covered_routes": sorted(covered_routes),
        "route_expectation_stale": sum(
            "ROUTE_EXPECTATION_STALE" in review["blockers"] for review in reviews
        ),
        "recall_at_10": (
            sum(recalled) / len(recalled) if recalled else None
        ),
        "time_to_first_usable_ms": {
            "p50": _percentile(durations, 0.50),
            "p90": _percentile(durations, 0.90),
        },
        "known_cost_units": known_cost_units if automatic_records else None,
        "release_evidence": release_evidence,
        "missing_release_evidence": sorted(RELEASE_EVIDENCE - set(release_evidence)),
        "release_ready": release_ready,
    }


def load_records(paths: list[Path]) -> list[dict]:
    records = []
    for path in paths:
        payload = json.loads(Path(path).read_text())
        rows = payload.get("records", payload) if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            raise ValueError(f"records file must contain a list: {path}")
        records.extend(rows)
    return records


def parse_args(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--records", required=True, type=Path, action="append")
    parser.add_argument("--reviews", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    records = load_records(args.records)
    reviews = json.loads(args.reviews.read_text())
    report = summarize(records, reviews)
    content = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content)
    else:
        print(content, end="")
    return 0 if report["release_ready"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
