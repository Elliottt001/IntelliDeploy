from __future__ import annotations

import asyncio
import inspect
import json
import os
import re
import shlex
import subprocess
from pathlib import Path, PurePosixPath
from typing import Protocol

from app.core.types import AppManifest, DeploymentResult, Requirement, ValidationReport
from app.runtime.manifest import validate_release_manifest
from app.runtime.validation import validate_application


IDENTIFIER = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
HOST = re.compile(r"^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$")
USER = re.compile(r"^[a-z_][a-z0-9_.-]{0,63}$")
DOMAIN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$")


REMOTE_SCRIPT = r'''
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

payload = json.load(sys.stdin)
safe = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")

def run(argv, timeout=600):
    result = subprocess.run(argv, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout)[-8000:])
    return result.stdout.strip()

def child(root, *parts):
    root_path = pathlib.Path(root).resolve()
    value = root_path.joinpath(*parts).resolve()
    value.relative_to(root_path)
    return value

action = payload["action"]
root = payload["deployment_root"]
instance = payload.get("instance_id", "probe")
version = payload.get("version_id", "probe")
if not safe.fullmatch(instance) or not safe.fullmatch(version):
    raise RuntimeError("unsafe remote identifier")

if action == "preflight":
    run(["docker", "version", "--format", "{{.Server.Version}}"], 30)
    run(["docker", "compose", "version", "--short"], 30)
    if shutil.disk_usage(root).free < payload["required_disk_bytes"]:
        raise RuntimeError("insufficient disk capacity")
    for image in payload.get("images", []):
        run(["docker", "pull", image], 300)
    result = {"ok": True}
else:
    version_dir = child(root, "instances", instance, "versions", version)
    version_dir.mkdir(parents=True, exist_ok=True)
    compose_file = version_dir / "compose.json"
    project = f"intellideploy-{instance}-{version}"
    candidate_file = pathlib.Path(payload["caddy_config_dir"]) / f"{instance}-candidate.caddy"
    stable_file = pathlib.Path(payload["caddy_config_dir"]) / f"{instance}.caddy"
    backup_file = version_dir / "previous-caddy"
    current_link = child(root, "instances", instance, "current")

    def reload_caddy():
        binary = payload.get("caddy_binary", "caddy")
        run([binary, "validate", "--config", payload["caddy_main_config"]], 30)
        if payload.get("caddy_reload_mode", "systemd") == "admin":
            run([binary, "reload", "--config", payload["caddy_main_config"]], 30)
        else:
            run(["systemctl", "reload", "caddy"], 30)

    if action == "prepare":
        for reference, value in payload.get('secret_values', {}).items():
            if not re.fullmatch(r'[A-Za-z0-9_.-]{1,128}', reference):
                raise RuntimeError('unsafe secret reference')
            secret = child(root, 'instances', instance, 'secrets', reference)
            secret.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            descriptor = os.open(secret, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(descriptor, 'w') as output:
                output.write(value)
        compose_file.write_text(json.dumps(payload["compose"], sort_keys=True))
        compose_file.chmod(0o600)
        if stable_file.exists():
            backup_file.write_text(stable_file.read_text())
        run(["docker", "compose", "-p", project, "-f", str(compose_file), "pull"])
        run(["docker", "compose", "-p", project, "-f", str(compose_file), "up", "-d"])
        if payload.get('migrations'):
            run(['docker', 'compose', '-p', project, '-f', str(compose_file), 'run', '--rm', payload.get('migration_service',payload['web_service']), *payload['migrations']])
        mapping = run(["docker", "compose", "-p", project, "-f", str(compose_file),
                       "port", payload["web_service"], str(payload["web_port"])], 60)
        host_port = mapping.rsplit(":", 1)[-1]
        candidate_file.write_text(
            f"{payload['candidate_domain']} {{\n  reverse_proxy 127.0.0.1:{host_port}\n}}\n"
        )
        (version_dir / "release.json").write_text(
            json.dumps({"host_port": int(host_port)}, sort_keys=True)
        )
        reload_caddy()
        result = {"candidate_url": f"https://{payload['candidate_domain']}",
                  "previous_version": os.path.basename(os.path.realpath(current_link)) if current_link.exists() else None}
    elif action == "activate":
        release = json.loads((version_dir / "release.json").read_text())
        stable_file.write_text(
            f"{payload['stable_domain']} {{\n  reverse_proxy 127.0.0.1:{release['host_port']}\n}}\n"
        )
        temporary = current_link.with_name("current-new")
        if temporary.exists() or temporary.is_symlink():
            temporary.unlink()
        temporary.symlink_to(pathlib.Path("versions") / version_dir.name)
        os.replace(temporary, current_link)
        candidate_file.unlink(missing_ok=True)
        reload_caddy()
        result = {"url": f"https://{payload['stable_domain']}"}
    elif action == "rollback":
        if backup_file.exists():
            stable_file.write_text(backup_file.read_text())
        candidate_file.unlink(missing_ok=True)
        run(["docker", "compose", "-p", project, "-f", str(compose_file), "down"], 120)
        reload_caddy()
        result = {"ok": True}
    elif action == "start":
        if not compose_file.is_file():
            raise RuntimeError("release compose file is missing")
        run(["docker", "compose", "-p", project, "-f", str(compose_file), "up", "-d"], 300)
        result = {"ok": True}
    elif action == "stop":
        if compose_file.is_file():
            run(["docker", "compose", "-p", project, "-f", str(compose_file), "stop"], 120)
        result = {"ok": True}
    elif action == "delete":
        if compose_file.is_file():
            command = ["docker", "compose", "-p", project, "-f", str(compose_file), "down"]
            if payload.get("delete_data"):
                command.append("-v")
            run(command, 180)
        stable_file.unlink(missing_ok=True)
        candidate_file.unlink(missing_ok=True)
        if current_link.exists() or current_link.is_symlink():
            current_link.unlink()
        reload_caddy()
        result = {"ok": True}
    elif action == "observe":
        if not compose_file.is_file():
            state = "DELETED" if not current_link.exists() else "STOPPED"
        else:
            running = run(["docker", "compose", "-p", project, "-f", str(compose_file),
                           "ps", "--status", "running", "--services"], 60)
            state = "RUNNING" if running.strip() else "STOPPED"
        result = {"state": state, "compute_state": "RUNNING" if state == "RUNNING" else "STOPPED"}
    else:
        raise RuntimeError("unsupported runtime action")

print(json.dumps(result))
'''


