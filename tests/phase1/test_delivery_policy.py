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


def test_delivery_and_waived_storage_facts_do_not_become_software_checks():
    text = '编辑预览。只需要当次编辑和预览，不需要跨会话保存。不需要自己部署。'
    value = RequirementDraft(prompt=text, acceptance=[{'id': 'edit', 'action': '编辑预览', 'expected': '当次可用'}],
        facts=[{'id': 'function', 'source_message_id': 'm', 'quote': '编辑预览', 'kind': 'FUNCTION', 'acceptance_ids': ['edit']},
            {'id': 'scope', 'source_message_id': 'm', 'quote': '只需要当次编辑和预览，不需要跨会话保存', 'kind': 'DATA', 'acceptance_ids': []},
            {'id': 'delivery', 'source_message_id': 'm', 'quote': '不需要自己部署。', 'kind': 'EXTERNAL', 'acceptance_ids': []}])
    req = validate_revision(None, value, rows(text))
    assert [a.id for a in req.core_acceptance] == ['edit']
    assert len(req.facts) == 3
    assert req.delivery_policy.preference == 'EXISTING_SERVICE_FIRST'
    assert req.delivery_policy.allow_generation is False


@pytest.mark.parametrize('quote,kind', [('必须跨会话保存', 'DATA'), ('必须账号隔离', 'ACCESS'), ('真实调用AI', 'EXTERNAL')])
def test_actual_business_facts_still_need_acceptance_mapping(quote, kind):
    value = RequirementDraft(prompt=quote, acceptance=[{'id': 'A1', 'action': quote, 'expected': '实际生效'}],
        facts=[{'id': 'F1', 'source_message_id': 'm', 'quote': quote, 'kind': kind, 'acceptance_ids': []}])
    with pytest.raises(RequirementCoverageError, match='acceptance mapping'):
        validate_revision(None, value, rows(quote))


def test_delivery_fact_cannot_replace_business_coverage():
    text = '编辑预览，不需要自己部署'
    value = RequirementDraft(prompt=text, acceptance=[{'id': 'edit', 'action': '编辑预览', 'expected': '可用'}],
        facts=[{'id': 'delivery', 'source_message_id': 'm', 'quote': '不需要自己部署', 'kind': 'EXTERNAL', 'acceptance_ids': []}])
    with pytest.raises(RequirementCoverageError, match='business fact'):
        validate_revision(None, value, rows(text))


def test_confirmation_is_bound_to_the_actual_deployment_question():
    from app.agent.requirements import delivery_policy_from_messages
    messages=[{'id':'q','role':'assistant','sequence':1,'content':'是否部署独立实例？'},
              {'id':'a','role':'user','sequence':2,'content':'同意'}]
    assert delivery_policy_from_messages(messages).preference=='SELF_HOSTED'
    assert delivery_policy_from_messages(rows('同意')).preference=='EXISTING_SERVICE_FIRST'


@pytest.mark.asyncio
async def test_requirement_review_does_not_demand_delivery_before_search():
    import json
    from app.agent.requirements import compile_requirement
    from app.core.types import ModelTurn
    text='找一个私人笔记软件，先给官方服务链接'
    value=draft(text)
    class Model:
        calls=0
        async def complete(self,messages,tools,model):
            self.calls+=1
            if self.calls%2==0:
                scope=json.loads(messages[1]['content'])['review_scope']
                assert scope['requires_delivery_evidence'] is False
                return ModelTurn(assistant_message={'content':'{"missing":[]}'})
            return ModelTurn(assistant_message={'content':json.dumps(value.model_dump(mode='json'),ensure_ascii=False)})
    assert (await compile_requirement(rows(text),None,Model())).acceptance[0].id=='A1'
