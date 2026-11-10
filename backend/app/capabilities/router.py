from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Header, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.apps.models import Instance
from app.capabilities.files import FileAccessDenied, FileStore
from app.capabilities.ai import chat
from app.capabilities.identity import consume_login_code, issue_app_identity, issue_login_code
from app.capabilities.search import fetch, search
from app.config import settings
from app.core.errors import abort
from app.database import SessionLocal, get_db
from app.models.user import User
from app.utils.security import get_current_user


router = APIRouter(tags=["capabilities"])


@router.get('/api/instances/{instance_id}/access')
def instance_access(instance_id:str,
    instance_token:Annotated[str,Header(alias='X-Instance-Token')],
    authorization:Annotated[str|None,Header()]=None,
    db:Session=Depends(get_db)):
    from app.capabilities.identity import _verify_instance_credential,verify_app_identity
    from app.community.service import active_publication
    from app.runtime.access import authorize_instance_access,AccessDenied
    instance=db.get(Instance,instance_id)
    if instance is None: abort('NOT_FOUND','实例不存在',404)
    _verify_instance_credential(db,instance_id,instance_token)
    from app.runtime.models import ResourceRecord
    from sqlalchemy import select
    migration=db.scalar(select(ResourceRecord).where(ResourceRecord.type=='MIGRATION_GUARD',ResourceRecord.reference==instance_id,ResourceRecord.state.in_(['PREPARING','APPLYING','UNKNOWN'])))
    user_id=None
    if authorization:
        scheme,_,token=authorization.partition(' ')
        if scheme.lower()!='bearer' or not token: abort('IDENTITY_INVALID','应用身份格式无效',401)
        user_id=verify_app_identity(token,instance.app_id,instance_id)
    from app.capabilities.identity import candidate_context
    context=candidate_context(db,instance,user_id)
    if context:
        return Response(content=__import__('json').dumps({'allowed':True,'user_id':context.user_id}),media_type='application/json',headers={'Cache-Control':'no-store'})
    if migration:abort('INSTANCE_MAINTENANCE','应用数据正在维护或等待核对',403)
    if instance.status!='RUNNING': abort('INSTANCE_UNAVAILABLE','应用暂不可用',403)
    try:
        user_id=authorize_instance_access(owner_id=instance.owner_id,public_visible=active_publication(db,instance_id) is not None,authenticated_user_id=user_id,forwarded_user_id=None,trusted_gateway=False)
    except AccessDenied: abort('INSTANCE_FORBIDDEN','应用未公开或无权访问',403)
    return Response(content=__import__('json').dumps({'allowed':True,'user_id':user_id}),media_type='application/json',headers={'Cache-Control':'no-store'})


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


class FileIdResponse(BaseModel):
    file_id: str


class CapabilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: str = Field(min_length=1, max_length=128)


class ChatRequest(CapabilityRequest):
    messages: list[dict] = Field(min_length=1)
    model: str = Field(min_length=1, max_length=128)


class SearchRequest(CapabilityRequest):
    query: str = Field(min_length=1, max_length=128)
    count: int = Field(default=5, ge=1, le=50)


class FetchRequest(CapabilityRequest):
    url: str = Field(min_length=1, max_length=2048)


def capability_context(
    instance_id: Annotated[str, Header(alias="X-Instance-ID")],
    instance_token: Annotated[str, Header(alias="X-Instance-Token")],
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
):
    from app.capabilities.identity import resolve_context

    user_token = None
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() != "bearer" or not value:
            abort("IDENTITY_INVALID", "应用身份格式无效", 401)
        user_token = value
    return resolve_context(db, instance_id, user_token, instance_token)


@router.post("/api/instances/{instance_id}/login-code", response_model=LoginCodeResponse)
def create_login_code(
    instance_id: str,
    body: LoginCodeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    instance = db.get(Instance, instance_id)
    from app.community.service import active_publication
    if instance is None or (instance.owner_id != user.id and active_publication(db,instance_id) is None):
        abort("NOT_FOUND", "实例不存在或无权访问", 404)
    try:
        code = issue_login_code(db, instance_id, user.id, body.callback)
    except ValueError as exc:
        abort("CALLBACK_INVALID", str(exc), 422)
    db.commit()
    return Response(content=LoginCodeResponse(code=code).model_dump_json(),media_type='application/json',headers={'Cache-Control':'no-store'})


@router.post(
    "/api/capabilities/identity/exchange", response_model=IdentityExchangeResponse
)
def exchange_identity(body: IdentityExchangeRequest, db: Session = Depends(get_db)):
    user_id, instance = consume_login_code(
        db, body.code, body.callback, body.instance_token
    )
    token = issue_app_identity(user_id, instance.app_id, instance.id)
    db.commit()
    result=IdentityExchangeResponse(
        access_token=token, expires_in=settings.APP_IDENTITY_TTL_SECONDS
    )
    return Response(content=result.model_dump_json(),media_type='application/json',headers={'Cache-Control':'no-store'})


@router.post("/api/capabilities/files", response_model=FileIdResponse, status_code=201)
def upload_file(
    file: Annotated[UploadFile, File()],
    public: bool = False,
    context=Depends(capability_context),
):
    store = FileStore(
        session_factory=SessionLocal,
        root=Path(settings.INSTANCE_FILES_ROOT),
        max_bytes=settings.INSTANCE_FILE_MAX_BYTES,
    )
    try:
        return FileIdResponse(
            file_id=store.create(context, file.file, file.filename or "", public)
        )
    except FileAccessDenied as exc:
        abort("FILE_FORBIDDEN", str(exc), 403)
    except ValueError as exc:
        abort("FILE_INVALID", str(exc), 422)


@router.get("/api/capabilities/files/{file_id}")
def download_file(file_id: str, context=Depends(capability_context)):
    store = FileStore(
        session_factory=SessionLocal,
        root=Path(settings.INSTANCE_FILES_ROOT),
        max_bytes=settings.INSTANCE_FILE_MAX_BYTES,
    )
    try:
        record = store.record(context, file_id)
        return Response(
            content=store.read(context, file_id),
            media_type=record.content_type,
            headers={"Cache-Control": "no-store"},
        )
    except FileAccessDenied as exc:
        abort("FILE_NOT_FOUND", str(exc), 404)


@router.post("/api/capabilities/chat")
async def capability_chat(body: ChatRequest, context=Depends(capability_context)):
    return await chat(context, body.messages, body.model, body.operation_id)


@router.post("/api/capabilities/search")
async def capability_search(body: SearchRequest, context=Depends(capability_context)):
    return await search(context, body.query, body.operation_id, body.count)


@router.post("/api/capabilities/fetch")
async def capability_fetch(body: FetchRequest, context=Depends(capability_context)):
    return await fetch(context, body.url, body.operation_id)