class DeploymentFailed(RuntimeError):
    pass


class TargetUnavailable(RuntimeError):
    pass


class TargetProvider(Protocol):
    def get(self, target_id: str): ...


class SecretResolver(Protocol):
    def resolve(self, reference: str) -> str: ...


class SSHExecutor(Protocol):
    async def run(self, argv: list[str], stdin: str, timeout: int) -> dict: ...


class DatabaseTargetProvider:
    def get(self, target_id: str):
        from app.database import SessionLocal
        from app.runtime.models import DeploymentTarget

        with SessionLocal() as session:
            target = session.get(DeploymentTarget, target_id)
            if target is None:
                return None
            return {
                "id": target.id,
                "kind": target.kind,
                "enabled": target.enabled,
                "health": target.health,
                "architecture": target.architecture,
                "capacity": target.capacity,
                "domain_suffix": target.domain_suffix,
                "secret_ref": target.secret_ref,
            }


class EnvironmentSecretResolver:
    def resolve(self, reference: str) -> str:
        from app.config import settings
        if reference in settings.DEPLOYMENT_SECRET_FILES:
            path=settings.DEPLOYMENT_SECRET_FILES[reference]
            if not Path(path).is_file() or not Path(path).is_absolute(): raise TargetUnavailable('SSH credential file is not configured')
            return path
        paths = json.loads(os.environ.get("DEPLOYMENT_SECRET_PATHS", "{}"))
        path = paths.get(reference)
        if not isinstance(path, str) or not path.startswith("/"):
            raise TargetUnavailable("deployment SSH key reference is not configured")
        return path


