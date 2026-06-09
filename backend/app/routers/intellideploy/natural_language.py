from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.natural_language_deploy import (
    NaturalLanguageDeployRequest,
    NaturalLanguageDeployResponse,
)
from app.services.natural_language_deploy_service import NaturalLanguageDeployService
from app.utils.security import get_current_user


router = APIRouter(prefix="/api/nl-deploy", tags=["natural-language-deploy"])


def get_natural_language_deploy_service(
    db: Session = Depends(get_db),
) -> NaturalLanguageDeployService:
    return NaturalLanguageDeployService(db)


@router.post("/start", response_model=NaturalLanguageDeployResponse)
async def start_natural_language_deployment(
    request: NaturalLanguageDeployRequest,
    current_user: User = Depends(get_current_user),
    service: NaturalLanguageDeployService = Depends(get_natural_language_deploy_service),
):
    try:
        return await service.run(request, current_user=current_user)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Natural language deployment failed: {exc}",
        ) from exc
