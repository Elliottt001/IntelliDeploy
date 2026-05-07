from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from contracts.models import AgentAction, BuilderOutput, ReviewerOutput, SecurityOutput
from src.agents.multi_agent_graph import build_multi_agent_graph


class FakeStructuredLLMRunner:
    available = True

    def generate_structured(self, *, system_prompt: str, user_prompt: str, output_model: type, context: dict[str, Any]):
        flow_id = context["flow_id"]
        repo_profile = context["repo_profile"]
        user_intent = context["user_intent"]
        if output_model is BuilderOutput:
            return BuilderOutput(
                context={
                    "flow_id": flow_id,
                    "stage": "BUILDING",
                    "user_intent": user_intent,
                    "repo_profile": repo_profile,
                },
                action=AgentAction(
                    agent="BUILDER",
                    action="LLM generated deployment plan",
                    output={
                        "framework": "react",
                        "base_image": "node:20-alpine",
                        "install_command": "npm ci",
                        "start_command": "npm run start",
                        "target_port": 8080,
                        "healthcheck_path": "/",
                        "proposed_files": ["Dockerfile", "start.sh"],
                    },
                    confidence=0.91,
                ),
                proposed_files=["Dockerfile", "start.sh"],
            )
        if output_model is ReviewerOutput:
            return ReviewerOutput(
                context={
                    "flow_id": flow_id,
                    "stage": "REVIEWING",
                    "user_intent": user_intent,
                    "repo_profile": repo_profile,
                },
                action=AgentAction(
                    agent="REVIEWER",
                    action="LLM reviewed deployment plan",
                    output={"decision": "APPROVE"},
                    confidence=0.9,
                ),
                findings=[],
            )
        if output_model is SecurityOutput:
            return SecurityOutput(
                context={
                    "flow_id": flow_id,
                    "stage": "SECURITY_CHECK",
                    "user_intent": user_intent,
                    "repo_profile": repo_profile,
                },
                action=AgentAction(
                    agent="SECURITY",
                    action="LLM approved security posture",
                    output={"decision": "APPROVE"},
                    confidence=0.9,
                ),
                blocked=False,
                vulnerabilities=[],
            )
        raise AssertionError(f"Unexpected output model: {output_model}")


class UnavailableLLMRunner:
    available = False

    def generate_structured(self, **kwargs):
        raise AssertionError("Unavailable runner should not be called")


def _base_state(repo_profile: dict, *, max_attempts: int = 2) -> dict:
    return {
        "flow_id": "flow-happy-001",
        "user_intent": "Deploy a React portfolio app",
        "repo_profile": repo_profile,
        "stage": "Thinking",
        "attempt": 0,
        "max_attempts": max_attempts,
        "final_status": "IN_PROGRESS",
        "rendered_prompts": {},
        "llm_used": {},
        "fallback_reasons": [],
        "builder_result": {},
        "reviewer_result": {},
        "security_result": {},
        "consensus_result": {},
        "reviewer_decision": "UNKNOWN",
        "reviewer_feedback": "",
        "security_decision": "UNKNOWN",
        "security_feedback": "",
        "trace": [],
        "node_durations_ms": {},
    }


def test_multi_agent_graph_happy_path() -> None:
    graph = build_multi_agent_graph(llm_runner=UnavailableLLMRunner())
    init_state = _base_state(
        {
            "framework": "react",
            "has_dockerfile": False,
            "healthcheck_path": "/",
        }
    )

    result = graph.invoke(init_state)

    assert result["final_status"] == "SUCCESS"
    assert result["stage"] == "Finalize"
    assert result["reviewer_decision"] == "APPROVE"
    assert result["security_decision"] == "APPROVE"
    assert result["builder_result"]["action"]["agent"] == "BUILDER"
    assert result["reviewer_result"]["action"]["agent"] == "REVIEWER"
    assert result["security_result"]["action"]["agent"] == "SECURITY"
    assert result["consensus_result"]["final_decision"] == "APPROVE"
    assert set(result["rendered_prompts"]) == {
        "builder.main_flow",
        "reviewer.main_flow",
        "security.main_flow",
    }
    assert "Builder" in result["node_durations_ms"]
    assert "Reviewer" in result["node_durations_ms"]
    assert "Security" in result["node_durations_ms"]
    assert "Finalize" in result["node_durations_ms"]


def test_multi_agent_graph_reviewer_revise_then_recover() -> None:
    graph = build_multi_agent_graph(llm_runner=UnavailableLLMRunner())
    init_state = _base_state({"framework": "react", "has_dockerfile": False})

    result = graph.invoke(init_state)

    assert result["final_status"] == "SUCCESS"
    assert result["attempt"] == 1
    assert result["repo_profile"]["healthcheck_path"] == "/"
    assert result["reviewer_decision"] == "APPROVE"
    assert any("consensus=review_revise" in item for item in result["trace"])
    assert any("healing attempt=1" in item for item in result["trace"])


def test_multi_agent_graph_security_veto_fails_after_retry_budget() -> None:
    graph = build_multi_agent_graph(llm_runner=UnavailableLLMRunner())
    init_state = _base_state(
        {
            "framework": "react",
            "has_dockerfile": False,
            "healthcheck_path": "/",
            "contains_secrets": True,
        },
        max_attempts=1,
    )

    result = graph.invoke(init_state)

    assert result["final_status"] == "FAILED"
    assert result["stage"] == "Finalize"
    assert result["security_decision"] == "REJECT"
    assert result["security_result"]["blocked"] is True
    assert result["consensus_result"]["final_decision"] == "REJECT"
    assert any("consensus=security_veto" in item for item in result["trace"])


def test_multi_agent_graph_uses_llm_runner_and_pydantic_parse() -> None:
    graph = build_multi_agent_graph(llm_runner=FakeStructuredLLMRunner())
    init_state = _base_state({"framework": "react", "has_dockerfile": False})

    result = graph.invoke(init_state)

    assert result["final_status"] == "SUCCESS"
    assert result["llm_used"] == {"Builder": "True", "Reviewer": "True", "Security": "True"}
    assert result["fallback_reasons"] == []
    assert result["builder_result"]["action"]["action"] == "LLM generated deployment plan"
    assert result["reviewer_result"]["action"]["output"]["decision"] == "APPROVE"
    assert result["security_result"]["blocked"] is False
