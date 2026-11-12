"""Only registered temporary resources can be collected. User versions/data are retained."""
from datetime import datetime,timedelta,timezone
import shutil
from pathlib import Path
import re
from uuid import uuid4,uuid5,NAMESPACE_URL

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.apps.models import App,AppVersion,Instance
from app.community.models import Publication
from app.config import settings
from app.database import SessionLocal
from app.jobs.models import ACTIVE_STATUSES,Job
from app.runtime.models import CleanupAction,ResourceRecord

LOCAL_TYPES={'WORKSPACE','EVIDENCE','TEMP_ARTIFACT'}
REMOTE_TYPES={'CANDIDATE_RUNTIME','CACHE_IMAGE','EXECUTION_CONTAINER'}


def register_resource(session,type,operation_id,reference,*,job_id=None,app_id=None,version_id=None,target_id=None,metadata=None):
    if type not in LOCAL_TYPES|REMOTE_TYPES: raise ValueError('Only explicit temporary resource types can be registered')
    id=str(uuid5(NAMESPACE_URL,type+':'+operation_id))
    session.execute(insert(ResourceRecord).values(id=id,type=type,operation_id=operation_id,reference=reference,
        job_id=job_id,app_id=app_id,version_id=version_id,target_id=target_id,state='AVAILABLE',metadata_json={'managed':True,**(metadata or {})})
        .on_conflict_do_nothing(index_elements=['id']))
    row=session.get(ResourceRecord,id,with_for_update=True)
    if row.state in {'DELETING','DELETED','UNKNOWN'} or (row.reference,row.job_id,row.app_id)!=(reference,job_id,app_id):
        raise ValueError('Resource is being collected or its identity changed')
    row.last_seen_at=datetime.now(timezone.utc)
    if version_id: row.version_id=version_id
    return row


def _strings(value):
    if isinstance(value,str): yield value
    elif isinstance(value,dict):
        for item in value.values(): yield from _strings(item)
    elif isinstance(value,list):
        for item in value: yield from _strings(item)


def _contains(reference,value):
    if not reference.startswith('/') or not value.startswith('/'): return False
    try: return Path(value).resolve().is_relative_to(Path(reference).resolve())
    except (OSError,ValueError): return False


def protected_resource_ids(session):
    resources=list(session.scalars(select(ResourceRecord)))
    jobs=list(session.scalars(select(Job).where(Job.status.in_(ACTIVE_STATUSES))))
    job_ids={j.id for j in jobs}
    refs=set()
    for job in jobs: refs.update(_strings(job.checkpoint or {}))
    for resource in resources:
        if resource.job_id in job_ids: refs.update((resource.reference,resource.operation_id,resource.id))
    versions=list(session.scalars(select(AppVersion)))
    version_ids={v.id for v in versions}
    for version in versions:
        if version.artifact_path: refs.add(version.artifact_path)
        refs.update(_strings(version.validation or {})); refs.update(_strings(version.manifest or {}))
    for app in session.scalars(select(App)):
        version_ids.update(v for v in (app.active_version_id,app.candidate_version_id,app.source_version_id) if v)
    for publication in session.scalars(select(Publication).where(Publication.visible.is_(True))):
        version_ids.add(publication.version_id); refs.add(publication.instance_id)
    image_digests={value.rsplit('@sha256:',1)[-1] for value in refs if re.search(r'@sha256:[0-9a-f]{64}$',value)}
    instances={i.id for i in session.scalars(select(Instance).where(Instance.kind=='PRODUCTION',Instance.status!='DELETED'))}
    pending_apps={r.app_id for r in resources if r.type in {'RELEASE_ATTEMPT','MIGRATION_GUARD'} and r.state not in {'SUCCEEDED','FAILED','DELETED','STOPPED'} and r.app_id}
    protected=set()
    for resource in resources:
        meta=resource.metadata_json or {}
        if (resource.job_id in job_ids or resource.version_id in version_ids or resource.app_id in pending_apps
            or resource.reference in refs or resource.id in refs or resource.operation_id in refs
            or resource.reference in instances or meta.get('instance_id') in instances
            or meta.get('attempt_id') in refs or any(_contains(resource.reference,ref) for ref in refs)):
            protected.add(resource.id)
        if resource.type=='CACHE_IMAGE' and resource.reference.rsplit('@sha256:',1)[-1] in image_digests: protected.add(resource.id)
    return protected


