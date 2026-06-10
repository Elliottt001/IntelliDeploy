from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.project import Project
from app.models.user import User
from app.schemas.fallback import (
    Constraints,
    GenerationMode,
    PreferredStack,
    RepoProfile,
    StartFallbackTaskRequest,
    TriggerReason,
)
from app.schemas.natural_language_deploy import (
    NaturalLanguageDeployRequest,
    NaturalLanguageDeployResponse,
)
from app.schemas.retrieval import RepoSearchRequest
from app.services.deployment_orchestrator import DeploymentOrchestrator
from app.services.generation_task_service import GenerationTaskService
from app.services.intellideploy_sealos import slugify
from app.services.retrieval_service import RetrievalService, get_retrieval_service


def _first_present(items: Iterable[str | None]) -> str | None:
    for item in items:
        if item:
            return item
    return None


def _frameworks_from_candidate(candidate: RepositoryCandidate | None) -> list[str]:
    if candidate is None:
        return []
    haystack = " ".join(
        [
            candidate.description or "",
            " ".join(candidate.topics or []),
            " ".join(candidate.file_tree or []),
            " ".join(candidate.key_files.values() if candidate.key_files else []),
        ]
    ).lower()
    frameworks: list[str] = []
    for label, needles in {
        "FastAPI": ["fastapi"],
        "Flask": ["flask"],
        "Next.js": ["next", "next.js"],
        "React": ["react", "vite"],
        "Express": ["express"],
    }.items():
        if any(needle in haystack for needle in needles):
            frameworks.append(label)
    return frameworks


def _package_manager_from_candidate(candidate: RepositoryCandidate | None) -> str | None:
    files = set(candidate.file_tree or candidate.files or []) if candidate else set()
    key_files = set(candidate.key_files or {}) if candidate else set()
    all_files = files | key_files
    if "requirements.txt" in all_files:
        return "pip"
    if "package-lock.json" in all_files or "package.json" in all_files:
        return "npm"
    if "pnpm-lock.yaml" in all_files:
        return "pnpm"
    if "yarn.lock" in all_files:
        return "yarn"
    return None


