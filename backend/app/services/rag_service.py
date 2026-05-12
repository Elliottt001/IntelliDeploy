from __future__ import annotations

import base64
import math
import re
from datetime import UTC, datetime
from typing import Any
from urllib import parse
from uuid import uuid4

from sqlalchemy.orm import Session

from app.schemas.fallback import Constraints, PreferredStack, RepoProfile, StartFallbackTaskRequest
from app.schemas.rag import (
    RagCandidate,
    RagSearchRequest,
    RagSearchResponse,
    RagStartGenerationRequest,
    RepoIntent,
    RerankStage,
    RetrievalSource,
)
from app.services.generation_task_service import GenerationTaskService
from app.services.intellideploy_github import (
    GitHubApiError,
    get_github_access_token,
    github_request_json,
    list_github_repos,
)
from app.services.repo_skeleton_extractor import RemoteRepoSkeletonExtractor


_STACK_ALIASES: dict[str, str] = {
    "react": "React",
    "next": "Next.js",
    "nextjs": "Next.js",
    "vue": "Vue",
    "vite": "Vite",
    "fastapi": "FastAPI",
    "flask": "Flask",
    "django": "Django",
    "express": "Express",
    "node": "Node.js",
    "python": "Python",
    "go": "Go",
    "java": "Java",
}

_APP_TYPE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "frontend_web": ("网站", "前端", "portfolio", "个人网站", "landing", "博客", "blog", "dashboard", "网页"),
    "backend_api": ("api", "接口", "后端", "服务", "server"),
    "chatbot": ("chatbot", "聊天", "agent", "助手", "llm"),
    "dashboard": ("dashboard", "看板", "后台", "管理"),
    "automation_tool": ("自动化", "脚本", "workflow", "工具"),
}

_STOPWORDS = {
    "帮我",
    "生成",
    "做一个",
    "一个",
    "可以",
    "部署",
    "到",
    "云上",
    "app",
    "应用",
    "项目",
    "the",
    "and",
    "with",
    "for",
}


