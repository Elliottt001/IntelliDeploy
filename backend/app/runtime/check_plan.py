from __future__ import annotations

import inspect
import json
from pydantic import TypeAdapter
from typing import Any

from app.core.types import BrowserCheck, Requirement
from app.runtime.validation import ALLOWED_ACTIONS


class CheckPlanInvalid(ValueError):
    pass


ASSERTION_ACTIONS = {"expect_text", "expect_count", "request"}


def _validate_plan(requirement: Requirement, raw_checks: Any) -> list[BrowserCheck]:
    if not isinstance(raw_checks, list):
        raise CheckPlanInvalid("browser check plan must be a list")
    try:
        checks = [BrowserCheck.model_validate(item) for item in raw_checks]
    except Exception as exc:
        raise CheckPlanInvalid("browser check plan is malformed") from exc
    required = [item.id for item in requirement.core_acceptance]
    if [item.item_id for item in checks] != required:
        raise CheckPlanInvalid("browser check plan must cover every core item exactly once")
    for check in checks:
        if not check.actions:
            raise CheckPlanInvalid("every core check requires actions")
        kinds = [action.get("type") for action in check.actions]
        if any(kind not in ALLOWED_ACTIONS for kind in kinds):
            raise CheckPlanInvalid("browser check plan contains an unsupported action")
        if not any(kind in ASSERTION_ACTIONS for kind in kinds):
            raise CheckPlanInvalid("every core check requires a behavior assertion")
        for action in check.actions:
            if action.get("type") == "request" and not any(
                key in action for key in ("expected_status", "expected_text")
            ):
                raise CheckPlanInvalid("request checks require an expected response")
    return checks


async def _model_checks(model_client, requirement, source_tree, feedback):
    if hasattr(model_client, "compile_checks"):
        value = model_client.compile_checks(requirement, source_tree, feedback=feedback)
    elif hasattr(model_client, "complete"):
        prompt = {
            "schema": TypeAdapter(list[BrowserCheck]).json_schema(),
            "requirement": requirement.model_dump(mode="json"),
            "source_tree": list(source_tree),
            "feedback": feedback,
            "allowed_actions": sorted(ALLOWED_ACTIONS),
            "action_arguments": {
                "goto": ["path"], "fill": ["selector", "value"],
                "click": ["selector"], "expect_text": ["selector", "text"],
                "expect_count": ["selector", "count"], "reload": [],
                "request": ["path"], "restart_service": ["service"],
            },
            "request_optional_fields": ["method", "json"],
            "request_assertion_fields": ["expected_status", "expected_text"],
        }
        value = model_client.complete(
            [
                {
                    "role": "system",
                    "content": "Return only a JSON array matching the supplied schema for every acceptance item. Use actual source selectors/routes and action_arguments; each request requires expected_status or expected_text. Never replace business checks with a homepage or health response.",
                },
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
            ],
            [],
            "check-plan",
        )
    else:
        raise CheckPlanInvalid("check plan model is not configured")
    if inspect.isawaitable(value):
        value = await value
    if hasattr(value, "assistant_message"):
        value = value.assistant_message.get("content")
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise CheckPlanInvalid("check plan model did not return JSON") from exc
    return value


async def compile_browser_checks(
    requirement: Requirement,
    source_tree: list[str],
    model_client,
) -> list[BrowserCheck]:
    requirement = requirement.for_core_validation()
    feedback = None
    last_error: CheckPlanInvalid | None = None
    for _ in range(2):
        try:
            raw = await _model_checks(model_client, requirement, source_tree, feedback)
            return _validate_plan(requirement, raw)
        except CheckPlanInvalid as exc:
            last_error = exc
            feedback = str(exc)
    raise CheckPlanInvalid("browser check plan remained invalid after two rounds") from last_error

