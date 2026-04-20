import json
from pathlib import Path

from fallback.services.fallback_service import FallbackService


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def test_service_runs_direct_deploy_flow() -> None:
    result = FallbackService().run(_load_fixture("fastapi_good.json"))

    assert result["classification"].evaluation_result.decision == "A"
    assert result["plan"].decision == "A"
    assert result["plan"].docker_spec is not None
    assert result["plan"].docker_spec.start_command == "uvicorn main:app --host 0.0.0.0 --port 8000"
    assert result["validation"].passed is True


def test_service_runs_patch_repo_flow() -> None:
    result = FallbackService().run(_load_fixture("node_broken.json"))

    assert result["classification"].evaluation_result.decision == "B"
    assert result["plan"].decision == "B"
    assert any(file.path == "Dockerfile" for file in result["plan"].generated_files)
    assert result["plan"].next_action == "MANUAL_REVIEW"
    assert result["validation"].passed is True


def test_service_runs_vibe_scaffold_flow() -> None:
    result = FallbackService().run(_load_fixture("unusable_repo.json"))

    assert result["classification"].evaluation_result.decision == "C"
    assert result["plan"].decision == "C"
    assert result["plan"].artifact_type == "TEMPLATE_PROJECT"
    assert any(file.path == "main.py" for file in result["plan"].generated_files)
    assert any(file.path == "Dockerfile" for file in result["plan"].generated_files)
    assert result["validation"].passed is True


def test_service_runs_manual_required_flow() -> None:
    result = FallbackService().run(_load_fixture("missing_info.json"))

    assert result["classification"].evaluation_result.decision == "D"
    assert result["plan"].decision == "D"
    assert result["plan"].docker_spec is None
    assert result["plan"].missing_information
    assert result["validation"].passed is True
