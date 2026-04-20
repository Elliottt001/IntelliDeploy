from __future__ import annotations

import json
import sys
from pathlib import Path

from fallback.schemas.request import FallbackRequest
from fallback.services.fallback_service import FallbackService


def main() -> int:
    fixture_path = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path(__file__).resolve().parent / "tests" / "fixtures" / "fastapi_good.json"
    )
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    request = FallbackRequest.model_validate(payload)
    result = FallbackService().run(request)
    print(json.dumps({key: value.model_dump(mode="json") for key, value in result.items()}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

