from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.schemas.fallback import (  # noqa: E402
    GenerationMode,
    PreferredStack,
    StartFallbackTaskRequest,
    TriggerReason,
)
from app.services.fallback_client import LocalFallbackGenerationClient  # noqa: E402
from fallback.async_tasks.redis_state import InMemoryTaskStateStore  # noqa: E402


@pytest.mark.asyncio
async def test_local_fallback_client_runs_task_to_artifact_without_http_service():
    client = LocalFallbackGenerationClient(store=InMemoryTaskStateStore())
    request = StartFallbackTaskRequest(
        project_id="1",
        deployment_id="1",
        trigger_reason=TriggerReason.FORCE_FALLBACK,
        original_prompt="生成一个可以部署的待办事项 Web 应用",
        generation_mode=GenerationMode.VIBE,
        preferred_stack=PreferredStack(frontend="React", runtime="node20"),
    )

    started = await client.start_fallback_task(request)
    status = await client.query_task_status(started.task_id)
    artifact = await client.get_artifact_result(started.task_id)

    assert started.accepted is True
    assert status.status.value == "SUCCEEDED"
    assert status.artifact_ready is True
    assert artifact.deploy_ready is True
    assert artifact.dockerfile_content.startswith("FROM")
    assert artifact.runtime.start_command
    assert artifact.runtime.exposed_port > 0
