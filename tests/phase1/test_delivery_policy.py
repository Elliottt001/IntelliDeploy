import pytest

from app.core.types import Requirement, RequirementDraft
from app.agent.requirements import validate_revision, RequirementCoverageError


def rows(text):
    return [{'id':'m','role':'user','sequence':1,'content':text}]


def draft(text, **values):
    return RequirementDraft(prompt=text, acceptance=[{'id':'A1','action':'保存私人笔记','expected':'账号之间隔离','private_data':True}],
        facts=[{'id':'F1','source_message_id':'m','quote':text,'kind':'FUNCTION','acceptance_ids':['A1']}], **values)


def test_old_requirement_keeps_core_and_disallows_generation():
    req=Requirement(prompt='私人笔记',acceptance=[{'id':'A1','action':'隔离账号','expected':'不能越权'}])
    assert req.delivery_policy.preference=='EXISTING_SERVICE_FIRST'
    assert req.delivery_policy.allow_generation is False
    assert req.acceptance[0].importance=='CORE'


@pytest.mark.parametrize('text,preference,generate',[
    ('做一个私人笔记网站','EXISTING_SERVICE_FIRST',False),
    ('我要自托管私人笔记','SELF_HOSTED',False),
    ('self-host a private notes app','SELF_HOSTED',False),
    ('不要从零生成，找一个私人笔记','EXISTING_SERVICE_FIRST',False),
    ('从零生成私人笔记','EXISTING_SERVICE_FIRST',True),
])
def test_policy_is_derived_from_user_request(text,preference,generate):
    req=validate_revision(None,draft(text),rows(text))
    assert req.delivery_policy.preference==preference
    assert req.delivery_policy.allow_generation is generate


def test_private_acceptance_cannot_be_downgraded_to_preference():
    value=draft('保存私人笔记')
    value.acceptance[0].importance='PREFERENCE'
    with pytest.raises(RequirementCoverageError,match='core'):
        validate_revision(None,value,rows('保存私人笔记'))
