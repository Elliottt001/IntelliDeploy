import json
from pathlib import Path

from fallback.classifier.classify import classify_fallback_request


def _load_fixture(name: str) -> dict:
    return json.loads((Path(__file__).parent / "fixtures" / name).read_text(encoding="utf-8"))


def test_classify_fastapi_repo_as_a() -> None:
    payload = _load_fixture("fastapi_good.json")

    result = classify_fallback_request(payload)

    assert result.evaluation_result.decision == "A"
    assert result.hu_generation_request is None


def test_classify_unusable_repo_as_c_and_build_handoff() -> None:
    payload = _load_fixture("unusable_repo.json")

    result = classify_fallback_request(payload)

    assert result.evaluation_result.decision == "C"
    assert result.hu_generation_request is not None
    assert result.hu_generation_request["trigger_reason"] == "LOW_SCORE_ALL"


def test_classify_missing_info_repo_as_d() -> None:
    payload = _load_fixture("missing_info.json")

    result = classify_fallback_request(payload)

    assert result.evaluation_result.decision == "D"
    assert result.hu_generation_request is None
