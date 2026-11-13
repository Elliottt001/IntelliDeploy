from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.types import (
    AppManifest,
    CheckResult,
    Requirement,
    ServiceSpec,
    ValidationReport,
)
from app.runtime.linux import (
    DeploymentFailed,
    TargetUnavailable,
    deploy_linux,
    preflight_linux_target,
    render_compose,
)


def manifest_fixture() -> AppManifest:
    return AppManifest(
        web_service="web",
        services=[
            ServiceSpec(
                name="web",
                image="registry.test/web@sha256:" + "a" * 64,
                port=3000,
                volumes={"data": "/data"},
                env_refs={"DATABASE_PASSWORD": "database-password"},
                depends_on=["db"],
                health_path="/health",
                memory_mb=512,
                cpu_millis=500,
            ),
            ServiceSpec(
                name="db",
                image="registry.test/postgres@sha256:" + "b" * 64,
                port=5432,
                volumes={"postgres": "/var/lib/postgresql/data"},
                memory_mb=1024,
                cpu_millis=1000,
            ),
        ],
    )


def target() -> dict:
    return {
        "id": "linux-test",
        "kind": "LINUX",
        "enabled": True,
        "health": "HEALTHY",
        "architecture": "amd64",
        "domain_suffix": "apps.test.invalid",
        "secret_ref": "ssh-key-1",
        "capacity": {
            "ssh_host": "192.0.2.10",
            "ssh_user": "deploy",
            "deployment_root": "/srv/intellideploy",
            "registry": "registry.test",
            "memory_mb": 8192,
            "cpu_millis": 8000,
            "storage_mb": 100000,
        },
    }


class Targets:
    def __init__(self, value=None):
        self.value = value

    def get(self, target_id):
        assert target_id == "linux-test"
        return self.value


class Secrets:
    def resolve(self, reference):
        assert reference == "ssh-key-1"
        return "/controlled/keys/linux-test"


class SSH:
    def __init__(self, *, fail_action: str | None = None):
        self.fail_action = fail_action
        self.calls: list[tuple[list[str], dict]] = []

    async def run(self, argv, stdin, timeout):
        payload = json.loads(stdin)
        self.calls.append((argv, payload))
        if payload["action"] == self.fail_action:
            raise RuntimeError(f"{self.fail_action} failed")
        if payload["action"] == "prepare":
            return {
                "candidate_url": "https://candidate-instance.apps.test.invalid",
                "previous_version": "old-version",
            }
        if payload["action"] == "activate":
            return {"url": "https://instance.apps.test.invalid"}
        return {"ok": True}


def passing_report() -> ValidationReport:
    return ValidationReport(
        checks=[CheckResult(id="save", status="PASS", evidence="evidence/save")],
        required_ids=["save"],
        requirement_revision=1,
        attempt_id="attempt-1",
        manifest_hash="manifest-1",
    )


def requirement() -> Requirement:
    return Requirement(prompt="保存笔记", acceptance=[])


def test_compose_namespaces_data_by_instance_and_keeps_databases_private():
    one = render_compose(
        manifest_fixture(),
        "instance-a",
        {"database-password": "/controlled/secrets/database-password"},
    )
    two = render_compose(
        manifest_fixture(),
        "instance-b",
        {"database-password": "/controlled/secrets/database-password"},
    )

    assert one["volumes"] != two["volumes"]
    assert one["services"]["web"]["restart"] == "unless-stopped"
    assert one["services"]["web"]["ports"] == ["127.0.0.1::3000"]
    assert "ports" not in one["services"]["db"]
    assert one["services"]["web"]["environment"] == {
        "DATABASE_PASSWORD_FILE": "/run/secrets/database-password"
    }
    assert "/controlled/secrets/database-password" not in json.dumps(
        one["services"]["web"]
    )
    assert one["volumes"]["instance-a-data"]["name"] == "instance-a-data"
    assert two["volumes"]["instance-b-data"]["name"] == "instance-b-data"


@pytest.mark.asyncio
async def test_linux_deploy_uses_argv_and_json_stdin_without_interpolating_values():
    ssh = SSH()
    reports = []

    async def validate(url, requirement, checks, **kwargs):
        reports.append(url)
        return passing_report()

    result = await deploy_linux(
        "linux-test",
        "instance-1",
        "version-1",
        manifest_fixture(),
        "operation-1",
        requirement(),
        target_provider=Targets(target()),
        secret_resolver=Secrets(),
        ssh_executor=ssh,
        validator=validate,
        browser_checks=[],
        secret_files={"database-password": "/controlled/secrets/database-password"},
    )

    assert result.url == "https://instance.apps.test.invalid"
    assert reports == [
        "https://candidate-instance.apps.test.invalid",
        "https://instance.apps.test.invalid",
    ]
    assert [payload["action"] for _, payload in ssh.calls] == [
        "preflight",
        "prepare",
        "activate",
    ]
    argv = ssh.calls[0][0]
    assert argv[0] == 'ssh'
    assert 'BatchMode=yes' in argv and 'IdentitiesOnly=yes' in argv
    assert 'StrictHostKeyChecking=yes' in argv
    assert argv[argv.index('-i')+1] == '/controlled/keys/linux-test'
    assert 'deploy@192.0.2.10' in argv
    import shlex
    command=shlex.split(' '.join(argv[argv.index('python3'):]))
    assert len(command)==3 and command[:2]==['python3','-c']
    assert "192.0.2.10" not in command[2]
    assert "instance-1" not in command[2]
    payload_text = json.dumps(ssh.calls[1][1])
    assert "/controlled/keys/linux-test" not in payload_text
    assert "python3 -" not in payload_text


