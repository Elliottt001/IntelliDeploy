from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.apps import service
from app.core.types import AppDetail, AppPage, CreateAppRequest, CreateAppResponse, JobRef, MessageRequest
from app.database import get_db
from app.models.user import User
from app.utils.security import get_current_user

router = APIRouter(prefix='/api/apps', tags=['apps'])
Key = Annotated[str, Header(alias='Idempotency-Key', min_length=1, max_length=200)]


@router.post('', response_model=CreateAppResponse, status_code=201)
def create(body: CreateAppRequest, key: Key, user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    app, job = service.create_app(db,user.id,body.prompt,key,body.budget_units,body.evaluation_target_id)
    # The original create response is QUEUED; later state comes from GET jobs.
    return CreateAppResponse(app_id=app.id,job_id=job.id,status='QUEUED')


@router.get('', response_model=AppPage)
def listing(cursor: str|None=None, limit: int=Query(default=20,ge=1,le=100), user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    return service.list_apps(db,user.id,cursor,limit)


@router.get('/{app_id}', response_model=AppDetail)
def detail(app_id: str, user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    return service.app_detail(db,service.owned_app(db,app_id,user.id))


@router.post('/{app_id}/messages', response_model=JobRef, status_code=202)
def message(app_id: str, body: MessageRequest, key: Key, user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    return service.add_message(db,app_id,user.id,body.content,key,body.budget_units)


@router.get('/{app_id}/versions/{version_id}/artifact')
def artifact(app_id: str,version_id: str,user: User=Depends(get_current_user),db: Session=Depends(get_db)):
    path=service.artifact_path(db,app_id,version_id,user.id)
    return FileResponse(path,media_type='application/zip',filename=f'{app_id}-{version_id}.zip')
