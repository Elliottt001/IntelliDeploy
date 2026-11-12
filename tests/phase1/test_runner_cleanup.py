import httpx
import pytest
from app.runner.service import RunnerService,create_app


@pytest.mark.asyncio
async def test_runner_workspace_cleanup_requires_auth_ownership_and_retains_a_fence(tmp_path):
    job='12345678-1234-1234-1234-123456789abc'
    service=RunnerService(tmp_path)
    root=service.job_root(job); (root/'source').mkdir(); (root/'source/app.py').write_text('owned source')
    app=create_app(service,'test-only-token')
    payload={'type':'WORKSPACE','reference':str(root),'job_id':job,'operation_id':'workspace:'+job}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='https://runner.test') as client:
        assert (await client.post('/v1/resources/remove',json=payload)).status_code==401
        headers={'Authorization':'Bearer test-only-token'}
        assert (await client.post('/v1/resources/remove',json={**payload,'operation_id':'foreign'},headers=headers)).status_code==409
        assert root.exists()
        assert (await client.post('/v1/resources/remove',json=payload,headers=headers)).status_code==200
        assert not root.exists()
        assert (await client.post('/v1/resources/inspect',json=payload,headers=headers)).json()=={'exists':False}
        assert (await client.get('/v1/jobs/'+job+'/workspace',headers={**headers,'X-Lease-Generation':'2'})).status_code==410


def test_missing_docker_socket_is_not_proof_that_an_image_was_deleted(tmp_path,monkeypatch):
    from app.runner.docker import ContainerCommands
    import os
    binary=tmp_path/'docker'
    binary.write_text('#!/bin/sh\necho "Cannot connect: docker.sock: No such file or directory" >&2\nexit 1\n')
    binary.chmod(0o755)
    monkeypatch.setenv('PATH',str(tmp_path)+':'+os.environ['PATH'])
    executor=ContainerCommands('registry.test/image@sha256:'+'a'*64)
    with pytest.raises(RuntimeError): executor.inspect_resource('CACHE_IMAGE','registry.test/image@sha256:'+'a'*64)
