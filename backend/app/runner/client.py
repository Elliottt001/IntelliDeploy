import ssl
from pathlib import Path
from urllib.parse import urlsplit, quote
import httpx
from app.config import settings
from app.runtime.artifacts import source_archive, unpack_source


class RunnerUnavailable(RuntimeError):
    pass


class RunnerConflict(RunnerUnavailable):
    pass


class RunnerBuildFailed(RuntimeError):
    pass


class RunnerClient:
    def __init__(self, client):
        self.client = client

    @classmethod
    def from_settings(cls):
        url = urlsplit(settings.RUNNER_URL)
        if (
            url.scheme != "https"
            or not url.hostname
            or url.username
            or url.password
            or url.query
            or url.fragment
        ):
            raise RunnerUnavailable("执行节点必须使用已登记的HTTPS地址")
        paths = [
            settings.RUNNER_CA_FILE,
            settings.RUNNER_CERT_FILE,
            settings.RUNNER_KEY_FILE,
        ]
        if (
            not settings.RUNNER_RPC_TOKEN
            or not all(Path(p).is_file() for p in paths if p)
            or not all(paths)
        ):
            raise RunnerUnavailable("执行节点mTLS证书和授权尚未配置")
        try:
            context = ssl.create_default_context(cafile=paths[0])
            context.load_cert_chain(paths[1], paths[2])
        except (OSError, ssl.SSLError) as exc:
            raise RunnerUnavailable("执行节点证书不可用") from exc
        return cls(
            httpx.AsyncClient(
                base_url=settings.RUNNER_URL.rstrip("/"),
                verify=context,
                headers={"Authorization": "Bearer " + settings.RUNNER_RPC_TOKEN},
                timeout=650,
            )
        )

    async def request(self, method, path, *, generation=None, **kwargs):
        headers = (
            {"X-Lease-Generation": str(generation)} if generation is not None else {}
        )
        try:
            response = await self.client.request(
                method, path, headers=headers, **kwargs
            )
        except httpx.RequestError as exc:
            raise RunnerUnavailable("执行节点结果待核对，不能盲目重放") from exc
        if response.status_code == 409:
            raise RunnerConflict("执行节点操作冲突或结果待核对")
        if response.status_code >= 400:
            try:
                detail = response.json().get("detail")
            except (ValueError, AttributeError):
                detail = None
            if isinstance(detail, dict) and detail.get("code") == "BUILD_FAILED":
                raise RunnerBuildFailed(
                    str(detail.get("message") or "candidate build failed")
                )
            raise RunnerUnavailable("执行节点拒绝操作或尚未就绪")
        return response

    async def health(self):
        return (await self.request("GET", "/v1/health")).json()

    async def upload(self, job_id, root, generation):
        await self.request(
            "POST",
            f"/v1/jobs/{quote(job_id, safe='')}/workspace",
            generation=generation,
            content=source_archive(root),
        )

    async def snapshot(self, job_id, root, generation):
        response = await self.request(
            "GET", f"/v1/jobs/{quote(job_id, safe='')}/workspace", generation=generation
        )
        return unpack_source(response.content, root)

    async def import_source(self, job_id, data, destination, operation, generation):
        await self.request(
            "POST",
            f"/v1/jobs/{job_id}/sources/{quote(operation, safe='')}",
            generation=generation,
            params={"destination": destination},
            content=data,
        )

    async def tool(self, job_id, call, generation):
        return (
            await self.request(
                "POST",
                f"/v1/jobs/{job_id}/tools",
                generation=generation,
                json={"call": call.model_dump(mode="json")},
            )
        ).json()

    async def tool_result(self, job_id, call_id, generation):
        return (
            await self.request(
                "GET",
                f"/v1/jobs/{job_id}/tools/{quote(call_id, safe='')}",
                generation=generation,
            )
        ).json()

    async def build(self, job_id, attempt_id, manifest, generation):
        return (
            await self.request(
                "POST",
                f"/v1/jobs/{job_id}/build/{attempt_id}",
                generation=generation,
                json=manifest.model_dump(mode="json"),
            )
        ).json()

    async def start(self, **kwargs):
        return (await self.request("POST", "/v1/runtimes", json=kwargs)).json()

    async def restart_service(self, runtime_id, service):
        await self.request(
            "POST", f"/v1/runtimes/{runtime_id}/restart", json={"service": service}
        )

    async def stop(self, runtime_id, preserve_evidence=True):
        await self.request(
            "DELETE",
            f"/v1/runtimes/{runtime_id}",
            params={"preserve_evidence": str(preserve_evidence).lower()},
        )

    async def close(self):
        await self.client.aclose()
