from __future__ import annotations

import sys
import types
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services.image_builder import BuildMethod, ImageBuilder  # noqa: E402
from app.services import image_builder as image_builder_module  # noqa: E402


@pytest.mark.asyncio
async def test_docker_api_builder_falls_back_to_cli_on_sdk_connection_error(monkeypatch):
    docker_module = types.ModuleType("docker")
    docker_errors = types.ModuleType("docker.errors")

    class BuildError(Exception):
        pass

    class APIError(Exception):
        pass

    def from_env():
        raise RuntimeError("Not supported URL scheme http+docker")

    docker_module.from_env = from_env
    docker_errors.BuildError = BuildError
    docker_errors.APIError = APIError
    monkeypatch.setitem(sys.modules, "docker", docker_module)
    monkeypatch.setitem(sys.modules, "docker.errors", docker_errors)

    builder = ImageBuilder(method=BuildMethod.DOCKER_API)

    async def fake_cli(*args, **kwargs):
        return {"status": "success", "image": "fallback-cli:latest"}

    monkeypatch.setattr(builder, "_build_with_docker_cli", fake_cli)

    result = await builder.build_image(
        dockerfile_content="FROM scratch\n",
        context_files={},
        image_name="fallback-cli",
        image_tag="latest",
    )

    assert result == {"status": "success", "image": "fallback-cli:latest"}


@pytest.mark.asyncio
async def test_docker_cli_builder_times_out_hung_build(monkeypatch):
    import asyncio

    fake_processes = []

    class FakeProcess:
        def __init__(self):
            self.returncode = 1
            self.killed = False

        async def communicate(self):
            await asyncio.sleep(0.02)
            return b"still building", None

        def kill(self):
            self.killed = True

        async def wait(self):
            return self.returncode

    async def fake_subprocess_exec(*args, **kwargs):
        process = FakeProcess()
        fake_processes.append(process)
        return process

    monkeypatch.setattr(image_builder_module.settings, "DEPLOYMENT_TIMEOUT", 0.001)
    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_subprocess_exec)

    builder = ImageBuilder(method=BuildMethod.DOCKER_API)
    result = await builder._build_with_docker_cli(
        dockerfile_content="FROM scratch\n",
        context_files={},
        image_name="hung-build",
        image_tag="latest",
        build_args=None,
    )

    assert result["status"] == "failed"
    assert "timed out" in result["error"].lower()
    assert fake_processes[0].killed is True
