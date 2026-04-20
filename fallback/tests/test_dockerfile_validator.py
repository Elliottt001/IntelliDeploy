from fallback.validators.dockerfile_validator import validate_dockerfile


def test_validate_dockerfile_accepts_complete_python_image() -> None:
    result = validate_dockerfile(
        "FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt ./\nRUN pip install -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD uvicorn main:app --host 0.0.0.0 --port 8000\n",
        expected_language="python",
        entry_candidates=["main.py"],
    )

    assert result["is_valid"] is True
    assert result["base_image"] == "python:3.11-slim"


def test_validate_dockerfile_flags_missing_cmd() -> None:
    result = validate_dockerfile(
        "FROM python:3.11-slim\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\n",
        expected_language="python",
    )

    assert result["is_valid"] is False
    assert "missing_cmd" in result["errors"]
