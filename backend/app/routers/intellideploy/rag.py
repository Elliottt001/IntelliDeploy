import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.project import Project
from app.models.user import User
from app.schemas.fallback import StartFallbackTaskResponse, TaskStatus
from app.schemas.rag import (
    RagCandidate,
    RagChatRequest,
    RagChatResponse,
    RagSearchRequest,
    RagSearchResponse,
    RagStartGenerationRequest,
    RagStartGenerationResponse,
)
from app.services.full_pipeline_runner import run_full_pipeline_background
from app.services.rag_service import RagService
from app.services.intellideploy_project_utils import parse_repo_url
from app.services.intellideploy_sealos import slugify
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/rag", tags=["intellideploy-rag"])

logger = logging.getLogger(__name__)


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
    if request.prefetched_search is not None:
        # 前端已经先调用 /api/rag/search 拿到候选，这里直接复用，避免重复 LLM 调用
        # 让 chat 请求保持在亚秒级返回，WebSocket 能在流水线启动前先连上。
        search = request.prefetched_search
    else:
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
        if not search.candidates:
            detail = (
                "RAG retrieval returned no candidates. This usually means "
                "GitHub Search is rate-limited because no token is configured. "
                "Please set GITHUB_SEARCH_TOKENS (comma-separated list) in "
                "backend/.env and restart the backend."
            )
        else:
            detail = (
                "Selected repository is not in the candidate list "
                f"(selected_repo_url={request.selected_repo_url!r})."
            )
        logger.warning(
            "[/api/rag/chat] 404 returned: %s (raw_query=%r, candidates=%d, "
            "selected_repo_url=%r)",
            detail,
            request.raw_query,
            len(search.candidates),
            request.selected_repo_url,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    project = _get_or_create_project_from_candidate(
        db, current_user.id, candidate
    )
    deployment = Deployment(
        project_id=project.id,
        status="pending",
        runtime_name=slugify(project.name) or f"app-{project.id}",
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    # 把 Multi-Agent + 降级生成 + 构建部署整条链路丢到后台任务里跑，
    # HTTP 立即返回 deployment_id —— 让前端有机会先连 WebSocket，
    # 后台任务再开始广播 stage 事件（哪怕跑得快，WS manager 也会缓冲并 replay）。
    asyncio.create_task(
        run_full_pipeline_background(
            deployment_id=deployment.id,
            project_id=project.id,
            raw_query=request.raw_query,
            request_id=search.request_id or f"rag-{deployment.id}",
            repo_profile=candidate.repo_profile,
            preferred_stack=candidate.preferred_stack,
            constraints=request.constraints,
            evaluation_score=candidate.final_score,
            missing_components=list(candidate.missing_components or []),
            generation_mode=request.generation_mode,
            trigger_reason=request.trigger_reason,
        )
    )

    # 返回一个"已入队"占位 generation response —— 真正的进度走 WebSocket
    queued_generation = StartFallbackTaskResponse(
        accepted=True,
        task_id=f"pending-{deployment.id}",
        status=TaskStatus.QUEUED,
        queued_at=datetime.now(),
        message=(
            "Pipeline kicked off in background. "
            "Subscribe to /ws/deployments/{deployment_id} for live progress."
        ),
    )

    return RagChatResponse(
        search=search,
        generation=queued_generation,
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