class SubprocessSSHExecutor:
    async def run(self, argv: list[str], stdin: str, timeout: int) -> dict:
        def execute():
            return subprocess.run(
                argv,
                input=stdin,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout,
                check=False,
            )

        result = await asyncio.to_thread(execute)
        if result.returncode:
            raise RuntimeError((result.stderr or result.stdout)[-8_000:])
        lines = [line for line in result.stdout.splitlines() if line.strip()]
        if not lines:
            raise RuntimeError("remote executor returned no result")
        return json.loads(lines[-1])


class LinuxInstanceAdapter:
    def __init__(self, *, target_provider=None, secret_resolver=None, ssh_executor=None):
        self.target_provider = target_provider or DatabaseTargetProvider()
        self.secret_resolver = secret_resolver or EnvironmentSecretResolver()
        self.ssh_executor = ssh_executor or SubprocessSSHExecutor()

    def _context(self, instance):
        target = _target_dict(self.target_provider.get(instance.target_id))
        if (
            target.get("kind") != "LINUX"
            or not target.get("enabled")
            or target.get("health") != "HEALTHY"
        ):
            raise TargetUnavailable("Linux target is unavailable")
        capacity = target.get("capacity") or {}
        for key in ("ssh_host", "ssh_user", "deployment_root"):
            if not capacity.get(key):
                raise TargetUnavailable(f"Linux target {key} is missing")
        secret_ref = target.get("secret_ref")
        if not secret_ref:
            raise TargetUnavailable("Linux target SSH key reference is missing")
        return target, self.secret_resolver.resolve(secret_ref)

    async def _run(self, instance, action: str, **extra):
        target, key_path = self._context(instance)
        capacity = target["capacity"]
        payload = {
            "action": action,
            "deployment_root": capacity["deployment_root"],
            "instance_id": instance.id,
            "version_id": instance.version_id,
            "caddy_config_dir": capacity.get("caddy_config_dir", "/etc/caddy/conf.d"),
            "caddy_main_config": capacity.get("caddy_main_config", "/etc/caddy/Caddyfile"),
        "caddy_reload_mode": capacity.get("caddy_reload_mode", "systemd"),
        "caddy_binary": capacity.get("caddy_binary", "caddy"),
            **extra,
        }
        return await self.ssh_executor.run(
            _ssh_argv(target, key_path), json.dumps(payload), 300
        )

    async def start(self, instance):
        await self._run(instance, "start")

    async def stop(self, instance):
        await self._run(instance, "stop")

    async def delete(self, instance, *, delete_data: bool):
        await self._run(instance, "delete", delete_data=delete_data)

    async def observe(self, instance):
        try:
            value = await self._run(instance, "observe")
        except Exception as exc:
            return {
                "state": "UNKNOWN",
                "compute_state": "UNKNOWN",
                "resource_spec": instance.resource_spec,
                "storage_mb": (instance.resource_spec or {}).get("storage_mb", 0),
                "evidence": f"Linux observation failed: {type(exc).__name__}",
            }
        return {
            **value,
            "resource_spec": instance.resource_spec,
            "storage_mb": (instance.resource_spec or {}).get("storage_mb", 0),
            "evidence": "Linux Compose state observed",
        }


def _safe_identifier(value: str, kind: str) -> str:
    if not IDENTIFIER.fullmatch(value):
        raise ValueError(f"{kind} identifier is invalid")
    return value


def _safe_secret_name(value: str) -> str:
    return _safe_identifier(value, "secret")


