import json
from pathlib import Path

import pytest
from sqlalchemy import select

from app.billing.models import PriceRule
from app.models.user import User
from app.runtime.models import DeploymentTarget


def test_register_cannot_grant_developer(api_client):
    response = api_client.post('/auth/register', json={'username': 'visitor', 'email': 'visitor@test', 'password': 'test-password', 'is_developer': True})
    assert response.status_code == 422


def test_admin_catalog_import_preserves_price_versions_and_rolls_back_bad_import(session_factory):
    from app.admin.service import import_catalog
    with session_factory() as db:
        import_catalog(db, {'prices': [{'kind':'execution.millis','version':'prod-v1','numerator':1,'denominator':1000}], 'skus': []})
        db.commit()
    with session_factory() as db:
        with pytest.raises(ValueError):
            import_catalog(db, {'prices': [{'kind':'execution.millis','version':'prod-v1','numerator':2,'denominator':1000}], 'skus': []})
        db.rollback()
        assert db.get(PriceRule, ('execution.millis','prod-v1')).numerator == 1


def test_admin_target_registration_hides_secret_refs_and_rejects_inline_secrets(session_factory):
    from app.admin.service import add_target, list_targets
    with session_factory() as db:
        target = add_target(db, 'linux-prod', 'linux', {'architecture':'amd64', 'domain_suffix':'apps.example.test',
            'secret_ref':'ssh-production', 'capacity': {'ssh_host':'host.example.test','ssh_user':'deploy','deployment_root':'/srv/apps',
                'cpu_millis':2000,'memory_mb':2048,'storage_mb':10240,'gateway_image':'registry.example/gateway@sha256:'+'a'*64}})
        db.commit()
        assert target.health == 'UNKNOWN'
        public = json.dumps(list_targets(db))
        assert 'ssh-production' not in public and 'secret_ref' not in public
        with pytest.raises(ValueError):
            add_target(db, 'bad', 'linux', {'secret_ref':'ref','capacity':{'private_key':'secret'}})


def test_developer_updates_are_audited_and_claim_drain_preserves_queued_jobs(session_factory, job_factory):
    from app.admin.service import set_developer, set_drain
    from app.jobs.store import claim_job
    from app.jobs.models import Job
    from app.runtime.models import AdminAudit
    job = job_factory()
    with session_factory() as db:
        from app.apps.models import App
        user_id = db.get(App, job.app_id).owner_id
        set_developer(db, user_id, True)
        set_drain(db, True)
        db.commit()
    with session_factory() as db:
        assert claim_job(db, 'worker') is None
        assert db.get(Job, job.id).status == 'QUEUED'
        assert db.get(User,user_id).is_developer
        assert len(list(db.scalars(select(AdminAudit)))) == 2
        set_drain(db, False)
        db.commit()
        assert claim_job(db, 'worker').id == job.id


def test_management_cli_parses_nested_commands_and_prints_safe_errors():
    assert Path('backend/app/admin/cli.py').is_file(), '08-O1 management CLI is missing'
    from app.admin.cli import parser
    args = parser().parse_args(['users','developer','grant','--user-id','12'])
    assert args.user_id == 12 and args.action == 'grant'


def test_ssh_remote_program_is_one_shell_argument_instead_of_executable_fragments():
    import shlex
    from app.runtime.linux import _ssh_argv
    argv=_ssh_argv({'capacity':{'ssh_host':'host.example.test','ssh_user':'deploy','ssh_port':2222}},'/private/key')
    remote=argv[argv.index('python3'):]
    parsed=shlex.split(' '.join(remote))
    assert len(parsed)==3 and parsed[:2]==['python3','-c']
    compile(parsed[2],'<remote-agent>','exec')


def test_registered_capacity_accepts_explicit_caddy_admin_reload():
    from app.admin.service import Capacity
    parsed = Capacity.model_validate({'cpu_millis':1000,'memory_mb':1024,'storage_mb':1000,
        'gateway_image':'registry.example/gateway@sha256:'+'a'*64,
        'caddy_reload_mode':'admin','caddy_binary':'/controlled/caddy'})
    assert parsed.caddy_reload_mode == 'admin'
