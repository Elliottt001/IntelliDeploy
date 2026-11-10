from __future__ import annotations

import json
import inspect
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit
from uuid import uuid4

from playwright.async_api import BrowserContext, Page, async_playwright, expect

from app.config import settings
from app.core.types import BrowserCheck, CheckResult, Requirement, ValidationReport


ALLOWED_ACTIONS = {
    "goto",
    "fill",
    "click",
    "expect_text",
    "expect_count",
    "reload",
    "request",
    "restart_service",
}


class CheckNotRun(RuntimeError):
    pass


def _same_origin_url(base_url: str, value: str) -> str:
    target = urljoin(base_url.rstrip("/") + "/", value)
    base = urlsplit(base_url)
    parsed = urlsplit(target)
    if (
        base.scheme not in {"http", "https"}
        or parsed.scheme != base.scheme
        or parsed.hostname != base.hostname
        or parsed.port != base.port
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError("browser action URL must use the candidate application origin")
    return target


def _required(action: dict[str, Any], key: str, expected_type: type) -> Any:
    value = action.get(key)
    if not isinstance(value, expected_type) or (expected_type is str and not value):
        raise ValueError(f"browser action requires {key}")
    return value


async def execute_browser_check(
    page: Page,
    context: BrowserContext,
    base_url: str,
    check: BrowserCheck,
    runtime_controller=None,
) -> None:
    for action in check.actions:
        kind = action.get("type")
        if kind not in ALLOWED_ACTIONS:
            raise ValueError(f"browser action is not allowed: {kind}")
        if kind == "goto":
            await page.goto(_same_origin_url(base_url, _required(action, "path", str)))
        elif kind == "fill":
            await page.locator(_required(action, "selector", str)).fill(
                _required(action, "value", str)
            )
        elif kind == "click":
            await page.locator(_required(action, "selector", str)).click()
        elif kind == "expect_text":
            await expect(page.locator(_required(action, "selector", str))).to_contain_text(
                _required(action, "text", str), timeout=3_000
            )
        elif kind == "expect_count":
            count = action.get("count")
            if not isinstance(count, int) or count < 0:
                raise ValueError("browser action requires a non-negative count")
            await expect(page.locator(_required(action, "selector", str))).to_have_count(
                count, timeout=3_000
            )
        elif kind == "reload":
            await page.reload()
        elif kind == "request":
            method = str(action.get("method", "GET")).upper()
            if method not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                raise ValueError("browser request method is not allowed")
            response = await context.request.fetch(
                _same_origin_url(base_url, _required(action, "path", str)),
                method=method,
                data=action.get("json"),
            )
            expected_status = action.get("expected_status", 200)
            if response.status != expected_status:
                body = (await response.text())[:1000]
                raise AssertionError(
                    f"request returned {response.status}, expected {expected_status}: {body}"
                )
            expected_text = action.get("expected_text")
            if expected_text is not None and str(expected_text) not in (await response.text()):
                raise AssertionError("request response did not contain expected text")
        elif kind == "restart_service":
            if runtime_controller is None:
                raise CheckNotRun("runtime controller is required for service restart")
            service = _required(action, "service", str)
            result = runtime_controller.restart_service(service)
            if inspect.isawaitable(result):
                await result


async def _save_evidence(page: Page, directory: Path, error: Exception | None, network_errors: list[str]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    try:
        await page.screenshot(path=str(directory / "screenshot.png"), full_page=True)
    except Exception as screenshot_error:
        (directory / "screenshot-error.txt").write_text(str(screenshot_error))
    try:
        (directory / "dom.html").write_text((await page.content())[:256_000])
    except Exception as dom_error:
        (directory / "dom-error.txt").write_text(str(dom_error))
    (directory / "network-errors.txt").write_text("\n".join(network_errors))
    if error is not None:
        (directory / "error.txt").write_text(f"{type(error).__name__}: {error}")


async def validate_application(
    base_url: str,
    requirement: Requirement,
    browser_checks: list[dict] | list[BrowserCheck],
    runtime_controller=None,
    *,
    evidence_root: str | Path | None = None,
    attempt_id: str | None = None,
    manifest_hash: str | None = None,
) -> ValidationReport:
    parsed_base = urlsplit(base_url)
    if parsed_base.scheme not in {"http", "https"} or not parsed_base.hostname:
        raise ValueError("candidate base URL must be HTTP(S)")
    attempt_id = attempt_id or uuid4().hex
    root = Path(evidence_root or Path(settings.ARTIFACTS_ROOT) / "validation") / attempt_id
    checks_by_id: dict[str, BrowserCheck] = {}
    for raw in browser_checks:
        check = raw if isinstance(raw, BrowserCheck) else BrowserCheck.model_validate(raw)
        if check.item_id in checks_by_id:
            raise ValueError("browser checks must have unique item IDs")
        checks_by_id[check.item_id] = check

    results: list[CheckResult] = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        contexts: dict[str, BrowserContext] = {}
        pages: dict[str, Page] = {}
        errors: dict[str, list[str]] = {}
        try:
            for item in requirement.acceptance:
                check = checks_by_id.get(item.id)
                if check is None:
                    results.append(
                        CheckResult(id=item.id, status="NOT_RUN", evidence="no check provided")
                    )
                    continue
                if check.actor not in contexts:
                    options=runtime_controller.browser_options(check.actor) if runtime_controller and hasattr(runtime_controller,'browser_options') else {}
                    contexts[check.actor] = await browser.new_context(**options)
                    pages[check.actor] = await contexts[check.actor].new_page()
                    errors[check.actor] = []
                    pages[check.actor].on(
                        "requestfailed",
                        lambda request, actor=check.actor: errors[actor].append(
                            f"{request.method} {request.url}: {request.failure}"
                        ),
                    )
                page = pages[check.actor]
                evidence_dir = root / item.id
                failure: Exception | None = None
                try:
                    await execute_browser_check(
                        page,
                        contexts[check.actor],
                        base_url,
                        check,
                        runtime_controller,
                    )
                    status = "PASS"
                except CheckNotRun as exc:
                    failure = exc
                    status = "NOT_RUN"
                except Exception as exc:
                    failure = exc
                    status = "FAIL"
                await _save_evidence(page, evidence_dir, failure, errors[check.actor])
                results.append(CheckResult(id=item.id, status=status, evidence=str(evidence_dir)))
        finally:
            for context in contexts.values():
                await context.close()
            await browser.close()

    return ValidationReport(
        checks=results,
        required_ids=[item.id for item in requirement.acceptance],
        requirement_revision=requirement.revision,
        attempt_id=attempt_id,
        manifest_hash=manifest_hash,
    )
