"""Prompt 模板层。

该文件统一管理 Builder、Reviewer、Security 的 Prompt 模板，
并负责把共享状态压缩为每个 Agent 所需的最小上下文。
"""

from __future__ import annotations

import json
from typing import Any

from agent_state import (
    AgentState,
    build_result_json_schema,
    review_result_json_schema,
    security_result_json_schema,
)


def _compact_json(payload: dict[str, Any]) -> str:
    """将上下文压缩为稳定 JSON，便于 Prompt 注入。"""

    return json.dumps(payload, ensure_ascii=False, indent=2, default=str)


def _trim_text(text: str | None, limit: int = 4000) -> str:
    """截断长文本，避免 Prompt 被无关内容淹没。"""

    if not text:
        return ""
    return text[:limit]


def inject_output_schema(prompt_sections: list[str], output_schema: dict[str, Any]) -> str:
    """将输出 Schema 注入 Prompt 约束中。"""

    schema_text = _compact_json(output_schema)
    prompt_sections.append("输出必须满足以下 JSON Schema：")
    prompt_sections.append(schema_text)
    return "\n\n".join(prompt_sections)


def build_builder_prompt(state: AgentState) -> list[dict[str, str]]:
    """根据共享状态构造 Builder Prompt。"""

    repo_context = state.get("repo_context", {})
    latest_review_result = state.get("latest_review_result")
    latest_security_result = state.get("latest_security_result")

    builder_context = {
        "project_id": state.get("project_id"),
        "session_id": state.get("session_id"),
        "iteration_count": state.get("iteration_count", 0),
        "user_prompt": state.get("user_prompt", ""),
        "repo_context": {
            "repo_url": repo_context.get("repo_url"),
            "repo_owner": repo_context.get("repo_owner"),
            "repo_name": repo_context.get("repo_name"),
            "default_branch": repo_context.get("default_branch"),
            "file_list": repo_context.get("file_list", []),
            "readme_text": _trim_text(repo_context.get("readme_text")),
            "tech_stack": repo_context.get("tech_stack", []),
            "entrypoints": repo_context.get("entrypoints", []),
            "dependency_files": repo_context.get("dependency_files", []),
            "detected_ports": repo_context.get("detected_ports", []),
            "env_candidates": repo_context.get("env_candidates", []),
            "error_context": _trim_text(repo_context.get("error_context"), limit=2000),
        },
        "latest_review_result": latest_review_result.model_dump() if latest_review_result else None,
        "latest_security_result": latest_security_result.model_dump() if latest_security_result else None,
    }

    prompt_sections = [
        "你是 IntelliDeploy 的 Builder Agent。",
        "你的职责是根据仓库上下文和上一轮反馈，生成当前轮可审查的部署产物。",
        "你只能输出结构化 JSON，不要输出解释性长文。",
        "你必须生成 current_dockerfile 和 current_configs。",
        "你不能决定流程是否通过，也不能输出路由结论。",
        "以下是当前输入上下文：",
        _compact_json(builder_context),
    ]
    builder_prompt = inject_output_schema(prompt_sections, build_result_json_schema())
    return [
        {"role": "system", "content": "你是一个严格遵守结构化输出约束的部署产物生成器。"},
        {"role": "user", "content": builder_prompt},
    ]


def build_reviewer_prompt(state: AgentState) -> list[dict[str, str]]:
    """根据共享状态和 Builder 当前产物构造 Reviewer Prompt。"""

    repo_context = state.get("repo_context", {})
    build_result = state.get("build_result")

    reviewer_context = {
        "project_id": state.get("project_id"),
        "session_id": state.get("session_id"),
        "iteration_count": state.get("iteration_count", 0),
        "user_prompt": state.get("user_prompt", ""),
        "repo_context": {
            "tech_stack": repo_context.get("tech_stack", []),
            "file_list": repo_context.get("file_list", []),
            "entrypoints": repo_context.get("entrypoints", []),
            "detected_ports": repo_context.get("detected_ports", []),
            "error_context": _trim_text(repo_context.get("error_context"), limit=2000),
        },
        "build_result": build_result.model_dump() if build_result else None,
    }

    prompt_sections = [
        "你是 IntelliDeploy 的 Reviewer Agent。",
        "你的职责是审查 Builder 当前轮产物的完整性、合理性和可部署性。",
        "你只能输出结构化 JSON。",
        "你不能生成 Dockerfile，也不能直接改写 Builder 结果。",
        "以下是当前审查上下文：",
        _compact_json(reviewer_context),
    ]
    reviewer_prompt = inject_output_schema(prompt_sections, review_result_json_schema())
    return [
        {"role": "system", "content": "你是一个严格、保守且结构化的质量审查器。"},
        {"role": "user", "content": reviewer_prompt},
    ]


def build_security_prompt(state: AgentState) -> list[dict[str, str]]:
    """根据共享状态和 Builder 当前产物构造 Security Prompt。"""

    repo_context = state.get("repo_context", {})
    build_result = state.get("build_result")

    security_context = {
        "project_id": state.get("project_id"),
        "session_id": state.get("session_id"),
        "iteration_count": state.get("iteration_count", 0),
        "repo_context": {
            "dependency_files": repo_context.get("dependency_files", []),
            "env_candidates": repo_context.get("env_candidates", []),
            "detected_ports": repo_context.get("detected_ports", []),
            "tech_stack": repo_context.get("tech_stack", []),
        },
        "build_result": build_result.model_dump() if build_result else None,
    }

    prompt_sections = [
        "你是 IntelliDeploy 的 Security Agent。",
        "你的职责是识别部署产物中的安全风险，包括基础镜像、密钥、依赖、网络和权限问题。",
        "你只能输出结构化 JSON。",
        "你不能直接修改产物，只能报告问题和修复建议。",
        "以下是当前安全检查上下文：",
        _compact_json(security_context),
    ]
    security_prompt = inject_output_schema(prompt_sections, security_result_json_schema())
    return [
        {"role": "system", "content": "你是一个严格的部署安全审查器。"},
        {"role": "user", "content": security_prompt},
    ]


__all__ = [
    "build_builder_prompt",
    "build_reviewer_prompt",
    "build_security_prompt",
    "inject_output_schema",
]
