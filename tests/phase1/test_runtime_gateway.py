import httpx
import pytest


@pytest.mark.asyncio
async def test_gateway_authorizes_each_request_and_overwrites_forged_identity():
    from app.runner.gateway import create_gateway

    record = {
        "instance_id": "instance",
        "instance_token": "scoped-token",
        "platform_url": "https://platform.test",
        "public_url": "https://app.test",
        "upstream_url": "http://internal.test:3000",
    }

    class Manager:
        def lookup(self, host):
            return record if host == "app.test" else None

    visible = True

    def upstream(request):
        if request.url.host == "platform.test":
            return (
                httpx.Response(200, json={"allowed": True, "user_id": 7})
                if visible
                else httpx.Response(403)
            )
        return httpx.Response(
            200, json={"user_id": request.headers.get("X-IntelliDeploy-User-ID")}
        )

    service_client = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_gateway(Manager(), service_client)),
        base_url="https://app.test",
    ) as client:
        response = await client.get(
            "/notes", headers={"X-IntelliDeploy-User-ID": "999"}
        )
        assert response.json() == {"user_id": "7"}
        visible = False
        assert (await client.get("/notes")).status_code == 403
    await service_client.aclose()


@pytest.mark.asyncio
async def test_gateway_callback_consumes_code_and_redirects_without_platform_token():
    from app.runner.gateway import create_gateway

    record = {
        "instance_id": "instance",
        "instance_token": "scoped-token",
        "platform_url": "https://platform.test",
        "public_url": "https://app.test",
        "upstream_url": "http://internal.test:3000",
    }

    class Manager:
        def lookup(self, host):
            return record

    def exchange(request):
        assert b"scoped-token" in request.content
        return httpx.Response(
            200, json={"access_token": "app-identity", "expires_in": 900}
        )

    service_client = httpx.AsyncClient(transport=httpx.MockTransport(exchange))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_gateway(Manager(), service_client)),
        base_url="https://app.test",
    ) as client:
        response = await client.get("/api/platform/callback?code=single-use")
        assert (
            response.status_code == 303
            and response.headers["location"] == "https://app.test/"
        )
        assert "HttpOnly" in response.headers["set-cookie"]
        assert response.headers["cache-control"] == "no-store"
    await service_client.aclose()
