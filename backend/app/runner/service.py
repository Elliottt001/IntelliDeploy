"""Dedicated runner API. Launch through main(), which requires mutual TLS."""

import asyncio
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import time
from uuid import UUID
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict

from app.agent.tools import execute_tool
from app.agent.workspace import safe_path
from app.core.types import AppManifest, ToolCall, ToolResult
from app.runtime.artifacts import source_archive, unpack_source
from app.runtime.build import BuildFailed, build_release


class ToolRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    call: ToolCall


class ResourceRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    type: Literal['WORKSPACE','CANDIDATE_RUNTIME','EXECUTION_CONTAINER','CACHE_IMAGE']
    reference: str
    job_id: str
    operation_id: str
    instance_id: str | None = None


class RunnerService:
    def __init__(
        self, root, *, command_executor=None, builder=None, runtimes=None, quota=None
    ):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.command_executor = command_executor
        self.builder = builder
        self.runtimes = runtimes
        self.quota = quota
        self.locks = {}

    def job_root(self, job):
        try:
            UUID(job)
        except ValueError:
            raise HTTPException(422, "invalid job identifier")
        path = self.root / job
        if (self.root/'tombstones'/job).exists(): raise HTTPException(410,'workspace was collected')
        if path.is_symlink(): raise HTTPException(409,'workspace ownership is invalid')
        existed=path.exists()
        path.mkdir(exist_ok=True, mode=0o700)
        owner=path/'owner.json'
        if not owner.exists():
            if existed: raise HTTPException(409,'unregistered workspace requires administrator reconciliation')
            self.save(owner,{'managed':True,'job_id':job,'operation_id':'workspace:'+job})
        return path

    async def inspect_resource(self,payload):
        UUID(payload.job_id)
        if payload.type=='CANDIDATE_RUNTIME':
            if not self.runtimes: raise HTTPException(503,'candidate service unavailable')
            return await self.runtimes.inspect_resource(payload.reference)
        if payload.type=='WORKSPACE':
            root=self.root/payload.job_id
            if root.is_symlink(): raise HTTPException(409,'workspace ownership is invalid')
            if not root.exists(): return {'exists':False}
            owner=root/'owner.json'
            labels=json.loads(owner.read_text()) if owner.is_file() else {}
            return {'exists':True,'labels':labels}
        if not self.command_executor: raise HTTPException(503,'container service unavailable')
        return await asyncio.to_thread(self.command_executor.inspect_resource,payload.type,payload.reference)

    async def remove_resource(self,payload):
        async with self.lock(payload.job_id):
            state=await self.inspect_resource(payload)
            if not state.get('exists'): return {'removed':True}
            expected={'managed':True,'job_id':payload.job_id,'operation_id':payload.operation_id}
            if payload.instance_id: expected['instance_id']=payload.instance_id
            if any(state['labels'].get(k)!=v for k,v in expected.items()): raise HTTPException(409,'resource ownership changed')
            if payload.type=='WORKSPACE':
                if self.command_executor and await asyncio.to_thread(self.command_executor.active,payload.job_id): raise HTTPException(409,'workspace still has running containers')
                root=self.root/payload.job_id
                self.save(self.root/'tombstones'/payload.job_id,{'collected':True})
                if self.quota: await asyncio.to_thread(self.quota.destroy,root)
                import shutil
                await asyncio.to_thread(shutil.rmtree,root)
            elif payload.type=='CANDIDATE_RUNTIME': await self.runtimes.remove_resource(payload.reference)
            else: await asyncio.to_thread(self.command_executor.remove_resource,payload.type,payload.reference)
            return {'removed':True}

    def lock(self, job):
        return self.locks.setdefault(job, asyncio.Lock())

    def save(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = path.with_suffix(".tmp")
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "w") as file:
            json.dump(value, file)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)

    def fence(self, job, generation):
        if generation < 1:
            raise HTTPException(422, "invalid lease generation")
        path = self.job_root(job) / "fence.json"
        current = json.loads(path.read_text())["generation"] if path.exists() else 0
        if generation < current:
            raise HTTPException(409, "worker lease was superseded")
        if generation > current:
            self.save(path, {"generation": generation})

    async def tool(self, job, call):
        if not re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", call.id):
            raise HTTPException(422, "invalid tool identifier")
        if call.name not in {
            "list_files",
            "read_file",
            "write_file",
            "apply_patch",
            "run_command",
        }:
            raise HTTPException(422, "tool is not allowed on runner")
        root = self.job_root(job)
        workspace = root / "source"
        if not workspace.is_dir():
            raise HTTPException(409, "workspace is not prepared")
        identity = hashlib.sha256(call.id.encode()).hexdigest()
        path = root / "operations" / f"{identity}.json"
        digest = hashlib.sha256(call.model_dump_json().encode()).hexdigest()
        if path.exists():
            record = json.loads(path.read_text())
            if record["request_hash"] != digest or record["state"] != "COMPLETED":
                raise HTTPException(409, "tool effect is unknown or conflicts")
            return record["result"]
        self.save(path, {"request_hash": digest, "state": "STARTED"})
        started = time.monotonic()
        if call.name == "run_command":
            if self.command_executor is None:
                raise HTTPException(503, "isolated command executor is not configured")
            from app.agent.tools import CommandArgs

            args = CommandArgs.model_validate(call.arguments)
            result = await asyncio.to_thread(
                self.command_executor.run,
                str(workspace),
                args.argv,
                args.timeout,
                f"{job}-{identity}",
            )
            tool = ToolResult(
                call_id=call.id, ok=result["ok"], content=result["content"][:65536]
            )
            duration = result.get("duration_ms")
        else:
            # Only scoped file operations run on the trusted node; code runs in containers.
            tool = await asyncio.to_thread(execute_tool, str(workspace), call)
            duration = max(1, int((time.monotonic() - started) * 1000))
        result = {"result": tool.model_dump(mode="json"), "duration_ms": duration}
        self.save(
            path, {"request_hash": digest, "state": "COMPLETED", "result": result}
        )
        return result


