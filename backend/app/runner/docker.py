import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time


class ContainerCommands:
    def __init__(self, image, *, network="none", proxy_url=None):
        if not re.fullmatch(r"(?:.+@)?sha256:[0-9a-f]{64}", image):
            raise ValueError("executor image must be digest pinned")
        self.image = image
        self.network = network
        self.proxy_url = proxy_url
        self.docker = shutil.which("docker")
        if not self.docker:
            raise ValueError("Docker client is unavailable on execution node")
        if network != "none":
            info = json.loads(
                subprocess.check_output(
                    [self.docker, "network", "inspect", network], text=True
                )
            )
            if not info[0].get("Internal") or not proxy_url:
                raise ValueError(
                    "dependency network requires internal isolation and proxy"
                )

    def environment(self):
        return {
            name: value
            for name in ("PATH", "DOCKER_HOST", "DOCKER_CONFIG")
            if (value := os.environ.get(name))
        }

    def run(self, workspace, argv, timeout, operation_id):
        if (
            not argv
            or any(not isinstance(item, str) for item in argv)
            or not 1 <= timeout <= 600
        ):
            raise ValueError("invalid command")
        name = "id-exec-" + hashlib.sha256(operation_id.encode()).hexdigest()[:32]
        command = [
            self.docker,
            "run",
            "--name",
            name,
            "--platform",
            "linux/amd64",
            "--network",
            self.network,
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--pids-limit",
            "128",
            "--memory",
            "1g",
            "--cpus",
            "1",
            "--user",
            "10001:10001",
            "--tmpfs",
            "/tmp:rw,nosuid,size=256m",
            "-v",
            str(Path(workspace).resolve()) + ":/workspace:rw",
            "-w",
            "/workspace",
        ]
        if self.proxy_url:
            command += [
                "-e",
                "HTTP_PROXY=" + self.proxy_url,
                "-e",
                "HTTPS_PROXY=" + self.proxy_url,
                "-e",
                "NODE_USE_ENV_PROXY=1",
            ]
        command += [self.image, *argv]
        started = time.monotonic()
        try:
            result = subprocess.run(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=timeout,
                env=self.environment(),
            )
            return {
                "ok": result.returncode == 0,
                "content": result.stdout[-65536:],
                "duration_ms": max(1, int((time.monotonic() - started) * 1000)),
            }
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "content": "受控命令达到超时上限",
                "duration_ms": timeout * 1000,
            }
        finally:
            subprocess.run(
                [self.docker, "rm", "-f", name],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=self.environment(),
            )
