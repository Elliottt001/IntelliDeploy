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
    "platform_backup_restart_cleanup",
}
EVIDENCE_STATUS = {"PASS", "FAIL", "NOT_RUN"}
PAIR_MODES = {"baseline", "hybrid"}


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


def _source_commits(record: dict) -> list[tuple[str, str]]:
    return sorted(
        (str(source.get("url")), str(source.get("commit")))
        for source in record.get("sources") or []
        if isinstance(source, dict) and source.get("url") and source.get("commit")
    )


def _algorithm_metrics(records: list[dict]) -> dict:
    references = [
        reference
        for record in records
        for reference in record.get("reference_repositories") or []
        if isinstance(reference, dict)
    ]
    recalled_at_5 = [
        isinstance(reference.get("rank"), int) and reference["rank"] <= 5
        for reference in references
    ]
    route_rows = [
        bool(record.get("route_matches_expected"))
        for record in records
        if record.get("route_matches_expected") is not None
    ]
    first_candidates = [
        bool(record.get("first_candidate_succeeded"))
        for record in records
        if record.get("first_candidate_succeeded") is not None
    ]
    true_positive = sum(int(record.get("review_true_positive") or 0) for record in records)
    false_positive = sum(int(record.get("review_false_positive") or 0) for record in records)
    build_count = (
        sum(int(record["build_count"]) for record in records)
        if records and all(isinstance(record.get("build_count"), int) for record in records)
        else None
    )
    duplicate_effect_count = (
        sum(int(record["duplicate_effect_count"]) for record in records)
        if records
        and all(
            isinstance(record.get("duplicate_effect_count"), int)
            for record in records
        )
        else None
    )
    return {
        "recall_at_5": (
            sum(recalled_at_5) / len(recalled_at_5) if recalled_at_5 else None
        ),
        "route_correctness": (
            sum(route_rows) / len(route_rows) if route_rows else None
        ),
        "first_candidate_success_rate": (
            sum(first_candidates) / len(first_candidates)
            if first_candidates
            else None
        ),
        "build_count": build_count,
        "review_precision": (
            true_positive / (true_positive + false_positive)
            if true_positive + false_positive
            else None
        ),
        "duplicate_effect_count": duplicate_effect_count,
        "selection_duration_ms": {
            "p50": _percentile(
                [
                    int(record["selection_duration_ms"])
                    for record in records
                    if isinstance(record.get("selection_duration_ms"), int)
                ],
                0.50,
            ),
            "p95": _percentile(
                [
                    int(record["selection_duration_ms"])
                    for record in records
                    if isinstance(record.get("selection_duration_ms"), int)
                ],
                0.95,
            ),
        },
        "delivery_success_rate": (
            sum(bool(record.get("real_delivery_passed")) for record in records)
            / len(records)
            if records
            else 0.0
        ),
        "known_cost_units": sum(
            int(record["cost_units"])
            for record in records
            if record.get("cost_status") == "known"
            and isinstance(record.get("cost_units"), int)
        ),
    }


def delivery_kind(record):
    return record.get('delivery_kind') or (record.get('result') or {}).get('kind') or 'HOSTED_INSTANCE'


def summarize_reuse_records(records):
    return {
        'external_link_successes':sum(r.get('status')=='SUCCEEDED' and delivery_kind(r)=='EXTERNAL_LINK' for r in records),
        'hosted_successes':sum(r.get('status')=='SUCCEEDED' and delivery_kind(r)=='HOSTED_INSTANCE' for r in records),
        'unconfirmed':sum(r.get('status') in {'WAITING_USER','NOT_RUN'} for r in records),
    }