def create_app(service, token):
    if not token:
        raise ValueError("runner authorization is required")
    app = FastAPI(title="IntelliDeploy dedicated runner")

    @app.post('/v1/resources/inspect')
    async def inspect_resource(payload:ResourceRequest): return await service.inspect_resource(payload)

    @app.post('/v1/resources/remove')
    async def remove_resource(payload:ResourceRequest): return await service.remove_resource(payload)

    @app.middleware("http")
    async def authorize(request, call_next):
        expected = "Bearer " + token
        if not hmac.compare_digest(request.headers.get("authorization", ""), expected):
            return Response(status_code=401)
        return await call_next(request)

    @app.get("/v1/health")
    def health():
        return {
            "ready": service.command_executor is not None,
            "builder_ready": service.builder is not None,
            "runtimes_ready": service.runtimes is not None,
            "candidate_domain_suffix": service.runtimes.domain
            if service.runtimes
            else None,
        }

    @app.post("/v1/jobs/{job}/workspace")
    async def upload(job: str, request: Request, x_lease_generation: int = Header()):
        async with service.lock(job):
            service.fence(job, x_lease_generation)
            root = service.job_root(job)
            data = await request.body()
            if len(data) > 64 * 1024 * 1024:
                raise HTTPException(413, "source upload exceeds limit")
            digest = hashlib.sha256(data).hexdigest()
            saved = root / "upload.json"
            if saved.exists():
                if json.loads(saved.read_text())["digest"] != digest:
                    raise HTTPException(409, "initial source already exists")
                return {"ok": True}
            workspace = (
                service.quota.prepare(root) if service.quota else root / "source"
            )
            workspace.mkdir(exist_ok=True)
            try:
                unpack_source(data, workspace)
            except (ValueError, KeyError):
                raise HTTPException(422, "unsafe source archive")
            (workspace / ".tool-results").mkdir(exist_ok=True)
            if service.quota:
                for path in workspace.rglob("*"):
                    if not path.is_symlink():
                        os.chown(path, 10001, 10001)
            service.save(saved, {"digest": digest})
            return {"ok": True}

    @app.get("/v1/jobs/{job}/workspace")
    async def snapshot(job: str, x_lease_generation: int = Header()):
        async with service.lock(job):
            service.fence(job, x_lease_generation)
            return Response(
                content=source_archive(service.job_root(job) / "source"),
                media_type="application/zip",
            )

    @app.post("/v1/jobs/{job}/sources/{operation}")
    async def import_source(
        job: str,
        operation: str,
        request: Request,
        destination: str,
        x_lease_generation: int = Header(),
    ):
        async with service.lock(job):
            service.fence(job, x_lease_generation)
            root = service.job_root(job)
            data = await request.body()
            if len(data) > 64 * 1024 * 1024:
                raise HTTPException(413, "source upload exceeds limit")
            path = (
                root
                / "imports"
                / f"{hashlib.sha256(operation.encode()).hexdigest()}.json"
            )
            digest = hashlib.sha256(data + destination.encode()).hexdigest()
            if path.exists():
                if json.loads(path.read_text())["digest"] != digest:
                    raise HTTPException(409, "source import changed")
                return {"ok": True}
            try:
                unpack_source(data, safe_path(root / "source", destination))
            except ValueError:
                raise HTTPException(422, "source import path is not allowed")
            service.save(path, {"digest": digest})
            return {"ok": True}

    @app.post("/v1/jobs/{job}/tools")
    async def tool(job: str, body: ToolRequest, x_lease_generation: int = Header()):
        async with service.lock(job):
            service.fence(job, x_lease_generation)
            return await service.tool(job, body.call)

    @app.get("/v1/jobs/{job}/tools/{call_id}")
    async def result(job: str, call_id: str, x_lease_generation: int = Header()):
        async with service.lock(job):
            service.fence(job, x_lease_generation)
            path = (
                service.job_root(job)
                / "operations"
                / f"{hashlib.sha256(call_id.encode()).hexdigest()}.json"
            )
            if not path.exists():
                return {"state": "NOT_STARTED"}
            return json.loads(path.read_text())

    @app.post("/v1/jobs/{job}/build/{attempt}")
    async def build(
        job: str, attempt: str, body: AppManifest, x_lease_generation: int = Header()
    ):
        async with service.lock(job):
            service.fence(job, x_lease_generation)
            if service.builder is None:
                raise HTTPException(503, "dedicated builder is not configured")
            started = time.monotonic()
            try:
                manifest = await build_release(
                    service.job_root(job) / "source",
                    body,
                    attempt,
                    build_executor=service.builder,
                )
            except (BuildFailed, ValueError) as exc:
                raise HTTPException(
                    422,
                    {
                        "code": "BUILD_FAILED",
                        "message": "candidate build failed",
                    },
                ) from exc
            return {
                "manifest": manifest.model_dump(mode="json"),
                "duration_ms": max(1, int((time.monotonic() - started) * 1000)),
            }

    @app.post("/v1/runtimes")
    async def start_runtime(request: Request):
        if service.runtimes is None:
            raise HTTPException(503, "candidate runtime backend is not configured")
        payload = await request.json()
        if not payload.get("isolated_network") or not payload.get("empty_data"):
            raise HTTPException(422, "candidate isolation is required")
        async with service.lock(payload["job_id"]):
            service.fence(payload["job_id"], int(payload["generation"]))
            return await service.runtimes.start(payload)

    @app.post("/v1/runtimes/{id}/restart")
    async def restart_runtime(id: str, request: Request):
        if service.runtimes is None:
            raise HTTPException(503, "candidate runtime backend is not configured")
        await service.runtimes.restart(id, (await request.json())["service"])
        return {"ok": True}

    @app.delete("/v1/runtimes/{id}")
    async def stop_runtime(id: str, preserve_evidence: bool = True):
        if service.runtimes is None:
            raise HTTPException(503, "candidate runtime backend is not configured")
        await service.runtimes.stop(id, preserve_evidence)
        return {"ok": True}

    return app