def render_compose(
    manifest: AppManifest,
    instance_id: str,
    secrets: dict[str, str],
) -> dict:
    validate_release_manifest(manifest)
    _safe_identifier(instance_id, "instance")
    services: dict[str, dict] = {}
    volumes: dict[str, dict] = {}
    compose_secrets: dict[str, dict] = {}
    for service in manifest.services:
        _safe_identifier(service.name, "service")
        rendered: dict = {
            "image": service.image,
            "restart": "unless-stopped",
            "networks": ["app"],
            "mem_limit": f"{service.memory_mb}m",
            "cpus": service.cpu_millis / 1000,
        }
        if service.depends_on:
            rendered["depends_on"] = service.depends_on
        if service.command:
            rendered['command'] = service.command
        if service.name == manifest.web_service:
            if service.port is None:
                raise ValueError("web service requires a port")
            rendered["ports"] = [f"127.0.0.1::{service.port}"]
        elif service.port is not None:
            rendered["expose"] = [str(service.port)]
        if service.health_path:
            rendered["healthcheck"] = {
                "test": [
                    "CMD-SHELL",
                    f"wget -qO- http://127.0.0.1:{service.port}{service.health_path} || exit 1",
                ],
                "interval": "10s",
                "timeout": "5s",
                "retries": 12,
            }
        service_volumes = []
        for logical_name, container_path in service.volumes.items():
            name = _safe_identifier(logical_name, "volume")
            volume_name = f"{instance_id}-{name}"
            volumes[volume_name] = {"name": volume_name}
            service_volumes.append(f"{volume_name}:{container_path}")
        if service_volumes:
            rendered["volumes"] = service_volumes
        environment: dict[str, str] = dict(service.env_values)
        service_secrets: list[str] = []
        for environment_name, reference in service.env_refs.items():
            if not re.fullmatch(r"[A-Z][A-Z0-9_]{0,127}", environment_name):
                raise ValueError("environment variable name is invalid")
            name = _safe_secret_name(reference)
            path = secrets.get(reference)
            if not isinstance(path, str) or not PurePosixPath(path).is_absolute():
                raise ValueError("secret file reference is missing")
            compose_secrets[name] = {"file": path}
            service_secrets.append(name)
            environment[f"{environment_name}_FILE"] = f"/run/secrets/{name}"
        if environment:
            rendered["environment"] = environment
            rendered["secrets"] = service_secrets
        services[service.name] = rendered
    result = {
        "name": f"intellideploy-{instance_id}",
        "services": services,
        "networks": {"app": {"name": f"intellideploy-{instance_id}"}},
        "volumes": volumes,
    }
    if compose_secrets:
        result["secrets"] = compose_secrets
    return result


def _target_dict(value) -> dict:
    if isinstance(value, dict):
        return value
    return {
        name: getattr(value, name)
        for name in (
            "id",
            "kind",
            "enabled",
            "health",
            "architecture",
            "capacity",
            "domain_suffix",
            "secret_ref",
        )
    }


def _validated_target(value, manifest: AppManifest) -> dict:
    if value is None:
        raise TargetUnavailable("Linux deployment target is not configured")
    target = _target_dict(value)
    if target.get("kind") != "LINUX" or not target.get("enabled") or target.get("health") != "HEALTHY":
        raise TargetUnavailable("Linux deployment target is unavailable")
    capacity = target.get("capacity") or {}
    host = capacity.get("ssh_host")
    user = capacity.get("ssh_user")
    root = capacity.get("deployment_root")
    domain = target.get("domain_suffix")
    if not isinstance(host, str) or not HOST.fullmatch(host):
        raise TargetUnavailable("Linux target SSH host is invalid")
    if not isinstance(user, str) or not USER.fullmatch(user):
        raise TargetUnavailable("Linux target SSH user is invalid")
    if not isinstance(root, str) or not PurePosixPath(root).is_absolute() or ".." in PurePosixPath(root).parts:
        raise TargetUnavailable("Linux target deployment root is invalid")
    if not isinstance(domain, str) or not DOMAIN.fullmatch(domain):
        raise TargetUnavailable("Linux target domain suffix is invalid")
    if capacity.get("caddy_reload_mode", "systemd") not in {"systemd", "admin"}:
        raise TargetUnavailable("Linux target Caddy reload mode is invalid")
    caddy_binary = capacity.get("caddy_binary", "caddy")
    if not isinstance(caddy_binary, str) or (caddy_binary != "caddy" and (not PurePosixPath(caddy_binary).is_absolute() or ".." in PurePosixPath(caddy_binary).parts)):
        raise TargetUnavailable("Linux target Caddy binary is invalid")
    required_memory = sum(service.memory_mb for service in manifest.services)
    required_cpu = sum(service.cpu_millis for service in manifest.services)
    required_storage = sum(sum(service.storage_mb.values()) for service in manifest.services)
    if required_memory > int(capacity.get("memory_mb", 0)) or required_cpu > int(capacity.get("cpu_millis", 0)):
        raise TargetUnavailable("Linux target compute capacity is insufficient")
    if required_storage > int(capacity.get("storage_mb", 0)):
        raise TargetUnavailable("Linux target storage capacity is insufficient")
    return target


