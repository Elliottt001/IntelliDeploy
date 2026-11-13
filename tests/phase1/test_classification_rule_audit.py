import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / "docs/algorithm/classify-fallback-rule-audit.md"


def test_audit_exists_and_keeps_old_route_semantics_explicit():
    text = AUDIT.read_text()
    assert "CLS-OLD-C-REGENERATE" in text
    assert "CLS-OLD-D-MANUAL" in text
    assert "REJECTED" in text


def test_active_algorithms_do_not_import_old_solvers():
    for folder in ("agent", "jobs", "runtime"):
        for path in (ROOT / "backend/app" / folder).rglob("*.py"):
            for node in ast.walk(ast.parse(path.read_text())):
                if isinstance(node, ast.ImportFrom):
                    assert not (node.module or "").startswith("fallback.solvers")
                    assert all(a.name != "classify_fallback_request" for a in node.names)
                elif isinstance(node, ast.Import):
                    assert all(not a.name.startswith("fallback.solvers") for a in node.names)
