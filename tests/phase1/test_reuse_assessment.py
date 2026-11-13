import pytest
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