async def _call_validator(validator, *args, **kwargs) -> ValidationReport:
    value = validator(*args, **kwargs)
    if inspect.isawaitable(value):
        value = await value
    return ValidationReport.model_validate(value)


def _ssh_argv(target: dict, key_path: str) -> list[str]:
    capacity = target["capacity"]
    from app.config import settings
    known_hosts=[]
    if settings.DEPLOYMENT_KNOWN_HOSTS_FILE:
        path=Path(settings.DEPLOYMENT_KNOWN_HOSTS_FILE)
        if not path.is_absolute() or not path.is_file(): raise TargetUnavailable('Registered known-hosts file is unavailable')
        known_hosts=['-o','UserKnownHostsFile='+str(path)]
    return [
        "ssh",
        '-p',str(capacity.get('ssh_port',22)),
        '-o','StrictHostKeyChecking=yes',
        *known_hosts,
        "-o",
        "BatchMode=yes",
        "-o",
        "IdentitiesOnly=yes",
        "-i",
        key_path,
        f"{capacity['ssh_user']}@{capacity['ssh_host']}",
        "python3",
        "-c",
        shlex.quote(REMOTE_SCRIPT),
    ]


async def preflight_linux_target(
    target_id: str,
    manifest: AppManifest,
    *,
    target_provider: TargetProvider | None = None,
    secret_resolver: SecretResolver | None = None,
    ssh_executor: SSHExecutor | None = None,
) -> dict:
    target = _validated_target(
        (target_provider or DatabaseTargetProvider()).get(target_id), manifest
    )
    secret_ref = target.get("secret_ref")
    if not isinstance(secret_ref, str) or not secret_ref:
        raise TargetUnavailable("Linux target SSH key reference is missing")
    key_path = (secret_resolver or EnvironmentSecretResolver()).resolve(secret_ref)
    payload = {
        "action": "preflight",
        "deployment_root": target["capacity"]["deployment_root"],
        "instance_id": "probe",
        "version_id": "probe",
        "required_disk_bytes": max(
            1_073_741_824,
            sum(sum(item.storage_mb.values()) for item in manifest.services) * 1024 * 1024,
        ),
        "images": [service.image for service in manifest.services],
    }
    try:
        return await (ssh_executor or SubprocessSSHExecutor()).run(
            _ssh_argv(target, key_path), json.dumps(payload), 600
        )
    except Exception as exc:
        raise DeploymentFailed(f"Linux preflight failed: {exc}") from exc


