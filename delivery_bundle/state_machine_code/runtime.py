"""运行时适配层。

该文件提供统一的模型调用入口，并在当前本地开发阶段提供离线兜底逻辑，
便于多智能体主流程先跑通。
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from urllib import request
from typing import Any


def _get_model_api_key() -> str | None:
    return os.getenv("OPENAI_API_KEY") or os.getenv("MODEL_KEY") or os.getenv("API_KEY")


def _get_model_base_url() -> str | None:
    return os.getenv("OPENAI_BASE_URL") or os.getenv("MODEL_API") or os.getenv("BASE_URL")


def _get_model_name() -> str:
    return os.getenv("OPENAI_MODEL") or os.getenv("MODEL_NAME") or "gpt-4o-mini"


def _api_available() -> bool:
    return bool(_get_model_api_key() and _get_model_base_url())


def call_with_timeout(messages: list[dict[str, str]], timeout_seconds: int = 30) -> list[dict[str, str]]:
    """当前阶段保留超时边界，直接返回原消息。"""

    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be greater than 0")
    return messages


def call_with_retry(
    messages: list[dict[str, str]],
    output_schema: dict[str, Any],
    retry_count: int = 1,
    timeout_seconds: int = 30,
) -> dict[str, Any]:
    """当前阶段统一重试入口。"""

    last_error: Exception | None = None
    for _ in range(max(retry_count, 1)):
        try:
            prepared_messages = call_with_timeout(messages, timeout_seconds=timeout_seconds)
            if _api_available():
                return _call_openai_compatible(
                    prepared_messages,
                    output_schema=output_schema,
                    timeout_seconds=timeout_seconds,
                )
            return _offline_infer(prepared_messages, output_schema)
        except Exception as error:  # pragma: no cover
            last_error = error
            time.sleep(0.05)
    if last_error is not None and _api_available():
        prepared_messages = call_with_timeout(messages, timeout_seconds=timeout_seconds)
        return _offline_infer(prepared_messages, output_schema)
    if last_error is not None:
        raise last_error
    raise RuntimeError("call_with_retry failed without capturing an exception")


def call_rag_if_needed(query: str | None = None) -> dict[str, Any]:
    """当前阶段预留 RAG 接口；默认返回空结果。"""

    return {"query": query, "documents": []}


def call_llm(
    messages: list[dict[str, str]],
    output_schema: dict[str, Any],
    timeout_seconds: int = 30,
    retry_count: int = 1,
) -> dict[str, Any]:
    """统一调用上游模型能力。"""

    return call_with_retry(
        messages=messages,
        output_schema=output_schema,
        retry_count=retry_count,
        timeout_seconds=timeout_seconds,
    )


def _call_openai_compatible(
    messages: list[dict[str, str]],
    *,
    output_schema: dict[str, Any],
    timeout_seconds: int,
) -> dict[str, Any]:
    api_key = _get_model_api_key()
    api_base = _get_model_base_url()
    if not api_key or not api_base:
        raise ValueError("model api is not configured")

    payload = {
        "model": _get_model_name(),
        "temperature": 0.2,
        "messages": _inject_schema_into_messages(messages, output_schema),
    }
    req = request.Request(
        url=f"{api_base.rstrip('/')}/chat/completions",
        method="POST",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    with request.urlopen(req, timeout=timeout_seconds) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
    return _extract_json_object(content)


def _inject_schema_into_messages(
    messages: list[dict[str, str]],
    output_schema: dict[str, Any],
) -> list[dict[str, str]]:
    if not messages:
        raise ValueError("messages must not be empty")

    schema_text = json.dumps(output_schema, ensure_ascii=False)
    injected = [dict(item) for item in messages]
    first_message = dict(injected[0])
    existing_content = first_message.get("content", "")
    first_message["content"] = (
        f"{existing_content}\n\n"
        "Return strict JSON only. The JSON must match this JSON Schema:\n"
        f"{schema_text}"
    )
    injected[0] = first_message
    return injected


def _extract_json_object(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("LLM response does not contain a JSON object")

    parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("LLM response JSON must be an object")
    return parsed


def _offline_infer(messages: list[dict[str, str]], output_schema: dict[str, Any]) -> dict[str, Any]:
    """离线推理兜底，根据 Prompt 内容输出稳定结构。"""

    joined = "\n".join(item.get("content", "") for item in messages)
    schema_keys = set((output_schema.get("properties") or {}).keys())

    if "current_dockerfile" in schema_keys:
        return _offline_builder_output(joined)
    if "reviewer_id" in schema_keys:
        return _offline_reviewer_output(joined)
    if "scanner_id" in schema_keys:
        return _offline_security_output(joined)
    raise ValueError("unsupported output schema")


def _infer_runtime(joined_prompt: str) -> tuple[str, str, str, list[int], list[str]]:
    """从 Prompt 中启发式识别运行时。"""

    lowered = joined_prompt.lower()
    ports = [3000]
    warnings: list[str] = []

    if "requirements.txt" in lowered or "python" in lowered or "fastapi" in lowered:
        dockerfile = "\n".join(
            [
                "FROM python:3.12-slim",
                "WORKDIR /app",
                "ENV PYTHONDONTWRITEBYTECODE=1",
                "ENV PYTHONUNBUFFERED=1",
                "COPY . .",
                "RUN pip install --no-cache-dir -r requirements.txt",
                "EXPOSE 8000",
                'CMD ["python", "app.py"]',
            ]
        )
        return "python-builder", dockerfile, "python", [8000], warnings

    if "go.mod" in lowered or '"go"' in lowered:
        dockerfile = "\n".join(
            [
                "FROM golang:1.22-alpine",
                "WORKDIR /app",
                "COPY . .",
                "RUN go mod download",
                "EXPOSE 8080",
                'CMD ["go", "run", "./"]',
            ]
        )
        return "go-builder", dockerfile, "go", [8080], warnings

    if "package.json" not in lowered:
        warnings.append("未明确识别依赖清单，已按 Node 默认模板生成。")

    dockerfile = "\n".join(
        [
            "FROM node:20-alpine",
            "WORKDIR /app",
            "COPY package*.json ./",
            "RUN npm install",
            "COPY . .",
            "EXPOSE 3000",
            'CMD ["npm", "run", "start"]',
        ]
    )
    return "node-builder", dockerfile, "node", ports, warnings


def _extract_round_index(joined_prompt: str) -> int:
    """从 Prompt 中提取当前轮次。"""

    matched = re.search(r'"iteration_count"\s*:\s*(\d+)', joined_prompt)
    if matched:
        return max(1, int(matched.group(1)) + 1)
    return 1


def _artifact_version(joined_prompt: str, round_index: int) -> str:
    """基于 Prompt 计算稳定版本号。"""

    digest = hashlib.sha1(joined_prompt.encode("utf-8")).hexdigest()[:8]
    return f"artifact-r{round_index}-{digest}"


def _offline_builder_output(joined_prompt: str) -> dict[str, Any]:
    """生成 Builder 离线结果。"""

    builder_id, dockerfile, runtime_name, ports, warnings = _infer_runtime(joined_prompt)
    round_index = _extract_round_index(joined_prompt)
    artifact_version = _artifact_version(joined_prompt, round_index)

    return {
        "builder_id": builder_id,
        "round_index": round_index,
        "artifact_version": artifact_version,
        "current_dockerfile": dockerfile,
        "current_configs": {
            "runtime": runtime_name,
            "ports": ports,
            "env_template": [],
        },
        "build_summary": f"已基于仓库上下文生成 {runtime_name} 部署产物。",
        "build_warnings": warnings,
    }


def _offline_reviewer_output(joined_prompt: str) -> dict[str, Any]:
    """生成 Reviewer 离线结果。"""

    round_index = _extract_round_index(joined_prompt)
    artifact_version = _artifact_version(joined_prompt, round_index)

    risk_findings: list[str] = []
    improvement_suggestions: list[str] = []
    score = 88.0
    passed = True

    if "未明确识别依赖清单" in joined_prompt:
        score = 72.0
        passed = False
        risk_findings.append("依赖清单识别不充分，生成结果存在运行不确定性。")
        improvement_suggestions.append("补充准确的依赖清单文件后重新生成部署产物。")

    if "npm err" in joined_prompt.lower():
        score = min(score, 70.0)
        passed = False
        risk_findings.append("当前错误上下文显示依赖安装阶段存在构建风险。")
        improvement_suggestions.append("在 Dockerfile 中补充构建依赖并确认 Node 原生模块编译环境。")

    summary = "当前产物可进入下一阶段审查。" if passed else "当前产物需要进一步修正后再进入部署。"

    return {
        "reviewer_id": "reviewer-offline",
        "round_index": round_index,
        "score": score,
        "passed": passed,
        "summary": summary,
        "improvement_suggestions": improvement_suggestions,
        "risk_findings": risk_findings,
        "artifact_version": artifact_version,
    }


def _offline_security_output(joined_prompt: str) -> dict[str, Any]:
    """生成 Security 离线结果。"""

    round_index = _extract_round_index(joined_prompt)
    issues: list[dict[str, Any]] = []
    risk_score = 18.0

    if "latest" in joined_prompt.lower():
        risk_score = 45.0
        issues.append(
            {
                "issue_id": "base-image-latest",
                "severity": "medium",
                "category": "base_image",
                "title": "基础镜像使用浮动标签",
                "description": "镜像标签未固定，可能导致环境不可重复。",
                "remediation": "改用固定版本号镜像标签。",
            }
        )

    if "env_template" in joined_prompt.lower():
        issues.append(
            {
                "issue_id": "env-template-review",
                "severity": "low",
                "category": "runtime",
                "title": "环境变量模板需要人工确认",
                "description": "生成结果包含环境变量模板，占位值需要在部署前确认。",
                "remediation": "在正式部署前校验环境变量值和敏感信息注入方式。",
            }
        )
        risk_score = max(risk_score, 22.0)

    passed = risk_score < 60.0
    summary = "未发现阻断部署的高危安全问题。" if passed else "发现需要修复的安全问题。"

    return {
        "scanner_id": "security-offline",
        "round_index": round_index,
        "passed": passed,
        "summary": summary,
        "risk_score": risk_score,
        "issues": issues,
    }


__all__ = [
    "call_llm",
    "call_with_retry",
    "call_with_timeout",
    "call_rag_if_needed",
]