class NaturalLanguageDeployService:
    def __init__(
        self,
        db: Session,
        *,
        retrieval_service: RetrievalService | None = None,
        generation_service: GenerationTaskService | None = None,
        orchestrator_factory=None,
    ) -> None:
        self.db = db
        self.retrieval_service = retrieval_service or get_retrieval_service()
        self.generation_service = generation_service or GenerationTaskService(db)
        self.orchestrator_factory = orchestrator_factory or (
            lambda kubeconfig=None: DeploymentOrchestrator(db, kubeconfig=kubeconfig)
        )

    async def run(
        self,
        request: NaturalLanguageDeployRequest,
        *,
        current_user: User,
    ) -> NaturalLanguageDeployResponse:
        retrieval = await self.retrieval_service.search(
            RepoSearchRequest(
                natural_language_query=request.natural_language_query,
                top_n=request.top_n,
                readme_corpus=request.readme_corpus,
            )
        )
        candidate = retrieval.candidates[0] if retrieval.candidates else None
        project = self._get_or_create_project(candidate, current_user)
        deployment = self._create_deployment(project)

        fallback_request = self._build_fallback_request(
            request=request,
            project=project,
            deployment=deployment,
            candidate=candidate,
            repo_profile=retrieval.repository_profile,
        )
        task_response = await self.generation_service.start_fallback_task(fallback_request)

        artifact = None
        if task_response.status.value == "SUCCEEDED":
            artifact = await self.generation_service.get_artifact_result(task_response.task_id)

        if artifact is None:
            deployment.status = "generation_pending"
            self.db.commit()
            return NaturalLanguageDeployResponse(
                status="generation_pending",
                message="Fallback generation has been queued.",
                intent=retrieval.intent,
                selected_repository=candidate,
                project_id=project.id,
                deployment_id=deployment.id,
                task_id=task_response.task_id,
            )

        if not artifact.deploy_ready:
            deployment.status = "manual_review"
            self.db.commit()
            return NaturalLanguageDeployResponse(
                status="manual_review",
                message="Artifact generated but needs manual review before deployment.",
                intent=retrieval.intent,
                selected_repository=candidate,
                project_id=project.id,
                deployment_id=deployment.id,
                task_id=task_response.task_id,
                artifact=artifact,
            )

        kubeconfig = request.kubeconfig or current_user.kubeconfig
        if not request.deploy or not kubeconfig:
            deployment.status = "artifact_ready"
            deployment.dockerfile_content = artifact.dockerfile_content
            self.db.commit()
            message = (
                "Artifact generated; deployment skipped by request."
                if not request.deploy
                else "Artifact generated; kubeconfig is required to deploy."
            )
            return NaturalLanguageDeployResponse(
                status="artifact_ready",
                message=message,
                intent=retrieval.intent,
                selected_repository=candidate,
                project_id=project.id,
                deployment_id=deployment.id,
                task_id=task_response.task_id,
                artifact=artifact,
            )

        orchestrator = self.orchestrator_factory(kubeconfig)
        deployment_result = await orchestrator.start_deployment(
            deployment_id=deployment.id,
            artifact=artifact,
            kubeconfig=kubeconfig,
        )
        return NaturalLanguageDeployResponse(
            status="deployed",
            message="Artifact generated and deployment started.",
            intent=retrieval.intent,
            selected_repository=candidate,
            project_id=project.id,
            deployment_id=deployment.id,
            task_id=task_response.task_id,
            artifact=artifact,
            deployment_result=deployment_result,
        )

    def _get_or_create_project(
        self, candidate: RepositoryCandidate | None, current_user: User
    ) -> Project:
        if candidate:
            repo_url = candidate.repo_url or candidate.html_url
            full_name = candidate.full_name or "generated/generated-app"
            owner, _, repo_name = full_name.partition("/")
            name = repo_name or slugify(candidate.description or "generated-app") or "generated-app"
            existing = (
                self.db.query(Project)
                .filter(Project.user_id == current_user.id, Project.repo_url == repo_url)
                .first()
            )
            if existing:
                return existing
            project = Project(
                name=name,
                repo_url=repo_url,
                repo_owner=owner or "generated",
                repo_name=repo_name or name,
                visibility="public",
                default_branch=candidate.default_branch or "main",
                user_id=current_user.id,
            )
        else:
            name = slugify("generated-app") or "generated-app"
            project = Project(
                name=name,
                repo_url=f"generated://{current_user.id}/{name}",
                repo_owner="generated",
                repo_name=name,
                visibility="generated",
                default_branch="main",
                user_id=current_user.id,
            )

        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def _create_deployment(self, project: Project) -> Deployment:
        runtime_name = slugify(f"{project.name}-{project.id}") or f"app-{project.id}"
        deployment = Deployment(
            project_id=project.id,
            status="pending",
            runtime_name=runtime_name,
        )
        self.db.add(deployment)
        self.db.commit()
        self.db.refresh(deployment)
        return deployment

    def _build_fallback_request(
        self,
        *,
        request: NaturalLanguageDeployRequest,
        project: Project,
        deployment: Deployment,
        candidate: RepositoryCandidate | None,
        repo_profile: RepoProfile | None,
    ) -> StartFallbackTaskRequest:
        resolved_profile = repo_profile or self._repo_profile_from_candidate(candidate)
        preferred_stack = self._preferred_stack(resolved_profile)
        return StartFallbackTaskRequest(
            project_id=str(project.id),
            deployment_id=str(deployment.id),
            trigger_reason=TriggerReason.FORCE_FALLBACK,
            original_prompt=request.natural_language_query,
            generation_mode=GenerationMode.AUTO,
            preferred_stack=preferred_stack,
            repo_profile=resolved_profile,
            constraints=Constraints(must_provide_dockerfile=True, must_provide_healthcheck=True),
            file_tree=candidate.file_tree if candidate else None,
            key_files=candidate.key_files if candidate else None,
        )

    def _repo_profile_from_candidate(
        self, candidate: RepositoryCandidate | None
    ) -> RepoProfile | None:
        if candidate is None:
            return None
        frameworks = _frameworks_from_candidate(candidate)
        return RepoProfile(
            source_repo_url=candidate.repo_url or candidate.html_url,
            detected_languages=[candidate.language] if candidate.language else [],
            detected_frameworks=frameworks,
            package_manager=_package_manager_from_candidate(candidate),
            entrypoints=[
                path
                for path in candidate.file_tree or []
                if path.endswith(("main.py", "app.py", "server.js", "package.json"))
            ],
            dependency_files=[
                path
                for path in candidate.file_tree or []
                if path.endswith(("requirements.txt", "package.json", "pyproject.toml"))
            ],
            has_valid_dockerfile=any(
                path.lower() == "dockerfile" for path in (candidate.file_tree or candidate.files or [])
            ),
            readme_summary=candidate.readme_snippet or candidate.description,
        )

    def _preferred_stack(self, repo_profile: RepoProfile | None) -> PreferredStack:
        frameworks = repo_profile.detected_frameworks if repo_profile else []
        languages = repo_profile.detected_languages if repo_profile else []
        backend = _first_present(
            framework for framework in frameworks if framework in {"FastAPI", "Flask", "Express"}
        )
        frontend = _first_present(
            framework for framework in frameworks if framework in {"Next.js", "React", "Vue"}
        )
        language = (languages[0].lower() if languages else "")
        runtime = "python3.11" if "python" in language else "node20" if language else None
        return PreferredStack(frontend=frontend, backend=backend, runtime=runtime)
