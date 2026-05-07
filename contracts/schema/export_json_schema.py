from __future__ import annotations

import json
from pathlib import Path

from contracts.models import (
    AsyncTaskState,
    AsyncTaskSubmitRequest,
    BuilderOutput,
    ConsensusState,
    ContractEnvelope,
    RestResponse,
    ReviewerOutput,
    SecurityOutput,
    WebSocketEvent,
)

SCHEMA_MODELS = {
    "ContractEnvelope": ContractEnvelope,
    "RestResponse": RestResponse,
    "WebSocketEvent": WebSocketEvent,
    "AsyncTaskSubmitRequest": AsyncTaskSubmitRequest,
    "AsyncTaskState": AsyncTaskState,
    "BuilderOutput": BuilderOutput,
    "ReviewerOutput": ReviewerOutput,
    "SecurityOutput": SecurityOutput,
    "ConsensusState": ConsensusState,
}


def export_schema(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, model in SCHEMA_MODELS.items():
        schema = model.model_json_schema()
        path = output_dir / f"{name}.schema.json"
        path.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    export_schema(root)
    print(f"Exported {len(SCHEMA_MODELS)} schemas to {root}")
