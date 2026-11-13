"""Adapt supported official deployment material without regenerating business code."""
import json
import re
import shlex
from pathlib import Path
import yaml
from app.config import settings
from app.agent.contracts import DeploymentPlan
from app.agent.packaging import checked_path
from app.core.types import AppManifest, ServiceSpec, BuildSpec


class OfficialDeploymentUnsupported(ValueError):
    pass


def plan_official_deployment(profile, decision):
    asset = decision.deployment_asset
    if asset is None:
        asset = next((a for kind in ('COMPOSE','IMAGE','SCRIPT') for a in profile.deployment_assets if a.kind==kind),None)
    if asset and asset.kind in {'COMPOSE','IMAGE','SCRIPT'}:
        return DeploymentPlan(kind=asset.kind,source_ref=asset.source_ref,digest=asset.source_digest,location=asset.location)
    return DeploymentPlan(kind='SOURCE_BUILD',source_ref=profile.repo_url+'@'+profile.commit+':Dockerfile',
        digest=profile.commit,location='Dockerfile')


def compose_manifest(body):
    try:
        data = yaml.safe_load(body)
    except yaml.YAMLError as exc:
        raise OfficialDeploymentUnsupported('official compose is malformed') from exc
    if not isinstance(data,dict) or not isinstance(data.get('services'),dict):
        raise OfficialDeploymentUnsupported('official compose has no services')
    if any(k not in {'name','version','services','volumes'} for k in data):
        raise OfficialDeploymentUnsupported('official compose uses unverified network/config/extensions')
    declared = data.get('volumes') or {}
    if any(v for v in declared.values()):
        raise OfficialDeploymentUnsupported('external volume/driver needs explicit target configuration')
    services=[];builds=[];webs=[]
    supported={'image','build','ports','expose','environment','volumes','depends_on','command','restart','container_name'}
    for name, row in data['services'].items():
        if not isinstance(row,dict) or set(row)-supported:
            raise OfficialDeploymentUnsupported(f'unsupported compose options in {name}')
        ports=row.get('ports') or []
        port=None
        if ports:
            if len(ports)!=1 or isinstance(ports[0],dict):
                raise OfficialDeploymentUnsupported('multiple/structured ports require explicit mapping')
            try: port=int(str(ports[0]).split(':')[-1].split('/')[0])
            except ValueError as exc: raise OfficialDeploymentUnsupported('port is not fixed') from exc
            webs.append(name)
        elif row.get('expose'):
            port=int(row['expose'][0])
        mounts={}
        for value in row.get('volumes') or []:
            if not isinstance(value,str) or len(value.split(':'))!=2:
                raise OfficialDeploymentUnsupported('volume needs named source and container path')
            volume,target=value.split(':')
            if volume not in declared:
                raise OfficialDeploymentUnsupported('host bind mount is not allowed')
            mounts[volume]=target
        environment=row.get('environment') or {}
        if isinstance(environment,list):
            environment=dict(x.split('=',1) for x in environment if '=' in x)
            if len(environment)!=len(row['environment']):
                raise OfficialDeploymentUnsupported('unresolved environment input')
        env_refs={};env_values={}
        for key,value in environment.items():
            if not re.fullmatch(r'[A-Z][A-Z0-9_]*',key) or value is None:
                raise OfficialDeploymentUnsupported('environment input is not explicit')
            if str(value).startswith('${') or key in {'DATABASE_URL','POSTGRES_PASSWORD','POSTGRES_USER','POSTGRES_DB'}:
                env_refs[key]=name+'-'+key.lower().replace('_','-')
            elif re.search(r'password|secret|token|key',key,re.I):
                raise OfficialDeploymentUnsupported('literal secret must be supplied through instance configuration')
            else: env_values[key]=str(value)
        depends=row.get('depends_on') or []
        if isinstance(depends,dict):
            raise OfficialDeploymentUnsupported('conditional dependency semantics must not be dropped')
        command=row.get('command')
        if isinstance(command,str):
            if any(x in command for x in (';','&&','|','$','`')):
                raise OfficialDeploymentUnsupported('shell command needs explicit verification')
            command=shlex.split(command)
        image=row.get('image') or f'{name}:pending-build'
        if row.get('build'):
            build=row['build']; context=build if isinstance(build,str) else build.get('context','.')
            dockerfile='Dockerfile' if isinstance(build,str) else build.get('dockerfile','Dockerfile')
            builds.append(BuildSpec(service=name,context=context,dockerfile=str(Path(context)/dockerfile)))
        services.append(ServiceSpec(name=name,image=image,port=port,volumes=mounts,
            command=command,env_refs=env_refs,env_values=env_values,depends_on=depends))
    if len(webs)!=1:
        raise OfficialDeploymentUnsupported('official compose needs one public web entry')
    return AppManifest(web_service=webs[0],services=services,builds=builds)


async def execute_official_deployment(execution, plan):
    from app.jobs.pipeline import CandidateDraft
    from app.agent.workspace import WorkspaceManager
    workspace=Path(WorkspaceManager(settings.AGENT_WORKSPACE_ROOT).create_workspace(execution.job_id))
    if plan.kind=='COMPOSE':
        manifest=compose_manifest(checked_path(workspace,plan.location).read_text())
    elif plan.kind=='IMAGE':
        profile=next(p for p in execution.algorithm_checkpoint().profiles if plan.source_ref.startswith(p.repo_url+'@'+p.commit))
        if len(profile.ports)!=1:
            raise OfficialDeploymentUnsupported('official image web port is not confirmed')
        manifest=AppManifest(web_service='web',services=[ServiceSpec(name='web',image=plan.location,port=profile.ports[0])])
    elif plan.kind=='SCRIPT':
        # Scripts that simply delegate to an existing Compose file can reuse it safely.
        body=checked_path(workspace,plan.location).read_text()
        match=re.fullmatch(r'\s*(?:#!/bin/(?:sh|bash)\n)?docker compose -f ([\w./-]+) up -d\s*',body)
        if not match:
            raise OfficialDeploymentUnsupported('deployment script requires unsupported host effects; use its documented compose/image')
        manifest=compose_manifest(checked_path(workspace,match[1]).read_text())
    else:
        profile=next(p for p in execution.algorithm_checkpoint().profiles if plan.source_ref.startswith(p.repo_url+'@'+p.commit))
        if len(profile.ports)!=1 or not checked_path(workspace,'Dockerfile').is_file():
            raise OfficialDeploymentUnsupported('source deployment needs a verified Dockerfile and web port')
        manifest=AppManifest(web_service='web',services=[ServiceSpec(name='web',image='web:pending-build',port=profile.ports[0])],
            builds=[BuildSpec(service='web',context='.',dockerfile='Dockerfile')])
    await execution.runner.upload(execution.job_id,workspace,execution.generation)
    execution.save(workspace_uploaded=True,generation_manifest=manifest.model_dump(mode='json'),
        implementation_attempt=execution.attempt_index,official_deployment=plan.model_dump(mode='json'))
    files=await execution.runner.snapshot(execution.job_id,workspace,execution.generation)
    return CandidateDraft(str(workspace),manifest,files)
