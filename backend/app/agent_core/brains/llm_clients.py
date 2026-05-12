from __future__ import annotations

import json
import re
from typing import Any
from urllib import request

from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.brains.router_agent import RepoIntent


class OpenAICompatibleIntentClient:
    def __init__(
        self,
        api_base: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 1.5,
    ):
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def __call__(self, query: str) -> dict[str, Any]:
        payload = {
            "model": self.model,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are IntelliDeploy Router Agent. Convert fuzzy user needs "
                        "into strict JSON with keys: raw_query, normalized_query, "
                        "keywords, github_query, tech_stack, is_frontend_only, "
                        "has_database. Add GitHub guards stars:>50 and pushed:>recent."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Example: '\u641e\u4e2a\u7c7b\u4f3c\u5c0f\u7ea2\u4e66\u7684' => "
                        '{"keywords":["image-sharing","social-network","waterfall-layout"],'
                        '"tech_stack":["Next.js","React"],"is_frontend_only":false,'
                        '"has_database":true}\n'
                        f"User query: {query}"
                    ),
                },
            ],
            "response_format": {"type": "json_object"},
        }
        content = _chat_completion_content(
            self.api_base, self.api_key, payload, self.timeout_seconds
        )
        data = _parse_json_content(content)
        data.setdefault("raw_query", query)
        data.setdefault("normalized_query", query.lower())
        return data


class OpenAICompatibleRepoReranker:
    def __init__(
        self,
        api_base: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 5.0,
    ):
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def __call__(
        self, intent: RepoIntent, candidates: list[RepositoryCandidate]
    ) -> list[str]:
        candidate_summaries = [
            {
                "full_name": candidate.full_name,
                "description": candidate.description,
                "stars": candidate.stars,
                "pushed_at": candidate.pushed_at,
                "topics": candidate.topics,
                "files": candidate.files,
                "score": candidate.score,
                "readme_snippet": candidate.readme_snippet[:1000],
            }
            for candidate in candidates
        ]
        payload = {
            "model": self.model,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Rank GitHub repositories for one-click deployment. "
                        "Prefer intent match, active repos, simple deployability, "
                        "Docker/package metadata, and avoid dead or overly complex repos. "
                        "Return strict JSON: {\"ordered_full_names\":[...]}."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "intent": intent.model_dump(),
                            "candidates": candidate_summaries,
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "response_format": {"type": "json_object"},
        }
        content = _chat_completion_content(
            self.api_base, self.api_key, payload, self.timeout_seconds
        )
        data = _parse_json_content(content)
        ordered = data.get("ordered_full_names") or data.get("top_repositories") or []
        return [str(name) for name in ordered]


def _chat_completion_content(
    api_base: str,
    api_key: str,
    payload: dict[str, Any],
    timeout_seconds: float,
) -> str:
    req = request.Request(
        url=f"{api_base}/v1/chat/completions",
        method="POST",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    with request.urlopen(req, timeout=timeout_seconds) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body.get("choices", [{}])[0].get("message", {}).get("content", "")


def _parse_json_content(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))
