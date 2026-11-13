import pytest
from app.core.types import Requirement


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
