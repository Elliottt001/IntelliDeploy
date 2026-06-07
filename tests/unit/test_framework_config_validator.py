from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fallback.classifier.conflict_detector import (  # noqa: E402
    detect_all_conflicts,
    detect_framework_config_conflicts,
)
from fallback.schemas.plan import FallbackPlan, GeneratedFile  # noqa: E402
from fallback.services.template_loader import render_template  # noqa: E402
from fallback.validators.framework_config_validator import validate_framework_config  # noqa: E402


def _plan(files: dict[str, str]) -> FallbackPlan:
    return FallbackPlan(
        decision="C",
        generated_files=[GeneratedFile(path=p, content=c) for p, c in files.items()],
    )


VUE_PKG = json.dumps({"dependencies": {"vue": "latest", "vite": "latest", "@vitejs/plugin-vue": "latest"}})
REACT_PKG = json.dumps({"dependencies": {"react": "^18"}, "devDependencies": {"vite": "^5", "@vitejs/plugin-react": "^4"}})
GOOD_VUE_CONFIG = "import vue from '@vitejs/plugin-vue';\nexport default { plugins: [vue()] };"
GOOD_REACT_CONFIG = "import react from '@vitejs/plugin-react';\nexport default { plugins: [react()] };"


def test_vue_vite_without_config_is_blocking():
    """当前真实报错的复现：声明 vue+vite 却没有 vite.config -> 必须 blocking 拦下。"""
    check, errors = validate_framework_config(_plan({"package.json": VUE_PKG}))
    assert check.passed is False
    assert any(e.code == "FRAMEWORK_CONFIG_MISSING_VUE_PLUGIN" and e.severity == "blocking" for e in errors)


def test_vue_vite_with_config_passes():
    check, errors = validate_framework_config(
        _plan({"package.json": VUE_PKG, "vite.config.js": GOOD_VUE_CONFIG})
    )
    assert check.passed is True
    assert errors == []


def test_react_vite_without_plugin_is_warning_not_blocking():
    """react 可走 classic transform，缺插件只提示不拦，避免误伤合法老式仓库。"""
    pkg = json.dumps({"dependencies": {"react": "^18"}, "devDependencies": {"vite": "^5"}})
    check, errors = validate_framework_config(_plan({"package.json": pkg}))
    assert check.passed is True  # warning 不算 fail
    assert any(e.code == "FRAMEWORK_CONFIG_MISSING_REACT_PLUGIN" and e.severity == "warning" for e in errors)


def test_react_vite_with_plugin_passes():
    check, errors = validate_framework_config(
        _plan({"package.json": REACT_PKG, "vite.config.js": GOOD_REACT_CONFIG})
    )
    assert check.passed is True
    assert errors == []


def test_no_package_json_is_not_applicable():
    check, errors = validate_framework_config(_plan({"main.py": "print('hi')"}))
    assert check.passed is True
    assert errors == []


def test_unrelated_node_app_passes():
    """express 应用没有前端框架，不触发任何规则。"""
    pkg = json.dumps({"dependencies": {"express": "^4"}})
    check, errors = validate_framework_config(_plan({"package.json": pkg}))
    assert check.passed is True
    assert errors == []


def test_reads_from_disk_workspace(tmp_path):
    """Decision A 真实仓库走磁盘路径：文件不在 plan.generated_files 也能读到。"""
    (tmp_path / "package.json").write_text(VUE_PKG, encoding="utf-8")
    # 故意不写 vite.config -> 应被拦
    plan = FallbackPlan(decision="A", generated_files=[])
    check, errors = validate_framework_config(plan, workspace_path=tmp_path)
    assert check.passed is False
    assert any(e.code == "FRAMEWORK_CONFIG_MISSING_VUE_PLUGIN" for e in errors)


def test_malformed_package_json_does_not_crash():
    check, errors = validate_framework_config(_plan({"package.json": "{not valid json"}))
    assert check.passed is True
    assert errors == []


def test_real_vue_scaffold_now_passes_validator():
    """端到端：用真实 vue_vite 模板渲染出的文件，必须通过 framework_config 校验
    （证明 Layer 1 模板修复与 Layer 2 校验自洽）。"""
    from fallback.services.template_loader import render_template

    variables = {
        "app_name": "demo", "port": 80, "start_command": 'nginx -g "daemon off;"',
        "install_command": "npm install", "base_image": "nginx:1.27-alpine",
        "healthcheck_path": "/", "feature_blocks": "", "feature_markup": "<li>x</li>",
    }
    files = {
        "package.json": render_template("vue_vite", "package.json.template", variables),
        "vite.config.js": render_template("vue_vite", "vite.config.js.template", variables),
    }
    check, errors = validate_framework_config(_plan(files))
    assert check.passed is True, f"vue scaffold still fails: {[e.code for e in errors]}"
    assert errors == []


def test_real_react_scaffold_now_passes_validator():
    from fallback.services.template_loader import render_template

    variables = {
        "app_name": "demo", "port": 80, "start_command": 'nginx -g "daemon off;"',
        "install_command": "npm install", "base_image": "nginx:1.27-alpine",
        "healthcheck_path": "/", "feature_blocks": "", "feature_markup": "<li>x</li>",
    }
    files = {
        "package.json": render_template("react_vite", "package.json.template", variables),
        "vite.config.js": render_template("react_vite", "vite.config.js.template", variables),
    }
    check, errors = validate_framework_config(_plan(files))
    assert check.passed is True, f"react scaffold still fails: {[e.code for e in errors]}"
    assert errors == []


# ---------------------------------------------------------------------------
# classifier 层探针：同一份规则在分类阶段也能识别真实仓库的 framework/config 冲突
# ---------------------------------------------------------------------------


def test_classifier_probe_flags_vue_repo_without_vite_config():
    """Decision A 走真实仓库：classifier 应在 conflict_items 里标记问题，
    让 scoring 减分、更可能打回 Decision C 重生成，避免浪费一次 Kaniko 构建。"""
    conflicts = detect_framework_config_conflicts({}, {"package.json": VUE_PKG})
    assert "framework_config_missing_vue_plugin" in conflicts


def test_classifier_probe_silent_on_correct_vue_repo():
    conflicts = detect_framework_config_conflicts(
        {}, {"package.json": VUE_PKG, "vite.config.js": GOOD_VUE_CONFIG}
    )
    assert conflicts == []


def test_classifier_probe_integrated_into_detect_all_conflicts():
    """新探针必须真正接入 detect_all_conflicts，否则 scoring 看不到。"""
    result = detect_all_conflicts({}, {"package.json": VUE_PKG})
    assert "framework_config_missing_vue_plugin" in result["conflict_items"]


def test_classifier_probe_handles_no_package_json():
    assert detect_framework_config_conflicts({}, {"main.py": "x=1"}) == []
    assert detect_framework_config_conflicts({}, {}) == []
