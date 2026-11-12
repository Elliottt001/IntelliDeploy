import importlib.util
import json
import stat
from pathlib import Path

import pytest


SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "run_phase1_acceptance.py"


def _load_runner_module():
    assert SCRIPT.is_file(), "07-E3 acceptance runner is not implemented"
    spec = importlib.util.spec_from_file_location("phase1_acceptance_runner", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_runner_does_not_count_fixture_or_missing_core_checks_as_delivery():
    module = _load_runner_module()
    assert hasattr(module, "evaluate_record")
    fixture = module.evaluate_record(
        {
            "status": "SUCCEEDED",
            "result": {"url": "https://fixture.test"},
            "report": {"overall": "PASS", "checks": [{"id": "save", "status": "PASS", "evidence_urls": ["/e/1"]}]},
            "source_mode": "fixture",
        },
        ["save"],
    )
    missing = module.evaluate_record(
        {
            "status": "SUCCEEDED",
            "result": {"url": "https://real.test"},
            "report": {"overall": "PASS", "checks": []},
            "source_mode": "real",
        },
        ["save"],
    )
    assert fixture["real_delivery_passed"] is False
    assert "source_mode_not_real" in fixture["failure_reasons"]
    assert missing["real_delivery_passed"] is False
    assert "missing_core_checks:save" in missing["failure_reasons"]


def test_runner_keeps_route_as_reference_but_rejects_forced_or_missing_retrieval_evidence():
    module = _load_runner_module()
    record = {
        "status": "SUCCEEDED",
        "result": {"url": "https://delivery.test"},
        "report": {
            "overall": "PASS",
            "checks": [
                {"id": "save", "status": "PASS", "evidence_urls": ["/e/1"]}
            ],
        },
        "source_mode": "real",
        "routing_mode": "forced",
        "route": "D",
        "retrieval": {
            "candidates": [{"repo_url": "https://github.com/other/project", "rank": 1}]
        },
        "sources": [{"url": "https://github.com/other/project"}],
    }
    output = module.evaluate_record(
        record,
        ["save"],
        expected_route="A",
        expected_selection_mode="automatic",
        known_repositories=["https://github.com/example/reference"],
    )
    assert output["route_matches_expected"] is False
    assert output["reference_repositories"][0]["recalled"] is False
    assert output["real_delivery_passed"] is False
    assert "routing_mode_not_automatic" in output["failure_reasons"]
    assert "reference_repository_not_recalled:https://github.com/example/reference" in output["failure_reasons"]

    automatic = module.evaluate_record(
        {
            **record,
            "routing_mode": "automatic",
            "route": "B",
            "retrieval": {"candidates": []},
            "sources": [],
        },
        ["save"],
        True,
        expected_route="D",
        expected_selection_mode="automatic",
    )
    assert automatic["route_matches_expected"] is False
    assert automatic["real_delivery_passed"] is True

    unchecked_url = module.evaluate_record(
        {
            **automatic,
            "real_delivery_passed": True,
            "failure_reasons": [],
        },
        ["save"],
    )
    assert unchecked_url["real_delivery_passed"] is False
    assert "delivery_url_unreachable" in unchecked_url["failure_reasons"]


class FakeTransport:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        return self.responses.pop(0)

    def download(self, path):
        self.calls.append(("DOWNLOAD", path, {}))
        return b"png-bytes", "image/png"


def test_runner_rejects_incomplete_cases_before_creating_an_app(tmp_path):
    module = _load_runner_module()
    transport = FakeTransport([])
    runner = module.AcceptanceRunner(
        transport,
        output_dir=tmp_path,
        max_polls=1,
        poll_interval=0,
        job_timeout=10,
        url_checker=lambda _url: True,
    )
    result = runner.run([{"id": "missing-checks", "prompt": "保存笔记"}])
    assert result["records"] == [
        {
            "case_id": "missing-checks",
            "status": "NOT_RUN",
            "not_run_reason": "ValueError",
            "message": "case requires expected_route, core_checks, known_repositories and target",
            "suite": "smoke",
            "required": False,
            "release_checks": {},
        }
    ]
    assert transport.calls == []


def test_runner_answers_only_declared_questions_and_stops_on_quota_pause(tmp_path):
    module = _load_runner_module()
    assert hasattr(module, "AcceptanceRunner")
    waiting_transport = FakeTransport(
        [
            {"app_id": "app-1", "job_id": "job-1", "status": "QUEUED"},
            {"id": "job-1", "app_id": "app-1", "status": "WAITING_USER", "question": "是否公开？"},
        ]
    )
    runner = module.AcceptanceRunner(
        waiting_transport,
        output_dir=tmp_path,
        max_polls=2,
        poll_interval=0,
        job_timeout=10,
        url_checker=lambda _url: True,
    )
    record = runner.run_case(
        {
            "id": "no-answer",
            "prompt": "保存笔记",
            "expected_route": "A",
            "core_checks": ["save"],
            "known_repositories": [],
            "target": None,
        }
    )
    assert record["status"] == "NOT_RUN"
    assert record["not_run_reason"] == "WAITING_USER_WITHOUT_DECLARED_ANSWER"
    assert all("/messages" not in path for _, path, _ in waiting_transport.calls)

    quota_transport = FakeTransport(
        [
            {"app_id": "app-2", "job_id": "job-2", "status": "QUEUED"},
            {"id": "job-2", "app_id": "app-2", "status": "PAUSED_QUOTA", "question": None},
        ]
    )
    runner = module.AcceptanceRunner(
        quota_transport,
        output_dir=tmp_path,
        max_polls=2,
        poll_interval=0,
        job_timeout=10,
        url_checker=lambda _url: True,
    )
    record = runner.run_case(
        {
            "id": "quota",
            "prompt": "保存笔记",
            "expected_route": "A",
            "core_checks": ["save"],
            "known_repositories": [],
            "target": None,
            "answers": {"是否公开？": "保持私有"},
        }
    )
    assert record["status"] == "PAUSED_QUOTA"
    assert all("/resume" not in path for _, path, _ in quota_transport.calls)


def test_runner_saves_protected_evidence_under_the_run_directory(tmp_path):
    module = _load_runner_module()
    transport = FakeTransport([])
    runner = module.AcceptanceRunner(
        transport,
        output_dir=tmp_path / "run-1",
        max_polls=1,
        poll_interval=0,
        job_timeout=10,
        url_checker=lambda _url: True,
    )
    saved = runner.download_evidence(
        "case/unsafe",
        {
            "checks": [
                {
                    "id": "save-note",
                    "evidence_urls": ["/api/jobs/job/report/evidence/e1"],
                }
            ]
        },
    )
    assert saved == [
        {
            "check_id": "save-note",
            "source_url": "/api/jobs/job/report/evidence/e1",
            "path": "evidence/case-unsafe/save-note-1.png",
            "content_type": "image/png",
        }
    ]
    assert (tmp_path / "run-1/evidence/case-unsafe/save-note-1.png").read_bytes() == b"png-bytes"
    assert stat.S_IMODE(
        (tmp_path / "run-1/evidence/case-unsafe/save-note-1.png").stat().st_mode
    ) == 0o600

    with pytest.raises(ValueError, match="protected evidence path"):
        runner.download_evidence(
            "case/unsafe",
            {
                "checks": [
                    {
                        "id": "save-note",
                        "evidence_urls": ["https://attacker.test/collect-token"],
                    }
                ]
            },
        )
    assert all("attacker.test" not in path for _, path, _ in transport.calls)


def test_report_writer_keeps_each_run_in_a_separate_directory(tmp_path):
    module = _load_runner_module()
    destination = module.write_run_report(
        tmp_path, {"records": [], "summary": {"total": 0}}, run_id="run-1"
    )
    assert destination == tmp_path / "run-1/report.json"
    assert json.loads(destination.read_text())["summary"]["total"] == 0
    assert stat.S_IMODE(destination.stat().st_mode) == 0o600
    assert stat.S_IMODE(destination.parent.stat().st_mode) == 0o700


def test_empty_case_file_is_rejected_without_opening_transport(tmp_path, monkeypatch):
    module = _load_runner_module()
    cases = tmp_path / "empty.json"
    cases.write_text("[]")
    monkeypatch.setenv("INTELLIDEPLOY_TEST_TOKEN", "test-token")
    assert module.main(["--cases", str(cases), "--output", str(tmp_path / "out")]) == 2


def test_suite_selects_the_canonical_case_file(tmp_path):
    module = _load_runner_module()
    args = module.parse_args(["--suite", "quality", "--output", str(tmp_path)])
    assert args.suite == "quality"
    assert args.cases == Path("tests/phase1/cases/quality.json")

    custom = tmp_path / "custom.json"
    args = module.parse_args(
        [
            "--suite",
            "faults",
            "--cases",
            str(custom),
            "--output",
            str(tmp_path),
        ]
    )
    assert args.suite == "faults"
    assert args.cases == custom


def test_runner_preserves_suite_and_required_gate_metadata(tmp_path):
    module = _load_runner_module()
    transport = FakeTransport(
        [
            {"app_id": "app-3", "job_id": "job-3", "status": "QUEUED"},
            {
                "id": "job-3",
                "app_id": "app-3",
                "status": "FAILED",
                "phase": "failed",
                "usage_units": 3,
                "result": None,
            },
            {"job_id": "job-3", "overall": "FAIL", "checks": []},
            {
                "job_id": "job-3",
                "app_id": "app-3",
                "status": "FAILED",
                "source_mode": "real",
                "routing_mode": "automatic",
                "route": "GENERATE_APP",
                "sources": [],
                "retrieval": {"candidates": []},
                "result": None,
                "report": {"overall": "FAIL", "checks": []},
            },
        ]
    )
    runner = module.AcceptanceRunner(
        transport,
        output_dir=tmp_path,
        max_polls=1,
        poll_interval=0,
        job_timeout=10,
        url_checker=lambda _url: True,
        suite="quality",
    )
    record = runner.run_case(
        {
            "id": "quality-gate",
            "prompt": "生成一个带权限的记录工具",
            "expected_route": "GENERATE_APP",
            "core_checks": ["save", "deny-other-user"],
            "known_repositories": [],
            "target": None,
            "required": True,
            "release_checks": {"multi_user_privacy": "NOT_RUN"},
        }
    )
    assert record["suite"] == "quality"
    assert record["required"] is True
    assert record["release_checks"] == {"multi_user_privacy": "NOT_RUN"}


def test_runner_without_human_reviews_cannot_report_release_ready(tmp_path):
    module = _load_runner_module()
    runner = module.AcceptanceRunner(
        FakeTransport([]),
        output_dir=tmp_path,
        max_polls=1,
        poll_interval=0,
        job_timeout=10,
        url_checker=lambda _url: True,
        suite="quality",
    )
    result = runner.run([])
    assert result["suite"] == "quality"
    assert result["quality_summary"] == {
        "release_ready": False,
        "not_run_reasons": ["MISSING_HUMAN_REVIEWS"],
    }


def test_runner_uses_the_shared_summarizer_when_reviews_are_supplied():
    module = _load_runner_module()
    result = {
        "records": [
            {
                "case_id": "reviewed-case",
                "suite": "quality",
                "required": True,
                "source_mode": "real",
                "routing_mode": "automatic",
                "status": "SUCCEEDED",
                "real_delivery_passed": True,
                "route": "DEPLOY_EXISTING",
                "duration_ms": 100,
                "usage_units": 1,
                "cost_units": 1,
                "cost_status": "known",
                "release_checks": {},
            }
        ]
    }
    reviews = [
        {
            "case_id": "reviewed-case",
            "job_id": "job-reviewed",
            "reviewer": "human@example.test",
            "requirement_coverage": "PASS",
            "usability": "PASS",
            "blockers": [],
            "evidence": ["artifacts/evaluations/reviewed-case/review.json"],
        }
    ]
    output = module.attach_quality_summary(result, reviews)
    assert output["quality_summary"]["required_case_count"] == 1
    assert output["quality_summary"]["automatic"]["passed"] == 1
    assert output["quality_summary"]["release_ready"] is False