def summarize_pairs(records: list[dict]) -> dict:
    """Conservatively compare durable baseline/hybrid evaluation records."""
    groups: dict[str, list[dict]] = {}
    not_run_reasons: list[str] = []
    for record in records:
        if delivery_kind(record) == 'EXTERNAL_LINK':
            not_run_reasons.append('EXTERNAL_LINK_NOT_HOSTED_PAIR')
            continue
        pair_id = record.get("pair_id")
        if not isinstance(pair_id, str) or not pair_id:
            not_run_reasons.append("UNMATCHED_ALGORITHM_PAIR")
            continue
        groups.setdefault(pair_id, []).append(record)

    pairs = []
    for rows in groups.values():
        modes = {row.get("algorithm_mode") for row in rows}
        case_ids = {row.get("case_id") for row in rows}
        if len(rows) != 2 or modes != PAIR_MODES or len(case_ids) != 1:
            not_run_reasons.append("UNMATCHED_ALGORITHM_PAIR")
            continue
        by_mode = {row["algorithm_mode"]: row for row in rows}
        baseline, hybrid = by_mode["baseline"], by_mode["hybrid"]
        comparable = all(
            baseline.get(field) == hybrid.get(field)
            for field in ("target_id", "budget_units", "model", "price_version")
        ) and _source_commits(baseline) == _source_commits(hybrid)
        if not comparable:
            not_run_reasons.append("PAIR_RESOURCE_MISMATCH")
            continue
        pairs.append((baseline, hybrid))

    paired_records = [row for pair in pairs for row in pair]
    if any(row.get("source_mode") != "real" for row in paired_records):
        not_run_reasons.append("FIXTURE_ALGORITHM_EVIDENCE")
    if any(
        row.get("status") == "NOT_RUN"
        or (row.get("evidence_gate") or {}).get("status") == "NOT_RUN"
        for row in paired_records
    ):
        not_run_reasons.append("REQUIRED_EXTERNAL_EVIDENCE_NOT_RUN")
    if any(
        row.get("cost_status") != "known" or row.get("cost_units") is None
        for row in paired_records
    ):
        not_run_reasons.append("PAIR_COST_UNKNOWN")

    baseline_records = [pair[0] for pair in pairs]
    hybrid_records = [pair[1] for pair in pairs]
    baseline_metrics = _algorithm_metrics(baseline_records)
    hybrid_metrics = _algorithm_metrics(hybrid_records)
    release_ready = bool(pairs) and not not_run_reasons and all(
        row.get("real_delivery_passed") is True
        and (row.get("evidence_gate") or {}).get("status") == "PASS"
        for row in paired_records
    )

    gate_reasons = []
    required_metric_fields = {
        "selection_duration_ms",
        "first_candidate_succeeded",
        "build_count",
        "duplicate_effect_count",
        "review_true_positive",
        "review_false_positive",
    }
    if any(not required_metric_fields <= set(record) for record in hybrid_records):
        gate_reasons.append("ALGORITHM_METRICS_INCOMPLETE")
    selection_p50 = hybrid_metrics["selection_duration_ms"]["p50"]
    if selection_p50 is None or selection_p50 > 90_000:
        gate_reasons.append("LOW_SELECTION_P50_OVER_90000MS")
    if (
        hybrid_metrics["recall_at_5"] is None
        or baseline_metrics["recall_at_5"] is None
        or hybrid_metrics["recall_at_5"] < baseline_metrics["recall_at_5"]
    ):
        gate_reasons.append("RECALL_AT_5_REGRESSION")
    if (
        hybrid_metrics["route_correctness"] is None
        or baseline_metrics["route_correctness"] is None
        or hybrid_metrics["route_correctness"] < baseline_metrics["route_correctness"]
    ):
        gate_reasons.append("ROUTE_CORRECTNESS_REGRESSION")
    if hybrid_metrics["delivery_success_rate"] < baseline_metrics["delivery_success_rate"]:
        gate_reasons.append("REAL_DELIVERY_SUCCESS_REGRESSION")
    if hybrid_metrics["known_cost_units"] > baseline_metrics["known_cost_units"]:
        gate_reasons.append("HYBRID_COST_REGRESSION")
    if hybrid_metrics["review_precision"] is None or hybrid_metrics["review_precision"] < 0.8:
        gate_reasons.append("REVIEW_PRECISION_BELOW_0_8")
    if hybrid_metrics["duplicate_effect_count"] != 0:
        gate_reasons.append("DUPLICATE_EFFECT_NONZERO")

    return {
        "pair_count": len(pairs),
        "baseline_metrics": baseline_metrics,
        "hybrid_metrics": hybrid_metrics,
        "not_run_reasons": sorted(set(not_run_reasons)),
        "gate_reasons": gate_reasons,
        "release_ready": release_ready,
        "hybrid_default_ready": release_ready and not gate_reasons,
    }


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
    quality_required = [
        record for record in required if record.get("suite", "quality") == "quality"
    ]
    quality_required_ids = {record["case_id"] for record in quality_required}
    review_by_id = _validate_reviews(quality_required_ids, reviews)

    automatic_records = [
        record
        for record in records
        if record.get("source_mode") == "real"
        and delivery_kind(record) == 'HOSTED_INSTANCE'
        and record.get("routing_mode", "automatic") == "automatic"
    ]
    release_evidence = _merge_release_evidence([r for r in records if delivery_kind(r)=='HOSTED_INSTANCE'])
    actual_routes = Counter(
        record.get("route")
        for record in automatic_records
        if record.get("route") in ROUTES
    )
    required_not_run = sum(record.get("status") == "NOT_RUN" for record in required)
    required_failures = 0
    for record in required:
        if record.get("status") == "NOT_RUN":
            continue
        review = review_by_id.get(record["case_id"])
        if (
            not record.get("real_delivery_passed")
            or (
                review is not None
                and (
                    review["requirement_coverage"] != "PASS"
                    or review["usability"] != "PASS"
                    or any(
                        blocker != "ROUTE_EXPECTATION_STALE"
                        for blocker in review["blockers"]
                    )
                )
            )
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

    delivered_required = [
        record
        for record in quality_required
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
        and len(delivered_required) == len(quality_required)
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
    parser.add_argument("--reviews", type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    records = load_records(args.records)
    if any(record.get("pair_id") for record in records):
        report = summarize_pairs(records)
    else:
        if args.reviews is None:
            raise SystemExit("--reviews is required for non-paired records")
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
