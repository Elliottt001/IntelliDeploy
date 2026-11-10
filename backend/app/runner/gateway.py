"""Runtime entry for any supported Web stack; business data authorization stays in the app."""

from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse
import httpx

IDENTITY_COOKIE = "intellideploy_app_identity"


def create_gateway(manager, client=None):
    client = client or httpx.AsyncClient(timeout=30, follow_redirects=False)
    app = FastAPI(docs_url=None, openapi_url=None)

    @app.api_route(
        "/{path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    )
    async def forward(path: str, request: Request):
        record = manager.lookup(request.url.hostname)
        if record is None:
            return Response(status_code=404)
        base = record["platform_url"].rstrip("/")
        headers = {
            "X-Instance-ID": record["instance_id"],
            "X-Instance-Token": record["instance_token"],
        }
        token = request.cookies.get(IDENTITY_COOKIE)
        if token:
            headers["Authorization"] = "Bearer " + token
        try:
            if path == "api/platform/callback":
                code = request.query_params.get("code")
                if not code:
                    return Response(
                        status_code=401, headers={"Cache-Control": "no-store"}
                    )
                callback = record["public_url"].rstrip("/") + "/api/platform/callback"
                result = await client.post(
                    base + "/api/capabilities/identity/exchange",
                    json={
                        "code": code,
                        "callback": callback,
                        "instance_token": record["instance_token"],
                    },
                )
                if result.status_code != 200:
                    return Response(
                        status_code=401, headers={"Cache-Control": "no-store"}
                    )
                payload = result.json()
                response = RedirectResponse(
                    record["public_url"].rstrip("/") + "/", status_code=303
                )
                response.set_cookie(
                    IDENTITY_COOKIE,
                    payload["access_token"],
                    httponly=True,
                    secure=record["public_url"].startswith("https:"),
                    samesite="lax",
                    max_age=min(payload["expires_in"], 3600),
                )
                response.headers["Cache-Control"] = "no-store"
                response.headers["Referrer-Policy"] = "no-referrer"
                return response
            authorized = await client.get(
                base + f"/api/instances/{record['instance_id']}/access", headers=headers
            )
            if authorized.status_code != 200:
                return Response(
                    "应用未公开或需要登录",
                    {401: 401, 403: 403}.get(authorized.status_code, 503),
                    headers={"Cache-Control": "no-store"},
                )
            identity = authorized.json().get("user_id")
            denied = {
                "host",
                "connection",
                "content-length",
                "x-intellideploy-user-id",
                "x-forwarded-user-id",
                "x-instance-id",
                "x-instance-token",
                "proxy-authorization",
            }
            outgoing = {
                name: value
                for name, value in request.headers.items()
                if name.lower() not in denied
            }
            if identity is not None:
                outgoing["X-IntelliDeploy-User-ID"] = str(identity)
            result = await client.request(
                request.method,
                record["upstream_url"].rstrip("/") + "/" + path,
                params=list(request.query_params.multi_items()),
                headers=outgoing,
                content=await request.body(),
            )
            result_headers = {
                name: value
                for name, value in result.headers.items()
                if name.lower()
                not in {
                    "connection",
                    "content-length",
                    "transfer-encoding",
                    "content-encoding",
                }
            }
            return Response(
                result.content, status_code=result.status_code, headers=result_headers
            )
        except (httpx.RequestError, ValueError, KeyError):
            return Response(status_code=503, headers={"Cache-Control": "no-store"})

    return app


def main():
    import os, uvicorn

    hosts = set(os.environ["RUNTIME_ALLOWED_HOSTS"].split(","))

    class StaticRuntime:
        def lookup(self, host):
            if host not in hosts:
                return None
            return {
                "instance_id": os.environ["PLATFORM_INSTANCE_ID"],
                "instance_token": os.environ["PLATFORM_INSTANCE_TOKEN"],
                "platform_url": os.environ["PLATFORM_CAPABILITY_URL"],
                "public_url": "https://" + host,
                "upstream_url": os.environ["RUNTIME_UPSTREAM_URL"],
            }

    uvicorn.run(create_gateway(StaticRuntime()), host="0.0.0.0", port=8080)


if __name__ == "__main__":
    main()
