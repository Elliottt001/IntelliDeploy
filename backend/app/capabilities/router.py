from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.apps.models import Instance
from app.capabilities.identity import consume_login_code, issue_app_identity, issue_login_code
from app.config import settings
from app.core.errors import abort
from app.database import get_db
from app.models.user import User
from app.utils.security import get_current_user


router = APIRouter(tags=["capabilities"])


class LoginCodeRequest(BaseModel):
    callback: str = Field(min_length=1, max_length=2048)


class LoginCodeResponse(BaseModel):
    code: str
    expires_in: int = 60


class IdentityExchangeRequest(LoginCodeRequest):
    code: str = Field(min_length=16, max_length=512)
    instance_token: str = Field(min_length=16, max_length=1024)


class IdentityExchangeResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


@router.post("/api/instances/{instance_id}/login-code", response_model=LoginCodeResponse)
def create_login_code(
    instance_id: str,
    body: LoginCodeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    instance = db.get(Instance, instance_id)
    if instance is None or instance.owner_id != user.id:
        abort("NOT_FOUND", "实例不存在或无权访问", 404)
    try:
        code = issue_login_code(db, instance_id, user.id, body.callback)
    except ValueError as exc:
        abort("CALLBACK_INVALID", str(exc), 422)
    db.commit()
    return LoginCodeResponse(code=code)


@router.post(
    "/api/capabilities/identity/exchange", response_model=IdentityExchangeResponse
)
def exchange_identity(body: IdentityExchangeRequest, db: Session = Depends(get_db)):
    user_id, instance = consume_login_code(
        db, body.code, body.callback, body.instance_token
    )
    token = issue_app_identity(user_id, instance.app_id, instance.id)
    db.commit()
    return IdentityExchangeResponse(
        access_token=token, expires_in=settings.APP_IDENTITY_TTL_SECONDS
    )

