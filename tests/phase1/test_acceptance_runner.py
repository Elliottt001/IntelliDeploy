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
