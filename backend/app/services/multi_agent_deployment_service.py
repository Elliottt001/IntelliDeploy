from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.intellideploy.deployment_event import DeploymentEvent
from app.schemas.fallback import (
    Constraints,
    PackageManager,
    PreferredStack,
    RepoProfile,
    StartFallbackTaskRequest,
    StartFallbackTaskResponse,
)
from app.services.generation_task_service import GenerationTaskService
from app.services.websocket_manager import get_ws_manager
from src.agents.multi_agent_graph import build_multi_agent_graph


class MultiAgentConsensusRejected(RuntimeError):
    def __init__(self, consensus_result: dict[str, Any], graph_state: dict[str, Any]):
        self.consensus_result = consensus_result
        self.graph_state = graph_state
        super().__init__(consensus_result.get("rationale") or "Multi-agent consensus rejected deployment.")


class MultiAgentDeploymentService:
    """Runs Builder/Reviewer/Security consensus before generation tasks enter deployment flow."""

    def __init__(self, db: Session, graph=None):
        self.db = db
        self.graph = graph or build_multi_agent_graph()
        self.generation_service = GenerationTaskService(db)

    async def start_generation_with_consensus(
        self,
        request: StartFallbackTaskRequest,
    ) -> StartFallbackTaskResponse:
        await self._broadcast_stage(
            request.deployment_id,
            "Thinking",
            "running",
            "Multi-Agent 正在分析需求和仓库上下文",
            0.08,
        )
        graph_state = self.run_consensus(request)
        await self._broadcast_graph_stages(request, graph_state)
        consensus = graph_state.get("consensus_result") or {}
        final_decision = consensus.get("final_decision")

        self._record_consensus_event(request, graph_state)
        if final_decision == "REJECT" or graph_state.get("final_status") == "FAILED":
            await self._broadcast_stage(
                request.deployment_id,
                "Finalize",
                "failed",
                consensus.get("rationale") or "Multi-Agent 共识拒绝部署",
                1.0,
                {"consensus": consensus},
            )
            self._record_event(
                int(request.deployment_id),
                "agent",
                "error",
                consensus.get("rationale") or "Multi-agent consensus rejected deployment.",
                "MULTI_AGENT_REJECTED",
            )
            raise MultiAgentConsensusRejected(consensus, graph_state)

        governed_request = self._apply_graph_result_to_request(request, graph_state)
        await self._broadcast_stage(
            request.deployment_id,
            "Generating",
            "running",
            "共识通过,正在启动生成任务",
            0.42,
            {"consensus": consensus},
        )
        return await self.generation_service.start_fallback_task(governed_request)

    def run_consensus(self, request: StartFallbackTaskRequest) -> dict[str, Any]:
        init_state = self._initial_state(request)
        return self.graph.invoke(init_state)

    def _initial_state(self, request: StartFallbackTaskRequest) -> dict[str, Any]:
        repo_profile = self._repo_profile_payload(request)
        constraints = request.constraints.model_dump(exclude_none=True) if request.constraints else {}
        if "target_port" in constraints:
            repo_profile["target_port"] = constraints["target_port"]
        if request.preferred_stack:
            repo_profile["preferred_stack"] = request.preferred_stack.model_dump(exclude_none=True)

        return {
            "flow_id": request.request_id or f"generation-{request.project_id}-{uuid4()}",
            "user_intent": request.original_prompt,
            "repo_profile": repo_profile,
            "stage": "Thinking",
            "attempt": 0,
            "max_attempts": 2,
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

    def _repo_profile_payload(self, request: StartFallbackTaskRequest) -> dict[str, Any]:
        payload = request.repo_profile.model_dump(exclude_none=True) if request.repo_profile else {}
        if request.preferred_stack:
            preferred_stack = request.preferred_stack
            framework = preferred_stack.frontend or preferred_stack.backend or preferred_stack.runtime
            if framework and not payload.get("framework"):
                payload["framework"] = framework
            frameworks = list(payload.get("detected_frameworks") or [])
            if framework and framework not in frameworks:
                frameworks.append(framework)
                payload["detected_frameworks"] = frameworks
        return payload

    def _apply_graph_result_to_request(
        self,
        request: StartFallbackTaskRequest,
        graph_state: dict[str, Any],
    ) -> StartFallbackTaskRequest:
        payload = request.model_dump(mode="python")
        builder_output = (
            graph_state.get("builder_result", {})
            .get("action", {})
            .get("output", {})
        )
        repo_profile_payload = deepcopy(payload.get("repo_profile") or {})
        graph_repo_profile = deepcopy(graph_state.get("repo_profile") or {})

        if builder_output:
            repo_profile_payload["agent_build_plan"] = builder_output
            repo_profile_payload["agent_consensus"] = graph_state.get("consensus_result", {})
            repo_profile_payload["agent_trace"] = graph_state.get("trace", [])
            repo_profile_payload["agent_proposed_files"] = builder_output.get("proposed_files", [])
            repo_profile_payload["healthcheck_path"] = builder_output.get("healthcheck_path") or graph_repo_profile.get("healthcheck_path")
            if builder_output.get("framework"):
                frameworks = list(repo_profile_payload.get("detected_frameworks") or [])
                if builder_output["framework"] not in frameworks:
                    frameworks.append(builder_output["framework"])
                repo_profile_payload["detected_frameworks"] = frameworks
            if builder_output.get("target_port"):
                constraints_payload = deepcopy(payload.get("constraints") or {})
                constraints_payload["target_port"] = builder_output["target_port"]
                payload["constraints"] = constraints_payload
        else:
            repo_profile_payload["agent_consensus"] = graph_state.get("consensus_result", {})
            repo_profile_payload["agent_trace"] = graph_state.get("trace", [])

        repo_profile_payload.update(
            {
                key: value
                for key, value in graph_repo_profile.items()
                if key in {"healthcheck_path", "target_port"} and value is not None
            }
        )

        payload["repo_profile"] = self._normalize_repo_profile(repo_profile_payload).model_dump()
        payload["constraints"] = self._normalize_constraints(payload.get("constraints")).model_dump()
        payload["preferred_stack"] = self._normalize_preferred_stack(payload.get("preferred_stack")).model_dump()
        return StartFallbackTaskRequest.model_validate(payload)

    @staticmethod
    def _normalize_repo_profile(payload: dict[str, Any]) -> RepoProfile:
        allowed = set(RepoProfile.model_fields)
        normalized = {key: value for key, value in payload.items() if key in allowed}
        if "package_manager" in normalized and normalized["package_manager"] is not None:
            try:
                normalized["package_manager"] = PackageManager(normalized["package_manager"])
            except ValueError:
                normalized.pop("package_manager", None)
        return RepoProfile.model_validate(normalized)

    @staticmethod
    def _normalize_constraints(payload: dict[str, Any] | None) -> Constraints:
        allowed = set(Constraints.model_fields)
        return Constraints.model_validate({key: value for key, value in (payload or {}).items() if key in allowed})

    @staticmethod
    def _normalize_preferred_stack(payload: dict[str, Any] | None) -> PreferredStack:
        allowed = set(PreferredStack.model_fields)
        return PreferredStack.model_validate({key: value for key, value in (payload or {}).items() if key in allowed})

    def _record_consensus_event(self, request: StartFallbackTaskRequest, graph_state: dict[str, Any]) -> None:
        consensus = graph_state.get("consensus_result") or {}
        self._record_event(
            int(request.deployment_id),
            "agent",
            "info" if consensus.get("final_decision") == "APPROVE" else "warning",
            (
                "Multi-agent consensus "
                f"{consensus.get('final_decision', 'UNKNOWN')}: "
                f"{consensus.get('rationale', '')}"
            ),
            None,
        )

    def _record_event(
        self,
        deployment_id: int,
        phase: str,
        level: str,
        message: str,
        error_type: str | None,
    ) -> None:
        event = DeploymentEvent(
            deployment_id=deployment_id,
            phase=phase,
            level=level,
            message=message,
            error_type=error_type,
        )
        self.db.add(event)
        self.db.commit()

    async def _broadcast_graph_stages(
        self,
        request: StartFallbackTaskRequest,
        graph_state: dict[str, Any],
    ) -> None:
        consensus = graph_state.get("consensus_result") or {}
        builder_result = graph_state.get("builder_result") or {}
        reviewer_decision = graph_state.get("reviewer_decision") or "UNKNOWN"
        security_decision = graph_state.get("security_decision") or "UNKNOWN"

        await self._broadcast_stage(
            request.deployment_id,
            "Thinking",
            "success",
            "需求和仓库上下文分析完成",
            0.18,
        )
        if builder_result:
            await self._broadcast_stage(
                request.deployment_id,
                "Building",
                "success",
                "Builder Agent 已生成部署方案",
                0.28,
                {"builder_result": builder_result},
            )
        await self._broadcast_stage(
            request.deployment_id,
            "Reviewing",
            "success" if reviewer_decision in {"APPROVE", "PASS", "UNKNOWN"} else "failed",
            f"Reviewer Agent 决策: {reviewer_decision}",
            0.33,
            {"decision": reviewer_decision, "feedback": graph_state.get("reviewer_feedback")},
        )
        await self._broadcast_stage(
            request.deployment_id,
            "SecurityCheck",
            "success" if security_decision in {"APPROVE", "PASS", "UNKNOWN"} else "failed",
            f"Security Agent 决策: {security_decision}",
            0.38,
            {"decision": security_decision, "feedback": graph_state.get("security_feedback")},
        )
        await self._broadcast_stage(
            request.deployment_id,
            "Consensus",
            "success" if consensus.get("final_decision") == "APPROVE" else "failed",
            consensus.get("rationale") or "Multi-Agent 共识已完成",
            0.4,
            {"consensus": consensus},
        )

    async def _broadcast_stage(
        self,
        deployment_id: str,
        stage: str,
        status: str,
        message: str,
        progress: float,
        data: dict[str, Any] | None = None,
    ) -> None:
        await get_ws_manager().broadcast_pipeline_stage(
            str(deployment_id),
            stage,
            status=status,
            message=message,
            progress=progress,
            data=data,
        )
