from sqlalchemy import select
from app.jobs.models import Job


def create(client, headers, key='create-once', prompt='保存私有笔记'):
    return client.post('/api/apps', headers={**headers, 'Idempotency-Key': key}, json={'prompt': prompt, 'budget_units': 100})


def test_create_persists_and_replays_without_duplicate_messages(api_client, owner_headers, other_headers):
    one = create(api_client, owner_headers)
    assert one.status_code == 201
    two = create(api_client, owner_headers)
    assert two.json() == one.json()
    app_id, job_id = one.json()['app_id'], one.json()['job_id']
    detail = api_client.get('/api/apps/' + app_id, headers=owner_headers).json()
    assert len(detail['conversation']) == 1
    assert detail['active_job']['id'] == job_id
    assert detail['delivery'] is None
    assert create(api_client, owner_headers, prompt='不同内容').status_code == 409
    assert create(api_client, other_headers).json()['app_id'] != app_id
    for path in [f'/api/apps/{app_id}', f'/api/jobs/{job_id}', f'/api/jobs/{job_id}/report', f'/api/jobs/{job_id}/events']:
        assert api_client.get(path, headers=other_headers).status_code == 404


def test_auth_validation_and_no_fake_delivery(api_client, owner_headers):
    assert create(api_client, {}).status_code == 401
    assert api_client.post('/api/apps', headers=owner_headers, json={'prompt':'abc'}).status_code == 422
    bad = api_client.post('/api/apps', headers={**owner_headers,'Idempotency-Key':'bad'}, json={'prompt':' ', 'budget_units':0})
    assert bad.status_code == 422
    assert 'code' in bad.json()['error']
    assert api_client.post('/api/apps', headers={**owner_headers,'Idempotency-Key':'dev'}, json={'prompt':'abc','evaluation_target_id':'arbitrary'}).status_code == 403
    one = create(api_client, owner_headers).json()
    snap = api_client.get('/api/jobs/'+one['job_id'], headers=owner_headers).json()
    assert snap['status'] == 'QUEUED' and snap['result'] is None
    report = api_client.get('/api/jobs/'+one['job_id']+'/report', headers=owner_headers).json()
    assert report['overall'] == 'NOT_RUN' and report['checks'] == []


def test_waiting_answer_resumes_same_job_and_replays_once(api_client, owner_headers, session_factory):
    one = create(api_client, owner_headers).json()
    endpoint = '/api/apps/'+one['app_id']+'/messages'
    headers = {**owner_headers, 'Idempotency-Key':'answer'}
    assert api_client.post(endpoint, headers=headers, json={'content':'新增搜索'}).status_code == 409
    with session_factory() as session:
        job = session.get(Job, one['job_id']); job.status='WAITING_USER'; job.question='公开吗？'; session.commit()
    first = api_client.post(endpoint, headers=headers, json={'content':'保持私有'})
    assert first.status_code == 202 and first.json()['job_id'] == one['job_id']
    assert api_client.post(endpoint, headers=headers, json={'content':'保持私有'}).json() == first.json()
    detail = api_client.get('/api/apps/'+one['app_id'], headers=owner_headers).json()
    assert [m['sequence'] for m in detail['conversation']] == [1,2]


def test_cancel_is_persistent_idempotent_and_does_not_delete_app(api_client, owner_headers):
    one = create(api_client, owner_headers).json()
    endpoint = '/api/jobs/'+one['job_id']+'/cancel'
    headers = {**owner_headers, 'Idempotency-Key':'cancel'}
    first = api_client.post(endpoint, headers=headers)
    assert first.status_code == 202
    assert api_client.post(endpoint, headers=headers).json() == first.json()
    assert api_client.get('/api/jobs/'+one['job_id'],headers=owner_headers).json()['status'] == 'CANCELLED'
    detail = api_client.get('/api/apps/'+one['app_id'],headers=owner_headers).json()
    assert detail['active_job'] is None and detail['latest_job']['status'] == 'CANCELLED'


def test_openapi_uses_json_login_bearer_and_public_job_schema(api_client):
    schema = api_client.get('/openapi.json').json()
    assert schema['components']['securitySchemes']['HTTPBearer']['scheme'] == 'bearer'
    assert 'application/json' in schema['paths']['/auth/login']['post']['requestBody']['content']
    assert 'JobSnapshot' in schema['components']['schemas']


