from copy import deepcopy
from types import SimpleNamespace
from uuid import uuid4
from datetime import datetime, timezone
import zipfile

import pytest
from sqlalchemy import select

from app.apps.models import App, AppVersion, Instance, RequirementRecord
from app.models.user import User
from app.core.types import AppManifest, ServiceSpec, ValidationReport, CheckResult, Requirement, AcceptanceItem
from app.runtime.manifest import manifest_hash


@pytest.fixture
def publication_context(session_factory, tmp_path):
    manifest = AppManifest(web_service='web', services=[ServiceSpec(name='web', image='registry.test/notes@sha256:'+'a'*64, port=3000)])
    requirement = Requirement(prompt='保存私有笔记', acceptance=[AcceptanceItem(id='save', action='保存笔记', expected='刷新仍存在', private_data=True)])
    report = ValidationReport(checks=[CheckResult(id='save', status='PASS', evidence='evidence/save')], required_ids=['save'], requirement_revision=1, attempt_id='verified', manifest_hash=manifest_hash(manifest))
    artifact = tmp_path / 'source.zip'
    with zipfile.ZipFile(artifact, 'w') as archive:
        archive.writestr('app.py', 'print("notes")')
    with session_factory() as session:
        owner = User(username='creator-'+uuid4().hex, email=uuid4().hex+'@test', hashed_password='test-only')
        visitor = User(username='visitor-'+uuid4().hex, email=uuid4().hex+'@test', hashed_password='test-only')
        session.add_all([owner, visitor]); session.flush()
        app = App(owner_id=owner.id, name='私有笔记', prompt=requirement.prompt)
        session.add(app); session.flush()
        version = AppVersion(app_id=app.id, requirement_revision=1, manifest=manifest.model_dump(mode='json'), validation=report.model_dump(mode='json'), artifact_path=str(artifact), sources=[{'url':'https://github.com/example/notes', 'commit':'a'*40, 'role':'main'}], delivery={'summary':'记录你的笔记', 'features':['保存笔记'], 'browser_checks':[{'item_id':'save','actor':'owner','actions':[], 'expected':'刷新仍存在'}]})
        session.add(version); session.flush()
        app.active_version_id = version.id
        instance = Instance(app_id=app.id, owner_id=owner.id, version_id=version.id, status='RUNNING', url='https://notes.apps.test.invalid', data_namespace='private-'+uuid4().hex, secret_ref='private-secret')
        session.add(instance)
        session.add(RequirementRecord(app_id=app.id, revision=1, requirement=requirement.model_dump(mode='json'), review={}))
        session.commit()
        return SimpleNamespace(app_id=app.id, version_id=version.id, instance_id=instance.id, owner_id=owner.id, visitor_id=visitor.id, manifest=manifest, report=report, requirement=requirement)


def publish_context(session, c, **kwargs):
    from app.community.service import publish
    return publish(session, c.app_id, c.owner_id, c.version_id, kwargs.pop('payer_policy', 'SPONSOR'), **kwargs)


def test_publication_requires_active_verified_version(publication_context, session_factory):
    from app.community.service import PublicationError
    c = publication_context
    with session_factory() as session:
        version = session.get(AppVersion, c.version_id)
        data = deepcopy(version.validation); data['checks'][0]['status'] = 'FAIL'; version.validation = data
        with pytest.raises(PublicationError): publish_context(session, c)
        session.rollback()
        session.get(Instance, c.instance_id).version_id = None
        with pytest.raises(PublicationError): publish_context(session, c)


def test_publication_rejects_missing_core_binding_and_foreign_owner(publication_context, session_factory):
    from app.community.service import PublicationError, publish
    c = publication_context
    with session_factory() as session:
        with pytest.raises(PublicationError): publish(session, c.app_id, c.visitor_id, c.version_id, 'VISITOR')
        version = session.get(AppVersion, c.version_id)
        data = deepcopy(version.validation); data['required_ids'] = []; version.validation = data
        with pytest.raises(PublicationError): publish_context(session, c)


def test_public_response_excludes_secrets_and_stopped_link(publication_context, session_factory):
    from app.community.service import get_publication
    c = publication_context
    with session_factory() as session:
        publication = publish_context(session, c, sponsor_limit_units=200)
        session.commit()
        public = get_publication(session, publication.id).model_dump()
        assert public['name'] == '私有笔记' and public['url'] == 'https://notes.apps.test.invalid'
        assert not {'env_refs','checkpoint','secret_ref','manifest','validation','data_namespace'} & public.keys()
        session.get(Instance, c.instance_id).status = 'STOPPED'; session.flush()
        assert get_publication(session, publication.id).url is None
        assert get_publication(session, publication.id).available is False


