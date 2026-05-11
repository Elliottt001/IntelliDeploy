"""输出校验层。

该文件负责统一校验和规范化 Builder、Reviewer、Security 的结构化输出，
并在输出异常时生成稳定的兜底结果。
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError

from agent_state import BuildResult, ReviewResult, SecurityResult


def _coerce_raw_output(raw_output: Any) -> dict[str, Any]:
    """将原始输出统一转换为字典。"""

    if isinstance(raw_output, dict):
        return raw_output
    if isinstance(raw_output, str):
        parsed = json.loads(raw_output)
        if isinstance(parsed, dict):
            return parsed
        raise ValueError("raw_output is not a JSON object")
    raise TypeError("raw_output must be a dict or JSON string")


def normalize_invalid_output(agent_name: str, raw_output: Any, error: Exception) -> dict[str, Any]:
    """生成统一的校验失败信息。"""

    return {
        "agent_name": agent_name,
        "error_type": error.__class__.__name__,
        "error_message": str(error),
        "raw_output": raw_output,
    }


def validate_build_result(raw_output: Any) -> BuildResult:
    """校验 Builder 输出是否合法。"""

    payload = _coerce_raw_output(raw_output)
    return BuildResult.model_validate(payload)


def validate_review_result(raw_output: Any) -> ReviewResult:
    """校验 Reviewer 输出是否合法。"""

    payload = _coerce_raw_output(raw_output)
    return ReviewResult.model_validate(payload)


def validate_security_result(raw_output: Any) -> SecurityResult:
    """校验 Security 输出是否合法。"""

    payload = _coerce_raw_output(raw_output)
    return SecurityResult.model_validate(payload)


def safe_validate_build_result(raw_output: Any) -> tuple[BuildResult | None, dict[str, Any] | None]:
    """安全校验 Builder 输出，失败时返回错误信息。"""

    try:
        return validate_build_result(raw_output), None
    except (ValueError, TypeError, ValidationError) as error:
        return None, normalize_invalid_output("builder", raw_output, error)


def safe_validate_review_result(raw_output: Any) -> tuple[ReviewResult | None, dict[str, Any] | None]:
    """安全校验 Reviewer 输出，失败时返回错误信息。"""

    try:
        return validate_review_result(raw_output), None
    except (ValueError, TypeError, ValidationError) as error:
        return None, normalize_invalid_output("reviewer", raw_output, error)


def safe_validate_security_result(raw_output: Any) -> tuple[SecurityResult | None, dict[str, Any] | None]:
    """安全校验 Security 输出，失败时返回错误信息。"""

    try:
        return validate_security_result(raw_output), None
    except (ValueError, TypeError, ValidationError) as error:
        return None, normalize_invalid_output("security", raw_output, error)


__all__ = [
    "normalize_invalid_output",
    "validate_build_result",
    "validate_review_result",
    "validate_security_result",
    "safe_validate_build_result",
    "safe_validate_review_result",
    "safe_validate_security_result",
]
