"""
Chat 路由 — 对接 IntelliDeploy AI 助手
"""
import json
import uuid
from typing import Any, Dict, List, Optional
from urllib import request as urllib_request

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.services.intellideploy_prompts import (
    build_chat_messages,
    validate_chat_response,
    _fallback_response,
)

router = APIRouter(prefix="/chat", tags=["chat"])

# 内存会话存储（开发用，生产换 Redis）
_sessions: Dict[str, List[Dict[str, str]]] = {}


class CreateSessionResponse(BaseModel):
    session_id: str


class SendMessageRequest(BaseModel):
    session_id: str
    content: str


class SendMessageResponse(BaseModel):
    content: str
    status: str
    steps: List[str] = []
    artifacts: Optional[Dict[str, Any]] = None
    next_action: Optional[str] = None


def _call_llm(messages: list) -> str:
    """调用 LLM，返回原始文本；未配置时返回空字符串"""
    api_base = settings.MODEL_API or settings.BASE_URL
    api_key = settings.MODEL_KEY or settings.API_KEY
    model = settings.MODEL_NAME

    if not api_base or not api_key or not model:
        return ""

    payload = {
        "model": model,
        "temperature": 0.7,
        "messages": messages,
    }
    req = urllib_request.Request(
        url=f"{api_base.rstrip('/')}/v1/chat/completions",
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib_request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        return body["choices"][0]["message"]["content"]
    except Exception:
        return ""


@router.post("/session", response_model=CreateSessionResponse)
def create_session():
    session_id = str(uuid.uuid4())
    _sessions[session_id] = []
    return {"session_id": session_id}


@router.post("/message", response_model=SendMessageResponse)
def send_message(body: SendMessageRequest):
    session_id = body.session_id
    if session_id not in _sessions:
        _sessions[session_id] = []

    history = _sessions[session_id]
    messages = build_chat_messages(body.content, history)
    raw = _call_llm(messages)

    if not raw:
        # LLM 未配置，返回引导性 mock
        result = {
            "status": "thinking",
            "message": (
                f"收到你的需求：**{body.content}**\n\n"
                "正在分析项目结构，请配置 `MODEL_API` 和 `MODEL_KEY` 以启用 AI 回复。\n\n"
                "目前系统已就绪，等待大模型接入后即可自动生成 Dockerfile 和 K8s 配置。"
            ),
            "steps": ["解析用户意图", "检索匹配仓库", "生成部署配置"],
            "artifacts": {"dockerfile": None, "k8s_yaml": None, "env_vars": []},
            "next_action": "请在 backend/.env 中配置 MODEL_API、MODEL_KEY、MODEL_NAME",
        }
    else:
        result = validate_chat_response(raw)

    # 更新历史
    history.append({"role": "user", "content": body.content})
    history.append({"role": "assistant", "content": result.get("message", "")})
    # 只保留最近 12 条
    _sessions[session_id] = history[-12:]

    return SendMessageResponse(
        content=result.get("message", ""),
        status=result.get("status", "done"),
        steps=result.get("steps", []),
        artifacts=result.get("artifacts"),
        next_action=result.get("next_action"),
    )
