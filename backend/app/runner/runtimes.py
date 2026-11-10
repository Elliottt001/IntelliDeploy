import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
from uuid import UUID
import httpx

from app.core.types import AppManifest
from app.runtime.linux import render_compose


class ContainerRuntimes:
    def __init__(self, root, domain_suffix, *, proxy_image=None):
        if not re.fullmatch(r"[A-Za-z0-9.-]+", domain_suffix):
            raise ValueError("candidate domain must be registered")
        self.root = Path(root).resolve()
        self.domain = domain_suffix
        self.proxy_image = proxy_image
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)

    async def command(self, *argv, timeout=180):
        def run():
            result = subprocess.run(
                list(argv),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=timeout,
            )
            if result.returncode:
                raise RuntimeError("candidate container operation failed")
            return result.stdout

        return await asyncio.to_thread(run)

    def path(self, id):
        UUID(id)
        return self.root / id

    async def start(self, payload):
        id = payload["instance_id"]
        root = self.path(id)
        root.mkdir(exist_ok=True, mode=0o700)
        manifest = AppManifest.model_validate(payload["manifest"])
        digest = hashlib.sha256(
            json.dumps(payload, sort_keys=True).encode()
        ).hexdigest()
        state = root / "runtime.json"
        if state.exists():
            saved = json.loads(state.read_text())
            if saved["request_hash"] != digest:
                raise ValueError("runtime operation input changed")
            if saved["state"] == "RUNNING":
                return {
                    "id": id,
                    "base_url": saved["public_url"],
                    "data_namespace": saved["data_namespace"],
                }
            raise RuntimeError("runtime effect needs reconciliation")
        values = payload["values"]
        paths = {}
        for reference, value in values.items():
            if not re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", reference):
                raise ValueError("invalid secret reference")
            secret = root / "secrets" / reference
            secret.parent.mkdir(exist_ok=True, mode=0o700)
            fd = os.open(secret, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w") as file:
                file.write(value)
            paths[reference] = str(secret)
        compose = render_compose(manifest, id, paths)
        compose["networks"]["app"]["internal"] = True
        for service in manifest.services:
            environment = compose["services"][service.name].setdefault(
                "environment", {}
            )
            for name, reference in service.env_refs.items():
                environment[name] = values[reference]
        if self.proxy_image:
            from urllib.parse import urlsplit

            host = urlsplit(payload["platform_url"]).hostname
            compose["networks"]["outbound"] = {}
            from urllib.parse import urlsplit

            capability = urlsplit(payload["platform_url"])
            compose["services"]["dependency-proxy"] = {
                "image": self.proxy_image,
                "networks": ["app", "outbound"],
                "command": ["python", "-m", "app.runner.proxy"],
                "environment": {
                    "ALLOWED_HOSTS": ",".join(
                        [
                            host,
                            "registry.npmjs.org",
                            "pypi.org",
                            "files.pythonhosted.org",
                        ]
                    ),
                    "ALLOWED_PRIVATE_HOSTS": host,
                    "ALLOWED_PRIVATE_PORTS": str(capability.port or 443),
                },
                "read_only": True,
                "cap_drop": ["ALL"],
                "security_opt": ["no-new-privileges:true"],
                "mem_limit": "128m",
                "cpus": 0.25,
            }
            for service in manifest.services:
                compose["services"][service.name]["environment"].update(
                    {
                        "HTTP_PROXY": "http://dependency-proxy:3128",
                        "HTTPS_PROXY": "http://dependency-proxy:3128",
                        "NODE_USE_ENV_PROXY": "1",
                    }
                )
        config = root / "compose.json"
        config.write_text(json.dumps(compose))
        config.chmod(0o600)
        public_url = f"https://{id}.{self.domain}"
        saved = {
            "id": id,
            "instance_id": id,
            "instance_token": payload["instance_token"],
            "platform_url": payload["platform_url"],
            "public_url": public_url,
            "data_namespace": payload["data_namespace"],
            "state": "PREPARING",
            "request_hash": digest,
            "expires_at": time.time() + 900,
        }
        state.write_text(json.dumps(saved))
        state.chmod(0o600)
        try:
            dependencies = [
                service.name
                for service in manifest.services
                if service.name != manifest.web_service
            ]
            if dependencies:
                await self.command(
                    "docker", "compose", "-f", str(config), "up", "-d", *dependencies
                )
            if manifest.migration:
                await self.command(
                    "docker",
                    "compose",
                    "-f",
                    str(config),
                    "run",
                    "--rm",
                    manifest.web_service,
                    *manifest.migration,
                    timeout=600,
                )
            await self.command("docker", "compose", "-f", str(config), "up", "-d")
            container = (
                await self.command(
                    "docker",
                    "compose",
                    "-f",
                    str(config),
                    "ps",
                    "-q",
                    manifest.web_service,
                )
            ).strip()
            info = json.loads(await self.command("docker", "inspect", container))[0]
            web = next(
                service
                for service in manifest.services
                if service.name == manifest.web_service
            )
            port = info["NetworkSettings"]["Ports"][str(web.port) + "/tcp"][0][
                "HostPort"
            ]
            upstream = f"http://127.0.0.1:{port}"
            health = web.health_path or "/api/health"
            if not health.startswith("/") or health.startswith("//"):
                raise ValueError("health path must be relative")
            async with httpx.AsyncClient(timeout=5) as client:
                for _ in range(60):
                    try:
                        response = await client.get(upstream + health)
                        if response.status_code < 400:
                            break
                    except httpx.RequestError:
                        pass
                    await asyncio.sleep(2)
                else:
                    raise RuntimeError("candidate did not become healthy")
            saved.update(state="RUNNING", upstream_url=upstream)
            state.write_text(json.dumps(saved))
            return {
                "id": id,
                "base_url": public_url,
                "data_namespace": saved["data_namespace"],
            }
        except Exception:
            await self.stop(id, True)
            raise

    def lookup(self, host):
        suffix = "." + self.domain
        if not host or not host.endswith(suffix):
            return None
        id = host[: -len(suffix)]
        try:
            path = self.path(id) / "runtime.json"
        except ValueError:
            return None
        if not path.is_file():
            return None
        state = json.loads(path.read_text())
        return (
            state
            if state["state"] == "RUNNING" and state["expires_at"] > time.time()
            else None
        )

    async def restart(self, id, service):
        root = self.path(id)
        compose = json.loads((root / "compose.json").read_text())
        if service not in compose["services"] or service == "dependency-proxy":
            raise ValueError("service is not part of the candidate")
        await self.command(
            "docker", "compose", "-f", str(root / "compose.json"), "restart", service
        )

    async def stop(self, id, preserve_evidence=True):
        root = self.path(id)
        config = root / "compose.json"
        if not config.is_file():
            return
        await self.command("docker", "compose", "-f", str(config), "down", "--volumes")
        state = root / "runtime.json"
        if state.exists():
            saved = json.loads(state.read_text())
            saved["state"] = "STOPPED"
            state.write_text(json.dumps(saved))

    async def cleanup_expired(self):
        for path in self.root.glob("*/runtime.json"):
            saved = json.loads(path.read_text())
            if saved["state"] == "RUNNING" and saved["expires_at"] < time.time():
                await self.stop(saved["id"], True)