def test_unpublish_revokes_new_community_access_but_keeps_owner(publication_context, session_factory):
    from app.community.service import unpublish, get_publication, PublicationError
    from app.capabilities.identity import issue_login_code, provision_instance_credential, resolve_context, IdentityError
    c = publication_context
    with session_factory() as session:
        publication = publish_context(session, c, sponsor_limit_units=200)
        token = provision_instance_credential(session, c.instance_id)
        session.commit()
        assert resolve_context(session, c.instance_id, None, token).payer_id == c.owner_id
        code = issue_login_code(session, c.instance_id, c.visitor_id, 'https://notes.apps.test.invalid/api/platform/callback')
        assert code
        unpublish(session, publication.id, c.owner_id); session.commit()
        with pytest.raises(PublicationError): get_publication(session, publication.id)
        with pytest.raises(IdentityError): resolve_context(session, c.instance_id, None, token)
        with pytest.raises(IdentityError): issue_login_code(session, c.instance_id, c.visitor_id, 'https://notes.apps.test.invalid/api/platform/callback')
        assert issue_login_code(session, c.instance_id, c.owner_id, 'https://notes.apps.test.invalid/api/platform/callback')
        assert session.get(Instance, c.instance_id).status == 'RUNNING'


def test_sponsor_limit_reserves_concurrent_calls_and_releases_unused(publication_context, session_factory):
    from app.community.service import reserve_sponsor
    from app.capabilities.identity import SponsorLimitExceeded
    from app.billing.ledger import grant, reserve, settle, record_usage
    from app.billing.models import PriceRule
    from app.core.types import UsageInput
    c = publication_context
    with session_factory() as session:
        publication = publish_context(session, c, sponsor_limit_units=100)
        grant(session,c.owner_id,'sponsor-test',1000,'FREE')
        session.add(PriceRule(kind='test',version='test',numerator=1,denominator=1)); session.commit()
        reserve(session,c.owner_id,'call-1',80)
        reserve_sponsor(session,publication.id,'call-1',80); session.commit()
    with session_factory() as session:
        with pytest.raises(SponsorLimitExceeded): reserve_sponsor(session,publication.id,'call-2',80)
        session.rollback()
        record_usage(session,UsageInput(operation_id='usage-1',payer_id=c.owner_id,kind='test',units=10,price_version='test',reservation_operation_id='call-1'))
        settle(session,'call-1'); session.commit()
    with session_factory() as session:
        reserve(session,c.owner_id,'call-2',80)
        reserve_sponsor(session,publication.id,'call-2',80); session.commit()
        assert reserve_sponsor(session,publication.id,'call-2',80).operation_id == 'call-2'


def test_community_api_anonymous_read_owner_writes_and_library(publication_context, api_client, session_factory):
    from app.utils.security import get_current_user
    from app.main import app as api_app
    c=publication_context
    with session_factory() as session:
        owner=session.get(User,c.owner_id); visitor=session.get(User,c.visitor_id)
    api_app.dependency_overrides[get_current_user]=lambda: owner
    response=api_client.post(f'/api/apps/{c.app_id}/publish',json={'version_id':c.version_id,'payer_policy':'VISITOR'})
    assert response.status_code == 200, response.text
    publication_id=response.json()['id']
    api_app.dependency_overrides.pop(get_current_user)


    assert api_client.get('/api/community/apps').json()['items'][0]['id'] == publication_id
    assert api_client.get(f'/api/publications/{publication_id}').status_code == 200
    api_app.dependency_overrides[get_current_user]=lambda: visitor
    assert api_client.delete(f'/api/publications/{publication_id}').status_code == 404
    assert api_client.put(f'/api/library/favorites/{publication_id}').status_code == 200
    assert api_client.get('/api/library/favorites').json()['items'][0]['id'] == publication_id
    assert api_client.post(f'/api/publications/{publication_id}/use').status_code == 200
    assert api_client.get('/api/library/recent').json()['items'][0]['id'] == publication_id
    api_app.dependency_overrides.pop(get_current_user)

def test_gateway_rechecks_publication_after_unpublish(publication_context,api_client,session_factory):
    from app.capabilities.identity import provision_instance_credential
    from app.community.service import unpublish
    c=publication_context
    with session_factory() as session:
        p=publish_context(session,c)
        token=provision_instance_credential(session,c.instance_id);session.commit()
    headers={'X-Instance-ID':c.instance_id,'X-Instance-Token':token}
    response=api_client.get(f'/api/instances/{c.instance_id}/access',headers=headers)
    assert response.status_code==200,response.text
    assert response.json()=={'allowed':True,'user_id':None}
    with session_factory() as session:
        unpublish(session,p.id,c.owner_id);session.commit()
    assert api_client.get(f'/api/instances/{c.instance_id}/access',headers=headers).status_code==403


def test_parallel_sponsor_reservations_cannot_exceed_period_limit(publication_context,session_factory):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from app.community.service import reserve_sponsor
    from app.capabilities.identity import SponsorLimitExceeded
    from app.billing.ledger import grant,reserve
    c=publication_context
    with session_factory() as session:
        p=publish_context(session,c,sponsor_limit_units=100)
        grant(session,c.owner_id,'parallel-sponsor',1000,'FREE')
        reserve(session,c.owner_id,'parallel-1',80);reserve(session,c.owner_id,'parallel-2',80);session.commit()
    gate=Barrier(2)
    def attempt(key):
        with session_factory() as session:
            gate.wait(timeout=5)
            try:reserve_sponsor(session,p.id,key,80);session.commit();return True
            except SponsorLimitExceeded:session.rollback();return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(attempt,key) for key in ('parallel-1','parallel-2')]
        assert sorted(f.result(timeout=10) for f in futures)==[False,True]
