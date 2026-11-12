from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import case, func, select, or_
from sqlalchemy.dialects.postgresql import insert
from fastapi import HTTPException

from app.agent.checkpoint import save_algorithm_checkpoint
from app.agent.contracts import ALGORITHM_VERSION, AlgorithmCheckpoint
from app.apps.models import App, AppVersion, Instance, RequirementRecord
from app.billing.models import Reservation, UnknownUsage
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
    instance=session.scalar(select(Instance).where(Instance.app_id==app_id, Instance.status!='DELETED',Instance.kind=='PRODUCTION').with_for_update())
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
    pending_usage=select(UnknownUsage.id).where(UnknownUsage.status=='UNKNOWN',UnknownUsage.metadata_json['reservation_operation_id'].astext==Reservation.operation_id).correlate(Reservation).exists()
    used=session.scalar(select(func.coalesce(func.sum(case((or_(Reservation.status=='OPEN',pending_usage),Reservation.max_units),else_=Reservation.used_units)),0)).join(SponsorReservation,SponsorReservation.operation_id==Reservation.operation_id).where(SponsorReservation.publication_id==publication.id,SponsorReservation.period_start==period))
    if used+max_units>publication.sponsor_limit_units: raise SponsorLimitExceeded()
    result=SponsorReservation(publication_id=publication.id,operation_id=operation_id,period_start=period)
    session.add(result); session.flush()
    return result


def create_copy(session,publication_id,owner_id,operation_id,budget_units=None):
    from app.apps.service import replay,remember,select_budget
    from app.apps.models import Conversation,Message
    from app.jobs.models import Job
    from app.billing.ledger import reserve
    from app.capabilities.identity import provision_instance_credential
    from app.config import settings
    import json,os
    payload={'publication_id':publication_id,'budget_units':budget_units}
    saved,digest=replay(session,owner_id,'copy',operation_id,payload)
    if saved:
        return session.get(App,saved.response['app_id']),session.get(Instance,saved.response['instance_id']),session.get(Job,saved.response['job_id'])
    publication=session.scalar(select(Publication).where(Publication.id==publication_id,Publication.visible.is_(True)).with_for_update())
    if not publication: raise PublicationError()
    version=session.get(AppVersion,publication.version_id)
    original=session.get(Instance,publication.instance_id)
    if not version.immutable or not ValidationReport.model_validate(version.validation).passed or not Path(version.artifact_path or '').is_file():
        raise PublicationError('来源版本尚未通过验证',409)
    requirement=session.scalar(select(RequirementRecord).where(RequirementRecord.app_id==publication.app_id,RequirementRecord.revision==version.requirement_revision))
    if not requirement: raise PublicationError('来源需求不存在',409)
    app=App(owner_id=owner_id,name=session.get(App,publication.app_id).name+' · 我的副本',prompt=requirement.requirement['prompt'],source_version_id=version.id)
    session.add(app);session.flush()
    session.add(Conversation(app_id=app.id))
    session.add(Message(app_id=app.id,sequence=1,role='user',content=app.prompt))
    copied_requirement=Requirement.model_validate(requirement.requirement).model_copy(update={'revision':1,'facts':[],'source_message_ids':[]})
    session.add(RequirementRecord(app_id=app.id,revision=1,requirement=copied_requirement.model_dump(mode='json'),review={'source_version_id':version.id,'copied_acceptance':True}))
    from uuid import uuid4
    instance=Instance(owner_id=owner_id,app_id=app.id,target_id=original.target_id,data_namespace='copy_'+uuid4().hex)
    session.add(instance);session.flush()
    token=provision_instance_credential(session,instance.id)
    algorithm=AlgorithmCheckpoint.empty(requirement_revision=1,mode=settings.ALGORITHM_MODE,algorithm_version=ALGORITHM_VERSION)
    checkpoint=save_algorithm_checkpoint({'source_version_id':version.id},algorithm)
    job=Job(app_id=app.id,kind='COPY',phase='validating',operation_id=f'{owner_id}:copy:{operation_id}',requirement_revision=1,budget_units=select_budget(budget_units,session,owner_id),checkpoint=checkpoint)
    session.add(job);session.flush()
    parent=reserve(session,owner_id,f'job:{job.id}',job.budget_units)
    job.reservation_id=parent.id
    root=Path(settings.INSTANCE_SECRETS_ROOT)/'copies'
    root.mkdir(parents=True,exist_ok=True,mode=0o700)
    secret=root/(instance.id+'.json')
    descriptor=os.open(secret,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'w') as output:
        json.dump({'instance_id':instance.id,'instance_token':token},output)
    instance.secret_ref=str(secret)
    remember(session,owner_id,'copy',operation_id,digest,{'app_id':app.id,'instance_id':instance.id,'job_id':job.id,'status':'QUEUED'})
    return app,instance,job


def prepare_copy_candidate(session,job):
    import zipfile,stat
    from app.agent.workspace import WorkspaceManager,safe_path
    from app.config import settings
    from app.core.types import BrowserCheck
    from app.jobs.pipeline import CandidateDraft
    from app.runtime.build import _sensitive
    source_id=job.checkpoint.get('source_version_id')
    app=session.get(App,job.app_id)
    source=session.get(AppVersion,source_id)
    if not source or app.source_version_id!=source.id or not source.immutable:
        raise PublicationError('副本来源不完整',409)
    workspace=Path(WorkspaceManager(settings.AGENT_WORKSPACE_ROOT).create_workspace(job.id))
    files=[]
    try:
        with zipfile.ZipFile(source.artifact_path) as archive:
            if sum(item.file_size for item in archive.infolist())>100*1024*1024: raise ValueError('source archive too large')
            for item in archive.infolist():
                relative=Path(item.filename)
                if relative.is_absolute() or '..' in relative.parts or stat.S_ISLNK(item.external_attr>>16): raise ValueError('unsafe source path')
                if item.is_dir() or item.filename in {'release-manifest.json','validation-report.json','source-metadata.json'}: continue
                if relative.parts and relative.parts[0]=='source': relative=Path(*relative.parts[1:])
                if _sensitive(relative): continue
                target=safe_path(workspace,relative.as_posix())
                target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(archive.read(item));files.append(relative.as_posix())
    except (OSError,ValueError,zipfile.BadZipFile) as exc:
        raise PublicationError('副本源码材料无效',409) from exc
    manifest=AppManifest.model_validate(source.manifest).model_copy(deep=True)
    validate_release_manifest(manifest)
    manifest.builds=[]
    instance=session.scalar(select(Instance).where(Instance.app_id==job.app_id,Instance.kind=='PRODUCTION'))
    for service in manifest.services:
        # Preserve required names, replace every source credential reference.
        service.env_refs={name:f'copy-{instance.id}-{name.lower().replace("_","-")}' for name in service.env_refs}
    checks=[BrowserCheck.model_validate(check) for check in (source.delivery or {}).get('browser_checks',[])]
    if not checks: raise PublicationError('来源缺少可重复执行的业务检查',409)
    return CandidateDraft(str(workspace),manifest,files,checks)
