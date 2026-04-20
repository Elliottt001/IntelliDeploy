from __future__ import annotations

from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse


def decompose_user_intent(
    request: FallbackRequest,
    classify_response: ClassifyResponse,
) -> dict[str, object]:
    text_blob = " ".join(
        [
            request.raw_query,
            classify_response.user_intent_summary.target_app_type,
            " ".join(classify_response.user_intent_summary.expected_features),
        ]
    ).lower()

    components = ["healthcheck"]
    assumed_env_vars: list[str] = []

    if any(keyword in text_blob for keyword in ("api", "backend", "service", "chatbot")):
        components.append("api_service")
    if any(keyword in text_blob for keyword in ("chat", "completion", "llm")):
        components.append("chat_endpoint")
        if "openai" in text_blob or "llm" in text_blob:
            assumed_env_vars.append("OPENAI_API_KEY")
    if any(keyword in text_blob for keyword in ("auth", "login", "user")):
        components.append("auth_module")
        assumed_env_vars.append("JWT_SECRET")
    if any(keyword in text_blob for keyword in ("task", "todo", "crud", "list")):
        components.append("task_crud")
    if any(keyword in text_blob for keyword in ("webhook", "callback")):
        components.append("webhook_handler")
    if any(keyword in text_blob for keyword in ("dashboard", "frontend", "ui", "page")):
        components.append("frontend_ui")
    if any(keyword in text_blob for keyword in ("database", "postgres", "mysql", "sqlite", "store", "persist")):
        components.append("persistence_adapter")
        assumed_env_vars.append("DATABASE_URL")
    if any(keyword in text_blob for keyword in ("payment", "stripe", "checkout")):
        components.append("payment_adapter")
        assumed_env_vars.append("PAYMENT_API_KEY")

    components = list(dict.fromkeys(components))
    assumed_env_vars = list(dict.fromkeys(assumed_env_vars))
    complexity = "complex" if len(components) >= 4 or len(classify_response.user_intent_summary.expected_features) >= 3 else "simple"
    return {
        "components": components,
        "assumed_env_vars": assumed_env_vars,
        "complexity": complexity,
    }

