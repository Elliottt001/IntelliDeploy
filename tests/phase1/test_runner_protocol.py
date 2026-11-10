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
