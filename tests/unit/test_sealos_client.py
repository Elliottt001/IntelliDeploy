from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services import sealos_client as sealos_client_module  # noqa: E402
from app.services.sealos_client import SealosClient  # noqa: E402


@pytest.mark.asyncio
async def test_create_source_app_raises_when_resource_apply_fails(monkeypatch):
    def fake_deploy_source_with_kubeconfig(**kwargs):
        return {
            "status": "failed",
            "results": [
                {"step": "configmap", "success": True, "message": "created"},
                {"step": "deploy", "success": False, "message": "Forbidden"},
            ],
        }

    monkeypatch.setattr(
        sealos_client_module,
        "deploy_source_with_kubeconfig",
        fake_deploy_source_with_kubeconfig,
    )

    client = SealosClient(kubeconfig="kubeconfig")

    with pytest.raises(Exception, match="deploy: Forbidden"):
        await client.create_source_app(
            name="demo",
            runtime_image="node:20-alpine",
            source_files={"server.js": "console.log('ok')"},
            install_command=None,
            start_command="node server.js",
            port=8000,
        )
