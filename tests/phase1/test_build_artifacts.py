from __future__ import annotations

import json
import os
import zipfile
from pathlib import Path

import pytest

from app.core.types import (
    AppManifest,
    BuildSpec,
    CheckResult,
    ServiceSpec,
    ValidationReport,
)
from app.runtime.build import BuildFailed, build_release, snapshot_release


class FakeBuilder:
    def __init__(self, *, fail: bool = False):
        self.fail = fail
        self.calls: list[list[str]] = []
        self.resolves: list[str] = []

    async def build(self, argv: list[str]) -> None:
        self.calls.append(argv)
        if self.fail:
            raise RuntimeError("registry push failed")
        metadata_path = Path(argv[argv.index("--metadata-file") + 1])
        service = next(value for value in argv if value.startswith("type=image,name="))
        image_name = service.split("name=", 1)[1].split(",", 1)[0]
        digest = "a" * 64 if image_name.endswith("/web:build-once") else "b" * 64
        metadata_path.write_text(
            json.dumps({"containerimage.digest": f"sha256:{digest}"})
        )

    async def resolve(self, image: str) -> str:
        self.resolves.append(image)
        return "sha256:" + "c" * 64


@pytest.fixture
def sample_workspace(tmp_path):
    (tmp_path / "web").mkdir()
    (tmp_path / "web" / "Dockerfile").write_text("FROM scratch\n")
    (tmp_path / "web" / "app.py").write_text("print('web')\n")
    (tmp_path / "worker").mkdir()
    (tmp_path / "worker" / "Dockerfile").write_text("FROM scratch\n")
    (tmp_path / "worker" / "worker.py").write_text("print('worker')\n")
    return tmp_path


def manifest() -> AppManifest:
    return AppManifest(
        web_service="web",
        services=[
            ServiceSpec(name="web", image="web:candidate", depends_on=["worker"]),
            ServiceSpec(name="worker", image="worker:candidate"),
            ServiceSpec(name="redis", image="redis:7.4"),
        ],
        builds=[
            BuildSpec(service="web", context="web", dockerfile="web/Dockerfile"),
            BuildSpec(
                service="worker", context="worker", dockerfile="worker/Dockerfile"
            ),
        ],
    )


def report() -> ValidationReport:
    return ValidationReport(
        checks=[CheckResult(id="save", status="PASS", evidence="evidence/save")],
        required_ids=["save"],
        requirement_revision=1,
        attempt_id="attempt-1",
        manifest_hash="candidate-hash",
    )


def test_manifest_rejects_dependency_cycle():
    with pytest.raises(ValueError):
        AppManifest(
            web_service="web",
            services=[
                ServiceSpec(name="web", image="web:build", depends_on=["api"]),
                ServiceSpec(name="api", image="api:build", depends_on=["web"]),
            ],
        )


@pytest.mark.asyncio
async def test_build_release_pins_all_images_and_uses_buildkit_argv(sample_workspace):
    builder = FakeBuilder()

    result = await build_release(
        sample_workspace,
        manifest(),
        "build-once",
        build_executor=builder,
        registry="registry.test/apps",
    )

    assert len(builder.calls) == 2
    assert builder.resolves == ["redis:7.4"]
    assert all("@sha256:" in service.image for service in result.services)
    assert result.services[0].image == "registry.test/apps/web@sha256:" + "a" * 64
    assert result.services[1].image == "registry.test/apps/worker@sha256:" + "b" * 64
    assert result.services[2].image == "redis:7.4@sha256:" + "c" * 64
    command = builder.calls[0]
    assert command[:3] == ["buildctl", "build", "--frontend"]
    assert "/var/run/docker.sock" not in " ".join(command)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("context", "dockerfile"),
    [("../outside", "../outside/Dockerfile"), ("web", "../Dockerfile")],
)
async def test_build_release_rejects_context_or_dockerfile_escape(
    sample_workspace, context, dockerfile
):
    value = manifest()
    value.builds[0] = BuildSpec(
        service="web", context=context, dockerfile=dockerfile
    )

    with pytest.raises(ValueError, match="workspace|context"):
        await build_release(
            sample_workspace,
            value,
            "escape",
            build_executor=FakeBuilder(),
            registry="registry.test/apps",
        )


