from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fallback.classifier.classify import classify_fallback_request
from fallback.schemas.plan import FallbackPlan
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.schemas.validation import ValidationResult
from fallback.schemas.workspace import DeployArtifact, MaterializeResult
from fallback.solvers.router import solve_by_decision
from fallback.validators.validation_pipeline import validate_fallback_plan

from .artifact_builder import ArtifactBuilder
from .config import FallbackConfig, get_config
from .logger import get_fallback_logger
from .workspace_manager import WorkspaceManager


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class FallbackService:
    def __init__(self, *, config: FallbackConfig | None = None) -> None:
        self.config = config or get_config()
        self.logger = get_fallback_logger()
        self.workspace_manager = WorkspaceManager(config=self.config)
        self.artifact_builder = ArtifactBuilder(config=self.config)

    def evaluate(self, payload: FallbackRequest | dict[str, Any]) -> ClassifyResponse:
        request = payload if isinstance(payload, FallbackRequest) else FallbackRequest.model_validate(payload)
        result = classify_fallback_request(request)
        self.logger.info(
            "evaluate request_id=%s decision=%s score=%s repo=%s",
            request.request_id,
            result.evaluation_result.decision,
            result.evaluation_result.evaluation_score,
            result.repo_fact_summary.repo_url,
        )
        return result

    def solve_plan(
        self,
        payload: FallbackRequest | dict[str, Any],
        *,
        classify_response: ClassifyResponse | None = None,
    ) -> FallbackPlan:
        request = payload if isinstance(payload, FallbackRequest) else FallbackRequest.model_validate(payload)
        classify_response = classify_response or self.evaluate(request)
        plan = solve_by_decision(request, classify_response)
        plan.request_id = request.request_id
        plan.project_id = request.project_id
        plan.deployment_id = request.deployment_id
        plan.source_repo_url = classify_response.repo_fact_summary.repo_url
        if not plan.task_id:
            plan.task_id = request.request_id or str(uuid4())
        return plan

    def solve(
        self,
        payload: FallbackRequest | dict[str, Any],
        *,
        classify_response: ClassifyResponse | None = None,
    ) -> FallbackPlan:
        return self.solve_plan(payload, classify_response=classify_response)

    def materialize(
        self,
        payload: FallbackRequest | dict[str, Any],
        *,
        plan: FallbackPlan,
        classify_response: ClassifyResponse,
    ) -> MaterializeResult | None:
        request = payload if isinstance(payload, FallbackRequest) else FallbackRequest.model_validate(payload)
        if plan.decision == "D":
            return None
        if not plan.task_id:
            plan.task_id = request.request_id or str(uuid4())
        result = self.workspace_manager.materialize(
            task_id=plan.task_id,
            request=request,
            plan=plan,
            classify_response=classify_response,
        )
        return result

    def validate(
        self,
        plan: FallbackPlan,
        *,
        materialize_result: MaterializeResult | None = None,
        classify_response: ClassifyResponse | None = None,
    ) -> ValidationResult:
        validation_result = validate_fallback_plan(
            plan,
            workspace_context=materialize_result.workspace_context if materialize_result else None,
            classify_response=classify_response,
        )
        if materialize_result is not None:
            workspace_context = materialize_result.workspace_context
            workspace_context.status = "VALIDATED"
            workspace_context.timestamps.validated_at = _now_iso()
            workspace_context.timestamps.updated_at = workspace_context.timestamps.validated_at
            self.workspace_manager.write_metadata(workspace_context)
        return validation_result

    def package(
        self,
        *,
        plan: FallbackPlan,
        materialize_result: MaterializeResult | None,
        validation_result: ValidationResult,
    ) -> DeployArtifact | None:
        if plan.decision == "D" or materialize_result is None:
            return None
        artifact = self.artifact_builder.package(
            workspace_context=materialize_result.workspace_context,
            validation_result=validation_result,
            plan=plan,
        )
        plan.artifact_path = str(artifact.artifact_path)
        return artifact

    def persist_artifact(self, plan: FallbackPlan, *, task_id: str | None = None) -> str | None:
        if plan.artifact_path:
            return plan.artifact_path
        return None

    def run_pipeline(self, payload: FallbackRequest | dict[str, Any]) -> dict[str, Any]:
        request = payload if isinstance(payload, FallbackRequest) else FallbackRequest.model_validate(payload)
        classify_response = self.evaluate(request)
        plan = self.solve_plan(request, classify_response=classify_response)
        materialize_result = self.materialize(request, plan=plan, classify_response=classify_response)
        validation = self.validate(
            plan,
            materialize_result=materialize_result,
            classify_response=classify_response,
        )
        artifact = self.package(
            plan=plan,
            materialize_result=materialize_result,
            validation_result=validation,
        )

        if validation.final_status == "FAIL":
            plan.deploy_ready = False
            plan.next_action = "MANUAL_REVIEW"
            if not plan.summary:
                plan.summary = "Fallback plan generated, but validation did not pass."
        elif validation.final_status == "WARN" and plan.next_action == "DEPLOY":
            plan.next_action = "MANUAL_REVIEW"

        return {
            "classification": classify_response,
            "plan": plan,
            "materialize_result": materialize_result,
            "validation": validation,
            "artifact": artifact,
        }

    def run(self, payload: FallbackRequest | dict[str, Any]) -> dict[str, Any]:
        return self.run_pipeline(payload)

