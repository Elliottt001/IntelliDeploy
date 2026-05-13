from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.project import Project
from app.models.user import User
from app.schemas.rag import (
    RagCandidate,
    RagChatRequest,
    RagChatResponse,
    RagSearchRequest,
    RagSearchResponse,
    RagStartGenerationRequest,
    RagStartGenerationResponse,
)
from app.services.rag_service import RagService
from app.services.multi_agent_deployment_service import MultiAgentConsensusRejected
from app.services.intellideploy_project_utils import parse_repo_url
from app.services.intellideploy_sealos import slugify
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/rag", tags=["intellideploy-rag"])


@router.post("/search", response_model=RagSearchResponse)
async def search_repositories(
    request: RagSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await RagService(db).search(request, user_id=current_user.id)


@router.post("/start-generation", response_model=RagStartGenerationResponse)
async def start_generation_from_rag(
    request: RagStartGenerationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        search, generation = await RagService(db).start_generation(request, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return RagStartGenerationResponse(search=search, generation=generation)


@router.post("/chat", response_model=RagChatResponse)
async def chat_from_prompt(
    request: RagChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = RagService(db)
    search = await service.search(
        RagSearchRequest(
            raw_query=request.raw_query,
            preferred_stack=request.preferred_stack,
            constraints=request.constraints,
            top_k=request.top_k,
            include_readme=True,
        ),
        user_id=current_user.id,
    )
    candidate = _select_candidate(search.candidates, request.selected_repo_url)
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No RAG candidate is available for generation.",
        )

    project = _get_or_create_project_from_candidate(db, current_user.id, candidate)
    deployment = Deployment(
        project_id=project.id,
        status="pending",
        runtime_name=slugify(project.name) or f"app-{project.id}",
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    try:
        generation = await service.start_generation_for_candidate(
            search_response=search,
            candidate=candidate,
            project_id=str(project.id),
            deployment_id=str(deployment.id),
            raw_query=request.raw_query,
            request_id=search.request_id,
            generation_mode=request.generation_mode,
            trigger_reason=request.trigger_reason,
            constraints=request.constraints,
        )
    except MultiAgentConsensusRejected as exc:
        deployment.status = "failed"
        deployment.error_message = str(exc)
        deployment.error_type = "MULTI_AGENT_REJECTED"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": str(exc),
                "consensus": exc.consensus_result,
                "trace": exc.graph_state.get("trace", []),
            },
        ) from exc
    except Exception:
        db.delete(deployment)
        db.commit()
        raise

    return RagChatResponse(
        search=search,
        generation=generation,
        project_id=str(project.id),
        deployment_id=str(deployment.id),
    )


def _select_candidate(candidates: list[RagCandidate], selected_repo_url: str | None) -> RagCandidate | None:
    if selected_repo_url:
        for candidate in candidates:
            if candidate.repo_url == selected_repo_url:
                return candidate
    return candidates[0] if candidates else None


def _get_or_create_project_from_candidate(db: Session, user_id: int, candidate: RagCandidate) -> Project:
    existing = (
        db.query(Project)
        .filter(Project.user_id == user_id, Project.repo_url == candidate.repo_url)
        .first()
    )
    if existing:
        return existing

    parsed = parse_repo_url(candidate.repo_url) or {}
    project = Project(
        name=candidate.name,
        repo_url=candidate.repo_url,
        repo_owner=parsed.get("owner") or candidate.owner,
        repo_name=parsed.get("repo") or candidate.name,
        visibility="public",
        default_branch=candidate.default_branch or "main",
        user_id=user_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
