from __future__ import annotations

import json
import re
from typing import Any


_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)
_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")


def strip_code_fence(text: str) -> str:
    return _CODE_FENCE_RE.sub("", text).strip()


def repair_json_text(text: str) -> str:
    cleaned = strip_code_fence(text)
    cleaned = _TRAILING_COMMA_RE.sub(r"\1", cleaned)
    return cleaned.strip()


def loads_json_or_raise(value: str | dict[str, Any] | list[Any]) -> Any:
    if isinstance(value, (dict, list)):
        return value
    repaired = repair_json_text(value)
    return json.loads(repaired)

