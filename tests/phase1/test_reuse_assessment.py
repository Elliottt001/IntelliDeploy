import pytest
import json
from app.core.types import Requirement, RetrievalCandidate
from test_candidate_ranking import profile


def requirement():
    return Requirement(prompt='私人笔记',acceptance=[{'id':'A1','action':'创建笔记','expected':'保存'}])


def test_unread_business_is_unknown_not_missing():
    from app.agent.ranking import rank_candidate
    value=rank_candidate(profile('notes'),requirement())
    assert value.missing_core==[]
    assert 'core:A1' in value.unknown_fields
    assert 'missing_core_requirements' not in value.rejection_reasons


def test_unknown_does_not_reject_all_reuse():
    from app.agent.contracts import CandidateAssessment
    value=CandidateAssessment(repo_url='https://github.com/example/notes',commit='a'*40,requirement_revision=1,
        capabilities=[{'acceptance_id':'A1','status':'UNKNOWN','reason':'handler not read'}])
    assert not value.rejects_all_reuse()


def test_supported_capability_must_cite_read_source_and_exact_quote():
    from app.agent.assessment import validate_assessment
    from app.agent.contracts import CandidateAssessment
    value=CandidateAssessment(repo_url='https://github.com/example/notes',commit='a'*40,requirement_revision=1,
        capabilities=[{'acceptance_id':'A1','status':'SUPPORTED','evidence_refs':['README.md'],
                       'quote':'Create private notes','reason':'documented CRUD'}])
    assert validate_assessment(value,requirement(),profile('notes'),{'README.md':'Create private notes'}).capabilities[0].status=='SUPPORTED'
    with pytest.raises(ValueError,match='evidence'):
        validate_assessment(value,requirement(),profile('notes'),{'README.md':'unrelated'})


@pytest.mark.asyncio
async def test_one_bad_quote_does_not_discard_other_valid_candidates():
    from app.agent.assessment import assess_candidates
    from app.core.types import ModelTurn
    ps=[profile('one'),profile('two')]
    candidates=[RetrievalCandidate(repo_url=p.repo_url,commit=p.commit,key_files={'README.md':'Create private notes'}) for p in ps]
    class Model:
        async def complete(self,*args):
            rows=[{'repo_url':p.repo_url,'commit':p.commit,'requirement_revision':1,
                   'capabilities':[{'acceptance_id':'A1','status':'SUPPORTED','evidence_refs':['README.md'],
                    'quote':'Create private notes' if i==0 else 'invented','reason':'notes'}]} for i,p in enumerate(ps)]
            return ModelTurn(assistant_message={'content':'```json\n'+json.dumps(rows)+'\n```'})
    values=await assess_candidates(requirement(),candidates,ps,Model())
    assert values[0].capabilities[0].status=='SUPPORTED'
    assert values[1].capabilities[0].status=='UNKNOWN'


def test_route_verdict_keys_are_explicit_a_b_c():
    from app.agent.contracts import CandidateAssessment
    with pytest.raises(ValueError):
        CandidateAssessment(repo_url='https://github.com/example/notes',commit='a'*40,requirement_revision=1,
            capabilities=[],route_verdicts={'EXISTING_SERVICE_FIRST':{'status':'ELIGIBLE','reason':'wrong contract'}})


def test_unverified_comment_does_not_invalidate_supported_capability():
    from app.agent.contracts import CandidateAssessment
    from app.agent.assessment import validate_assessment
    req=Requirement(prompt='notes',acceptance=[{'id':'A1','action':'create','expected':'visible'},{'id':'A2','action':'share','expected':'visible'}])
    value=CandidateAssessment(repo_url='https://github.com/example/notes',commit='a'*40,requirement_revision=1,
        capabilities=[{'acceptance_id':'A1','status':'SUPPORTED','evidence_refs':['README.md'],'quote':'Create notes','reason':'CRUD'},
            {'acceptance_id':'A2','status':'UNKNOWN','evidence_refs':['README.md'],'quote':'paraphrased unknown','reason':'not confirmed'}])
    result=validate_assessment(value,req,profile('notes'),{'README.md':'Create notes'})
    assert result.capabilities[0].status=='SUPPORTED'
    assert result.capabilities[1].status=='UNKNOWN'
