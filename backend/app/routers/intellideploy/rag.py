from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.rag import (
    RagSearchRequest,
    RagSearchResponse,
    RagStartGenerationRequest,
    RagStartGenerationResponse,
)
from app.services.rag_service import RagService
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
