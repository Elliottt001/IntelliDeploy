from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.agent.contracts import ALGORITHM_VERSION, AlgorithmCheckpoint


def _json_default(value: object) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, (set, frozenset)):
        return sorted(value)
    raise TypeError(f"unsupported checkpoint hash value: {type(value).__name__}")


def stage_input_hash(value: object) -> str:
    encoded = json.dumps(
        value,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        default=_json_default,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def load_algorithm_checkpoint(
    raw: dict, requirement_revision: int
) -> AlgorithmCheckpoint:
    stored = raw.get("algorithm")
    if stored is not None:
        return AlgorithmCheckpoint.model_validate(stored)

    route = raw.get("route")
    if route is None:
        route = (raw.get("loop") or {}).get("route")
    return AlgorithmCheckpoint(
        requirement_revision=requirement_revision,
        mode="baseline",
        algorithm_version=ALGORITHM_VERSION,
        retrieval=raw.get("retrieval"),
        evaluations=raw.get("evaluations") or [],
        route=route,
        selected_sources=raw.get("sources") or [],
    )


def save_algorithm_checkpoint(
    raw: dict, checkpoint: AlgorithmCheckpoint
) -> dict:
    return {
        **raw,
        "algorithm": checkpoint.model_dump(mode="json"),
    }
