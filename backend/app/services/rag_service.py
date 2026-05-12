from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
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
)
from app.services.generation_task_service import GenerationTaskService
from app.schemas.retrieval import RepoSearchRequest, RepoSearchResponse
from app.services.retrieval_service import RetrievalService, get_retrieval_service


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

class RagService:
    """Backward-compatible adapter over Lin Zihao's retrieval module."""

    def __init__(self, db: Session, retrieval_service: RetrievalService | None = None) -> None:
        self.db = db
        self.retrieval_service = retrieval_service or get_retrieval_service()

    async def search(self, request: RagSearchRequest, *, user_id: int) -> RagSearchResponse:
        request_id = f"rag-{uuid4().hex[:12]}"
        retrieval_response = await self.retrieval_service.search(
            RepoSearchRequest(
                natural_language_query=request.raw_query,
                top_n=request.top_k,
            )
        )
        return self.search_response_from_retrieval(request_id, retrieval_response)

    def search_response_from_retrieval(
        self,
        request_id: str,
        retrieval_response: RepoSearchResponse,
    ) -> RagSearchResponse:
        intent = self._intent_from_retrieval(retrieval_response)
        candidates = self._candidates_from_retrieval(retrieval_response)
        return RagSearchResponse(
            request_id=request_id,
            intent=intent,
            candidates=candidates,
            selected=candidates[0] if candidates else None,
            generated_at=datetime.now(UTC),
            warnings=[],
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

    def _intent_from_retrieval(self, response: RepoSearchResponse) -> RepoIntent:
        intent = response.intent
        return RepoIntent(
            raw_query=intent.raw_query,
            keywords=list(intent.keywords),
            github_query=intent.github_query,
            tech_stack=list(intent.tech_stack),
            target_app_type=intent.target_app_type,
            target_output_type=intent.target_output_type,
            is_frontend_only=bool(intent.is_frontend_only),
            has_database=intent.has_database,
            constraints=dict(intent.constraints),
        )

    def _candidates_from_retrieval(self, response: RepoSearchResponse) -> list[RagCandidate]:
        candidates: list[RagCandidate] = []
        for index, candidate in enumerate(response.candidates, start=1):
            profile = (
                response.repository_profile
                if index == 1 and response.repository_profile is not None
                else self._profile_from_retrieval_candidate(candidate)
            )
            preferred_stack = self._build_preferred_stack(profile, self._intent_from_retrieval(response))
            final_score = min(float(candidate.score or candidate.retrieval_score or 0), 100.0)
            candidates.append(
                RagCandidate(
                    rank=candidate.rank or index,
                    repo_url=candidate.repo_url or candidate.html_url,
                    full_name=candidate.full_name,
                    name=candidate.full_name.rsplit("/", 1)[-1],
                    owner=candidate.full_name.split("/", 1)[0] if "/" in candidate.full_name else "",
                    description=candidate.description,
                    default_branch=candidate.default_branch,
                    topics=list(candidate.topics),
                    stars=candidate.stars,
                    forks=candidate.forks,
                    language=candidate.language,
                    is_archived=candidate.is_archived,
                    last_commit_at=candidate.last_commit_at or candidate.pushed_at,
                    retrieval_sources=list(candidate.source_scores.keys()),
                    retrieval_score=final_score,
                    deployability_score=self._deployability_score_from_breakdown(candidate.score_breakdown),
                    final_score=final_score,
                    rerank_stage=RerankStage.LLM if candidate.score_breakdown else RerankStage.COARSE,
                    match_reasons=self._match_reasons_from_candidate(candidate),
                    readme_summary=profile.readme_summary,
                    repo_profile=profile,
                    preferred_stack=preferred_stack,
                    missing_components=self._missing_components(profile),
                )
            )
        return candidates

    def _profile_from_retrieval_candidate(self, candidate: Any) -> RepoProfile:
        frameworks = self._frameworks_from_repo(
            {
                "full_name": candidate.full_name,
                "description": candidate.description,
                "topics": candidate.topics,
                "language": candidate.language,
            }
        )
        package_manager = self._package_manager_from_frameworks(frameworks, candidate.language)
        return RepoProfile(
            source_repo_url=candidate.repo_url or candidate.html_url,
            detected_languages=[candidate.language] if candidate.language else [],
            detected_frameworks=frameworks,
            package_manager=package_manager,
            entrypoints=[],
            dependency_files=self._dependency_files(package_manager),
            has_valid_dockerfile=bool(candidate.score_breakdown.get("docker_bonus")),
            readme_summary=(candidate.readme_snippet or candidate.description)[:500] or None,
        )

    def _deployability_score_from_breakdown(self, breakdown: dict[str, float]) -> float:
        if not breakdown:
            return 0.0
        return min(
            breakdown.get("docker_bonus", 0)
            + breakdown.get("template_stack_bonus", 0)
            + breakdown.get("package_structure", 0),
            100.0,
        )

    def _match_reasons_from_candidate(self, candidate: Any) -> list[str]:
        reasons = [f"source:{source}" for source in candidate.source_scores]
        for key, value in candidate.score_breakdown.items():
            if value > 0:
                reasons.append(f"score:{key}")
        return sorted(dict.fromkeys(reasons))

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
