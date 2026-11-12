import os
import re
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, StrictInt
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.billing.models import PriceRule, ProductSku
from app.core.types import AppManifest, ServiceSpec
from app.jobs.models import Job, MaintenanceLease
from app.apps.models import InstanceOperation
from app.models.user import User
from app.runtime.models import AdminAudit, DeploymentTarget, PlatformControl


class Capacity(BaseModel):
    model_config = ConfigDict(extra='forbid')
    cpu_millis: StrictInt = Field(gt=0)
    memory_mb: StrictInt = Field(gt=0)
    storage_mb: StrictInt = Field(gt=0)
    name: str | None = None
    ssh_host: str | None = None
    ssh_user: str | None = None
    ssh_port: StrictInt = Field(default=22, ge=1, le=65535)
    deployment_root: str | None = None
    caddy_config_dir: str | None = None
    caddy_main_config: str | None = None
    namespace: str | None = None
    storage_class: str | None = None
    ingress_class: str | None = None
    gateway_image: str = Field(pattern=r'^.+@sha256:[0-9a-f]{64}$')


class TargetConfig(BaseModel):
    model_config = ConfigDict(extra='forbid')
    architecture: str = Field(default='amd64', pattern='^amd64$')
    domain_suffix: str = Field(pattern=r'^[A-Za-z0-9][A-Za-z0-9.-]+$')
    secret_ref: str = Field(pattern=r'^[A-Za-z0-9_-]{1,128}$')
    capacity: Capacity


class PriceInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: str = Field(pattern=r'^[a-z][a-z0-9_.]+$')
    version: str = Field(min_length=1,max_length=128)
    numerator: StrictInt = Field(ge=0)
    denominator: StrictInt = Field(gt=0)


class SkuInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(min_length=1,max_length=128)
    name: str = Field(min_length=1,max_length=256)
    provider: str = Field(pattern=r'^(alipay|wechat|stripe)$')
    currency: str = Field(pattern=r'^(CNY|USD)$')
    amount_minor: StrictInt = Field(gt=0)
    units: StrictInt = Field(gt=0)
    period: str | None = Field(default=None,pattern=r'^(MONTH|YEAR)$')
    enabled: bool = True
    stripe_price_id: str | None = None


class CatalogInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    prices: list[PriceInput] = []
    skus: list[SkuInput] = []


def audit(session, action, subject, details=None):
    session.add(AdminAudit(actor=f'os:{os.geteuid()}', action=action,subject=str(subject),details=details or {}))


def add_target(session, target_id, kind, data):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}',target_id) or kind not in {'linux','kubernetes'}:
        raise ValueError('Invalid target identity or kind')
    parsed = TargetConfig.model_validate(data)
    capacity = parsed.capacity.model_dump(exclude_none=True)
    if kind == 'linux' and (not capacity.get('ssh_host') or not capacity.get('ssh_user') or not (capacity.get('deployment_root') or '').startswith('/') or '..' in capacity['deployment_root'].split('/')):
        raise ValueError('Linux target needs a registered SSH host, user and absolute deployment root')
    if kind == 'kubernetes' and not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,62}',capacity.get('namespace','')):
        raise ValueError('Kubernetes target requires a namespace')
    if session.get(DeploymentTarget,target_id):
        raise ValueError('Target already exists; disable it before registering a new identity')
    target = DeploymentTarget(id=target_id,kind=kind.upper(),health='UNKNOWN',enabled=True,
        architecture=parsed.architecture,domain_suffix=parsed.domain_suffix,secret_ref=parsed.secret_ref,capacity=capacity)
    session.add(target)
    audit(session,'target.add',target_id)
    session.flush()
    return target


def list_targets(session):
    return [dict(id=row.id,kind=row.kind,enabled=row.enabled,health=row.health,architecture=row.architecture,
        capacity={key:row.capacity.get(key) for key in ('cpu_millis','memory_mb','storage_mb')})
        for row in session.scalars(select(DeploymentTarget).order_by(DeploymentTarget.id))]


def disable_target(session, target_id):
    row=session.get(DeploymentTarget,target_id,with_for_update=True)
    if not row: raise ValueError('Unknown target')
    row.enabled=False
    audit(session,'target.disable',target_id)


