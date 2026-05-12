from __future__ import annotations

import json
import re
from typing import Any
from urllib import request

from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.brains.router_agent import RepoIntent
from pydantic import BaseModel, Field, ValidationError


class StructuredLLMOutputError(RuntimeError):
    """Raised when a configured model does not satisfy a strict output schema."""


class RepoRerankResult(BaseModel):
    ordered_full_names: list[str] = Field(
        description="Candidate full_name values ordered from best to worst."
    )


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
        schema = _strict_json_schema(RepoIntent)
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
            "response_format": _json_schema_response_format(
                "repo_intent",
                schema,
            ),
        }
        content = _chat_completion_content(
            self.api_base, self.api_key, payload, self.timeout_seconds
        )
        data = _parse_json_content(content)
        data.setdefault("raw_query", query)
        data.setdefault("normalized_query", query.lower())
        try:
            return RepoIntent.model_validate(data).model_dump(mode="json")
        except ValidationError as exc:
            raise StructuredLLMOutputError(
                f"Intent model output did not match RepoIntent schema: {exc}"
            ) from exc


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
        allowed_names = {candidate.full_name for candidate in candidates}
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
            "response_format": _json_schema_response_format(
                "repo_rerank_result",
                _strict_json_schema(RepoRerankResult),
            ),
        }
        content = _chat_completion_content(
            self.api_base, self.api_key, payload, self.timeout_seconds
        )
        data = _parse_json_content(content)
        try:
            rerank_result = RepoRerankResult.model_validate(data)
        except ValidationError as exc:
            raise StructuredLLMOutputError(
                f"Reranker output did not match schema: {exc}"
            ) from exc

        ordered = [name for name in rerank_result.ordered_full_names if name in allowed_names]
        if not ordered:
            raise StructuredLLMOutputError("Reranker returned no valid candidate full_name values.")
        return ordered


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


def _json_schema_response_format(name: str, schema: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": name,
            "strict": True,
            "schema": schema,
        },
    }


def _strict_json_schema(model: type[BaseModel]) -> dict[str, Any]:
    schema = model.model_json_schema()
    _disallow_extra_properties(schema)
    return schema


def _disallow_extra_properties(schema_fragment: Any) -> None:
    if isinstance(schema_fragment, dict):
        if schema_fragment.get("type") == "object":
            schema_fragment["additionalProperties"] = False
            properties = schema_fragment.get("properties")
            if isinstance(properties, dict):
                schema_fragment["required"] = list(properties)
        for value in schema_fragment.values():
            _disallow_extra_properties(value)
    elif isinstance(schema_fragment, list):
        for item in schema_fragment:
            _disallow_extra_properties(item)
