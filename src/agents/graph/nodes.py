from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any

from contracts.models import (
    AgentAction,
    AgentContext,
    BuilderOutput,
    ConsensusState,
    ConsensusVote,
    ReviewerOutput,
    ReviewFinding,
    SecurityOutput,
)
from prompting import PromptManager
from pydantic import BaseModel

from src.agents.graph.state import AgentState, Decision, Stage
from src.agents.llm_runner import AgentLLMRunner, OpenAICompatibleLLMRunner


PROMPT_VERSION = "1.0.0"


class AgentNodeFactory:
    def __init__(
        self,
        *,
        prompt_manager: PromptManager | None = None,
        llm_runner: AgentLLMRunner | None = None,
    ) -> None:
        self.prompt_manager = prompt_manager or PromptManager()
        self.llm_runner = llm_runner or OpenAICompatibleLLMRunner()

    def timed(self, node_name: str, state: AgentState, update: dict) -> dict:
        started = time.perf_counter()
        staged = dict(update)
        staged["node_durations_ms"] = {node_name: int((time.perf_counter() - started) * 1000)}
        staged["trace"] = list(staged.get("trace", [])) + [
            f"[trace] node={node_name} stage={staged.get('stage', state['stage'])}"
        ]
        return staged

    def generate_or_fallback(
        self,
        *,
        state: AgentState,
        node_name: str,
        prompt_id: str,
        output_model: type[BaseModel],
        prompt_input: dict[str, Any],
        fallback_factory: Any,
    ) -> tuple[BaseModel, str, bool, str | None]:
        rendered_prompt = self.prompt_manager.render(prompt_id, PROMPT_VERSION, prompt_input)
        if self.runner_available():
            try:
                generated = self.llm_runner.generate_structured(
                    system_prompt=f"You are {node_name} Agent in IntelliDeploy.",
                    user_prompt=rendered_prompt,
                    output_model=output_model,
                    context=prompt_input,
                )
                return generated, rendered_prompt, True, None
            except Exception as exc:
                fallback_reason = f"{node_name} LLM failed, using deterministic fallback: {exc}"
        else:
            fallback_reason = f"{node_name} LLM unavailable, using deterministic fallback"

        generated = fallback_factory()
        validated = self.prompt_manager.validate_output(
            prompt_id,
            PROMPT_VERSION,
            generated.model_dump(mode="json"),
        )
        return validated, rendered_prompt, False, fallback_reason

    def runner_available(self) -> bool:
        return bool(getattr(self.llm_runner, "available", True))

    def thinking_node(self, state: AgentState) -> dict:
        return self.timed(
            "Thinking",
            state,
            {
                "stage": "Thinking",
                "final_status": "IN_PROGRESS",
            },
        )

    def builder_node(self, state: AgentState) -> dict:
        prompt_input = {
            "flow_id": state["flow_id"],
            "stage": "BUILDING",
            "user_intent": state["user_intent"],
            "repo_profile": state["repo_profile"],
            "constraints": {"max_attempts": state["max_attempts"], "attempt": state["attempt"]},
        }

        def fallback_builder() -> BuilderOutput:
            plan = self.build_plan(state)
            return BuilderOutput(
                context=self.agent_context(state, "Building"),
                action=AgentAction(
                    agent="BUILDER",
                    action="Generate deployable build plan",
                    output=plan,
                    confidence=0.88 if plan["framework"] != "generic" else 0.62,
                ),
                proposed_files=plan["proposed_files"],
            )

        generated, rendered_prompt, used_llm, fallback_reason = self.generate_or_fallback(
            state=state,
            node_name="Builder",
            prompt_id="builder.main_flow",
            output_model=BuilderOutput,
            prompt_input=prompt_input,
            fallback_factory=fallback_builder,
        )
        return self.timed(
            "Builder",
            state,
            {
                "stage": "Building",
                "rendered_prompts": {"builder.main_flow": rendered_prompt},
                "llm_used": {"Builder": str(used_llm)},
                "fallback_reasons": [fallback_reason] if fallback_reason else [],
                "builder_result": generated.model_dump(mode="json"),
            },
        )

    def reviewer_node(self, state: AgentState) -> dict:
        prompt_input = {
            "flow_id": state["flow_id"],
            "stage": "REVIEWING",
            "user_intent": state["user_intent"],
            "repo_profile": state["repo_profile"],
            "builder_output": state["builder_result"],
            "constraints": {"attempt": state["attempt"], "max_attempts": state["max_attempts"]},
        }

        def fallback_reviewer() -> ReviewerOutput:
            build_plan = state["builder_result"]["action"]["output"]
            findings = self.review_findings(build_plan)
            decision: Decision = "APPROVE" if not findings else "REVISE"
            return ReviewerOutput(
                context=self.agent_context(state, "Reviewing"),
                action=AgentAction(
                    agent="REVIEWER",
                    action="Review deployability of Builder output",
                    output={"decision": decision},
                    confidence=0.9 if decision == "APPROVE" else 0.8,
                ),
                findings=findings,
            )

        generated, rendered_prompt, used_llm, fallback_reason = self.generate_or_fallback(
            state=state,
            node_name="Reviewer",
            prompt_id="reviewer.main_flow",
            output_model=ReviewerOutput,
            prompt_input=prompt_input,
            fallback_factory=fallback_reviewer,
        )
        reviewer_payload = generated.model_dump(mode="json")
        findings = [ReviewFinding.model_validate(item) for item in reviewer_payload["findings"]]
        output_decision = reviewer_payload["action"]["output"].get("decision")
        decision: Decision = "REVISE" if findings or output_decision == "REVISE" else "APPROVE"
        return self.timed(
            "Reviewer",
            state,
            {
                "rendered_prompts": {"reviewer.main_flow": rendered_prompt},
                "llm_used": {"Reviewer": str(used_llm)},
                "fallback_reasons": [fallback_reason] if fallback_reason else [],
                "reviewer_result": reviewer_payload,
                "reviewer_decision": decision,
                "reviewer_feedback": "; ".join(f.suggestion for f in findings),
            },
        )

    def security_node(self, state: AgentState) -> dict:
        prompt_input = {
            "flow_id": state["flow_id"],
            "stage": "SECURITY_CHECK",
            "user_intent": state["user_intent"],
            "repo_profile": state["repo_profile"],
            "builder_output": state["builder_result"],
            "reviewer_output": state.get("reviewer_result", {}),
            "constraints": {"attempt": state["attempt"], "max_attempts": state["max_attempts"]},
        }

        def fallback_security() -> SecurityOutput:
            build_plan = state["builder_result"]["action"]["output"]
            vulnerabilities = self.security_findings(state, build_plan)
            blocked = any(item.severity == "CRITICAL" for item in vulnerabilities)
            decision: Decision = "REJECT" if blocked else "APPROVE"
            return SecurityOutput(
                context=self.agent_context(state, "SecurityCheck"),
                action=AgentAction(
                    agent="SECURITY",
                    action="Evaluate deployment security risks",
                    output={"decision": decision},
                    confidence=0.92 if blocked else 0.87,
                ),
                blocked=blocked,
                vulnerabilities=vulnerabilities,
            )

        generated, rendered_prompt, used_llm, fallback_reason = self.generate_or_fallback(
            state=state,
            node_name="Security",
            prompt_id="security.main_flow",
            output_model=SecurityOutput,
            prompt_input=prompt_input,
            fallback_factory=fallback_security,
        )
        security_payload = generated.model_dump(mode="json")
        vulnerabilities = [ReviewFinding.model_validate(item) for item in security_payload["vulnerabilities"]]
        output_decision = security_payload["action"]["output"].get("decision")
        decision: Decision = "REJECT" if security_payload["blocked"] or output_decision == "REJECT" else "APPROVE"
        return self.timed(
            "Security",
            state,
            {
                "rendered_prompts": {"security.main_flow": rendered_prompt},
                "llm_used": {"Security": str(used_llm)},
                "fallback_reasons": [fallback_reason] if fallback_reason else [],
                "security_result": security_payload,
                "security_decision": decision,
                "security_feedback": "; ".join(v.suggestion for v in vulnerabilities),
            },
        )

    def consensus_node(self, state: AgentState) -> dict:
        votes = [
            ConsensusVote(agent="BUILDER", decision="APPROVE", reason="Builder produced a schema-valid plan."),
            ConsensusVote(
                agent="REVIEWER",
                decision=state["reviewer_decision"],
                reason=state["reviewer_feedback"] or "Reviewer approved deployability.",
            ),
            ConsensusVote(
                agent="SECURITY",
                decision=state["security_decision"],
                reason=state["security_feedback"] or "Security approved deployment.",
            ),
        ]

        if state["security_decision"] == "REJECT":
            consensus = ConsensusState(
                flow_id=state["flow_id"],
                stage="SECURITY_CHECK",
                votes=votes,
                final_decision="REJECT",
                rationale="Security veto blocks deployment.",
                updated_at=datetime.now(UTC),
            )
            return self.timed(
                "Consensus",
                state,
                {
                    "consensus_result": consensus.model_dump(mode="json"),
                    "trace": ["[trace] consensus=security_veto"],
                    "final_status": "IN_PROGRESS",
                },
            )

        if state["reviewer_decision"] == "REVISE":
            consensus = ConsensusState(
                flow_id=state["flow_id"],
                stage="REVIEWING",
                votes=votes,
                final_decision="REVISE",
                rationale="Reviewer requested Builder revision.",
                updated_at=datetime.now(UTC),
            )
            return self.timed(
                "Consensus",
                state,
                {
                    "consensus_result": consensus.model_dump(mode="json"),
                    "trace": ["[trace] consensus=review_revise"],
                    "final_status": "IN_PROGRESS",
                },
            )

        consensus = ConsensusState(
            flow_id=state["flow_id"],
            stage="FINALIZE",
            votes=votes,
            final_decision="APPROVE",
            rationale="All agents approved deployment.",
            updated_at=datetime.now(UTC),
        )
        return self.timed(
            "Consensus",
            state,
            {
                "consensus_result": consensus.model_dump(mode="json"),
                "trace": ["[trace] consensus=approved"],
                "final_status": "SUCCESS",
            },
        )

    def healing_node(self, state: AgentState) -> dict:
        repo_profile = dict(state["repo_profile"])
        if state["reviewer_decision"] == "REVISE":
            repo_profile["healthcheck_path"] = repo_profile.get("healthcheck_path", "/")
        if state["security_decision"] == "REJECT":
            repo_profile["security_blocked"] = True
        return self.timed(
            "Healing",
            state,
            {
                "stage": "Healing",
                "attempt": state["attempt"] + 1,
                "repo_profile": repo_profile,
                "trace": [f"[trace] healing attempt={state['attempt'] + 1}"],
            },
        )

    def finalize_node(self, state: AgentState) -> dict:
        status = state["final_status"]
        if status != "SUCCESS":
            status = "FAILED"
        return self.timed(
            "Finalize",
            state,
            {
                "stage": "Finalize",
                "final_status": status,
            },
        )

    def agent_context(self, state: AgentState, stage: Stage) -> AgentContext:
        return AgentContext(
            flow_id=state["flow_id"],
            stage=self.stage_for_contract(stage),
            user_intent=state["user_intent"],
            repo_profile=state["repo_profile"],
        )

    def stage_for_contract(self, stage: str) -> str:
        return {
            "Thinking": "THINKING",
            "Building": "BUILDING",
            "Reviewing": "REVIEWING",
            "SecurityCheck": "SECURITY_CHECK",
            "Healing": "HEALING",
            "Finalize": "FINALIZE",
        }[stage]

    def framework(self, repo_profile: dict[str, Any]) -> str:
        frameworks = repo_profile.get("detected_frameworks") or []
        if isinstance(frameworks, list) and frameworks:
            return str(frameworks[0]).lower()
        return str(repo_profile.get("framework", "generic")).lower()

    def build_plan(self, state: AgentState) -> dict[str, Any]:
        repo_profile = state["repo_profile"]
        framework = self.framework(repo_profile)
        target_port = repo_profile.get("target_port") or repo_profile.get("port") or 8080

        if framework in {"react", "vite", "next.js", "next"}:
            base_image = "node:20-alpine"
            install_command = "npm ci"
            start_command = "npm run start"
            proposed_files = ["Dockerfile", "start.sh"]
        elif framework in {"fastapi", "flask", "python"}:
            base_image = "python:3.11-slim"
            install_command = "pip install -r requirements.txt"
            start_command = "uvicorn main:app --host 0.0.0.0 --port %s" % target_port
            proposed_files = ["Dockerfile", "start.sh", "requirements.txt"]
        else:
            base_image = "debian:bookworm-slim"
            install_command = "echo no dependency manifest detected"
            start_command = "sh start.sh"
            proposed_files = ["Dockerfile", "start.sh"]

        if state["attempt"] > 0:
            repo_profile["target_port"] = target_port
            repo_profile["healthcheck_path"] = repo_profile.get("healthcheck_path", "/")

        return {
            "framework": framework,
            "base_image": base_image,
            "install_command": install_command,
            "start_command": start_command,
            "target_port": target_port,
            "healthcheck_path": repo_profile.get("healthcheck_path"),
            "proposed_files": proposed_files,
        }

    def review_findings(self, build_plan: dict[str, Any]) -> list[ReviewFinding]:
        findings = []
        if not build_plan.get("healthcheck_path"):
            findings.append(
                ReviewFinding(
                    title="Missing healthcheck path",
                    severity="MEDIUM",
                    detail="The build plan does not declare a healthcheck path.",
                    suggestion="Add a stable healthcheck path such as '/'.",
                )
            )
        if build_plan["framework"] == "generic":
            findings.append(
                ReviewFinding(
                    title="Unknown framework",
                    severity="HIGH",
                    detail="The repository profile does not identify a supported runtime.",
                    suggestion="Collect dependency files or route to fallback generation.",
                )
            )
        return findings

    def security_findings(self, state: AgentState, build_plan: dict[str, Any]) -> list[ReviewFinding]:
        vulnerabilities = []
        command_blob = " ".join(
            str(build_plan.get(key, "")) for key in ("install_command", "start_command", "base_image")
        ).lower()
        if "curl | sh" in command_blob or "chmod 777" in command_blob:
            vulnerabilities.append(
                ReviewFinding(
                    title="Unsafe shell pattern",
                    severity="CRITICAL",
                    detail="The build plan contains an unsafe shell execution pattern.",
                    suggestion="Remove pipe-to-shell or broad file permissions.",
                )
            )
        if state["repo_profile"].get("contains_secrets"):
            vulnerabilities.append(
                ReviewFinding(
                    title="Secrets detected",
                    severity="CRITICAL",
                    detail="Repository profile indicates committed secrets.",
                    suggestion="Block deployment until secrets are removed and rotated.",
                )
            )
        return vulnerabilities