def test_report_rejects_old_revision_evidence(api_client, owner_headers, session_factory):
    from app.apps.models import App, AppVersion, RequirementRecord
    one = create(api_client,owner_headers).json()
    with session_factory() as session:
        job=session.get(Job,one['job_id']); job.requirement_revision=2
        session.add(RequirementRecord(app_id=one['app_id'],revision=2,requirement={'prompt':'保存','revision':2,'acceptance':[{'id':'save','action':'保存','expected':'记录保留'}]}))
        version=AppVersion(app_id=one['app_id'],requirement_revision=1,manifest={},validation={'checks':[{'id':'save','status':'PASS','evidence':'file'}],'required_ids':['save'],'requirement_revision':1,'attempt_id':'a','manifest_hash':'h'})
        session.add(version);session.flush();session.get(App,one['app_id']).candidate_version_id=version.id;session.commit()
    report=api_client.get('/api/jobs/'+one['job_id']+'/report',headers=owner_headers).json()
    assert report['overall']=='NOT_RUN'


def test_create_replay_returns_original_response_after_job_changes(api_client,owner_headers,session_factory):
    one=create(api_client,owner_headers).json()
    with session_factory() as session:
        session.get(Job,one['job_id']).status='FAILED';session.commit()
    assert create(api_client,owner_headers).json()==one


def test_terminal_sse_replays_only_new_events(api_client,owner_headers,session_factory):
    from app.jobs.events import append_event
    one=create(api_client,owner_headers).json()
    with session_factory() as session:
        first=append_event(session,one['job_id'],'phase',{'message':'开始'})
        session.get(Job,one['job_id']).status='FAILED';session.commit()
        last=append_event(session,one['job_id'],'phase',{'message':'未完成'})
    response=api_client.get('/api/jobs/'+one['job_id']+'/events',headers={**owner_headers,'Last-Event-ID':str(first)})
    assert response.status_code==200
    assert f'id: {last}\n' in response.text and f'id: {first}\n' not in response.text
    assert 'event: job\n' in response.text


def test_artifact_download_is_scoped_and_cannot_read_host_files(api_client,owner_headers,other_headers,session_factory,tmp_path,monkeypatch):
    from app.apps.models import AppVersion
    from app.config import settings
    monkeypatch.setattr(settings,'ARTIFACTS_ROOT',str(tmp_path))
    one=create(api_client,owner_headers).json()
    with session_factory() as session:
        version=AppVersion(app_id=one['app_id'],requirement_revision=1,manifest={},validation={},artifact_path='/etc/passwd')
        session.add(version);session.commit();version_id=version.id
    endpoint=f"/api/apps/{one['app_id']}/versions/{version_id}/artifact"
    assert api_client.get(endpoint,headers=owner_headers).status_code==409
    assert api_client.get(endpoint,headers=other_headers).status_code==404
    source=tmp_path/'source.zip';source.write_bytes(b'zip-bytes')
    with session_factory() as session:
        session.get(AppVersion,version_id).artifact_path=str(source);session.commit()
    download=api_client.get(endpoint,headers=owner_headers)
    assert download.content==b'zip-bytes' and 'attachment' in download.headers['content-disposition']


def test_missing_billing_cannot_resume_paused_task(api_client,owner_headers,session_factory):
    one=create(api_client,owner_headers).json()
    with session_factory() as session:
        session.get(Job,one['job_id']).status='PAUSED_QUOTA';session.commit()
    response=api_client.post('/api/jobs/'+one['job_id']+'/resume',headers={**owner_headers,'Idempotency-Key':'resume'})
    assert response.status_code==503
    assert api_client.get('/api/jobs/'+one['job_id'],headers=owner_headers).json()['status']=='PAUSED_QUOTA'


def test_report_evidence_is_job_scoped(api_client,owner_headers,other_headers,session_factory,tmp_path,monkeypatch):
    from app.runtime.models import ResourceRecord
    from app.config import settings
    monkeypatch.setattr(settings,'ARTIFACTS_ROOT',str(tmp_path))
    one=create(api_client,owner_headers).json()
    evidence=tmp_path/'screen.png';evidence.write_bytes(b'png')
    with session_factory() as session:
        resource=ResourceRecord(type='EVIDENCE',app_id=one['app_id'],job_id=one['job_id'],operation_id='check-save',state='READY',reference=str(evidence),metadata_json={'content_type':'image/png','check_id':'save'})
        session.add(resource);session.commit();resource_id=resource.id
    endpoint=f"/api/jobs/{one['job_id']}/report/evidence/{resource_id}"
    assert api_client.get(endpoint,headers=owner_headers).content==b'png'
    assert api_client.get(endpoint,headers=other_headers).status_code==404
    other=create(api_client,owner_headers,key='second').json()
    assert api_client.get(f"/api/jobs/{other['job_id']}/report/evidence/{resource_id}",headers=owner_headers).status_code==404


def test_concurrent_create_has_one_application(api_client,owner_headers):
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(2) as pool:
        responses=list(pool.map(lambda _:create(api_client,owner_headers),range(2)))
    assert [r.status_code for r in responses]==[201,201]
    assert responses[0].json()==responses[1].json()
    assert len(api_client.get('/api/apps',headers=owner_headers).json()['items'])==1
