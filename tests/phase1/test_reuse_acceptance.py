from scripts.summarize_phase1_evaluations import summarize_pairs
from test_default_execution import new_job


def test_external_link_is_not_hosted_deployment_success():
    from scripts.summarize_phase1_evaluations import summarize_reuse_records
    summary=summarize_reuse_records([
        {'delivery_kind':'EXTERNAL_LINK','status':'SUCCEEDED','route':None},
        {'delivery_kind':'HOSTED_INSTANCE','status':'FAILED','route':'DEPLOY_EXISTING'},
    ])
    assert summary['external_link_successes']==1
    assert summary['hosted_successes']==0


def test_external_pairs_never_authorize_hybrid_default():
    rows=[{'pair_id':'pair','algorithm_mode':mode,'case_id':'notes','delivery_kind':'EXTERNAL_LINK',
           'status':'SUCCEEDED','source_mode':'real','real_delivery_passed':True,
           'cost_status':'known','cost_units':1,'evidence_gate':{'status':'PASS'}} for mode in ['baseline','hybrid']]
    result=summarize_pairs(rows)
    assert result['hybrid_default_ready'] is False
    assert 'EXTERNAL_LINK_NOT_HOSTED_PAIR' in result['not_run_reasons']


def test_official_version_preserves_repository_and_does_not_claim_preferences(new_job,session_factory,tmp_path):
    from app.core.types import AppManifest,ValidationReport
    from app.runtime.manifest import manifest_hash
    from app.jobs.pipeline import PipelineCandidate,_create_verified_version
    from app.jobs.models import Job
    from app.apps.models import AppVersion,RequirementRecord
    jid,aid,_,_=new_job
    source={'url':'https://github.com/example/editor','commit':'a'*40,'role':'principal'}
    with session_factory() as session:
        job=session.get(Job,jid);job.requirement_revision=1
        job.checkpoint={**job.checkpoint,'algorithm':{**job.checkpoint['algorithm'],'selected_sources':[source]}}
        session.add(RequirementRecord(app_id=aid,revision=1,requirement={'prompt':'编辑器','acceptance':[
            {'id':'A1','action':'编辑','expected':'可用'},
            {'id':'color','action':'蓝色界面','expected':'蓝色','importance':'PREFERENCE'}]},review={}))
        session.commit()
    (tmp_path/'app.py').write_text('print("editor")')
    manifest=AppManifest(web_service='web',services=[{'name':'web','image':'image@sha256:'+'a'*64,'port':3000}])
    report=ValidationReport(checks=[{'id':'A1','status':'PASS','evidence':'fixture'}],required_ids=['A1'],
        requirement_revision=1,attempt_id='attempt',manifest_hash=manifest_hash(manifest))
    candidate=PipelineCandidate('attempt',str(tmp_path),manifest,manifest_hash(manifest),[])
    version_id=_create_verified_version(session_factory,jid,candidate,report)
    with session_factory() as session:
        version=session.get(AppVersion,version_id)
        assert version.sources==[source]
        assert version.delivery['features']==['编辑']
