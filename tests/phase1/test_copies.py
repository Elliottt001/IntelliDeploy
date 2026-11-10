from copy import deepcopy
from uuid import uuid4
import zipfile
import pytest
from sqlalchemy import select
from test_publications import publication_context, publish_context
from app.apps.models import App, AppVersion, Instance, RequirementRecord
from app.jobs.models import Job


def test_copy_is_idempotent_and_has_independent_data_credentials(publication_context,session_factory):
    from app.community.service import create_copy
    c=publication_context
    with session_factory() as session:
        from app.billing.ledger import grant
        p=publish_context(session,c)
        grant(session,c.visitor_id,'copy',1000,'FREE');session.commit()
        first=create_copy(session,p.id,c.visitor_id,'copy-once',100)
        again=create_copy(session,p.id,c.visitor_id,'copy-once',100)
        assert first[0].id==again[0].id and first[2].id==again[2].id
        app,instance,job=first
        assert app.source_version_id==c.version_id
        assert instance.data_namespace != session.get(Instance,c.instance_id).data_namespace
        assert instance.secret_ref != 'private-secret'
        assert instance.status=='PENDING' and instance.url is None
        assert job.kind=='COPY' and job.status=='QUEUED' and job.result is None
        assert job.requirement_revision==1
        assert session.scalar(select(RequirementRecord).where(RequirementRecord.app_id==app.id)).requirement['acceptance'][0]['id']=='save'
        from app.capabilities.models import InstanceDataSpace, FileRecord, InstanceCredential
        assert session.get(InstanceDataSpace,instance.id) is None
        assert session.scalar(select(FileRecord).where(FileRecord.instance_id==instance.id)) is None
        assert session.get(InstanceCredential,instance.id) is not None


def test_copy_source_stays_fixed_after_author_updates(publication_context,session_factory):
    from app.community.service import create_copy,prepare_copy_candidate
    from app.billing.ledger import grant
    c=publication_context
    with session_factory() as session:
        p=publish_context(session,c);grant(session,c.visitor_id,'copy',1000,'FREE');session.commit()
        app,instance,job=create_copy(session,p.id,c.visitor_id,'copy-fixed',100)
        replacement=AppVersion(app_id=c.app_id,requirement_revision=1,manifest=deepcopy(session.get(AppVersion,c.version_id).manifest),validation=deepcopy(c.report.model_dump(mode='json')),artifact_path=session.get(AppVersion,c.version_id).artifact_path)
        session.add(replacement);session.flush()
        p.version_id=replacement.id
        session.get(App,c.app_id).active_version_id=replacement.id
        session.get(Instance,c.instance_id).version_id=replacement.id
        session.commit()
        draft=prepare_copy_candidate(session,job)
        assert draft.manifest.services[0].image=='registry.test/notes@sha256:'+'a'*64
        assert not draft.manifest.builds
        assert draft.manifest.services[0].env_refs=={}
        assert draft.browser_checks[0].item_id=='save'
        assert app.source_version_id==c.version_id


@pytest.mark.asyncio
async def test_copy_pipeline_uses_existing_material_and_same_validation_gate(publication_context,session_factory):
    from app.community.service import create_copy
    from app.billing.ledger import grant
    from app.jobs.pipeline import run_pipeline,PipelineDependencies
    from app.core.types import CandidateRuntime,ValidationReport,CheckResult,DeploymentResult
    from app.runtime.manifest import manifest_hash
    c=publication_context
    with session_factory() as session:
        p=publish_context(session,c);grant(session,c.visitor_id,'copy',1000,'FREE');session.commit()
        copied,instance,job=create_copy(session,p.id,c.visitor_id,'copy-pipeline',100)
    async def forbidden(**kwargs): raise AssertionError('COPY must not regenerate source')
    async def build(*args): raise AssertionError('COPY must not rebuild verified image')
    async def start(job_id,attempt_id,manifest,requirement):
        return CandidateRuntime(id=attempt_id,base_url='https://candidate.test.invalid',manifest_hash=manifest_hash(manifest),data_namespace='empty-test-data',identity_refs={'owner':'test-one','other':'test-two'})
    async def stop(*args,**kwargs): pass
    async def validate(url,requirement,checks,controller,**kwargs):
        return ValidationReport(checks=[CheckResult(id='save',status='PASS',evidence='evidence/copy')],required_ids=['save'],requirement_revision=1,attempt_id=kwargs['attempt_id'],manifest_hash=kwargs['manifest_hash'])
    async def deploy(**kwargs):
        return DeploymentResult(instance_id=instance.id,operation_id=kwargs['operation_id'],url='https://independent.test.invalid',report=ValidationReport(checks=[CheckResult(id='save',status='PASS',evidence='evidence/live')],required_ids=['save'],requirement_revision=1,attempt_id='live',manifest_hash=manifest_hash(kwargs['manifest'])))
    await run_pipeline(job.id,session_factory=session_factory,dependencies=PipelineDependencies(generate_candidate=forbidden,build_candidate=build,start_candidate=start,stop_candidate=stop,validate_candidate=validate,runtime_controller=lambda _:None,deployer=deploy))
    with session_factory() as session:
        result=session.get(Job,job.id)
        assert result.status=='SUCCEEDED',result.error
        assert result.result['instance_id']==instance.id
        assert session.get(App,c.app_id).active_version_id==c.version_id
        assert session.get(App,copied.id).active_version_id!=c.version_id


def test_copy_rejects_private_or_invalid_artifact(publication_context,session_factory):
    from app.community.service import create_copy,prepare_copy_candidate,PublicationError
    from app.billing.ledger import grant
    c=publication_context
    with session_factory() as session:
        p=publish_context(session,c);grant(session,c.visitor_id,'copy',1000,'FREE');session.commit()
        copied,instance,job=create_copy(session,p.id,c.visitor_id,'copy-unsafe',100)
        artifact=session.get(AppVersion,c.version_id).artifact_path
        with zipfile.ZipFile(artifact,'w') as archive: archive.writestr('../escape.py','secret')
        with pytest.raises(PublicationError): prepare_copy_candidate(session,job)
        p.visible=False;session.commit()
        with pytest.raises(PublicationError): create_copy(session,p.id,c.visitor_id,'copy-hidden',100)


def test_copy_excludes_runtime_files_and_tool_logs(publication_context,session_factory):
    from app.community.service import create_copy,prepare_copy_candidate
    from app.billing.ledger import grant
    from pathlib import Path
    c=publication_context
    with session_factory() as session:
        p=publish_context(session,c);grant(session,c.visitor_id,'copy',1000,'FREE');session.commit()
        app,instance,job=create_copy(session,p.id,c.visitor_id,'copy-private',100)
        with zipfile.ZipFile(session.get(AppVersion,c.version_id).artifact_path,'w') as archive:
            archive.writestr('source/app.py','print("safe")')
            archive.writestr('source/.env','SECRET=private')
            archive.writestr('source/uploads/private.txt','private-record')
            archive.writestr('source/.tool-results/private.log','runtime-secret')
        draft=prepare_copy_candidate(session,job)
        assert draft.source_tree==['app.py']
        assert not (Path(draft.workspace_id)/'.tool-results/private.log').exists()
