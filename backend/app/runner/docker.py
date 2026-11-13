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

    def run(self, workspace, argv, timeout, operation_id, *, workspace_policy=None):
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
            '--label', 'intellideploy.managed=true',
            '--label', 'intellideploy.operation_id='+operation_id,
            '--label', 'intellideploy.job_id='+operation_id[:36],
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
            "-e",
            "npm_config_cache=/tmp/npm-cache",
            "-v",
            str(Path(workspace).resolve()) + ":/workspace:rw",
            "-w",
            "/workspace",
        ]
        if workspace_policy:
            from app.agent.contracts import ComponentWorkspacePolicy
            ComponentWorkspacePolicy.model_validate(workspace_policy)
            root = Path(workspace).resolve()
            mount_index = command.index("-v")
            command[mount_index:] = ["-v", str(root) + ":/workspace:ro", "-v",
                str(root / "app") + ":/workspace/app:rw", "-w", "/workspace/app"]
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

    def active(self,job_id):
        return subprocess.check_output([self.docker,'ps','-q','--filter','label=intellideploy.job_id='+job_id],env=self.environment(),text=True).split()

    def inspect_resource(self,type,reference):
        if type=='EXECUTION_CONTAINER' and not re.fullmatch(r'id-exec-[0-9a-f]{32}',reference): raise ValueError('Invalid execution container identity')
        if type=='CACHE_IMAGE' and not re.fullmatch(r'.+@sha256:[0-9a-f]{64}',reference): raise ValueError('Cache image must be digest pinned')
        kind='container' if type=='EXECUTION_CONTAINER' else 'image'
        result=subprocess.run([self.docker,kind,'inspect',reference],env=self.environment(),capture_output=True,text=True)
        if result.returncode:
            # A failed daemon/transport is not proof of absence.
            if re.search(r'No such (image|container):',result.stderr): return {'exists':False}
            raise RuntimeError('Resource observation is unavailable')
        labels=json.loads(result.stdout)[0].get('Config',{}).get('Labels') or {}
        return {'exists':True,'labels':{'managed':labels.get('intellideploy.managed')=='true','job_id':labels.get('intellideploy.job_id'),'operation_id':labels.get('intellideploy.operation_id')}}

    def remove_resource(self,type,reference):
        args=['rm','-f',reference] if type=='EXECUTION_CONTAINER' else ['image','rm',reference]
        subprocess.run([self.docker,*args],env=self.environment(),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
