import json
from pathlib import Path

from fallback.services.fallback_service import FallbackService


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def test_pipeline_materializes_and_packages_direct_deploy() -> None:
    result = FallbackService().run_pipeline(_load_fixture("fastapi_good.json"))

    materialize_result = result["materialize_result"]
    artifact = result["artifact"]

    assert materialize_result is not None
    assert materialize_result.workspace_context.paths.workspace_path.exists()
    assert (materialize_result.workspace_context.paths.workspace_path / "main.py").exists()
    assert artifact is not None
    assert artifact.artifact_path.exists()
    assert (artifact.artifact_path / "artifact_manifest.json").exists()
    assert artifact.start_command == "uvicorn main:app --host 0.0.0.0 --port 8000"


def test_pipeline_skips_materialize_and_package_for_manual_required() -> None:
    result = FallbackService().run_pipeline(_load_fixture("missing_info.json"))

    assert result["materialize_result"] is None
    assert result["artifact"] is None
    assert result["validation"].passed is True
