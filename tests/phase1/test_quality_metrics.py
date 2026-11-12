import importlib.util
import json
from pathlib import Path

import pytest


SCRIPT = (
    Path(__file__).resolve().parents[2]
    / "scripts"
    / "summarize_phase1_evaluations.py"
)


def _load_module():
    assert SCRIPT.is_file(), "07-E4 quality summarizer is not implemented"
    spec = importlib.util.spec_from_file_location("phase1_quality_summary", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def metric_context():
    class Context:
        @staticmethod
        def records():
            base = {
                "source_mode": "real",
                "routing_mode": "automatic",
                "required": True,
                "status": "SUCCEEDED",
                "real_delivery_passed": True,
                "route": "DEPLOY_EXISTING",
                "duration_ms": 1000,
                "usage_units": 10,
                "cost_units": 5,
                "cost_status": "known",
                "release_checks": {},
            }
            return [
                {**base, "case_id": "auto-pass"},
                {
                    **base,
                    "case_id": "auto-fail",
                    "status": "FAILED",
                    "real_delivery_passed": False,
                },
                {
                    **base,
                    "case_id": "auto-not-run",
                    "status": "NOT_RUN",
                    "real_delivery_passed": False,
                },
                {
                    **base,
                    "case_id": "forced-pass",
                    "routing_mode": "forced",
                    "required": False,
                },
                {
                    **base,
                    "case_id": "fixture-pass",
                    "source_mode": "fixture",
                    "required": False,
                },
            ]

        @staticmethod
        def reviews():
            return [
                {
                    "case_id": case_id,
                    "job_id": f"job-{case_id}",
                    "reviewer": "human@example.test",
                    "requirement_coverage": "PASS",
                    "usability": "PASS",
                    "blockers": [],
                    "evidence": [f"artifacts/evaluations/{case_id}/review.json"],
                }
                for case_id in ("auto-pass", "auto-fail", "auto-not-run")
            ]

        @staticmethod
        def model_pass_but_missing_upload():
            records = [
                {
                    "case_id": "missing-upload",
                    "source_mode": "real",
                    "routing_mode": "automatic",
                    "required": True,
                    "status": "SUCCEEDED",
                    "real_delivery_passed": True,
                    "route": "GENERATE_APP",
                    "duration_ms": 1000,
                    "usage_units": 10,
                    "cost_units": 5,
                    "cost_status": "known",
                    "release_checks": {},
                }
            ]
            reviews = [
                {
                    "case_id": "missing-upload",
                    "job_id": "job-missing-upload",
                    "reviewer": "human@example.test",
                    "requirement_coverage": "FAIL",
                    "usability": "PASS",
                    "blockers": ["upload action is missing"],
                    "evidence": ["artifacts/evaluations/missing-upload/review.json"],
                }
            ]
            return records, reviews

    return Context()


def test_forced_and_not_run_are_separate(metric_context):
    module = _load_module()
    report = module.summarize(metric_context.records(), metric_context.reviews())
    assert report["automatic"]["attempted"] == 3
    assert report["automatic"]["passed"] == 1
    assert report["required_not_run"] == 1
    assert report["forced"]["attempted"] == 1
    assert report["fixture"]["attempted"] == 1
    assert report["release_ready"] is False


def test_model_report_cannot_override_missing_user_feature(metric_context):
    module = _load_module()
    records, reviews = metric_context.model_pass_but_missing_upload()
    report = module.summarize(records, reviews)
    assert report["required_failures"] == 1
    assert report["release_ready"] is False


def test_required_reviews_must_match_required_cases_exactly(metric_context):
    module = _load_module()
    reviews = metric_context.reviews()[:-1]
    with pytest.raises(ValueError, match="required review case ids"):
        module.summarize(metric_context.records(), reviews)


def test_unknown_cost_and_missing_release_evidence_block_readiness():
    module = _load_module()
    routes = [
        "DEPLOY_EXISTING",
        "MODIFY_EXISTING",
        "COMPOSE_COMPONENTS",
        "GENERATE_APP",
    ]
    required_checks = {
        "multi_user_privacy": "PASS",
        "real_ai_search": "PASS",
        "adjustment_data_retention": "PASS",
        "community_copy": "PASS",
        "linux_delivery": "PASS",
        "sealos_delivery": "PASS",
        "alipay": "PASS",
        "wechat": "PASS",
        "stripe": "PASS",
        "web_client": "PASS",
        "ios_client": "PASS",
        "android_client": "NOT_RUN",
    }
    records = []
    reviews = []
    for index in range(12):
        case_id = f"quality-{index + 1}"
        records.append(
            {
                "case_id": case_id,
                "source_mode": "real",
                "routing_mode": "automatic",
                "required": True,
                "status": "SUCCEEDED",
                "real_delivery_passed": True,
                "route": routes[index % len(routes)],
                "duration_ms": 1000 + index,
                "usage_units": 10,
                "cost_units": None if index == 0 else 5,
                "cost_status": "unknown" if index == 0 else "known",
                "release_checks": required_checks if index == 0 else {},
            }
        )
        reviews.append(
            {
                "case_id": case_id,
                "job_id": f"job-{index + 1}",
                "reviewer": "human@example.test",
                "requirement_coverage": "PASS",
                "usability": "PASS",
                "blockers": [],
                "evidence": [f"artifacts/evaluations/{case_id}/review.json"],
            }
        )
    report = module.summarize(records, reviews)
    assert report["unknown_cost_count"] == 1
    assert report["release_evidence"]["android_client"] == "NOT_RUN"
    assert report["release_ready"] is False


def test_stale_expected_generation_route_does_not_hide_actual_reuse():
    module = _load_module()
    records = [
        {
            "case_id": "reuse-over-generation",
            "source_mode": "real",
            "routing_mode": "automatic",
            "required": True,
            "status": "SUCCEEDED",
            "real_delivery_passed": True,
            "expected_route": "GENERATE_APP",
            "route": "DEPLOY_EXISTING",
            "route_matches_expected": False,
            "duration_ms": 1000,
            "usage_units": 10,
            "cost_units": 5,
            "cost_status": "known",
            "release_checks": {},
        }
    ]
    reviews = [
        {
            "case_id": "reuse-over-generation",
            "job_id": "job-reuse",
            "reviewer": "human@example.test",
            "requirement_coverage": "PASS",
            "usability": "PASS",
            "blockers": ["ROUTE_EXPECTATION_STALE"],
            "evidence": ["artifacts/evaluations/reuse-over-generation/review.json"],
        }
    ]
    report = module.summarize(records, reviews)
    assert report["automatic"]["passed"] == 1
    assert report["actual_routes"] == {"DEPLOY_EXISTING": 1}
    assert report["route_expectation_stale"] == 1


def test_fixed_case_suites_cover_routes_and_required_faults():
    cases_dir = Path(__file__).parent / "cases"
    quality = json.loads((cases_dir / "quality.json").read_text())
    flow = json.loads((cases_dir / "flow.json").read_text())
    faults = json.loads((cases_dir / "faults.json").read_text())

    assert len(quality) >= 12
    route_counts = {}
    for case in quality:
        assert {
            "id",
            "prompt",
            "expected_route",
            "core_checks",
            "known_repositories",
            "answers",
            "target",
        } <= set(case)
        assert case["required"] is True
        route_counts[case["expected_route"]] = (
            route_counts.get(case["expected_route"], 0) + 1
        )
    assert route_counts == {
        "COMPOSE_COMPONENTS": 3,
        "DEPLOY_EXISTING": 3,
        "GENERATE_APP": 3,
        "MODIFY_EXISTING": 3,
    }
    assert all(
        any(
            case["expected_route"] == route
            and not case["known_repositories"]
            and not case.get("source_hint", False)
            for case in quality
        )
        for route in route_counts
    )

    assert {case["id"] for case in flow} >= {
        "cross-client-continuation",
        "adjustment-keeps-data",
        "community-copy-isolated",
        "same-app-linux-sealos",
    }
    assert {case["fault"] for case in faults} >= {
        "retrieval_rate_limit",
        "model_timeout",
        "quota_pause_resume",
        "build_repair",
        "candidate_data_loss",
        "cross_user_access",
        "migration_rollback",
        "release_switch_crash",
        "platform_restart",
        "instance_quota_resume",
        "orphan_cleanup_protection",
        "community_copy_isolation",
        "dual_target_delivery",
        "duplicate_payment_callbacks",
    }


def test_multiple_suite_reports_are_combined_without_overwriting_history(tmp_path):
    module = _load_module()
    smoke = tmp_path / "smoke.json"
    quality = tmp_path / "quality.json"
    smoke.write_text(json.dumps({"records": [{"case_id": "smoke-a"}]}))
    quality.write_text(
        json.dumps(
            {
                "records": [
                    {"case_id": "quality-a"},
                    {"case_id": "quality-a-retry"},
                ]
            }
        )
    )
    assert module.load_records([smoke, quality]) == [
        {"case_id": "smoke-a"},
        {"case_id": "quality-a"},
        {"case_id": "quality-a-retry"},
    ]
    args = module.parse_args(
        [
            "--records",
            str(smoke),
            "--records",
            str(quality),
            "--reviews",
            str(tmp_path / "reviews.json"),
        ]
    )
    assert args.records == [smoke, quality]

