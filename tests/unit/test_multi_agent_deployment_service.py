from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.schemas.fallback import (  # noqa: E402
    GenerationMode,
    RepoProfile,
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
    TaskStatus,
    TriggerReason,
)
from app.services.multi_agent_deployment_service import (  # noqa: E402
    MultiAgentConsensusRejected,
    MultiAgentDeploymentService,
)


class SessionStub:
    def __init__(self):
        self.events = []
        self.commits = 0

    def add(self, item):
        self.events.append(item)

    def commit(self):
        self.commits += 1


class GraphStub:
    def __init__(self, result):
        self.result = result
        self.input_state = None

    def invoke(self, state):
        self.input_state = state
        return self.result


def request() -> StartFallbackTaskRequest:
    return StartFallbackTaskRequest(
        project_id="1",
        deployment_id="2",
        request_id="req-1",
        trigger_reason=TriggerReason.FORCE_FALLBACK,
        original_prompt="Deploy a React app",
        generation_mode=GenerationMode.AUTO,
        repo_profile=RepoProfile(detected_frameworks=["React"]),
    )


def approved_state():
    build_plan = {
        "framework": "react",
        "base_image": "node:20-alpine",
        "install_command": "npm ci",
        "start_command": "npm run start",
        "target_port": 3000,
        "healthcheck_path": "/",
        "proposed_files": ["Dockerfile", "start.sh"],
    }
    return {
        "final_status": "SUCCESS",
        "repo_profile": {"healthcheck_path": "/", "target_port": 3000},
        "builder_result": {
            "action": {
                "agent": "BUILDER",
                "output": build_plan,
            }
        },
        "consensus_result": {
            "final_decision": "APPROVE",
            "rationale": "All agents approved deployment.",
        },
        "trace": ["[trace] consensus=approved"],
    }


def rejected_state():
    return {
        "final_status": "FAILED",
        "repo_profile": {"contains_secrets": True},
        "builder_result": {},
        "consensus_result": {
            "final_decision": "REJECT",
            "rationale": "Security veto blocks deployment.",
        },
        "trace": ["[trace] consensus=security_veto"],
    }


def test_start_generation_runs_graph_and_passes_governed_request(monkeypatch):
    async def run():
        session = SessionStub()
        service = MultiAgentDeploymentService(session, graph=GraphStub(approved_state()))
        captured = {}

        async def fake_start_fallback_task(governed_request):
            captured["request"] = governed_request
            return StartFallbackTaskResponse(
                accepted=True,
                task_id="task-1",
                status=TaskStatus.QUEUED,
                queued_at=datetime.now(),
            )

        service.generation_service.start_fallback_task = fake_start_fallback_task

        response = await service.start_generation_with_consensus(request())

        governed = captured["request"]
        assert response.task_id == "task-1"
        assert governed.constraints.target_port == 3000
        assert governed.repo_profile.healthcheck_path == "/"
        assert governed.repo_profile.agent_build_plan["start_command"] == "npm run start"
        assert governed.repo_profile.agent_consensus["final_decision"] == "APPROVE"
        assert session.events[-1].phase == "agent"

    asyncio.run(run())


def test_start_generation_rejects_when_security_vetoes():
    async def run():
        service = MultiAgentDeploymentService(SessionStub(), graph=GraphStub(rejected_state()))

        try:
            await service.start_generation_with_consensus(request())
        except MultiAgentConsensusRejected as exc:
            assert exc.consensus_result["final_decision"] == "REJECT"
            assert "Security veto" in str(exc)
        else:
            raise AssertionError("Expected consensus rejection")

    asyncio.run(run())
