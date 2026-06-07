from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
from typing import Callable, Iterable

from pydantic import BaseModel, Field


class IntentStructuringError(RuntimeError):
    """Raised when a configured structured-output model returns invalid intent."""


class RepoIntent(BaseModel):
    """Structured query intent consumed by retrieval agents."""

    raw_query: str = Field(description="Original user request from the API caller.")
    target_output_type: str = Field(
        default="repository",
        description="The standardized asset type expected by downstream agents.",
    )
    target_app_type: str = Field(
        default="web_app",
        description="Coarse product category inferred from the natural language query.",
    )
    expected_features: list[str] = Field(
        default_factory=list,
        description="Feature terms normalized from vague product language.",
    )
    preferred_language: str | None = Field(
        default=None,
        description="Preferred repository language inferred for GitHub ranking.",
    )
    preferred_framework: str | None = Field(
        default=None,
        description="Preferred framework inferred for deployability matching.",
    )
    constraints: dict[str, object] = Field(
        default_factory=dict,
        description="Machine-readable constraints that shape retrieval and reranking.",
    )
    normalized_query: str
    keywords: list[str] = Field(default_factory=list)
    github_query: str
    tech_stack: list[str] = Field(default_factory=list)
    is_frontend_only: bool = False
    has_database: bool = False