@pytest.mark.asyncio
async def test_repeated_operation_returns_same_digests_without_rebuilding(sample_workspace):
    builder = FakeBuilder()

    first = await build_release(
        sample_workspace,
        manifest(),
        "same-operation",
        build_executor=builder,
        registry="registry.test/apps",
    )
    second = await build_release(
        sample_workspace,
        manifest(),
        "same-operation",
        build_executor=builder,
        registry="registry.test/apps",
    )

    assert second == first
    assert len(builder.calls) == 2
    changed = manifest()
    changed.services[0].memory_mb = 1024
    with pytest.raises(ValueError, match="different build request"):
        await build_release(
            sample_workspace,
            changed,
            "same-operation",
            build_executor=builder,
            registry="registry.test/apps",
        )


@pytest.mark.asyncio
async def test_failed_push_does_not_create_completed_release(sample_workspace):
    with pytest.raises(BuildFailed, match="registry push failed"):
        await build_release(
            sample_workspace,
            manifest(),
            "failed-build",
            build_executor=FakeBuilder(fail=True),
            registry="registry.test/apps",
        )

    operations = sample_workspace / ".intellideploy" / "build-operations"
    assert not operations.exists() or not list(operations.glob("*.json"))


@pytest.mark.asyncio
async def test_build_operation_id_cannot_escape_metadata_or_image_tag(sample_workspace):
    with pytest.raises(ValueError, match="operation ID"):
        await build_release(
            sample_workspace,
            manifest(),
            "../escape",
            build_executor=FakeBuilder(),
            registry="registry.test/apps",
        )


def test_snapshot_excludes_secrets_caches_and_runtime_data(sample_workspace):
    (sample_workspace / ".git").mkdir()
    (sample_workspace / ".git" / "config").write_text("private")
    (sample_workspace / "node_modules").mkdir()
    (sample_workspace / "node_modules" / "cache.js").write_text("cache")
    (sample_workspace / ".env").write_text("TOKEN=do-not-copy")
    (sample_workspace / "server.key").write_text("private-key")
    (sample_workspace / "uploads").mkdir()
    (sample_workspace / "uploads" / "user.txt").write_text("user-data")
    (sample_workspace / "data" / "runtime").mkdir(parents=True)
    (sample_workspace / "data" / "runtime" / "app.db").write_text("production-data")
    outside = sample_workspace.parent / "outside-secret.txt"
    outside.write_text("external-secret")
    (sample_workspace / "linked-secret.txt").symlink_to(outside)
    (sample_workspace / "package-lock.json").write_text('{"lockfileVersion": 3}')
    source = {
        "repositories": [
            {"url": "https://github.com/example/notes", "commit": "d" * 40}
        ]
    }
    (sample_workspace / ".intellideploy").mkdir()
    (sample_workspace / ".intellideploy" / "source.json").write_text(json.dumps(source))

    archive_path = snapshot_release(sample_workspace, manifest(), report())

    assert Path(archive_path).is_file()
    with zipfile.ZipFile(archive_path) as archive:
        names = set(archive.namelist())
        assert "source/web/app.py" in names
        assert "source/package-lock.json" in names
        assert "release-manifest.json" in names
        assert "validation-report.json" in names
        assert "source-metadata.json" in names
        assert not any(".git" in name or "node_modules" in name for name in names)
        assert not any(name.endswith(".env") or name.endswith("server.key") for name in names)
        assert not any("uploads" in name for name in names)
        assert not any("data/runtime" in name for name in names)
        assert "source/linked-secret.txt" not in names
        metadata = json.loads(archive.read("source-metadata.json"))
        assert metadata["repositories"] == source["repositories"]
        assert metadata["files"]["web/app.py"]


@pytest.mark.docker
@pytest.mark.skipif(
    not os.environ.get("TEST_BUILD_REGISTRY"),
    reason="dedicated builder and test registry are not configured",
)
@pytest.mark.asyncio
async def test_release_contains_real_digest_on_dedicated_builder(sample_workspace):
    result = await build_release(
        sample_workspace,
        manifest(),
        "real-build",
        registry=os.environ["TEST_BUILD_REGISTRY"],
    )
    assert all("@sha256:" in service.image for service in result.services)
