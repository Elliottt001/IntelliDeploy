from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.errors import abort
from app.database import get_db
from app.apps import service
from app.core.types import CreateAppResponse
from app.evaluation.schemas import EvaluationRunRequest, EvaluationTarget
from app.models.user import User
from app.runtime.models import DeploymentTarget
from app.utils.security import get_current_user


router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])
Key = Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=200)]


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


@router.post("/runs", response_model=CreateAppResponse, status_code=201)
def create_run(
    body: EvaluationRunRequest,
    key: Key,
    user: User = Depends(require_evaluation_user),
    db: Session = Depends(get_db),
):
    app, job = service.create_app(
        db,
        user.id,
        body.prompt,
        key,
        body.budget_units,
        evaluation_target_id=body.target_id,
        algorithm_mode=body.algorithm_mode,
    )
    return CreateAppResponse(app_id=app.id, job_id=job.id, status="QUEUED")
