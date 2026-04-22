"""
IntelliDeploy Prompt 模板管理

所有面向前端渲染的 prompt 集中在此文件管理，禁止在其他文件散写 prompt。
前端消费的每条 AI 回复必须符合 ChatResponseSchema，确保可直接渲染。
"""

from typing import Any, Dict

# ---------------------------------------------------------------------------
# 前端消费的 JSON Schema（与 frontend/services/api.ts ChatMessage 对齐）
#
# {
#   "status": "thinking" | "building" | "healing" | "done" | "error",
#   "message": str,          # 展示给用户的自然语言描述（支持 Markdown）
#   "steps": [str],          # 当前阶段的步骤列表（可为空）
#   "artifacts": {           # 生成的部署产物（可为空）
#     "dockerfile": str | null,
#     "k8s_yaml": str | null,
#     "env_vars": [{"key": str, "value": str}]
#   },
#   "next_action": str | null  # 引导用户下一步操作的提示
# }
# ---------------------------------------------------------------------------

RESPONSE_SCHEMA = """{
  "status": "<thinking|building|healing|done|error>",
  "message": "<面向用户的 Markdown 格式说明>",
  "steps": ["<步骤1>", "<步骤2>"],
  "artifacts": {
    "dockerfile": "<Dockerfile 内容或 null>",
    "k8s_yaml": "<K8s YAML 内容或 null>",
    "env_vars": [{"key": "<变量名>", "value": "<示例值或占位符>"}]
  },
  "next_action": "<引导用户下一步的提示或 null>"
}"""


# ---------------------------------------------------------------------------
# 1. 聊天主 System Prompt
#    用于 /chat/message 接口，约束所有对话回复格式
# ---------------------------------------------------------------------------

CHAT_SYSTEM_PROMPT = f"""你是 IntelliDeploy AI 助手，专注于帮助用户将应用部署到 Kubernetes（Sealos）平台。

## 核心规则
1. **只输出 JSON**，不得输出任何 JSON 以外的内容，不加 markdown 代码块包裹。
2. 严格遵循以下 Schema，所有字段必须存在：
{RESPONSE_SCHEMA}

## status 使用规范
- `thinking`：正在分析用户意图或仓库结构
- `building`：正在生成 Dockerfile / K8s YAML
- `healing`：检测到错误，正在自动修复
- `done`：任务完成，产物已就绪
- `error`：无法继续，需要用户介入

## message 写作规范
- 使用中文，语气简洁专业
- 支持 Markdown：可用 `代码`、**加粗**、列表
- 不超过 200 字

## artifacts 规范
- dockerfile 和 k8s_yaml 使用真实可用的内容，不得使用占位符
- env_vars 的 value 使用 "<YOUR_VALUE>" 格式占位
- 若该阶段无产物，对应字段设为 null

## 基础镜像白名单（必须从此列表选择）
- Node.js → node:18-alpine
- Python（通用）→ python:3.12-slim
- Python + PyTorch → pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime
- Go → golang:1.22-alpine
- Java → eclipse-temurin:17-jre-alpine
- Nginx 静态站 → nginx:1.25-alpine
"""


# ---------------------------------------------------------------------------
# 2. 仓库分析 Prompt（增强版，在 intellideploy_ai.py 基础上加格式约束）
# ---------------------------------------------------------------------------

REPO_ANALYSIS_SYSTEM_PROMPT = f"""你是一个 DevOps 专家，分析代码仓库的文件列表和内容，推断部署配置。

只输出 JSON，Schema：
{{
  "runtime": "<node|python|go|java|static>",
  "baseImage": "<从白名单选择>",
  "installCmd": "<安装依赖命令>",
  "startCmd": "<启动命令>",
  "ports": [<端口号>],
  "needsDatabase": <true|false>,
  "needsIngress": <true|false>,
  "envVars": [{{"key": "<变量名>", "value": "<占位符>"}}],
  "confidence": "<high|medium|low>",
  "reasoning": "<一句话说明判断依据>"
}}

## 基础镜像白名单
- Node.js → node:18-alpine
- Python（通用）→ python:3.12-slim
- Python + PyTorch → pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime
- Go → golang:1.22-alpine
- Java → eclipse-temurin:17-jre-alpine
- Nginx 静态站 → nginx:1.25-alpine
"""


# ---------------------------------------------------------------------------
# 3. 错误自愈 Prompt
#    当部署失败时，传入错误日志，让模型给出修复方案
# ---------------------------------------------------------------------------

HEALING_SYSTEM_PROMPT = f"""你是一个 Kubernetes 部署自愈专家。用户提供了部署失败的错误日志，你需要分析根因并给出修复方案。

只输出 JSON，Schema：
{RESPONSE_SCHEMA}

## 额外要求
- status 固定为 "healing"
- message 中必须包含：① 根因分析 ② 修复方案 ③ 修复后的关键配置片段
- 如果是已知错误（如 CrashLoopBackOff、ImagePullBackOff、OOMKilled），直接给出标准修复步骤
- artifacts 中提供修复后的完整 Dockerfile 或 k8s_yaml（如适用）
"""


# ---------------------------------------------------------------------------
# 4. 格式校验工具函数
#    解析模型返回，校验 schema 完整性，不合格时返回降级结果
# ---------------------------------------------------------------------------

REQUIRED_CHAT_KEYS = {"status", "message", "steps", "artifacts", "next_action"}
VALID_STATUSES = {"thinking", "building", "healing", "done", "error"}


def validate_chat_response(raw: str) -> Dict[str, Any]:
    """
    解析并校验模型返回的 JSON。
    返回合法的 dict，或在解析失败时返回降级结果。
    """
    import json

    try:
        # 兼容模型偶尔包裹 ```json ... ``` 的情况
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        parsed = json.loads(cleaned.strip())
    except (json.JSONDecodeError, IndexError):
        return _fallback_response("模型返回格式异常，请重试。")

    # 补全缺失字段
    parsed.setdefault("steps", [])
    parsed.setdefault("artifacts", {"dockerfile": None, "k8s_yaml": None, "env_vars": []})
    parsed.setdefault("next_action", None)

    if parsed.get("status") not in VALID_STATUSES:
        parsed["status"] = "done"

    if not isinstance(parsed.get("message"), str) or not parsed["message"]:
        return _fallback_response("模型未返回有效消息。")

    return parsed


def _fallback_response(reason: str) -> Dict[str, Any]:
    """模型输出不合规时的降级兜底"""
    return {
        "status": "error",
        "message": f"⚠️ {reason}",
        "steps": [],
        "artifacts": {"dockerfile": None, "k8s_yaml": None, "env_vars": []},
        "next_action": "请重新描述你的需求，或粘贴 GitHub 仓库链接。",
    }


def build_chat_messages(user_input: str, history: list | None = None) -> list:
    """
    构建发送给模型的 messages 列表。
    history 格式：[{"role": "user"|"assistant", "content": str}]
    """
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    if history:
        # 只保留最近 6 轮，避免超出 context window
        messages.extend(history[-12:])
    messages.append({"role": "user", "content": user_input})
    return messages


def build_healing_messages(error_log: str, original_config: Dict[str, Any] | None = None) -> list:
    """构建自愈分析的 messages 列表"""
    user_content = f"错误日志：\n{error_log}"
    if original_config:
        import json
        user_content += f"\n\n原始部署配置：\n{json.dumps(original_config, ensure_ascii=False, indent=2)}"
    return [
        {"role": "system", "content": HEALING_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
