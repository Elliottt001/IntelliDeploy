import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, sessionmaker

from app.apps import service
from app.apps.router import Key
from app.core.errors import abort
from app.core.types import JobRef, JobReport, JobSnapshot, ResumeRequest
from app.database import get_db
from app.jobs.events import encode_event, events_after
from app.models.user import User
from app.utils.security import get_current_user

router = APIRouter(prefix='/api/jobs', tags=['jobs'])


@router.get('/{job_id}', response_model=JobSnapshot)
def snapshot(job_id: str, user: User=Depends(get_current_user),db: Session=Depends(get_db)):
    return service.job_snapshot(db,service.owned_job(db,job_id,user.id))


@router.get('/{job_id}/report', response_model=JobReport)
def report(job_id: str,user: User=Depends(get_current_user),db: Session=Depends(get_db)):
    return service.job_report(db,service.owned_job(db,job_id,user.id))


@router.get('/{job_id}/report/evidence/{evidence_id}')
def evidence(job_id: str,evidence_id: str,user: User=Depends(get_current_user),db: Session=Depends(get_db)):
    path,mime=service.evidence_path(db,job_id,evidence_id,user.id)
    return FileResponse(path,media_type=mime,headers={'Cache-Control':'no-store'})


@router.get('/{job_id}/events')
def stream(job_id: str,request: Request,after_id: int=Query(default=0,ge=0),last_event_id: Annotated[str|None,Header()]=None,user: User=Depends(get_current_user),db: Session=Depends(get_db)):
    service.owned_job(db,job_id,user.id)
    try:
        cursor=max(after_id,int(last_event_id or 0))
        if cursor<0:
            raise ValueError()
    except ValueError:
        abort('CURSOR_INVALID','事件游标无效',422)
    sessions=sessionmaker(bind=db.get_bind(),expire_on_commit=False)
    owner_id=user.id
    db.rollback()
    def read(after):
        with sessions() as session:
            job=service.owned_job(session,job_id,owner_id)
            return [(e.id,encode_event(e)) for e in events_after(session,job_id,after)],job.status
    async def generate():
        nonlocal cursor
        while not await request.is_disconnected():
            events,status=await asyncio.to_thread(read,cursor)
            for event_id,payload in events:
                cursor=event_id
                yield payload
            if status in {'SUCCEEDED','FAILED','CANCELLED'} and len(events)<100:
                break
            if not events:
                yield ': heartbeat\n\n'
                await asyncio.sleep(1)
    return StreamingResponse(generate(),media_type='text/event-stream',headers={'Cache-Control':'no-store','X-Accel-Buffering':'no'})


@router.post('/{job_id}/cancel',response_model=JobRef,status_code=202)
def cancel(job_id: str,key: Key,response: Response,user: User=Depends(get_current_user),db: Session=Depends(get_db)):
    action='cancel:'+job_id
    record,digest=service.replay(db,user.id,action,key,{})
    job=service.owned_job(db,job_id,user.id,lock=True)
    if record:
        return JobRef.model_validate(record.response)
    if job.status in {'SUCCEEDED','FAILED','CANCELLED'}:
        response.status_code=200
    else:
        job.cancel_requested=True
        if job.status=='QUEUED' and job.lease_generation==0:
            job.status='CANCELLED'
        job.updated_at=func.now()
    result=JobRef(app_id=job.app_id,job_id=job.id,status=job.status)
    service.remember(db,user.id,action,key,digest,result.model_dump(mode='json'))
    return result


@router.post('/{job_id}/resume',response_model=JobRef,status_code=202)
def resume(job_id: str,key: Key,body: ResumeRequest|None=None,user: User=Depends(get_current_user),db: Session=Depends(get_db)):
    action='resume:'+job_id
    payload=body.model_dump() if body else {'budget_units':None}
    record,digest=service.replay(db,user.id,action,key,payload)
    job=service.owned_job(db,job_id,user.id,lock=True)
    if record:
        return JobRef.model_validate(record.response)
    if job.status!='PAUSED_QUOTA':
        abort('STATE_CONFLICT','该任务当前不能补额度恢复')
    # 06-F1 supplies the same transaction's quota reservation.
    try:
        from app.billing.ledger import reserve
    except ModuleNotFoundError:
        abort('BILLING_UNAVAILABLE','额度服务尚未就绪',503,True)
    budget=service.select_budget(body.budget_units if body and body.budget_units else max(1,job.budget_units-job.used_units))
    reservation=reserve(db,user.id,f'job:{job.id}:resume:{key}',budget)
    job.reservation_id=reservation.id
    job.budget_units=job.used_units+budget
    job.status='QUEUED';job.lease_owner=None;job.lease_until=None;job.error=None
    result=JobRef(app_id=job.app_id,job_id=job.id,status=job.status)
    service.remember(db,user.id,action,key,digest,result.model_dump(mode='json'))
    return result
