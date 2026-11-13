from datetime import datetime, timezone
import pytest
from test_default_execution import new_job as new_job


def test_external_result_never_fabricates_hosted_instance():
    from app.core.types import ExternalLinkDelivery
    result=ExternalLinkDelivery(app_id='app',job_id='job',url='https://notes.example/',repo_url='https://github.com/example/notes',
        source_ref='repo@commit:README.md',summary='官方笔记服务',features=['私人笔记'],differences=[],
        verified_at=datetime.now(timezone.utc),verification_refs=['verification:job'],report_url='/api/jobs/job/report')
    assert result.kind=='EXTERNAL_LINK'
    assert 'instance_id' not in result.model_dump()
    assert 'version_id' not in result.model_dump()


@pytest.mark.asyncio
async def test_http_200_without_business_evidence_is_not_success():
    from app.runtime.external_delivery import verify_external_service
    from app.agent.contracts import DeploymentAsset
    from app.core.types import Requirement
    asset=DeploymentAsset(kind='OFFICIAL_SERVICE',location='https://notes.example/',source_ref='repo:README.md',source_digest='a'*64)
    class Verifier:
        async def inspect(self,url):
            return {'url':url,'status':200,'text':'Welcome','service_kind':'OFFICIAL_SERVICE'}
    result=await verify_external_service(Requirement(prompt='笔记',acceptance=[{'id':'A1','action':'保存笔记','expected':'持久保存'}]),asset,Verifier())
    assert result.status=='NOT_RUN'


@pytest.mark.asyncio
@pytest.mark.parametrize('renders_preview', [True, False])
async def test_public_spa_verification_executes_edit_and_preview_without_credentials(renders_preview):
    import httpx
    import json
    from app.runtime.external_delivery import OfficialServiceVerifier
    from app.core.types import Requirement, ModelTurn

    req = Requirement(prompt='edit and preview Markdown', acceptance=[
        {'id': 'A1', 'action': 'edit', 'expected': 'preview updated'}])
    html = '''<textarea id="editor"></textarea><div id="preview"></div><img src="http://127.0.0.1/private">
        <script>document.querySelector('#editor').addEventListener('input', e =>
        document.querySelector('#preview').textContent = e.target.value);</script>'''
    if not renders_preview:
        html = html.replace('e.target.value', '"broken preview"')
    seen = []
    def respond(request):
        seen.append(request)
        assert request.url.host == 'editor.example'
        assert request.method == 'GET'
        assert 'authorization' not in request.headers and 'cookie' not in request.headers
        return httpx.Response(200, text=html, headers={'content-type': 'text/html'})

    class Model:
        async def complete(self, messages, tools, purpose):
            if purpose == 'external-verification':
                value = {'service_kind': 'OFFICIAL_SERVICE', 'requires_user_action': True}
            else:
                value = [{'item_id': 'A1', 'actor': 'anonymous', 'expected': 'preview updated', 'actions': [
                    {'type': 'fill', 'selector': '#editor', 'value': 'reuse-preview'},
                    {'type': 'expect_text', 'selector': '#preview', 'text': 'reuse-preview'}]}]
            return ModelTurn(assistant_message={'content': json.dumps(value)})

    verifier = OfficialServiceVerifier(req, Model())
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await verifier._inspect_in_browser('https://editor.example/', client)
    assert result['executed_core_checks'][0]['status'] == ('PASS' if renders_preview else 'NOT_RUN')
    assert seen


def test_external_urls_reject_private_hosts_and_credentials():
    from app.runtime.external_delivery import validate_external_url
    for url in ['http://127.0.0.1/','https://10.0.0.1/','https://user:pass@example.com/','file:///tmp/test']:
        with pytest.raises(ValueError): validate_external_url(url,resolve=False)


@pytest.mark.asyncio
async def test_external_transport_connects_only_to_validated_public_address(monkeypatch):
    from app.runtime.external_delivery import PublicNetworkBackend
    monkeypatch.setattr('socket.getaddrinfo',lambda *a,**k:[(2,1,6,'',('93.184.216.34',443))])
    class Backend:
        host=None
        async def connect_tcp(self,host,port,**kwargs):
            self.host=host
            return 'stream'
    backend=Backend()
    assert await PublicNetworkBackend(backend).connect_tcp('example.com',443)=='stream'
    assert backend.host=='93.184.216.34'