def main():
    import ssl, uvicorn
    from app.runner.docker import ContainerCommands
    from app.runtime.build import BuildctlExecutor
    from app.runner.runtimes import ContainerRuntimes
    from app.runner.gateway import create_gateway
    from app.runner.quota import WorkspaceQuota

    required = [
        "RUNNER_SERVER_CERT",
        "RUNNER_SERVER_KEY",
        "RUNNER_CLIENT_CA",
        "RUNNER_RPC_TOKEN",
        "AGENT_EXECUTOR_IMAGE",
        "CANDIDATE_DOMAIN_SUFFIX",
    ]
    if not all(os.environ.get(name) for name in required):
        raise RuntimeError(
            "runner requires explicit mTLS, token and pinned executor configuration"
        )
    root = Path(
        os.environ.get("RUNNER_WORKSPACE_ROOT", "/var/lib/intellideploy-runner")
    )
    runtimes = ContainerRuntimes(
        root / "runtimes",
        os.environ["CANDIDATE_DOMAIN_SUFFIX"],
        proxy_image=os.environ.get("RUNTIME_PROXY_IMAGE"),
    )
    service = RunnerService(
        root / "jobs",
        command_executor=ContainerCommands(
            os.environ["AGENT_EXECUTOR_IMAGE"],
            network=os.environ.get("RUNNER_DEPENDENCY_NETWORK", "none"),
            proxy_url=os.environ.get("RUNNER_DEPENDENCY_PROXY"),
        ),
        builder=BuildctlExecutor(),
        runtimes=runtimes,
        quota=WorkspaceQuota(int(os.environ.get("RUNNER_WORKSPACE_LIMIT_MB", "1024"))),
    )

    async def serve():
        rpc = uvicorn.Server(
            uvicorn.Config(
                create_app(service, os.environ["RUNNER_RPC_TOKEN"]),
                host="0.0.0.0",
                port=9443,
                ssl_certfile=os.environ["RUNNER_SERVER_CERT"],
                ssl_keyfile=os.environ["RUNNER_SERVER_KEY"],
                ssl_ca_certs=os.environ["RUNNER_CLIENT_CA"],
                ssl_cert_reqs=ssl.CERT_REQUIRED,
            )
        )
        gateway = uvicorn.Server(
            uvicorn.Config(create_gateway(runtimes), host=os.environ.get('RUNNER_GATEWAY_BIND','127.0.0.1'), port=9877)
        )

        async def maintenance():
            while True:
                await runtimes.cleanup_expired()
                await asyncio.sleep(60)

        await asyncio.gather(rpc.serve(), gateway.serve(), maintenance())

    asyncio.run(serve())


if __name__ == "__main__":
    main()
