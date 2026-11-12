import importlib.util
import json
import os
from pathlib import Path
import subprocess

import httpx


def test_production_compose_keeps_control_plane_private_and_persists_state(tmp_path):
    runtime=tmp_path/'runtime.env'; runtime.write_text('DATABASE_URL=postgresql+psycopg://fixture:fixture@postgres/intellideploy\nSECRET_KEY=fixture-only-long-random-secret-never-deploy\n')
    env={**os.environ,'PLATFORM_ENV_FILE':str(runtime),'CREDENTIALS_DIR':str(tmp_path),
        'PLATFORM_DOMAIN':'platform.example.test','API_DOMAIN':'api.example.test'}
    result=subprocess.run(['docker','compose','-f','infra/platform/compose.prod.yml','config','--format','json'],env=env,capture_output=True,text=True)
    assert result.returncode==0, result.stderr
    config=json.loads(result.stdout)
    assert not config['services']['api'].get('ports') and not config['services']['postgres'].get('ports')
    assert config['networks']['control']['internal']
    assert config['services']['worker']['command']==['python','-m','app.jobs.worker']
    assert config['services']['api']['image']==config['services']['worker']['image']
    for name in ('api','worker'):
        assert not any('docker.sock' in volume['source'] for volume in config['services'][name]['volumes'])
        assert any(volume['type']=='volume' for volume in config['services'][name]['volumes'])


def test_platform_verify_does_not_turn_failed_readiness_into_production_success():
    path=Path('scripts/verify_platform_production.py')
    assert path.is_file(), 'Production verification entry is missing'
    spec=importlib.util.spec_from_file_location('platform_verify',path)
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    def upstream(request):
        if request.url.path=='/health/ready': return httpx.Response(503,json={'ready':False})
        if request.url.path=='/health/live': return httpx.Response(200,json={'alive':True})
        if request.url.path=='/api/apps': return httpx.Response(401,json={'error':{'code':'UNAUTHORIZED'}})
        return httpx.Response(200,text='<html>Platform login</html>',headers={'content-type':'text/html'})
    with httpx.Client(transport=httpx.MockTransport(upstream)) as client:
        report=module.verify_platform('https://platform.test','https://api.test',client=client)
    assert report['platform_ready'] is False
    assert report['checks']['api_ready']['status']=='FAIL'


def test_executor_compose_shares_only_the_registered_workspace_with_the_host(tmp_path):
    runtime=tmp_path/'runner.env'; runtime.write_text('RUNNER_RPC_TOKEN=test-only\n')
    env={**os.environ,'RUNNER_ENV_FILE':str(runtime),'RUNNER_IMAGE':'registry.test/runner@sha256:'+'a'*64,
        'PLATFORM_API_IMAGE':'registry.test/api@sha256:'+'a'*64,'BUILDKIT_IMAGE':'moby/buildkit@sha256:'+'b'*64,
        'CRANE_IMAGE':'registry.test/crane@sha256:'+'c'*64,'RUNTIME_PROXY_IMAGE':'registry.test/proxy@sha256:'+'d'*64,
        'RUNNER_WORKSPACE_ROOT':str(tmp_path/'workspaces'),'RUNNER_CREDENTIALS_DIR':str(tmp_path/'credentials'),
        'REGISTRY_CONFIG_DIR':str(tmp_path/'registry'),'DEPENDENCY_ALLOWED_HOSTS':'pypi.org,registry.npmjs.org','CANDIDATE_DOMAIN_SUFFIX':'candidate.example.test'}
    result=subprocess.run(['docker','compose','-f','infra/executor/compose.yml','config','--format','json'],env=env,capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    config=json.loads(result.stdout)
    runner=config['services']['runner']
    assert runner['network_mode']=='host'
    workspace=next(v for v in runner['volumes'] if v['target']==str(tmp_path/'workspaces'))
    assert workspace['source']==workspace['target'] and workspace['bind']['propagation']=='rshared'
    assert config['networks']['dependencies']['internal']
    assert config['services']['builder']['ports'][0]['host_ip']=='127.0.0.1'