class RagService:
    """Stable RAG orchestration contract for Lin Zihao's retrieval module.

    The internals are intentionally replaceable: real BM25/vector retrieval and
    LLM reranking can swap into this service without changing API consumers.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    async def search(self, request: RagSearchRequest, *, user_id: int) -> RagSearchResponse:
        request_id = f"rag-{uuid4().hex[:12]}"
        intent = self.structure_intent(request)
        warnings: list[str] = []

        raw_candidates: list[dict[str, Any]] = []
        try:
            raw_candidates.extend(self._github_search(intent, user_id=user_id))
        except GitHubApiError as exc:
            warnings.append(f"github_search_unavailable: {exc}")

        if not raw_candidates:
            try:
                raw_candidates.extend(self._user_repo_recall(user_id=user_id))
                if raw_candidates:
                    warnings.append("using_user_repo_recall_fallback")
            except GitHubApiError as exc:
                warnings.append(f"user_repo_recall_unavailable: {exc}")

        candidates = self._rank_candidates(
            raw_candidates,
            intent=intent,
            top_k=request.top_k,
            user_id=user_id,
            include_readme=request.include_readme,
        )

        return RagSearchResponse(
            request_id=request_id,
            intent=intent,
            candidates=candidates,
            selected=candidates[0] if candidates else None,
            generated_at=datetime.now(UTC),
            warnings=warnings,
        )

    async def start_generation(
        self,
        request: RagStartGenerationRequest,
        *,
        user_id: int,
    ):
        search_response = await self.search(
            RagSearchRequest(
                raw_query=request.raw_query,
                preferred_stack=request.preferred_stack,
                constraints=request.constraints,
                top_k=3,
                include_readme=True,
            ),
            user_id=user_id,
        )
        candidate = self._select_candidate(search_response.candidates, request.selected_repo_url)
        if candidate is None:
            raise ValueError("No RAG candidate is available for generation.")

        generation_request = StartFallbackTaskRequest(
            project_id=request.project_id,
            deployment_id=request.deployment_id,
            request_id=request.request_id or search_response.request_id,
            trigger_reason=request.trigger_reason,
            original_prompt=request.raw_query,
            generation_mode=request.generation_mode,
            evaluation_score=round(candidate.final_score),
            missing_components=candidate.missing_components,
            preferred_stack=candidate.preferred_stack,
            repo_profile=candidate.repo_profile,
            constraints=request.constraints or Constraints(),
        )
        generation = await GenerationTaskService(self.db).start_fallback_task(generation_request)
        return search_response, generation

    def structure_intent(self, request: RagSearchRequest) -> RepoIntent:
        raw_query = request.raw_query.strip()
        lowered = raw_query.lower()
        tokens = self._tokenize(raw_query)
        tech_stack = self._extract_stack(lowered)
        if request.preferred_stack:
            for value in request.preferred_stack.model_dump(exclude_none=True).values():
                if value and value not in tech_stack:
                    tech_stack.append(str(value))

        target_app_type = "unknown"
        for app_type, markers in _APP_TYPE_KEYWORDS.items():
            if any(marker in lowered for marker in markers):
                target_app_type = app_type
                break

        keywords = list(dict.fromkeys(tokens + [stack.lower().replace(".js", "") for stack in tech_stack]))
        github_terms = keywords[:6] or [raw_query]
        qualifiers = ["stars:>50", "archived:false"]
        if tech_stack:
            qualifiers.append(f"topic:{tech_stack[0].lower().replace('.js', '')}")
        github_query = " ".join(github_terms + qualifiers)

        return RepoIntent(
            raw_query=raw_query,
            keywords=keywords,
            github_query=github_query,
            tech_stack=tech_stack,
            target_app_type=target_app_type,
            is_frontend_only=target_app_type in {"frontend_web", "dashboard"},
            has_database=self._guess_database_need(lowered),
            constraints=(request.constraints.model_dump(exclude_none=True) if request.constraints else {}),
        )

    def _github_search(self, intent: RepoIntent, *, user_id: int) -> list[dict[str, Any]]:
        token = get_github_access_token(self.db, user_id)
        if not token:
            raise GitHubApiError("GitHub access token missing")
        query = parse.quote(intent.github_query)
        data = github_request_json(token, "GET", f"/search/repositories?q={query}&sort=stars&order=desc&per_page=20")
        items = data.get("items", []) if isinstance(data, dict) else []
        return [self._normalize_github_repo(item, RetrievalSource.GITHUB_SEARCH) for item in items]

    def _user_repo_recall(self, *, user_id: int) -> list[dict[str, Any]]:
        repos = list_github_repos(self.db, user_id)
        return [self._normalize_github_repo(item, RetrievalSource.USER_REPOS) for item in repos if isinstance(item, dict)]

    def _normalize_github_repo(self, item: dict[str, Any], source: RetrievalSource) -> dict[str, Any]:
        owner = item.get("owner") or {}
        return {
            "repo_url": item.get("html_url") or "",
            "full_name": item.get("full_name") or "",
            "name": item.get("name") or "",
            "owner": owner.get("login") or "",
            "description": item.get("description"),
            "default_branch": item.get("default_branch"),
            "topics": item.get("topics") or [],
            "stars": int(item.get("stargazers_count") or 0),
            "forks": int(item.get("forks_count") or 0),
            "language": item.get("language"),
            "is_archived": bool(item.get("archived")),
            "last_commit_at": item.get("pushed_at"),
            "retrieval_sources": [source],
        }

    def _rank_candidates(
        self,
        raw_candidates: list[dict[str, Any]],
        *,
        intent: RepoIntent,
        top_k: int,
        user_id: int,
        include_readme: bool,
    ) -> list[RagCandidate]:
        merged = self._dedupe(raw_candidates)
        scored: list[tuple[float, dict[str, Any], list[str]]] = []
        for repo in merged:
            score, reasons = self._score_repo(repo, intent)
            scored.append((score, repo, reasons))

        scored.sort(key=lambda item: item[0], reverse=True)
        candidates: list[RagCandidate] = []
        for rank, (score, repo, reasons) in enumerate(scored[:top_k], start=1):
            profile, skeleton_context = self._extract_repo_profile(repo, user_id=user_id, include_readme=include_readme)
            readme_summary = profile.readme_summary
            preferred_stack = self._build_preferred_stack(profile, intent)
            deployability_score = self._deployability_score(repo, profile)
            candidates.append(
                RagCandidate(
                    rank=rank,
                    repo_url=repo["repo_url"],
                    full_name=repo["full_name"],
                    name=repo["name"],
                    owner=repo["owner"],
                    description=repo.get("description"),
                    default_branch=repo.get("default_branch"),
                    topics=repo.get("topics", []),
                    stars=repo.get("stars", 0),
                    forks=repo.get("forks", 0),
                    language=repo.get("language"),
                    is_archived=repo.get("is_archived", False),
                    last_commit_at=repo.get("last_commit_at"),
                    retrieval_sources=repo.get("retrieval_sources", []),
                    retrieval_score=min(score, 100.0),
                    deployability_score=deployability_score,
                    final_score=min(score + deployability_score * 0.35, 100.0),
                    rerank_stage=RerankStage.COARSE,
                    match_reasons=self._append_skeleton_reasons(reasons, profile, skeleton_context),
                    readme_summary=readme_summary,
                    repo_profile=profile,
                    preferred_stack=preferred_stack,
                    missing_components=self._missing_components(profile),
                )
            )
        return candidates

    def _dedupe(self, repos: list[dict[str, Any]]) -> list[dict[str, Any]]:
        by_url: dict[str, dict[str, Any]] = {}
        for repo in repos:
            key = repo.get("repo_url") or repo.get("full_name")
            if not key:
                continue
            existing = by_url.get(key)
            if existing is None:
                by_url[key] = repo
                continue
            existing_sources = list(existing.get("retrieval_sources", []))
            for source in repo.get("retrieval_sources", []):
                if source not in existing_sources:
                    existing_sources.append(source)
            existing["retrieval_sources"] = existing_sources
        return list(by_url.values())

    def _score_repo(self, repo: dict[str, Any], intent: RepoIntent) -> tuple[float, list[str]]:
        score = 0.0
        reasons: list[str] = []
        haystack = " ".join(
            [
                repo.get("full_name") or "",
                repo.get("name") or "",
                repo.get("description") or "",
                " ".join(repo.get("topics", [])),
                repo.get("language") or "",
            ]
        ).lower()
        for keyword in intent.keywords:
            if keyword and keyword.lower() in haystack:
                score += 12
                reasons.append(f"keyword:{keyword}")
        for stack in intent.tech_stack:
            if stack.lower().replace(".js", "") in haystack:
                score += 14
                reasons.append(f"stack:{stack}")
        if repo.get("stars"):
            score += min(math.log(repo["stars"] + 1) * 8, 32)
            reasons.append("stars")
        if repo.get("is_archived"):
            score -= 30
            reasons.append("archived_penalty")
        if repo.get("last_commit_at") and str(repo["last_commit_at"]) >= "2023-01-01":
            score += 10
            reasons.append("recently_updated")
        return max(score, 0.0), sorted(dict.fromkeys(reasons))

    def _deployability_score(self, repo: dict[str, Any], profile: RepoProfile) -> float:
        score = 10.0
        if profile.detected_languages:
            score += 15
        if profile.detected_frameworks:
            score += 20
        if profile.package_manager:
            score += 20
        if profile.readme_summary:
            score += 10
        if repo.get("is_archived"):
            score -= 30
        return max(0.0, min(score, 100.0))

    def _extract_repo_profile(
        self,
        repo: dict[str, Any],
        *,
        user_id: int,
        include_readme: bool,
    ) -> tuple[RepoProfile, str | None]:
        token = get_github_access_token(self.db, user_id)
        if not token or not repo.get("owner") or not repo.get("name"):
            return self._build_repo_profile(repo, readme_summary=None), None
        try:
            skeleton = RemoteRepoSkeletonExtractor(
                token=token,
                owner=repo["owner"],
                repo=repo["name"],
                ref=repo.get("default_branch"),
                depth=2,
            ).extract()
            profile = skeleton.repo_profile
            fallback_profile = self._build_repo_profile(repo, readme_summary=profile.readme_summary)
            profile.detected_languages = profile.detected_languages or fallback_profile.detected_languages
            profile.detected_frameworks = profile.detected_frameworks or fallback_profile.detected_frameworks
            profile.package_manager = profile.package_manager or fallback_profile.package_manager
            profile.readme_summary = profile.readme_summary or fallback_profile.readme_summary
            return profile, skeleton.prompt_context
        except GitHubApiError:
            readme_summary = self._readme_summary(repo, token=token) if include_readme else None
            return self._build_repo_profile(repo, readme_summary=readme_summary), None

    def _readme_summary(self, repo: dict[str, Any], *, token: str) -> str | None:
        if not repo.get("owner") or not repo.get("name"):
            return None
        try:
            data = github_request_json(token, "GET", f"/repos/{repo['owner']}/{repo['name']}/readme", allow_404=True)
        except GitHubApiError:
            return None
        if not isinstance(data, dict) or not data.get("content"):
            return None
        try:
            content = base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
        except Exception:
            return None
        return self._summarize(content)

    def _append_skeleton_reasons(self, reasons: list[str], profile: RepoProfile, skeleton_context: str | None) -> list[str]:
        updated = list(reasons)
        if profile.dependency_files:
            updated.append("skeleton:dependencies")
        if profile.entrypoints:
            updated.append("skeleton:entrypoints")
        if profile.has_valid_dockerfile:
            updated.append("skeleton:dockerfile")
        if skeleton_context:
            updated.append("skeleton:context_extracted")
        return sorted(dict.fromkeys(updated))

    def _build_repo_profile(self, repo: dict[str, Any], *, readme_summary: str | None) -> RepoProfile:
        language = repo.get("language")
        frameworks = self._frameworks_from_repo(repo)
        package_manager = self._package_manager_from_frameworks(frameworks, language)
        return RepoProfile(
            source_repo_url=repo.get("repo_url"),
            detected_languages=[language] if language else [],
            detected_frameworks=frameworks,
            package_manager=package_manager,
            entrypoints=[],
            dependency_files=self._dependency_files(package_manager),
            has_valid_dockerfile=None,
            readme_summary=readme_summary or repo.get("description"),
        )

    def _build_preferred_stack(self, profile: RepoProfile, intent: RepoIntent) -> PreferredStack:
        framework = profile.detected_frameworks[0] if profile.detected_frameworks else None
        language = profile.detected_languages[0].lower() if profile.detected_languages else None
        frontend = framework if framework in {"React", "Next.js", "Vue", "Vite"} else None
        backend = framework if framework in {"FastAPI", "Flask", "Django", "Express"} else None
        if not backend and language in {"python", "go", "java"}:
            backend = language
        if intent.is_frontend_only and not frontend and framework:
            frontend = framework
        return PreferredStack(frontend=frontend, backend=backend, runtime=language)

    def _frameworks_from_repo(self, repo: dict[str, Any]) -> list[str]:
        haystack = " ".join(
            [repo.get("full_name") or "", repo.get("description") or "", " ".join(repo.get("topics", []))]
        ).lower()
        frameworks: list[str] = []
        for key, display in _STACK_ALIASES.items():
            if key in haystack and display not in frameworks:
                frameworks.append(display)
        language = repo.get("language")
        if language in {"JavaScript", "TypeScript"} and not frameworks:
            frameworks.append("Node.js")
        if language == "Python" and not frameworks:
            frameworks.append("Python")
        return frameworks

    def _package_manager_from_frameworks(self, frameworks: list[str], language: str | None) -> str | None:
        if any(item in frameworks for item in ("React", "Next.js", "Vue", "Vite", "Node.js", "Express")):
            return "npm"
        if language == "Python" or any(item in frameworks for item in ("Python", "FastAPI", "Flask", "Django")):
            return "pip"
        if language == "Go":
            return "go"
        return None

    def _dependency_files(self, package_manager: str | None) -> list[str]:
        return {
            "npm": ["package.json"],
            "pip": ["requirements.txt"],
            "go": ["go.mod"],
        }.get(package_manager or "", [])

    def _missing_components(self, profile: RepoProfile) -> list[str]:
        missing = ["Dockerfile", "healthcheck"]
        if not profile.dependency_files:
            missing.append("dependency_file")
        if not profile.entrypoints:
            missing.append("entry_file")
        return missing

    def _select_candidate(self, candidates: list[RagCandidate], selected_repo_url: str | None) -> RagCandidate | None:
        if selected_repo_url:
            for candidate in candidates:
                if candidate.repo_url == selected_repo_url:
                    return candidate
        return candidates[0] if candidates else None

    def _extract_stack(self, lowered_query: str) -> list[str]:
        stacks: list[str] = []
        for alias, display in _STACK_ALIASES.items():
            if alias in lowered_query and display not in stacks:
                stacks.append(display)
        return stacks

    def _tokenize(self, text: str) -> list[str]:
        raw_tokens = re.findall(r"[A-Za-z][A-Za-z0-9_.-]+|[\u4e00-\u9fff]{2,}", text.lower())
        return [token for token in raw_tokens if token not in _STOPWORDS][:10]

    def _guess_database_need(self, lowered_query: str) -> bool | None:
        if any(token in lowered_query for token in ("数据库", "database", "postgres", "mysql", "mongo")):
            return True
        if any(token in lowered_query for token in ("静态", "static", "portfolio", "个人网站")):
            return False
        return None

    def _summarize(self, text: str, max_length: int = 800) -> str:
        text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
        text = re.sub(r"\[[^\]]+\]\([^)]*\)", " ", text)
        text = re.sub(r"[#>*`|_-]+", " ", text)
        normalized = " ".join(text.split())
        return normalized[:max_length]
