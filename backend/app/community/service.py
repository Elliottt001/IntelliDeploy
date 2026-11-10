from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert
from fastapi import HTTPException

from app.apps.models import App, AppVersion, Instance, RequirementRecord
from app.billing.models import Reservation
from app.community.models import Favorite, Publication, RecentUse, SponsorReservation
from app.core.types import AppManifest, PublicationPage, PublicationResponse, Requirement, ValidationReport
from app.models.user import User
from app.runtime.manifest import manifest_hash, validate_release_manifest


class PublicationError(HTTPException):
    def __init__(self, message='公开应用不存在或无权访问', status=404):
        super().__init__(status, {'code':'PUBLICATION_UNAVAILABLE', 'message':message, 'retryable':False})


def active_publication(session, instance_id):
    return session.scalar(select(Publication).where(Publication.instance_id==instance_id, Publication.visible.is_(True)))


def publish(session, app_id, owner_id, version_id, payer_policy, *, sponsor_period='DAY', sponsor_limit_units=100):
    app=session.scalar(select(App).where(App.id==app_id, App.owner_id==owner_id).with_for_update())
    if app is None: raise PublicationError()
    instance=session.scalar(select(Instance).where(Instance.app_id==app_id, Instance.status!='DELETED').with_for_update())
    version=session.get(AppVersion,version_id)
    if not version or not instance or version.app_id!=app.id or not (version_id==app.active_version_id==instance.version_id) or instance.status!='RUNNING' or not instance.url:
        raise PublicationError('只能发布当前已验证且正在运行的版本',409)
    record=session.scalar(select(RequirementRecord).where(RequirementRecord.app_id==app_id, RequirementRecord.revision==version.requirement_revision))
    try:
        requirement=Requirement.model_validate(record.requirement if record else {})
        manifest=AppManifest.model_validate(version.manifest)
        report=ValidationReport.model_validate(version.validation)
        validate_release_manifest(manifest)
        if not (version.immutable and report.passed and report.required_ids==[item.id for item in requirement.acceptance] and report.requirement_revision==version.requirement_revision and report.manifest_hash==manifest_hash(manifest) and report.attempt_id and Path(version.artifact_path or '').is_file()):
            raise ValueError('unverified')
    except ValueError as exc:
        raise PublicationError('版本尚未通过完整业务验证',409) from exc
    if payer_policy not in {'SPONSOR','VISITOR'} or sponsor_period not in {'DAY','MONTH'} or isinstance(sponsor_limit_units,bool) or sponsor_limit_units<=0:
        raise PublicationError('公开费用政策无效',422)
    publication=session.scalar(select(Publication).where(Publication.app_id==app_id).with_for_update())
    if publication is None:
        publication=Publication(app_id=app_id,owner_id=owner_id,instance_id=instance.id,version_id=version_id)
        session.add(publication)
    publication.version_id=version_id
    publication.payer_policy=payer_policy
    publication.sponsor_period=sponsor_period
    publication.sponsor_limit_units=sponsor_limit_units
    publication.visible=True
    publication.updated_at=datetime.now(timezone.utc)
    session.flush()
    return publication


def public_response(session, publication):
    app=session.get(App,publication.app_id)
    instance=session.get(Instance,publication.instance_id)
    version=session.get(AppVersion,publication.version_id)
    creator=session.get(User,publication.owner_id)
    available=bool(instance and instance.status=='RUNNING' and instance.url and app.active_version_id==instance.version_id==publication.version_id)
    delivery=version.delivery or {}
    return PublicationResponse(id=publication.id,app_id=app.id,instance_id=publication.instance_id,version_id=version.id,name=app.name,summary=delivery.get('summary') or app.name,features=delivery.get('features') or [],creator=creator.username,url=instance.url if available else None,available=available,payer_policy=publication.payer_policy,sponsor_period=publication.sponsor_period,sponsor_limit_units=publication.sponsor_limit_units,copy_url=f'/api/publications/{publication.id}/copies',updated_at=publication.updated_at)


def get_publication(session, publication_id):
    publication=session.get(Publication,publication_id)
    if not publication or not publication.visible: raise PublicationError()
    return public_response(session,publication)


def unpublish(session, publication_id, owner_id):
    publication=session.scalar(select(Publication).where(Publication.id==publication_id,Publication.owner_id==owner_id).with_for_update())
    if publication is None: raise PublicationError()
    publication.visible=False
    publication.updated_at=datetime.now(timezone.utc)
    session.flush()


def list_publications(session, cursor=None, limit=20, *, user_id=None, library=None):
    query=select(Publication).where(Publication.visible.is_(True))
    if library:
        table=Favorite if library=='favorites' else RecentUse
        query=query.join(table, table.publication_id==Publication.id).where(table.user_id==user_id)
    if cursor: query=query.where(Publication.id>cursor)
    items=list(session.scalars(query.order_by(Publication.id).limit(limit+1)))
    return PublicationPage(items=[public_response(session,p) for p in items[:limit]],next_cursor=items[limit-1].id if len(items)>limit else None)


def set_favorite(session, user_id, publication_id, enabled):
    get_publication(session,publication_id)
    if enabled:
        session.execute(insert(Favorite).values(user_id=user_id,publication_id=publication_id).on_conflict_do_nothing())
    else:
        from sqlalchemy import delete
        session.execute(delete(Favorite).where(Favorite.user_id==user_id,Favorite.publication_id==publication_id))


def record_use(session,user_id,publication_id):
    public=get_publication(session,publication_id)
    if not public.available: raise PublicationError('应用暂不可用',409)
    session.execute(insert(RecentUse).values(user_id=user_id,publication_id=publication_id,instance_id=public.instance_id).on_conflict_do_update(index_elements=['user_id','publication_id'],set_={'updated_at':datetime.now(timezone.utc),'instance_id':public.instance_id}))
    return public


def reserve_sponsor(session,publication_id,operation_id,max_units):
    from app.capabilities.identity import SponsorLimitExceeded
    publication=session.scalar(select(Publication).where(Publication.id==publication_id).with_for_update())
    if not publication or not publication.visible or publication.payer_policy!='SPONSOR': raise SponsorLimitExceeded()
    now=datetime.now(timezone.utc)
    period=now.replace(hour=0,minute=0,second=0,microsecond=0)
    if publication.sponsor_period=='MONTH': period=period.replace(day=1)
    existing=session.get(SponsorReservation,operation_id)
    if existing:
        if existing.publication_id!=publication.id: raise SponsorLimitExceeded()
        return existing
    used=session.scalar(select(func.coalesce(func.sum(case((Reservation.status=='OPEN',Reservation.max_units),else_=Reservation.used_units)),0)).join(SponsorReservation,SponsorReservation.operation_id==Reservation.operation_id).where(SponsorReservation.publication_id==publication.id,SponsorReservation.period_start==period))
    if used+max_units>publication.sponsor_limit_units: raise SponsorLimitExceeded()
    result=SponsorReservation(publication_id=publication.id,operation_id=operation_id,period_start=period)
    session.add(result); session.flush()
    return result