class RouterAgent:
    """Lightweight NL2Repo router with a deterministic heuristic fallback.

    A production deployment can inject a structured-output LLM callable. The
    local fallback keeps latency low and makes tests deterministic.
    """

    def __init__(
        self,
        model_client: Callable[[str], dict] | None = None,
        min_stars: int = 50,
        recent_days: int = 365,
        fallback_on_model_error: bool = False,
    ):
        self.model_client = model_client
        self.min_stars = min_stars
        self.recent_days = recent_days
        self.fallback_on_model_error = fallback_on_model_error

    def structure_intent(self, natural_language_query: str) -> RepoIntent:
        query = natural_language_query.strip()
        if not query:
            query = "deployable web application"

        if self.model_client is not None:
            try:
                payload = self.model_client(query)
                intent = RepoIntent.model_validate(payload)
                return self._with_guarded_github_query(intent)
            except Exception as exc:
                if self.fallback_on_model_error:
                    return self._heuristic_intent(query)
                raise IntentStructuringError(
                    "Configured intent model failed strict RepoIntent validation."
                ) from exc

        return self._heuristic_intent(query)

    def _heuristic_intent(self, query: str) -> RepoIntent:
        normalized = query.lower()
        keywords: list[str] = []
        tech_stack: list[str] = []
        expected_features: list[str] = []
        target_app_type = "web_app"
        is_frontend_only = False
        has_database = False

        if self._contains_any(normalized, ["personal website", "portfolio", "blog", "\u4e2a\u4eba\u7f51\u7ad9"]):
            keywords.extend(["portfolio", "personal website", "blog", "minimalist"])
            expected_features.extend(["portfolio", "blog", "responsive layout"])
            tech_stack.extend(["Next.js", "React", "Vue"])
            target_app_type = "portfolio_site"
            is_frontend_only = True

        if self._contains_any(normalized, ["\u5c0f\u7ea2\u4e66", "xiaohongshu", "rednote"]):
            keywords.extend(["image-sharing", "social-network", "waterfall-layout", "community"])
            expected_features.extend(["image sharing", "social feed", "waterfall layout"])
            tech_stack.extend(["Next.js", "React"])
            target_app_type = "social_app"
            has_database = True

        if self._contains_any(normalized, ["dream", "dreams", "\u68a6", "\u68a6\u5883"]):
            keywords.extend(["dream", "journal", "sleep", "mood tracker"])
            expected_features.extend(["dream journal", "tags", "calendar", "search"])
            tech_stack.extend(["Next.js", "React", "TypeScript"])
            target_app_type = "journal_app"
            has_database = True

        if self._contains_any(normalized, ["agent", "workflow", "\u81ea\u52a8\u5316", "\u667a\u80fd\u4f53"]):
            keywords.extend(["ai agent", "workflow automation", "llm"])
            expected_features.extend(["agent workflow", "automation", "llm integration"])
            tech_stack.extend(["Python", "FastAPI"])
            target_app_type = "agent_service"
            has_database = True

        if self._contains_any(normalized, ["api", "backend", "\u540e\u7aef"]):
            keywords.extend(["api", "backend"])
            expected_features.extend(["api service", "backend"])
            tech_stack.extend(["Python", "FastAPI"])
            target_app_type = "api_service"
            has_database = True

        if not keywords:
            keywords.extend(self._extract_ascii_terms(normalized))

        if not keywords:
            keywords.extend(["web app", "deployable", "template"])
            expected_features.extend(["web app", "deployable"])
            tech_stack.extend(["Next.js", "React"])

        keywords = self._dedupe(keywords)[:8]
        tech_stack = self._dedupe(tech_stack)[:5]
        expected_features = self._dedupe(expected_features or keywords)[:8]

        intent = RepoIntent(
            raw_query=query,
            target_app_type=target_app_type,
            expected_features=expected_features,
            preferred_language=self._preferred_language(tech_stack),
            preferred_framework=tech_stack[0] if tech_stack else None,
            constraints={
                "frontend_only": is_frontend_only,
                "has_database": has_database,
                "min_stars": self.min_stars,
                "recent_days": self.recent_days,
            },
            normalized_query=normalized,
            keywords=keywords,
            tech_stack=tech_stack,
            is_frontend_only=is_frontend_only,
            has_database=has_database,
            github_query=self._build_github_query(keywords, tech_stack),
        )
        return intent

    def _with_guarded_github_query(self, intent: RepoIntent) -> RepoIntent:
        guarded = intent.github_query or self._build_github_query(
            intent.keywords, intent.tech_stack
        )
        if f"stars:>{self.min_stars}" not in guarded:
            guarded = f"{guarded} stars:>{self.min_stars}".strip()
        if "pushed:>" not in guarded:
            guarded = f"{guarded} pushed:>{self._cutoff_date()}"
        intent.github_query = guarded
        intent.target_output_type = intent.target_output_type or "repository"
        intent.expected_features = intent.expected_features or intent.keywords
        intent.preferred_framework = intent.preferred_framework or (
            intent.tech_stack[0] if intent.tech_stack else None
        )
        intent.preferred_language = intent.preferred_language or self._preferred_language(
            intent.tech_stack
        )
        intent.constraints = {
            "min_stars": self.min_stars,
            "recent_days": self.recent_days,
            **intent.constraints,
        }
        return intent

    def _build_github_query(self, keywords: Iterable[str], tech_stack: Iterable[str]) -> str:
        # 面向小白用户：他们不关心技术栈，只描述需求。
        # GitHub Search 是严格 AND，关键词越多命中越少 —— 经验上 3 个意图词 + stars
        # 就能命中数十个高质量项目；加 minimalist/topic:nextjs 之类反而直接归零。
        # 技术栈不进 query，留给后续打分和 LLM 重排。
        terms = list(keywords)[:3]
        terms.append(f"stars:>{self.min_stars}")
        return " ".join(term for term in terms if term)

    def _cutoff_date(self) -> str:
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.recent_days)
        return cutoff.date().isoformat()

    @staticmethod
    def _contains_any(text: str, needles: Iterable[str]) -> bool:
        return any(needle.lower() in text for needle in needles)

    @staticmethod
    def _dedupe(values: Iterable[str]) -> list[str]:
        seen: set[str] = set()
        deduped: list[str] = []
        for value in values:
            clean = value.strip()
            key = clean.lower()
            if clean and key not in seen:
                seen.add(key)
                deduped.append(clean)
        return deduped

    @staticmethod
    def _extract_ascii_terms(text: str) -> list[str]:
        words = re.findall(r"[a-zA-Z][a-zA-Z0-9_.+-]{2,}", text)
        stop_words = {"please", "help", "make", "build", "create", "with", "for"}
        return [word for word in words if word not in stop_words]

    @staticmethod
    def _stack_to_topic(stack: str) -> str | None:
        key = stack.lower().replace(".", "").replace(" ", "")
        mapping = {
            "nextjs": "nextjs",
            "react": "react",
            "vue": "vue",
            "typescript": "typescript",
            "python": "python",
            "fastapi": "fastapi",
        }
        return mapping.get(key)

    @staticmethod
    def _preferred_language(tech_stack: list[str]) -> str | None:
        normalized = {stack.lower().replace(".", "").replace(" ", "") for stack in tech_stack}
        if "typescript" in normalized or "nextjs" in normalized:
            return "TypeScript"
        if "python" in normalized or "fastapi" in normalized:
            return "Python"
        if "react" in normalized or "vue" in normalized:
            return "JavaScript"
        return None
