import pytest
from app.core.types import AppManifest, ServiceSpec, ValidationReport, CheckResult


def test_report_requires_unique_complete_passing_checks():
    assert not ValidationReport(checks=[]).passed
    assert not ValidationReport(checks=[CheckResult(id='save', status='PASS', evidence='real')], required_ids=['save', 'reload']).passed
    assert not ValidationReport(checks=[CheckResult(id='save', status='PASS', evidence='real')] * 2).passed
    assert ValidationReport(checks=[CheckResult(id='save', status='PASS', evidence='real')], required_ids=['save']).passed


@pytest.mark.parametrize('services', [
    [dict(name='api', image='api:build')],
    [dict(name='web', image='web:build', depends_on=['missing'])],
    [dict(name='web', image='web:build', depends_on=['api']), dict(name='api', image='api:build', depends_on=['web'])],
    [dict(name='web', image='web:build'), dict(name='web', image='other:build')],
    [dict(name='web', image='')],
    [dict(name='web', image='web:build', port=0)],
    [dict(name='web', image='web:build', memory_mb=0)],
    [dict(name='web', image='web:build', volumes={'data': '/var/run/docker.sock'})],
    [dict(name='web', image='web:build', volumes={'data': '../data'})],
])
def test_manifest_rejects_unrunnable_or_unsafe_services(services):
    with pytest.raises(ValueError):
        AppManifest(web_service='web', services=[ServiceSpec(**s) for s in services])


def test_manifest_accepts_namespaced_persistent_multi_service_app():
    manifest = AppManifest(web_service='web', services=[
        ServiceSpec(name='db', image='postgres:17', volumes={'records': '/var/lib/postgresql/data'}),
        ServiceSpec(name='web', image='web:build', port=3000, depends_on=['db'])])
    assert manifest.web_service == 'web'
