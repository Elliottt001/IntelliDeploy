from pathlib import Path
from io import BytesIO
import zipfile
import httpx
import pytest


def bundle(name="app.py", content='print("safe")'):
    output = BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr(name, content)
    return output.getvalue()


@pytest.mark.asyncio
async def test_runner_auth_fencing_workspace_and_durable_effect_replay(tmp_path):
    from app.runner.service import RunnerService, create_app

    class Commands:
        def run(self, workspace, argv, timeout, operation_id):
            file = Path(workspace) / "effects.txt"
            file.write_text((file.read_text() if file.exists() else "") + "executed\n")
            return {"ok": True, "content": "done", "duration_ms": 1}

    service = RunnerService(tmp_path, command_executor=Commands())
    app = create_app(service, "test-rpc-token")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="https://runner.test"
    ) as client:
        job = "12345678-1234-1234-1234-123456789abc"
        path = f"/v1/jobs/{job}"
        assert (
            await client.post(path + "/workspace", content=bundle())
        ).status_code == 401
        headers = {"Authorization": "Bearer test-rpc-token", "X-Lease-Generation": "1"}
        assert (
            await client.post(path + "/workspace", content=bundle(), headers=headers)
        ).status_code == 200
        call = {
            "id": "command-1",
            "name": "run_command",
            "arguments": {"argv": ["test-command"]},
        }
        one = await client.post(path + "/tools", json={"call": call}, headers=headers)
        two = await client.post(path + "/tools", json={"call": call}, headers=headers)
        assert one.status_code == two.status_code == 200 and one.json() == two.json()
        assert (tmp_path / job / "source/effects.txt").read_text() == "executed\n"
        restarted = create_app(
            RunnerService(tmp_path, command_executor=Commands()), "test-rpc-token"
        )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=restarted), base_url="https://runner.test"
        ) as second:
            assert (
                await second.post(path + "/tools", json={"call": call}, headers=headers)
            ).json() == one.json()
            new = {**headers, "X-Lease-Generation": "2"}
            assert (
                await second.get(path + "/tools/command-1", headers=new)
            ).status_code == 200
            old = await second.post(
                path + "/tools",
                json={
                    "call": {
                        "id": "old",
                        "name": "write_file",
                        "arguments": {"path": "app.py", "content": "unsafe"},
                    }
                },
                headers=headers,
            )
            assert old.status_code == 409
            assert (tmp_path / job / "source/app.py").read_text() == 'print("safe")'


@pytest.mark.asyncio
async def test_runner_rejects_archive_escape_and_changed_replay(tmp_path):
    from app.runner.service import RunnerService, create_app

    app = create_app(RunnerService(tmp_path), "test-rpc-token")
    headers = {"Authorization": "Bearer test-rpc-token", "X-Lease-Generation": "1"}
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="https://runner.test"
    ) as client:
        path = "/v1/jobs/12345678-1234-1234-1234-123456789abc"
        assert (
            await client.post(
                path + "/workspace",
                content=bundle("../escape", "unsafe"),
                headers=headers,
            )
        ).status_code == 422
        assert not (tmp_path / "escape").exists()
        await client.post(path + "/workspace", content=bundle(), headers=headers)
        call = {
            "id": "write",
            "name": "write_file",
            "arguments": {"path": "app.py", "content": "one"},
        }
        assert (
            await client.post(path + "/tools", json={"call": call}, headers=headers)
        ).status_code == 200
        call["arguments"]["content"] = "two"
        assert (
            await client.post(path + "/tools", json={"call": call}, headers=headers)
        ).status_code == 409


def test_runner_configuration_requires_https_and_mutual_tls(monkeypatch):
    from app.runner.client import RunnerClient, RunnerUnavailable
    from app.config import settings

    monkeypatch.setattr(settings, "RUNNER_URL", "http://runner.test")
    with pytest.raises(RunnerUnavailable):
        RunnerClient.from_settings()


@pytest.mark.asyncio
async def test_runner_client_preserves_repairable_build_failure_code():
    from app.core.types import AppManifest, ServiceSpec
    from app.runner.client import RunnerBuildFailed, RunnerClient

    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            422,
            json={
                "detail": {
                    "code": "BUILD_FAILED",
                    "message": "candidate build failed",
                }
            },
        )
    )
    client = httpx.AsyncClient(
        transport=transport,
        base_url="https://runner.test",
    )
    runner = RunnerClient(client)
    manifest = AppManifest(
        web_service="web",
        services=[ServiceSpec(name="web", image="build-locally", port=3000)],
    )

    with pytest.raises(RunnerBuildFailed, match="candidate build failed"):
        await runner.build("job", "attempt", manifest, 1)

    await client.aclose()


@pytest.mark.asyncio
async def test_runner_service_returns_sanitized_build_failure_code(
    tmp_path, monkeypatch
):
    from app.runner.service import RunnerService, create_app

    class FailingBuilder:
        async def build(self, argv):
            del argv
            raise RuntimeError("private build output")

        async def resolve(self, image):
            del image
            raise AssertionError("resolve is not used for a local build")

    archive = BytesIO()
    with zipfile.ZipFile(archive, "w") as output:
        output.writestr("Dockerfile", "FROM scratch\n")
        output.writestr("app.py", 'print("safe")')
    monkeypatch.setenv("BUILD_REGISTRY", "registry.test/apps")
    app = create_app(
        RunnerService(tmp_path, builder=FailingBuilder()),
        "test-rpc-token",
    )
    headers = {
        "Authorization": "Bearer test-rpc-token",
        "X-Lease-Generation": "1",
    }
    job = "12345678-1234-1234-1234-123456789abc"
    path = f"/v1/jobs/{job}"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="https://runner.test",
    ) as client:
        assert (
            await client.post(
                path + "/workspace",
                content=archive.getvalue(),
                headers=headers,
            )
        ).status_code == 200
        response = await client.post(
            path + "/build/attempt",
            headers=headers,
            json={
                "web_service": "web",
                "services": [
                    {"name": "web", "image": "build-locally", "port": 3000}
                ],
                "builds": [
                    {"service": "web", "context": ".", "dockerfile": "Dockerfile"}
                ],
            },
        )

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "code": "BUILD_FAILED",
        "message": "candidate build failed",
    }
    assert "private build output" not in response.text


