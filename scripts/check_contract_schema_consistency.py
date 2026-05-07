from __future__ import annotations

import json
import sys
from pathlib import Path

from contracts.schema.export_json_schema import SCHEMA_MODELS


def main() -> int:
    schema_dir = Path(__file__).resolve().parents[1] / "contracts" / "schema"
    failed: list[str] = []

    for name, model in SCHEMA_MODELS.items():
        expected_path = schema_dir / f"{name}.schema.json"
        if not expected_path.exists():
            failed.append(f"MISSING: {expected_path}")
            continue

        current = model.model_json_schema()
        saved = json.loads(expected_path.read_text(encoding="utf-8"))
        if current != saved:
            failed.append(f"DIFF: {name}.schema.json")

    if failed:
        print("Contract schema consistency check failed:")
        for item in failed:
            print(f"- {item}")
        print("Hint: run `python -m contracts.schema.export_json_schema`")
        return 1

    print("Contract schema consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
