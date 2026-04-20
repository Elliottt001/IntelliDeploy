import json
from pathlib import Path

from fallback.classifier.package_manager_detector import detect_package_manager


def _load_fixture(name: str) -> dict:
    return json.loads((Path(__file__).parent / "fixtures" / name).read_text(encoding="utf-8"))


def test_detect_python_package_manager_from_requirements() -> None:
    payload = _load_fixture("fastapi_good.json")
    result = detect_package_manager(payload["file_tree"], payload["key_files"])

    assert result["package_manager"] == "pip"
    assert "requirements.txt" in " ".join(result["dependency_files"])


def test_detect_node_package_manager_without_lockfile_warns() -> None:
    payload = {
        "file_tree": ["package.json", "src/main.tsx"],
        "key_files": {
            "package.json": '{"dependencies": {"react": "^18.0.0"}}',
        },
    }
    result = detect_package_manager(payload["file_tree"], payload["key_files"])

    assert result["package_manager"] == "npm"
    assert "missing_node_lockfile" in result["warnings"]