def _retention(type):
    if type=='WORKSPACE': return timedelta(days=settings.WORKSPACE_RETENTION_DAYS)
    if type=='EVIDENCE': return timedelta(days=settings.EVIDENCE_RETENTION_DAYS)
    if type=='TEMP_ARTIFACT' or type=='CACHE_IMAGE': return timedelta(days=settings.TEMP_RETENTION_DAYS)
    if type in {'CANDIDATE_RUNTIME','EXECUTION_CONTAINER'}: return timedelta(hours=settings.CANDIDATE_RETENTION_HOURS)
    return None


def plan_cleanup(session,now):
    if now.tzinfo is None: raise ValueError('Cleanup requires an aware UTC clock')
    protected=protected_resource_ids(session)
    actions=[]
    for resource in session.scalars(select(ResourceRecord).where(ResourceRecord.state!='DELETED').with_for_update()):
        retention=_retention(resource.type)
        if retention is None or resource.id in protected or not (resource.metadata_json or {}).get('managed'): continue
        last=max(resource.created_at,resource.last_seen_at)
        if resource.job_id:
            job=session.get(Job,resource.job_id)
            if not job or job.status in ACTIVE_STATUSES: continue
            last=max(last,job.updated_at)
        if now-last<retention: continue
        action=session.scalar(select(CleanupAction).where(CleanupAction.resource_id==resource.id,CleanupAction.action_kind=='REMOVE'))
        if action is None:
            action=CleanupAction(resource_id=resource.id,reason='UNREFERENCED_EXPIRED'); session.add(action); session.flush()
        elif action.status=='CANCELLED': action.status='QUEUED'; action.error_code=None
        if action.status!='DELETED': actions.append(action)
    return actions


def _local_path(resource):
    raw=Path(resource.reference)
    if not raw.is_absolute() or raw.is_symlink(): raise ValueError('Unsafe local cleanup reference')
    path=raw.resolve()
    if resource.type=='WORKSPACE' and resource.job_id and str(raw)!=str(Path(settings.AGENT_WORKSPACE_ROOT)/resource.job_id):
        raise ValueError('Workspace reference does not belong to its job')
    roots=[Path(settings.AGENT_WORKSPACE_ROOT).resolve()] if resource.type=='WORKSPACE' else [Path(settings.ARTIFACTS_ROOT).resolve()/'validation',Path(settings.ARTIFACTS_ROOT).resolve()/'temporary']
    if not any(path!=root and path.is_relative_to(root) for root in roots): raise ValueError('Cleanup path is outside its registered temporary roots')
    return path


class RunnerCleanup:
    async def inspect(self,resource):
        if resource.type in {'EVIDENCE','TEMP_ARTIFACT'} or resource.type=='WORKSPACE' and not (resource.metadata_json or {}).get('remote_uploaded'): return {'exists':False}
        return await self._request(resource,'inspect')
    async def remove(self,resource): return await self._request(resource,'remove')
    async def _request(self,resource,action):
        from app.runner.client import RunnerClient
        if resource.target_id: raise ValueError('Only the registered executor cache is supported')
        client=RunnerClient.from_settings()
        try:
            payload={'type':resource.type,'reference':resource.reference,'job_id':resource.job_id,'operation_id':resource.operation_id,
                'instance_id':(resource.metadata_json or {}).get('instance_id')}
            return (await client.request('POST','/v1/resources/'+action,json=payload)).json()
        finally: await client.close()


def _ownership(resource,state):
    labels=state.get('labels') or {}
    expected={'managed':True,'job_id':resource.job_id,'operation_id':resource.operation_id}
    instance=(resource.metadata_json or {}).get('instance_id')
    if instance: expected['instance_id']=instance
    if any(labels.get(key)!=value for key,value in expected.items()): raise ValueError('Resource ownership differs')