@pytest.mark.asyncio
async def test_prepare_failure_does_not_activate_or_replace_old_release():
    ssh = SSH(fail_action="prepare")

    with pytest.raises(DeploymentFailed, match="prepare failed"):
        await deploy_linux(
            "linux-test",
            "instance-1",
            "version-2",
            manifest_fixture(),
            "operation-2",
            requirement(),
            target_provider=Targets(target()),
            secret_resolver=Secrets(),
            ssh_executor=ssh,
            validator=lambda *args, **kwargs: passing_report(),
            browser_checks=[],
            secret_files={"database-password": "/controlled/secrets/database-password"},
        )

    assert [payload["action"] for _, payload in ssh.calls] == ["preflight", "prepare"]


@pytest.mark.asyncio
async def test_failed_candidate_validation_rolls_back_without_activation():
    ssh = SSH()
    failed = ValidationReport(
        checks=[CheckResult(id="save", status="FAIL", evidence="evidence/save")],
        required_ids=["save"],
    )

    async def validate(*args, **kwargs):
        return failed

    with pytest.raises(DeploymentFailed, match="validation"):
        await deploy_linux(
            "linux-test",
            "instance-1",
            "version-2",
            manifest_fixture(),
            "operation-3",
            requirement(),
            target_provider=Targets(target()),
            secret_resolver=Secrets(),
            ssh_executor=ssh,
            validator=validate,
            browser_checks=[],
            secret_files={"database-password": "/controlled/secrets/database-password"},
        )

    assert [payload["action"] for _, payload in ssh.calls] == [
        "preflight",
        "prepare",
        "rollback",
    ]


@pytest.mark.asyncio
async def test_missing_or_unhealthy_target_is_not_treated_as_deployment_failure():
    with pytest.raises(TargetUnavailable):
        await deploy_linux(
            "linux-test",
            "instance-1",
            "version-1",
            manifest_fixture(),
            "operation-4",
            requirement(),
            target_provider=Targets(None),
            secret_resolver=Secrets(),
            ssh_executor=SSH(),
            browser_checks=[],
        )

    unhealthy = target()
    unhealthy["health"] = "UNKNOWN"
    with pytest.raises(TargetUnavailable):
        await deploy_linux(
            "linux-test",
            "instance-1",
            "version-1",
            manifest_fixture(),
            "operation-5",
            requirement(),
            target_provider=Targets(unhealthy),
            secret_resolver=Secrets(),
            ssh_executor=SSH(),
            browser_checks=[],
        )


@pytest.mark.asyncio
async def test_instance_identifier_is_validated_before_remote_execution():
    ssh = SSH()
    with pytest.raises(ValueError, match="instance"):
        await deploy_linux(
            "linux-test",
            "../other-instance",
            "version-1",
            manifest_fixture(),
            "operation-6",
            requirement(),
            target_provider=Targets(target()),
            secret_resolver=Secrets(),
            ssh_executor=ssh,
            browser_checks=[],
        )
    assert ssh.calls == []


@pytest.mark.asyncio
async def test_target_preflight_checks_digest_images_without_creating_release():
    ssh = SSH()

    result = await preflight_linux_target(
        "linux-test",
        manifest_fixture(),
        target_provider=Targets(target()),
        secret_resolver=Secrets(),
        ssh_executor=ssh,
    )

    assert result == {"ok": True}
    assert len(ssh.calls) == 1
    payload = ssh.calls[0][1]
    assert payload["action"] == "preflight"
    assert payload["images"] == [
        "registry.test/web@sha256:" + "a" * 64,
        "registry.test/postgres@sha256:" + "b" * 64,
    ]
    assert "compose" not in payload


def test_registered_linux_user_can_contain_a_dot_without_allowing_shell_syntax():
    from app.runtime.linux import _validated_target
    value = target()
    value['capacity']['ssh_user'] = 'zhangruizhe.elliottt'
    assert _validated_target(value, manifest_fixture())['capacity']['ssh_user'] == 'zhangruizhe.elliottt'
    value['capacity']['ssh_user'] = 'user;command'
    with pytest.raises(TargetUnavailable, match='SSH user'):
        _validated_target(value, manifest_fixture())
