import json
from pathlib import Path

from fallback.classifier.extract_facts import extract_repository_facts
from fallback.classifier.scoring import build_candidate_decision


def _load_fixture(name: str) -> dict:
    return json.loads((Path(__file__).parent / "fixtures" / name).read_text(encoding="utf-8"))


def test_scoring_prefers_a_candidate_for_strong_fastapi_repo() -> None:
    payload = _load_fixture("fastapi_good.json")
    extraction = extract_repository_facts(payload)

    result = build_candidate_decision(extraction.user_intent_summary, extraction.repo_fact_summary.model_dump(mode="json"))

    assert result["candidate_decision"] == "A_candidate"
    assert result["evaluation_score"] >= 60


def test_scoring_prefers_c_candidate_for_notes_only_repo() -> None:
    payload = _load_fixture("unusable_repo.json")
    extraction = extract_repository_facts(payload)

    result = build_candidate_decision(extraction.user_intent_summary, extraction.repo_fact_summary.model_dump(mode="json"))

    assert result["candidate_decision"] == "C_candidate"
