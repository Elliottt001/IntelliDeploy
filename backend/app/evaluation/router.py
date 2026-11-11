from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.errors import abort
from app.database import get_db
from app.evaluation.schemas import EvaluationTarget
from app.models.user import User
from app.runtime.models import DeploymentTarget
from app.utils.security import get_current_user


router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


def require_evaluation_user(user: User = Depends(get_current_user)) -> User:
    if not settings.ENABLE_EVALUATION_UI or not user.is_developer:
        abort("NOT_FOUND", "接口不存在", 404)
    return user


@router.get("/targets", response_model=list[EvaluationTarget])
def targets(
    _user: User = Depends(require_evaluation_user), db: Session = Depends(get_db)
):
    rows = list(
        db.scalars(
            select(DeploymentTarget)
            .where(
                DeploymentTarget.enabled.is_(True),
                DeploymentTarget.health == "HEALTHY",
            )
            .order_by(DeploymentTarget.id)
        )
    )
    return [
        EvaluationTarget(
            target_id=row.id,
            name=str((row.capacity or {}).get("name") or row.id),
            kind=row.kind,
        )
        for row in rows
    ]
