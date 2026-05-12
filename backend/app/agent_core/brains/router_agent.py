from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
from typing import Callable, Iterable

from pydantic import BaseModel, Field


class RepoIntent(BaseModel):
    """Structured query intent consumed by retrieval agents."""

    raw_query: str
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
    ):
        self.model_client = model_client
        self.min_stars = min_stars
        self.recent_days = recent_days

    def structure_intent(self, natural_language_query: str) -> RepoIntent:
        query = natural_language_query.strip()
        if not query:
            query = "deployable web application"

        if self.model_client is not None:
            try:
                payload = self.model_client(query)
                intent = RepoIntent.model_validate(payload)
                return self._with_guarded_github_query(intent)
            except Exception:
                pass

        return self._heuristic_intent(query)

    def _heuristic_intent(self, query: str) -> RepoIntent:
        normalized = query.lower()
        keywords: list[str] = []
        tech_stack: list[str] = []
        is_frontend_only = False
        has_database = False

        if self._contains_any(normalized, ["personal website", "portfolio", "blog", "\u4e2a\u4eba\u7f51\u7ad9"]):
            keywords.extend(["portfolio", "personal website", "blog", "minimalist"])
            tech_stack.extend(["Next.js", "React", "Vue"])
            is_frontend_only = True

        if self._contains_any(normalized, ["\u5c0f\u7ea2\u4e66", "xiaohongshu", "rednote"]):
            keywords.extend(["image-sharing", "social-network", "waterfall-layout", "community"])
            tech_stack.extend(["Next.js", "React"])
            has_database = True

        if self._contains_any(normalized, ["dream", "dreams", "\u68a6", "\u68a6\u5883"]):
            keywords.extend(["dream", "journal", "sleep", "mood tracker"])
            tech_stack.extend(["Next.js", "React", "TypeScript"])
            has_database = True

        if self._contains_any(normalized, ["agent", "workflow", "\u81ea\u52a8\u5316", "\u667a\u80fd\u4f53"]):
            keywords.extend(["ai agent", "workflow automation", "llm"])
            tech_stack.extend(["Python", "FastAPI"])
            has_database = True

        if self._contains_any(normalized, ["api", "backend", "\u540e\u7aef"]):
            keywords.extend(["api", "backend"])
            tech_stack.extend(["Python", "FastAPI"])
            has_database = True

        if not keywords:
            keywords.extend(self._extract_ascii_terms(normalized))

        if not keywords:
            keywords.extend(["web app", "deployable", "template"])
            tech_stack.extend(["Next.js", "React"])

        keywords = self._dedupe(keywords)[:8]
        tech_stack = self._dedupe(tech_stack)[:5]

        intent = RepoIntent(
            raw_query=query,
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
        return intent

    def _build_github_query(self, keywords: Iterable[str], tech_stack: Iterable[str]) -> str:
        terms = list(keywords)[:4]
        for stack in list(tech_stack)[:3]:
            topic = self._stack_to_topic(stack)
            if topic:
                terms.append(f"topic:{topic}")
        terms.append(f"stars:>{self.min_stars}")
        terms.append(f"pushed:>{self._cutoff_date()}")
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
