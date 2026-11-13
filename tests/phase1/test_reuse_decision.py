import pytest
from app.core.types import Requirement
from test_default_execution import new_job


def test_no_candidates_cannot_silently_generate():
    from app.agent.reuse import choose_reuse_decision, NoReusableSolution
    req=Requirement(prompt='找笔记软件',acceptance=[])
    with pytest.raises(NoReusableSolution):
        choose_reuse_decision(req,[],[])


def test_a_rejection_does_not_reject_a_usable_principal():
    from app.agent.reuse import choose_reuse_decision
    from app.agent.contracts import CandidateAssessment
    from test_candidate_ranking import profile
    req=Requirement(prompt='私人笔记',acceptance=[{'id':'A1','action':'保存','expected':'可见'}])
    p=profile('notes')
    assessment=CandidateAssessment(repo_url=p.repo_url,commit=p.commit,requirement_revision=1,
        capabilities=[{'acceptance_id':'A1','status':'UNKNOWN','reason':'needs adaptation'}],
        route_verdicts={'A':{'status':'INELIGIBLE','reason':'missing SSO'},
                        'B':{'status':'ELIGIBLE','reason':'existing notes business','evidence_refs':['README.md']}})
    decision=choose_reuse_decision(req,[assessment],[p])
    assert decision.route=='MODIFY_EXISTING'
    assert decision.selected_sources[0].url==p.repo_url


def test_small_difference_does_not_block_direct_deployment():
    from app.agent.reuse import choose_reuse_decision
    from app.agent.contracts import CandidateAssessment
    from test_candidate_ranking import profile
    req=Requirement(prompt='私人笔记',acceptance=[{'id':'A1','action':'保存','expected':'可见'}])
    p=profile('notes')
    a=CandidateAssessment(repo_url=p.repo_url,commit=p.commit,requirement_revision=1,
        capabilities=[{'acceptance_id':'A1','status':'SUPPORTED','reason':'CRUD','evidence_refs':['README.md'],'quote':'notes'}],differences=['界面不同'])
    decision=choose_reuse_decision(req,[a],[p])
    assert decision.route=='DEPLOY_EXISTING'
    assert decision.differences==['界面不同']


def test_external_service_does_not_require_permission_to_redistribute_code():
    from app.agent.reuse import choose_reuse_decision
    from app.agent.contracts import CandidateAssessment, DeploymentAsset
    from test_candidate_ranking import profile
    req=Requirement(prompt='在线编辑器',acceptance=[{'id':'A1','action':'编辑','expected':'可用'}])
    p=profile('editor',license_status='UNKNOWN')
    p.deployment_assets=[DeploymentAsset(kind='OFFICIAL_SERVICE',location='https://editor.example/',source_ref='github:homepage',source_digest='a'*64)]
    a=CandidateAssessment(repo_url=p.repo_url,commit=p.commit,requirement_revision=1,
        capabilities=[{'acceptance_id':'A1','status':'SUPPORTED','evidence_refs':['README.md'],'quote':'editor','reason':'editor'}])
    assert choose_reuse_decision(req,[a],[p]).delivery_kind=='EXTERNAL_LINK'
    req.delivery_policy.preference='SELF_HOSTED'
    from app.agent.reuse import NoReusableSolution
    with pytest.raises(NoReusableSolution): choose_reuse_decision(req,[a],[p])


def test_equally_capable_principal_prefers_smaller_adaptation_scope():
    from app.agent.reuse import choose_reuse_decision
    from app.agent.contracts import CandidateAssessment
    from test_candidate_ranking import profile
    req=Requirement(prompt='笔记',acceptance=[{'id':'A1','action':'保存','expected':'可见'}],delivery_policy={'preference':'SELF_HOSTED'})
    ps=[profile('popular'),profile('small')]
    assessments=[CandidateAssessment(repo_url=p.repo_url,commit=p.commit,requirement_revision=1,
        capabilities=[{'acceptance_id':'A1','status':'SUPPORTED','reason':'notes','evidence_refs':['README.md'],'quote':'notes'}],
        adaptations=['rewrite auth','rewrite config','replace storage'] if i==0 else ['configure port']) for i,p in enumerate(ps)]
    assert choose_reuse_decision(req,assessments,ps).selected_sources[0].url==ps[1].repo_url


@pytest.mark.asyncio
async def test_real_orchestrator_entry_selects_repository_without_generation(new_job,session_factory,monkeypatch):
    import json
    from app.jobs.execution import JobExecution
    from app.core.types import RetrievalResult, ModelTurn
    from test_repository_profiler import retrieval_candidate
    candidate=retrieval_candidate(repo_url='https://github.com/example/notes',description='private notes web app',
        file_tree=['README.md','LICENSE','package.json','app/page.tsx','Dockerfile'],
        key_files={'README.md':'Create private notes','LICENSE':'MIT License',
            'package.json':'{"scripts":{"build":"next build","start":"next start"},"dependencies":{"next":"16.4.6"}}',
            'Dockerfile':'FROM node:24\nEXPOSE 3000\nCMD ["npm","start"]','app/page.tsx':'export default function Page(){return "notes";}'})
    async def retrieve(*args,**kwargs):
        return RetrievalResult(queries=['private notes'],completed=True,candidates=[candidate])
    monkeypatch.setattr('app.agent.retrieval.retrieve_sources',retrieve)
    class Model:
        async def complete(self,messages,tools,model):
            assert model != 'generate'
            return ModelTurn(assistant_message={'content':json.dumps([{'repo_url':candidate.repo_url,'commit':candidate.commit,
                'requirement_revision':1,'capabilities':[{'acceptance_id':'A1','status':'SUPPORTED','evidence_refs':['README.md'],
                    'quote':'Create private notes','reason':'notes functionality'}],'differences':['界面不同']}])},input_tokens=1,output_tokens=1)
    jid,_,_,generation=new_job
    execution=JobExecution(jid,'worker',generation,session_factory=session_factory,model_client=Model())
    route=await execution.choose_sources(Requirement(prompt='私人笔记',acceptance=[{'id':'A1','action':'创建笔记','expected':'保存'}]))
    assert route.route=='DEPLOY_EXISTING'
    assert route.sources[0].url==candidate.repo_url
    assert execution.algorithm_checkpoint().reuse_decision.differences==['界面不同']