async def check_target(session,target_id,probe=None):
    from app.runtime.linux import preflight_linux_target
    from app.runtime.kubernetes import preflight_kubernetes_target
    row=session.get(DeploymentTarget,target_id,with_for_update=True)
    if not row: raise ValueError('Unknown target')
    value={key:getattr(row,key) for key in ('id','kind','architecture','capacity','domain_suffix','secret_ref')}
    value.update(enabled=True,health='HEALTHY')
    manifest=AppManifest(web_service='web',services=[ServiceSpec(name='web',image=row.capacity['gateway_image'],port=8080,health_path='/health')])
    class Provider:
        def get(self,_): return value
    selected=probe or (preflight_linux_target if row.kind=='LINUX' else preflight_kubernetes_target)
    try:
        result=await selected(target_id,manifest,target_provider=Provider())
        if not result.get('ok'): raise ValueError('Target probe did not confirm readiness')
        row.health='HEALTHY'
    except Exception:
        row.health='UNHEALTHY'
        audit(session,'target.check',target_id,{'passed':False})
        session.commit()
        raise ValueError('Target preflight failed; check registered configuration and server access') from None
    audit(session,'target.check',target_id,{'passed':True})
    return {'id':target_id,'health':row.health,'enabled':row.enabled}


def import_catalog(session,data):
    parsed=CatalogInput.model_validate(data)
    identities=[(p.kind,p.version) for p in parsed.prices]
    if len(set(identities))!=len(identities) or len({s.id for s in parsed.skus})!=len(parsed.skus):
        raise ValueError('Duplicate catalog identity')
    for price in parsed.prices:
        old=session.get(PriceRule,(price.kind,price.version))
        if old and (old.numerator,old.denominator)!=(price.numerator,price.denominator):
            raise ValueError('Existing price versions are immutable')
    for sku in parsed.skus:
        if sku.provider in {'alipay','wechat'} and sku.currency!='CNY': raise ValueError('Domestic currency must be CNY')
        if sku.provider=='stripe' and not sku.stripe_price_id: raise ValueError('Stripe SKU needs its price reference')
        old=session.get(ProductSku,sku.id)
        if old and any(getattr(old,key)!=value for key,value in sku.model_dump().items() if key!='enabled'):
            raise ValueError('Existing SKU commercial terms are immutable; register a new SKU')
    for price in parsed.prices:
        if not session.get(PriceRule,(price.kind,price.version)): session.add(PriceRule(**price.model_dump()))
    for sku in parsed.skus:
        old=session.get(ProductSku,sku.id)
        if old: old.enabled=sku.enabled
        else: session.add(ProductSku(**sku.model_dump()))
    audit(session,'catalog.import','catalog',{'prices':len(parsed.prices),'skus':len(parsed.skus)})
    session.flush()
    return {'prices':len(parsed.prices),'skus':len(parsed.skus)}


def set_developer(session,user_id,enabled):
    row=session.get(User,user_id,with_for_update=True)
    if not row: raise ValueError('Unknown user')
    row.is_developer=enabled
    audit(session,'developer.grant' if enabled else 'developer.revoke',user_id)


def set_drain(session,enabled):
    session.execute(insert(PlatformControl).values(name='claims-paused',value={'paused':enabled},updated_at=datetime.now(timezone.utc))
        .on_conflict_do_update(index_elements=['name'],set_={'value':{'paused':enabled},'updated_at':datetime.now(timezone.utc)}))
    audit(session,'maintenance.drain' if enabled else 'maintenance.resume','claims')


def claims_paused(session):
    value=session.get(PlatformControl,'claims-paused')
    return bool(value and value.value.get('paused'))


def maintenance_status(session):
    now=datetime.now(timezone.utc)
    workers=list(session.scalars(select(PlatformControl).where(PlatformControl.name.like('worker:%'))))
    return {'claims_paused':claims_paused(session), 'running_jobs':session.scalar(select(func.count()).select_from(Job).where(Job.status=='RUNNING')),
        'running_operations':session.scalar(select(func.count()).select_from(InstanceOperation).where(InstanceOperation.status=='RUNNING')),
        'queued_jobs':session.scalar(select(func.count()).select_from(Job).where(Job.status=='QUEUED')),
        'workers':[{'id':r.name,'recent':(now-r.updated_at).total_seconds()<90} for r in workers],
        'maintenance':[{'name':r.name,'last_success':r.last_success,'retry_after':r.retry_after,'has_error':bool(r.error)} for r in session.scalars(select(MaintenanceLease))]}


async def runner_status():
    import asyncio
    from app.config import settings
    from app.runner.client import RunnerClient
    if not settings.RUNNER_URL: return {'status':'NOT_CONFIGURED'}
    client=None
    try:
        client=RunnerClient.from_settings()
        health=await asyncio.wait_for(client.health(),timeout=10)
        ready=all(health.get(k) is True for k in ('ready','builder_ready','runtimes_ready'))
        return {'status':'HEALTHY' if ready else 'UNHEALTHY'}
    except Exception: return {'status':'UNAVAILABLE'}
    finally:
        if client: await client.close()
