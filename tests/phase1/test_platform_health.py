import json
import logging

from sqlalchemy import text

from app.config import settings


def test_health_is_public_checks_schema_and_storage_but_not_paid_providers(api_client, session_factory, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'ARTIFACTS_ROOT', str(tmp_path))
    monkeypatch.setattr(settings, 'AGENT_WORKSPACE_ROOT', str(tmp_path / 'workspaces'))
    assert api_client.get('/health/live').status_code == 200
    assert api_client.get('/health/ready').status_code == 200
    with session_factory() as db:
        original = db.execute(text('SELECT version_num FROM alembic_version')).scalar_one()
        db.execute(text("UPDATE alembic_version SET version_num='0001_phase1'"))
        db.commit()
    try:
        response = api_client.get('/health/ready')
        assert response.status_code == 503 and response.json()['checks']['schema'] is False
    finally:
        with session_factory() as db:
            db.execute(text('UPDATE alembic_version SET version_num=:version'), {'version': original})
            db.commit()


def test_structured_logging_omits_messages_arguments_and_arbitrary_sensitive_fields():
    from app.core.logging import JsonFormatter
    record = logging.LogRecord('app.jobs', logging.ERROR, '', 0, 'Bearer private-token user text', (), None)
    record.job_id = 'job-1'
    record.phase = 'building'
    record.error_code = 'BUILD_FAILED'
    record.headers = {'Authorization': 'private-token'}
    record.reasoning_content = 'private reasoning'
    output = JsonFormatter().format(record)
    assert json.loads(output)['job_id'] == 'job-1'
    assert json.loads(output)['phase'] == 'building'
    assert 'private-token' not in output and 'private reasoning' not in output and 'user text' not in output


def test_dependency_proxy_denies_metadata_loopback_and_unregistered_resolved_private_addresses(monkeypatch):
    import pytest
    from app.runner.proxy import destination
    for address in ['127.0.0.1', '169.254.169.254', '10.20.0.1', '::1']:
        monkeypatch.setattr('socket.getaddrinfo', lambda *args, address=address, **kw: [(2, 1, 6, '', (address, 443))])
        with pytest.raises(ValueError):
            destination('dependency.test', 443, {'dependency.test'}, set())
    monkeypatch.setattr('socket.getaddrinfo', lambda *args, **kw: [(2, 1, 6, '', ('127.0.0.1', 443))])
    with pytest.raises(ValueError):
        destination('capability.test', 443, {'capability.test'}, {'capability.test'})


def test_production_configuration_requires_postgres_and_a_dedicated_database(monkeypatch):
    import pytest
    from app.core.health import validate_production_configuration
    monkeypatch.setattr(settings,'ENVIRONMENT','production')
    monkeypatch.setattr(settings,'SECRET_KEY','s'*40)
    for url in ['sqlite:///legacy.db','postgresql+psycopg://user:pass@host/intellideploy_test?sslmode=require']:
        monkeypatch.setattr(settings,'DATABASE_URL',url)
        with pytest.raises(RuntimeError): validate_production_configuration()
