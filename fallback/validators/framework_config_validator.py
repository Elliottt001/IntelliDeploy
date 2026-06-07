from __future__ import annotations

import json
from pathlib import Path

from fallback.schemas.plan import FallbackPlan
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.validation import ValidationCheck, ValidationError

# ---------------------------------------------------------------------------
# 框架 <-> 必需构建配置 的一致性规则（数据驱动，新增框架只加一条 dict）。
#
# 设计意图：这是一道“防腐层”，拦截「package.json 声明了某框架 + 某构建工具，
# 但缺少让它们协同工作的配置」这一整类问题，而不是针对单个仓库打补丁。
# 典型案例：声明了 vue + vite，却没有注册 @vitejs/plugin-vue 的 vite.config，
# 导致 vite 把 .vue 的 <template> 当 JSX 解析，build 阶段直接报
# [PARSE_ERROR] JSX syntax is disabled。这种错在 Kaniko 构建时才暴露，
# 白白浪费一次镜像构建；在这里用纯代码确定性地提前拦下。
#
# 规则字段：
#   name                 规则名（用于 check.name / 日志）
#   requires_deps        package.json 依赖里必须【全部】出现这些包，规则才触发
#   config_files         任一存在即视为“有配置文件”（按 basename 匹配工作区根目录）
#   config_must_mention  配置文件文本里必须出现【任一】片段，才算正确注册了插件
#   error_code           命中缺陷时的错误码
#   severity             "blocking" 真正必崩才拦；"warning" 存疑只提示，避免误伤
#   message              人类可读的修复指引
# ---------------------------------------------------------------------------
FRAMEWORK_CONFIG_RULES: list[dict] = [
    {
        "name": "vue_vite_plugin",
        "requires_deps": {"vue", "vite"},
        "config_files": ["vite.config.js", "vite.config.ts", "vite.config.mjs", "vite.config.cjs"],
        "config_must_mention": ["plugin-vue", "vue("],
        "error_code": "FRAMEWORK_CONFIG_MISSING_VUE_PLUGIN",
        "severity": "blocking",
        "message": (
            "package.json declares `vue` + `vite` but no vite config registers the Vue plugin. "
            "`vite build` will parse .vue <template> as JSX and fail. "
            "Add a vite.config.* with `import vue from '@vitejs/plugin-vue'` and `plugins: [vue()]`."
        ),
    },
    {
        "name": "react_vite_plugin",
        "requires_deps": {"react", "vite"},
        "config_files": ["vite.config.js", "vite.config.ts", "vite.config.mjs", "vite.config.cjs"],
        "config_must_mention": ["plugin-react", "react("],
        "error_code": "FRAMEWORK_CONFIG_MISSING_REACT_PLUGIN",
        # warning 而非 blocking：若每个文件都 `import React` 走 classic transform，
        # 无插件也能编过，blocking 会误伤这类合法（老式）仓库。
        "severity": "warning",
        "message": (
            "package.json declares `react` + `vite` but no vite config registers a React plugin. "
            "Unless every file imports React explicitly, JSX will fail to build. "
            "Add `@vitejs/plugin-react` to the vite config."
        ),
    },
    {
        "name": "svelte_vite_plugin",
        "requires_deps": {"svelte", "vite"},
        "config_files": ["vite.config.js", "vite.config.ts", "vite.config.mjs", "vite.config.cjs"],
        "config_must_mention": ["vite-plugin-svelte", "svelte("],
        "error_code": "FRAMEWORK_CONFIG_MISSING_SVELTE_PLUGIN",
        "severity": "blocking",
        "message": (
            "package.json declares `svelte` + `vite` but no vite config registers the Svelte plugin. "
            "Add `@sveltejs/vite-plugin-svelte` and `plugins: [svelte()]`."
        ),
    },
]


def _build_reader(
    workspace_path: Path | None,
    plan: FallbackPlan,
):
    """返回一个 read(relative_path)->str|None。

    优先读已落盘的工作区（覆盖 Decision A 真实仓库 + Decision C 脚手架），
    无 workspace 时回退到内存里的 plan.generated_files（便于无落盘的单测）。
    """
    in_memory = {gf.path: gf.content for gf in plan.generated_files}

    def read(relative_path: str) -> str | None:
        if workspace_path is not None:
            candidate = workspace_path / relative_path
            if candidate.is_file():
                try:
                    return candidate.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    return None
        return in_memory.get(relative_path)

    return read


def _collect_declared_deps(package_json_text: str) -> set[str]:
    try:
        data = json.loads(package_json_text)
    except (json.JSONDecodeError, TypeError):
        return set()
    deps: set[str] = set()
    for section in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        block = data.get(section)
        if isinstance(block, dict):
            deps.update(name.lower() for name in block.keys())
    return deps


def validate_framework_config(
    plan: FallbackPlan,
    *,
    workspace_path: Path | None = None,
    classify_response: ClassifyResponse | None = None,
) -> tuple[ValidationCheck, list[ValidationError]]:
    """检查 package.json 声明的框架与其必需构建配置是否自洽。

    无 package.json / 解析失败 / 无相关框架 -> 直接 PASS（不属于本校验范畴）。
    """
    read = _build_reader(workspace_path, plan)

    package_json_text = read("package.json")
    if not package_json_text:
        return (
            ValidationCheck(
                name="framework_config",
                passed=True,
                details="No package.json to check framework config.",
            ),
            [],
        )

    declared = _collect_declared_deps(package_json_text)
    if not declared:
        return (
            ValidationCheck(
                name="framework_config",
                passed=True,
                details="package.json has no declared dependencies.",
            ),
            [],
        )

    errors: list[ValidationError] = []
    triggered_rules: list[str] = []

    for rule in FRAMEWORK_CONFIG_RULES:
        if not rule["requires_deps"].issubset(declared):
            continue
        triggered_rules.append(rule["name"])

        config_texts: list[str] = []
        for config_name in rule["config_files"]:
            text = read(config_name)
            if text:
                config_texts.append(text.lower())

        mentions = tuple(token.lower() for token in rule["config_must_mention"])
        satisfied = any(
            any(token in text for token in mentions) for text in config_texts
        )
        if not satisfied:
            errors.append(
                ValidationError(
                    code=rule["error_code"],
                    message=rule["message"],
                    file_path="package.json",
                    severity=rule["severity"],
                )
            )

    if not triggered_rules:
        return (
            ValidationCheck(
                name="framework_config",
                passed=True,
                details="No framework/build-tool combination required config validation.",
            ),
            [],
        )

    blocking = [e for e in errors if e.severity == "blocking"]
    passed = not blocking
    if errors:
        details = "; ".join(f"{e.code}({e.severity})" for e in errors)
    else:
        details = f"Framework config consistent for: {', '.join(triggered_rules)}."

    return (
        ValidationCheck(
            name="framework_config",
            passed=passed,
            severity="blocking" if blocking else ("warning" if errors else "info"),
            details=details,
        ),
        errors,
    )