async def deploy_linux(
    target_id: str,
    instance_id: str,
    version_id: str,
    manifest: AppManifest,
    operation_id: str,
    requirement: Requirement,
    *,
    target_provider: TargetProvider | None = None,
    secret_resolver: SecretResolver | None = None,
    ssh_executor: SSHExecutor | None = None,
    validator=validate_application,
    browser_checks: list | None = None,
    secret_files: dict[str, str] | None = None,
    secret_values: dict[str,str] | None = None,
    gateway_image: str | None = None,
) -> DeploymentResult:
    _safe_identifier(instance_id, "instance")
    _safe_identifier(version_id, "version")
    _safe_identifier(operation_id, "operation")
    target = _validated_target(
        (target_provider or DatabaseTargetProvider()).get(target_id), manifest
    )
    secret_ref = target.get("secret_ref")
    if not isinstance(secret_ref, str) or not secret_ref:
        raise TargetUnavailable("Linux target SSH key reference is missing")
    key_path = (secret_resolver or EnvironmentSecretResolver()).resolve(secret_ref)
    capacity = target["capacity"]
    secret_files=dict(secret_files or {})
    for reference in (secret_values or {}):
        _safe_secret_name(reference)
        secret_files[reference]=str(PurePosixPath(capacity['deployment_root'])/'instances'/instance_id/'secrets'/reference)
    compose = render_compose(manifest, instance_id, secret_files)
    for service in manifest.services:
        for name,reference in service.env_refs.items():
            if reference in (secret_values or {}):compose['services'][service.name].setdefault('environment',{})[name]=secret_values[reference]
    web = next(item for item in manifest.services if item.name == manifest.web_service)
    stable_domain = f"{instance_id}.{target['domain_suffix']}"
    candidate_domain = f"candidate-{operation_id}.{target['domain_suffix']}"
    web_name=manifest.web_service;web_port=web.port
    if gateway_image:
        from app.runtime.manifest import digest_pinned
        if not digest_pinned(gateway_image):raise ValueError('gateway image must be digest pinned')
        environment={name:secret_values[reference] for name,reference in web.env_refs.items() if name in {'PLATFORM_INSTANCE_ID','PLATFORM_INSTANCE_TOKEN','PLATFORM_CAPABILITY_URL'}}
        environment.update({'RUNTIME_ALLOWED_HOSTS':stable_domain+','+candidate_domain,'RUNTIME_UPSTREAM_URL':f'http://{web.name}:{web.port}'})
        compose['services'][web.name].pop('ports',None)
        compose['services']['platform-gateway']={'image':gateway_image,'command':['python','-m','app.runner.gateway'],'environment':environment,'networks':['app'],'ports':['127.0.0.1::8080'],'depends_on':[web.name],'read_only':True,'cap_drop':['ALL'],'security_opt':['no-new-privileges:true'],'mem_limit':'256m','cpus':0.5,'restart':'unless-stopped'}
        web_name='platform-gateway';web_port=8080
    caddy_dir = capacity.get("caddy_config_dir", "/etc/caddy/conf.d")
    caddy_main = capacity.get("caddy_main_config", "/etc/caddy/Caddyfile")
    common = {
        "deployment_root": capacity["deployment_root"],
        "instance_id": instance_id,
        "version_id": version_id,
        "operation_id": operation_id,
        "compose": compose,
        "web_service": web_name,
        "web_port": web_port,
        "migration_service":manifest.web_service,
        "stable_domain": stable_domain,
        "candidate_domain": candidate_domain,
        "caddy_config_dir": caddy_dir,
        "caddy_main_config": caddy_main,
        "caddy_reload_mode": capacity.get("caddy_reload_mode", "systemd"),
        "caddy_binary": capacity.get("caddy_binary", "caddy"),
        "secret_values":secret_values or {},
        "migrations":manifest.migration,
    }
    argv = _ssh_argv(target, key_path)
    executor = ssh_executor or SubprocessSSHExecutor()

    async def remote(action: str, **extra):
        payload = {**common, "action": action, **extra}
        try:
            return await executor.run(argv, json.dumps(payload), 600)
        except Exception as exc:
            raise DeploymentFailed(f"Linux {action} failed: {exc}") from exc

    await remote(
        "preflight",
        required_disk_bytes=max(
            1_073_741_824,
            sum(sum(item.storage_mb.values()) for item in manifest.services) * 1024 * 1024,
        ),
        images=[service.image for service in manifest.services],
    )
    prepared = await remote("prepare")
    candidate_url = prepared.get("candidate_url")
    if not isinstance(candidate_url, str):
        raise DeploymentFailed("Linux prepare returned no candidate URL")
    candidate_report = await _call_validator(
        validator,
        candidate_url,
        requirement,
        browser_checks or [],
        attempt_id=operation_id,
    )
    if not candidate_report.passed:
        await remote("rollback")
        raise DeploymentFailed("Linux candidate validation failed")
    activated = await remote("activate")
    url = activated.get("url")
    if not isinstance(url, str):
        await remote("rollback")
        raise DeploymentFailed("Linux activation returned no URL")
    report = await _call_validator(
        validator,
        url,
        requirement,
        browser_checks or [],
        attempt_id=operation_id,
    )
    if not report.passed:
        await remote("rollback")
        raise DeploymentFailed("Linux release validation failed")
    return DeploymentResult(
        operation_id=operation_id,
        instance_id=instance_id,
        url=url,
        report=report,
    )
