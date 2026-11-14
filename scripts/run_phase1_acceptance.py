"""Run Phase 1 evaluation cases through the public app/job APIs only."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import httpx

try:
    from scripts.summarize_phase1_evaluations import summarize, summarize_pairs
except ModuleNotFoundError:  # Direct `python scripts/run_phase1_acceptance.py` execution.
    from summarize_phase1_evaluations import summarize, summarize_pairs


TERMINAL = {"SUCCEEDED", "FAILED", "CANCELLED"}
CASE_FILES = {
    "smoke": Path("tests/phase1/cases/real.json"),
    "quality": Path("tests/phase1/cases/quality.json"),
    "flow": Path("tests/phase1/cases/flow.json"),
    "faults": Path("tests/phase1/cases/faults.json"),
    "algorithm": Path("tests/phase1/cases/algorithm.json"),
}


class ApiFailure(RuntimeError):
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self.payload = payload
        message = ((payload.get("error") or {}).get("message") or "API request failed")
        super().__init__(message)


class HttpTransport:
    def __init__(self, base_url: str, token: str, timeout: float):
        self.client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {token}"},
            timeout=timeout,
            follow_redirects=False,
        )

    def request(self, method: str, path: str, **kwargs):
        operation_id = kwargs.pop("operation_id", None)
        headers = dict(kwargs.pop("headers", {}))
        if operation_id:
            headers["Idempotency-Key"] = operation_id
        response = self.client.request(method, path, headers=headers, **kwargs)
        try:
            payload = response.json()
        except ValueError:
            payload = {"error": {"message": "API returned non-JSON data"}}
        if response.is_error:
            raise ApiFailure(response.status_code, payload)
        return payload

    def close(self):
        self.client.close()

    def download(self, path: str) -> tuple[bytes, str]:
        response = self.client.get(path)
        if response.is_error:
            try:
                payload = response.json()
            except ValueError:
                payload = {"error": {"message": "evidence download failed"}}
            raise ApiFailure(response.status_code, payload)
        return response.content, response.headers.get("content-type", "application/octet-stream")


def _canonical_repository_url(value: object) -> str:
    try:
        parsed = urlsplit(str(value))
    except ValueError:
        return ""
    if not parsed.scheme or not parsed.hostname:
        return ""
    host = parsed.hostname.lower()
    path = parsed.path.rstrip("/")
    if path.endswith(".git"):
        path = path[:-4]
    return urlunsplit((parsed.scheme.lower(), host, path, "", ""))


def evaluate_record(
    record: dict,
    core_checks: list[str],
    url_reachable=None,
    *,
    expected_route: str | None = None,
    expected_selection_mode: str = "automatic",
    known_repositories: list[str] | None = None,
) -> dict:
    reasons = []
    if record.get('delivery_kind') == 'EXTERNAL_LINK' or (record.get('result') or {}).get('kind') == 'EXTERNAL_LINK':
        reasons.append('external_link_not_hosted_deployment')
    if record.get("source_mode") != "real":
        reasons.append("source_mode_not_real")
    if record.get("status") != "SUCCEEDED":
        reasons.append("job_not_succeeded")
    url = (record.get("result") or {}).get("url")
    if not url:
        reasons.append("missing_delivery_url")
    elif url_reachable is not True:
        reasons.append("delivery_url_unreachable")
    report = record.get("report") or {}
    if report.get("overall") != "PASS":
        reasons.append("report_not_passed")
    checks = {
        item.get("id"): item
        for item in report.get("checks") or []
        if isinstance(item, dict) and item.get("id")
    }
    missing = [check_id for check_id in core_checks if check_id not in checks]
    if missing:
        reasons.append("missing_core_checks:" + ",".join(missing))
    failed = [
        check_id
        for check_id in core_checks
        if check_id in checks
        and (
            checks[check_id].get("status") != "PASS"
            or not checks[check_id].get("evidence_urls")
        )
    ]
    if failed:
        reasons.append("unproven_core_checks:" + ",".join(failed))
    actual_route = record.get("route")
    route_matches_expected = expected_route is None or actual_route == expected_route
    if (
        expected_selection_mode == "automatic"
        and record.get("routing_mode") != "automatic"
    ):
        reasons.append("routing_mode_not_automatic")
    candidate_ranks = {
        _canonical_repository_url(item.get("repo_url")): item.get("rank")
        for item in (record.get("retrieval") or {}).get("candidates") or []
        if isinstance(item, dict) and item.get("repo_url")
    }
    source_urls = {
        _canonical_repository_url(item.get("url"))
        for item in record.get("sources") or []
        if isinstance(item, dict) and item.get("url")
    }
    reference_repositories = []
    for repository in known_repositories or []:
        canonical = _canonical_repository_url(repository)
        rank = candidate_ranks.get(canonical)
        recalled = rank is not None
        prioritized = recalled and rank == 1
        reused = canonical in source_urls
        reference_repositories.append(
            {
                "url": repository,
                "recalled": recalled,
                "rank": rank,
                "prioritized": prioritized,
                "reused": reused,
            }
        )
        if not recalled:
            reasons.append(f"reference_repository_not_recalled:{repository}")
        else:
            if not prioritized:
                reasons.append(f"reference_repository_not_prioritized:{repository}")
            if not reused:
                reasons.append(f"reference_repository_not_reused:{repository}")
    return {
        **record,
        "expected_route": expected_route,
        "route_matches_expected": route_matches_expected,
        "selection_mode": expected_selection_mode,
        "reference_repositories": reference_repositories,
        "real_delivery_passed": not reasons,
        "failure_reasons": reasons,
    }


def _safe_name(value: object) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value)).strip("-.")
    return normalized[:120] or "record"


def _secure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    path.chmod(0o700)


def _secure_write(path: Path, content: bytes) -> None:
    _secure_directory(path.parent)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(content)
    path.chmod(0o600)


def _new_run_id() -> str:
    return (
        datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        + "-"
        + uuid4().hex[:8]
    )


def write_run_report(output_dir: Path, result: dict, *, run_id: str | None = None) -> Path:
    run_id = run_id or _new_run_id()
    run_dir = Path(output_dir) / _safe_name(run_id)
    _secure_directory(run_dir)
    destination = run_dir / "report.json"
    _secure_write(
        destination,
        (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode(),
    )
    return destination


def attach_quality_summary(result: dict, reviews: list[dict] | None) -> dict:
    output = dict(result)
    if reviews is None:
        output["quality_summary"] = {
            "release_ready": False,
            "not_run_reasons": ["MISSING_HUMAN_REVIEWS"],
        }
    else:
        output["quality_summary"] = summarize(
            list(output.get("records") or []), reviews
        )
    return output


class AcceptanceRunner:
    def __init__(
        self,
        transport,
        *,
        output_dir: Path,
        max_polls: int,
        poll_interval: float,
        job_timeout: float,
        url_checker,
        suite: str = "smoke",
        algorithm_mode: str | None = None,
        paired: bool = False,
    ):
        self.transport = transport
        self.output_dir = Path(output_dir)
        self.max_polls = max_polls
        self.poll_interval = poll_interval
        self.job_timeout = job_timeout
        self.url_checker = url_checker
        self.suite = suite
        self.algorithm_mode = algorithm_mode
        self.paired = paired

    def _case_result(self, case: dict, payload: dict) -> dict:
        requirements = list(case.get("release_requirements") or [])
        status = payload.get("status")
        if payload.get("real_delivery_passed") is True:
            release_status = "PASS"
        elif status in TERMINAL:
            release_status = "FAIL"
        else:
            release_status = "NOT_RUN"
        return {
            **payload,
            **(
                {"algorithm_mode": case["_algorithm_mode"]}
                if case.get("_algorithm_mode")
                else {}
            ),
            **({"pair_id": case["_pair_id"]} if case.get("_pair_id") else {}),
            **(
                {
                    "target_id": case.get("target"),
                    "budget_units": case.get("budget_units"),
                }
                if case.get("_algorithm_mode")
                else {}
            ),
            "suite": self.suite,
            "required": bool(case.get("required", self.suite == "quality")),
            "release_requirements": requirements,
            "release_checks": {
                requirement: release_status for requirement in requirements
            },
        }

    def download_evidence(self, case_id: str, report: dict) -> list[dict]:
        if not hasattr(self.transport, "download"):
            return []
        evidence_dir = self.output_dir / "evidence" / _safe_name(case_id)
        saved = []
        for check in report.get("checks") or []:
            check_id = _safe_name(check.get("id") or "check")
            for position, url in enumerate(check.get("evidence_urls") or [], start=1):
                parsed = urlsplit(str(url))
                if (
                    parsed.scheme
                    or parsed.netloc
                    or parsed.query
                    or parsed.fragment
                    or not re.fullmatch(
                        r"/api/jobs/[^/]+/report/evidence/[^/]+", parsed.path
                    )
                ):
                    raise ValueError("evidence URL is not a protected evidence path")
                content, content_type = self.transport.download(url)
                media_type = content_type.split(";", 1)[0]
                extension = {
                    "image/png": ".png",
                    "image/jpeg": ".jpg",
                    "application/json": ".json",
                    "text/plain": ".txt",
                }.get(media_type, ".bin")
                _secure_directory(evidence_dir)
                destination = evidence_dir / f"{check_id}-{position}{extension}"
                _secure_write(destination, content)
                saved.append(
                    {
                        "check_id": check.get("id"),
                        "source_url": url,
                        "path": str(destination.relative_to(self.output_dir)),
                        "content_type": content_type,
                    }
                )
        return saved

    def _answer(self, case: dict, question: str | None, answer_index: int):
        answers = case.get("answers")
        if isinstance(answers, dict):
            return answers.get(question), answer_index
        if isinstance(answers, list) and answer_index < len(answers):
            return answers[answer_index], answer_index + 1
        return None, answer_index

    def _validate_case(self, case: dict) -> None:
        required = {"expected_route", "core_checks", "known_repositories", "target"}
        if not required.issubset(case):
            raise ValueError(
                "case requires expected_route, core_checks, known_repositories and target"
            )
        if not isinstance(case.get("id"), str) or not case["id"].strip():
            raise ValueError("case id must be a non-empty string")
        if not isinstance(case.get("prompt"), str) or not case["prompt"].strip():
            raise ValueError("case prompt must be a non-empty string")
        core_checks = case["core_checks"]
        if (
            not isinstance(core_checks, list)
            or not core_checks
            or not all(isinstance(value, str) and value for value in core_checks)
        ):
            raise ValueError("case core_checks must be a non-empty string list")
        repositories = case["known_repositories"]
        if not isinstance(repositories, list) or not all(
            isinstance(value, str) and value for value in repositories
        ):
            raise ValueError("case known_repositories must be a string list")
        selection_mode = case.get("selection_mode", "automatic")
        if selection_mode not in {"automatic", "forced"}:
            raise ValueError("case selection_mode must be automatic or forced")
        release_requirements = case.get("release_requirements", [])
        if not isinstance(release_requirements, list) or not all(
            isinstance(value, str) and value for value in release_requirements
        ):
            raise ValueError("case release_requirements must be a string list")

    def run_case(
        self,
        case: dict,
        *,
        algorithm_mode: str | None = None,
        pair_id: str | None = None,
    ) -> dict:
        self._validate_case(case)
        case = {
            **case,
            "_algorithm_mode": algorithm_mode,
            "_pair_id": pair_id,
        }
        case_id = str(case["id"])
        target = case.get("target")
        endpoint = "/api/evaluation/runs" if algorithm_mode else "/api/apps"
        body = {
            "prompt": case["prompt"],
            "budget_units": case.get("budget_units"),
        }
        if algorithm_mode:
            body.update({"target_id": target, "algorithm_mode": algorithm_mode})
        else:
            body["evaluation_target_id"] = target
        created = self.transport.request(
            "POST",
            endpoint,
            json=body,
            operation_id=f"evaluation:{case_id}:{algorithm_mode or 'default'}:{uuid4()}",
        )
        app_id, job_id = created["app_id"], created["job_id"]
        started = time.monotonic()
        answer_index = 0
        snapshots = []
        for poll in range(self.max_polls):
            if time.monotonic() - started > self.job_timeout:
                return self._case_result(case, {
                    "case_id": case_id,
                    "app_id": app_id,
                    "job_id": job_id,
                    "status": "NOT_RUN",
                    "not_run_reason": "JOB_WALL_CLOCK_TIMEOUT",
                    "polls": poll,
                    "snapshots": snapshots,
                })
            snapshot = self.transport.request("GET", f"/api/jobs/{job_id}")
            snapshots.append(
                {
                    "status": snapshot.get("status"),
                    "phase": snapshot.get("phase"),
                    "usage_units": snapshot.get("usage_units"),
                }
            )
            status = snapshot.get("status")
            if status == "WAITING_USER":
                answer, answer_index = self._answer(
                    case, snapshot.get("question"), answer_index
                )
                if not answer:
                    return self._case_result(case, {
                        "case_id": case_id,
                        "algorithm_mode": algorithm_mode,
                        "pair_id": pair_id,
                        "budget_units": case.get("budget_units"),
                        "app_id": app_id,
                        "job_id": job_id,
                        "status": "NOT_RUN",
                        "not_run_reason": "WAITING_USER_WITHOUT_DECLARED_ANSWER",
                        "question": snapshot.get("question"),
                        "snapshots": snapshots,
                    })
                self.transport.request(
                    "POST",
                    f"/api/apps/{app_id}/messages",
                    json={"content": answer},
                    operation_id=f"evaluation:{case_id}:answer:{answer_index}",
                )
            elif status == "PAUSED_QUOTA":
                return self._case_result(case, {
                    "case_id": case_id,
                    "app_id": app_id,
                    "job_id": job_id,
                    "status": status,
                    "not_run_reason": "PAUSED_QUOTA",
                    "snapshots": snapshots,
                })
            elif status in TERMINAL:
                report = self.transport.request("GET", f"/api/jobs/{job_id}/report")
                diagnostics = self.transport.request(
                    "GET", f"/api/jobs/{job_id}/diagnostics"
                )
                saved_evidence = self.download_evidence(case_id, report)
                result = snapshot.get("result") or None
                reachable = (
                    self.url_checker(result["url"])
                    if result and result.get("url")
                    else None
                )
                return self._case_result(case, evaluate_record(
                    {
                        **diagnostics,
                        "case_id": case_id,
                        "expected_route": case.get("expected_route"),
                        "selection_mode": case.get("selection_mode", "automatic"),
                        "target_override": bool(target),
                        "status": status,
                        "result": result,
                        "report": report,
                        "saved_evidence": saved_evidence,
                        "snapshots": snapshots,
                        "url_reachable": reachable,
                    },
                    list(case.get("core_checks") or []),
                    reachable,
                    expected_route=case.get("expected_route"),
                    expected_selection_mode=case.get(
                        "selection_mode", "automatic"
                    ),
                    known_repositories=list(case.get("known_repositories") or []),
                ))
            if self.poll_interval:
                time.sleep(self.poll_interval)
        return self._case_result(case, {
            "case_id": case_id,
            "app_id": app_id,
            "job_id": job_id,
            "status": "NOT_RUN",
            "not_run_reason": "MAX_POLLS_EXCEEDED",
            "polls": self.max_polls,
            "snapshots": snapshots,
        })

    def run(self, cases: list[dict]) -> dict:
        started_at = datetime.now(timezone.utc).isoformat()
        records = []
        for case in cases:
            try:
                if self.paired:
                    pair_id = f"pair:{case.get('id')}:{uuid4()}"
                    for mode in ("baseline", "hybrid"):
                        try:
                            records.append(
                                self.run_case(
                                    case, algorithm_mode=mode, pair_id=pair_id
                                )
                            )
                        except (ApiFailure, httpx.HTTPError, KeyError, ValueError) as exc:
                            reason = type(exc).__name__
                            if isinstance(exc, ApiFailure):
                                reason = str(
                                    (exc.payload.get("error") or {}).get("code")
                                    or reason
                                )
                            records.append(
                                self._case_result(
                                    {
                                        **case,
                                        "_algorithm_mode": mode,
                                        "_pair_id": pair_id,
                                    },
                                    {
                                        "case_id": str(case.get("id") or "unknown"),
                                        "status": "NOT_RUN",
                                        "not_run_reason": reason,
                                        "message": str(exc),
                                    },
                                )
                            )
                else:
                    records.append(
                        self.run_case(case, algorithm_mode=self.algorithm_mode)
                    )
            except (ApiFailure, httpx.HTTPError, KeyError, ValueError) as exc:
                reason = type(exc).__name__
                if isinstance(exc, ApiFailure):
                    reason = str((exc.payload.get("error") or {}).get("code") or reason)
                records.append(
                    self._case_result(case, {
                        "case_id": str(case.get("id") or "unknown"),
                        "status": "NOT_RUN",
                        "not_run_reason": reason,
                        "message": str(exc),
                    })
                )
        result = {
            "started_at": started_at,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "routing_mode": "automatic",
            "suite": self.suite,
            "records": records,
            "summary": {
                "total": len(records),
                "passed": sum(
                    1 for record in records if record.get("real_delivery_passed")
                ),
                "not_run": sum(
                    1 for record in records if record.get("status") == "NOT_RUN"
                ),
            },
        }
        if self.paired:
            result["quality_summary"] = summarize_pairs(records)
            return result
        return attach_quality_summary(result, None)


def _url_checker(timeout: float):
    def check(url: str) -> bool:
        try:
            response = httpx.get(url, timeout=timeout, follow_redirects=True)
            return 200 <= response.status_code < 400
        except httpx.HTTPError:
            return False

    return check


def parse_args(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", choices=sorted(CASE_FILES), default="smoke")
    parser.add_argument("--cases", type=Path)
    parser.add_argument("--reviews", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--api-url",
        default=os.environ.get("INTELLIDEPLOY_API_URL", "http://127.0.0.1:9000"),
    )
    parser.add_argument("--request-timeout", type=float, default=30)
    parser.add_argument("--job-timeout", type=float, default=3600)
    parser.add_argument("--max-polls", type=int, default=720)
    parser.add_argument("--poll-interval", type=float, default=5)
    parser.add_argument(
        "--algorithm-mode", choices=("baseline", "shadow", "hybrid")
    )
    parser.add_argument("--paired", action="store_true")
    args = parser.parse_args(argv)
    if args.cases is None:
        args.cases = CASE_FILES[args.suite]
    if args.paired and args.algorithm_mode:
        parser.error("--paired cannot be combined with --algorithm-mode")
    return args


def main(argv=None) -> int:
    args = parse_args(argv)
    token = os.environ.get("INTELLIDEPLOY_TEST_TOKEN")
    if not token:
        print("INTELLIDEPLOY_TEST_TOKEN is required", file=sys.stderr)
        return 2
    cases = json.loads(args.cases.read_text())
    if not isinstance(cases, list):
        print("cases file must contain a JSON list", file=sys.stderr)
        return 2
    if not cases:
        print("cases file must contain at least one case", file=sys.stderr)
        return 2
    transport = HttpTransport(args.api_url, token, args.request_timeout)
    run_id = _new_run_id()
    run_dir = args.output / _safe_name(run_id)
    _secure_directory(run_dir)
    try:
        runner = AcceptanceRunner(
            transport,
            output_dir=run_dir,
            max_polls=args.max_polls,
            poll_interval=args.poll_interval,
            job_timeout=args.job_timeout,
            url_checker=_url_checker(args.request_timeout),
            suite=args.suite,
            algorithm_mode=args.algorithm_mode,
            paired=args.paired,
        )
        result = runner.run(cases)
        if args.reviews:
            reviews = json.loads(args.reviews.read_text())
            if not isinstance(reviews, list):
                print("reviews file must contain a JSON list", file=sys.stderr)
                return 2
            result = attach_quality_summary(result, reviews)
    finally:
        transport.close()
    destination = write_run_report(args.output, result, run_id=run_id)
    print(destination)
    return 0 if result["summary"]["passed"] == result["summary"]["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