def test_verified_link_persists_without_hosted_entities(new_job,session_factory):
    from app.runtime.external_delivery import persist_external_delivery, ExternalVerification
    from app.core.types import ExternalLinkDelivery
    from app.jobs.models import Job
    from app.apps.models import RequirementRecord, App, Instance, AppVersion
    from app.apps.service import app_detail
    from sqlalchemy import select
    job_id,app_id,_,_=new_job
    with session_factory() as s:
        j=s.get(Job,job_id);j.requirement_revision=1
        s.add(RequirementRecord(app_id=app_id,revision=1,requirement={'prompt':'editor','acceptance':[{'id':'A1','action':'edit','expected':'visible'}]},review={}))
        s.flush()
        v=ExternalVerification(service_kind='OFFICIAL_SERVICE',url='https://notes.example/',source_refs=['repo:README.md'],
            checked_at=datetime.now(timezone.utc),status='PASS',core_checks=[{'id':'A1','status':'PASS','evidence':'public editor verified'}])
        d=ExternalLinkDelivery(app_id=app_id,job_id=job_id,url=v.url,repo_url='https://github.com/example/notes',source_ref=v.source_refs[0],
            summary='editor',features=['edit'],verified_at=v.checked_at,verification_refs=['external:'+job_id],report_url='/api/jobs/'+job_id+'/report')
        persist_external_delivery(s,j,d,v);s.commit()
        persist_external_delivery(s,j,d,v);s.commit()
        detail=app_detail(s,s.get(App,app_id))
        assert detail.delivery.kind=='EXTERNAL_LINK'
        assert s.scalar(select(Instance).where(Instance.app_id==app_id)) is None
        assert s.scalar(select(AppVersion).where(AppVersion.app_id==app_id)) is None


@pytest.mark.asyncio
async def test_observation_source_is_separate_from_business_pass():
    from app.runtime.external_delivery import verify_external_service
    from app.agent.contracts import DeploymentAsset
    from app.core.types import Requirement
    class Verifier:
        source_mode='real'
        async def inspect(self,url):return {'url':url,'status':200,'text':'Welcome'}
    asset=DeploymentAsset(kind='OFFICIAL_SERVICE',location='https://editor.example/',source_ref='github:homepage',source_digest='a'*64)
    verification=await verify_external_service(Requirement(prompt='编辑',acceptance=[{'id':'A1','action':'编辑','expected':'预览'}]),asset,Verifier())
    assert verification.source_mode=='real'
    assert verification.status=='NOT_RUN'


def test_public_report_does_not_turn_optional_difference_into_core_failure(new_job,session_factory):
    from app.apps.models import RequirementRecord,AppVersion,App
    from app.jobs.models import Job
    from app.apps.service import job_report
    jid,aid,_,_=new_job
    with session_factory() as session:
        session.add(RequirementRecord(app_id=aid,revision=1,requirement={'prompt':'editor','acceptance':[
            {'id':'A1','action':'编辑','expected':'可用'},
            {'id':'color','action':'蓝色界面','expected':'蓝色','importance':'PREFERENCE'}]},review={}))
        version=AppVersion(app_id=aid,requirement_revision=1,manifest={},artifact_path='fixture.zip',validation={
            'checks':[{'id':'A1','status':'PASS','evidence':'fixture'}],'required_ids':['A1'],
            'requirement_revision':1,'attempt_id':'attempt','manifest_hash':'a'*64})
        session.add(version);session.flush()
        session.get(App,aid).candidate_version_id=version.id
        job=session.get(Job,jid);job.requirement_revision=1
        job.checkpoint={**job.checkpoint,'attempt_id':'attempt','manifest_hash':'a'*64}
        session.commit()
        report=job_report(session,job)
        assert report.overall=='PASS'
        assert report.checks[1].importance=='PREFERENCE'
        assert report.checks[1].status=='NOT_RUN'