@pytest.mark.asyncio
async def test_composition_policy_blocks_writes_and_survives_runner_restart(tmp_path):
    from app.agent.packaging import tree_digest
    from app.runner.service import RunnerService, create_app
    from app.runner.client import RunnerClient
    from app.core.types import ToolCall
    source = tmp_path / "input"
    (source / "components/records").mkdir(parents=True)
    (source / "components/search").mkdir()
    for role in ("records", "search"):
        (source / f"components/{role}/source.txt").write_text(role)
    policy = {"mode": "COMPOSITION", "writable_root": "app", "components": [
        {"role": role, "relative_path": f"components/{role}",
         "tree_digest": tree_digest(source / f"components/{role}")} for role in ("records", "search")]}
    job = "12345678-1234-1234-1234-123456789abc"
    app = create_app(RunnerService(tmp_path / "runner"), "test-rpc-token")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://runner.test",
                                headers={"Authorization": "Bearer test-rpc-token"}) as http:
        client = RunnerClient(http)
        await client.upload(job, source, 1, policy=policy)
        for path, expected in (("components/search/source.txt", 422), ("app/output.txt", 200)):
            response = await http.post(f"/v1/jobs/{job}/tools", headers={"X-Lease-Generation": "1"},
                json={"call": ToolCall(id="write-" + str(expected), name="write_file",
                                       arguments={"path": path, "content": "new"}).model_dump(mode="json")})
            assert response.status_code == expected
    restarted = create_app(RunnerService(tmp_path / "runner"), "test-rpc-token")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=restarted), base_url="https://runner.test") as http:
        response = await http.post(f"/v1/jobs/{job}/tools",
            headers={"X-Lease-Generation": "1", "Authorization": "Bearer test-rpc-token"},
            json={"call": {"id": "patch", "name": "apply_patch", "arguments": {
                "path": "components/search/source.txt", "old_text": "search", "new_text": "bad"}}})
        assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize('arguments', [
    {'argv':['npm','ci'],'timeout':300000}, {'argv':[]}, {'argv':['npm'],'timeout':0},
])
async def test_runner_validates_command_before_start_record(tmp_path, arguments):
    from app.runner.service import RunnerService, create_app
    class ForbiddenCommands:
        def run(self,*args):
            raise AssertionError('invalid command was executed')
    service = RunnerService(tmp_path, command_executor=ForbiddenCommands())
    job = '12345678-1234-1234-1234-123456789abc'
    headers = {'Authorization':'Bearer test-rpc-token','X-Lease-Generation':'1'}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service,'test-rpc-token'), raise_app_exceptions=False),base_url='https://runner.test') as client:
        path = '/v1/jobs/'+job
        await client.post(path+'/workspace',content=bundle(),headers=headers)
        response = await client.post(path+'/tools',json={'call':{'id':'invalid','name':'run_command','arguments':arguments}},headers=headers)
    assert response.status_code == 422
    assert response.json()['detail']['code'] == 'TOOL_ARGUMENTS_INVALID'
    assert not list((tmp_path/job/'operations').glob('*.json'))


@pytest.mark.asyncio
async def test_runner_missing_executor_has_no_started_effect(tmp_path):
    from app.runner.service import RunnerService, create_app
    job = '12345678-1234-1234-1234-123456789abc'
    headers = {'Authorization':'Bearer test-rpc-token','X-Lease-Generation':'1'}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(RunnerService(tmp_path),'test-rpc-token')),base_url='https://runner.test') as client:
        path = '/v1/jobs/'+job
        await client.post(path+'/workspace',content=bundle(),headers=headers)
        response = await client.post(path+'/tools',json={'call':{'id':'no-executor','name':'run_command','arguments':{'argv':['true']}}},headers=headers)
    assert response.status_code == 503
    assert not list((tmp_path/job/'operations').glob('*.json'))


@pytest.mark.asyncio
async def test_runner_rejects_escape_path_before_started_effect(tmp_path):
    from app.runner.service import RunnerService, create_app
    job = '12345678-1234-1234-1234-123456789abc'
    headers = {'Authorization':'Bearer test-rpc-token','X-Lease-Generation':'1'}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(RunnerService(tmp_path),'test-rpc-token'), raise_app_exceptions=False),base_url='https://runner.test') as client:
        path = '/v1/jobs/'+job
        await client.post(path+'/workspace',content=bundle(),headers=headers)
        response = await client.post(path+'/tools',json={'call':{'id':'escape','name':'write_file','arguments':{'path':'../escape','content':'unsafe'}}},headers=headers)
    assert response.status_code == 422
    assert not list((tmp_path/job/'operations').glob('*.json'))
    assert not (tmp_path/job/'escape').exists()