async def execute_cleanup(action_id,*,session_factory=SessionLocal,adapter=None):
    adapter=adapter or RunnerCleanup()
    now=datetime.now(timezone.utc); token=uuid4().hex
    with session_factory() as session:
        action=session.get(CleanupAction,action_id,with_for_update=True)
        if not action or action.status in {'DELETED','CANCELLED'}: return
        if action.status=='DELETING' and action.lease_until and action.lease_until>now: return
        resource=session.get(ResourceRecord,action.resource_id,with_for_update=True)
        if resource.id in protected_resource_ids(session):
            action.status='CANCELLED'; action.error_code='REFERENCE_PROTECTED'; session.commit(); return
        if resource.type not in LOCAL_TYPES|REMOTE_TYPES or not (resource.metadata_json or {}).get('managed'):
            action.status='CANCELLED'; action.error_code='TYPE_NOT_COLLECTIBLE'; session.commit(); return
        action.previous_state=action.previous_state or resource.state
        action.status=resource.state='DELETING'; action.lease_token=token; action.lease_until=now+timedelta(minutes=10)
        session.flush()
        session.expunge(resource)  # Keep the checked resource snapshot usable after an expiring production commit.
        session.commit()
    try:
        with session_factory() as session:
            if resource.id in protected_resource_ids(session):
                action=session.get(CleanupAction,action_id,with_for_update=True)
                action.status='CANCELLED'; session.get(ResourceRecord,resource.id).state=action.previous_state; session.commit(); return
        path=_local_path(resource) if resource.type in LOCAL_TYPES else None
        remote=await adapter.inspect(resource)
        if remote.get('exists'):
            _ownership(resource,remote)
            await adapter.remove(resource)
            if (await adapter.inspect(resource)).get('exists'): raise RuntimeError('Removal was not confirmed')
        if path and path.exists():
            if path.is_dir(): shutil.rmtree(path)
            else: path.unlink()
        if path and path.exists(): raise RuntimeError('Local removal was not confirmed')
        if resource.type=='CANDIDATE_RUNTIME': retire_candidate_data(resource,session_factory)
        status,error='DELETED',None
    except Exception as exc:
        status,error='UNKNOWN',type(exc).__name__
    with session_factory() as session:
        action=session.get(CleanupAction,action_id,with_for_update=True)
        if action.lease_token!=token: return
        action.status=status; action.error_code=error; action.lease_until=None; action.updated_at=datetime.now(timezone.utc)
        session.get(ResourceRecord,action.resource_id).state=status
        session.commit()


def retire_candidate_data(resource,session_factory):
    from app.capabilities.models import InstanceDataSpace
    from app.capabilities.identity import revoke_instance_credential
    with session_factory() as session:
        instance=session.get(Instance,resource.reference)
        if not instance: return
        if instance.kind!='CANDIDATE' or instance.app_id!=resource.app_id: raise ValueError('Persistent instances are never collected')
        if resource.id in protected_resource_ids(session): raise ValueError('Candidate regained an active reference')
        space=session.get(InstanceDataSpace,instance.id)
        needs_data=bool(space and space.destroyed_at is None)
    if needs_data:
        if not settings.INSTANCE_DATABASE_ADMIN_URL: raise ValueError('Candidate database deletion requires its registered manager')
        from app.capabilities.data import DataSpaceManager
        manager=DataSpaceManager(session_factory=session_factory,admin_database_url=settings.INSTANCE_DATABASE_ADMIN_URL,
            secrets_root=Path(settings.INSTANCE_SECRETS_ROOT)/'databases')
        manager.destroy(resource.reference,confirmed=True)
    with session_factory() as session:
        instance=session.get(Instance,resource.reference,with_for_update=True)
        instance.status='DELETED'
        revoke_instance_credential(session,instance.id)
        session.commit()


async def run_cleanup_once(now,*,session_factory=SessionLocal):
    with session_factory() as session:
        actions=plan_cleanup(session,now); ids=[a.id for a in actions]; session.commit()
    for id in ids: await execute_cleanup(id,session_factory=session_factory)
    with session_factory() as session:
        return ['CLEANUP_UNKNOWN:'+id for id in ids if session.get(CleanupAction,id).status=='UNKNOWN']
