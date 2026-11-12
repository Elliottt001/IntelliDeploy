from __future__ import annotations

import asyncio

from app.agent.contracts import OrchestrationDecision
from app.agent.policy import decide_orchestration
from app.agent.contracts import RepositoryProfile
from app.core.types import Requirement, RoutePlan


class AlgorithmOrchestrator:
    def __init__(self, execution, hybrid_selector=None):
        self.execution = execution
        self.hybrid_selector = hybrid_selector or getattr(
            execution, "select_sources_hybrid", None
        )

    async def select_sources(self, requirement: Requirement) -> RoutePlan:
        checkpoint = self.execution.algorithm_checkpoint()
        if checkpoint.mode == "baseline":
            route = await self.execution.select_sources_baseline(requirement)
            checkpoint = self.execution.algorithm_checkpoint()
            checkpoint.route = route
            checkpoint.selected_sources = list(route.sources)
            self.execution.save_algorithm_checkpoint(checkpoint)
            return route
        if checkpoint.mode == "hybrid":
            if self.hybrid_selector is None:
                raise ValueError("hybrid selection port is not configured")
            route = await self.hybrid_selector(requirement)
            checkpoint = self.execution.algorithm_checkpoint()
            checkpoint.route = route
            checkpoint.selected_sources = list(route.sources)
            self.execution.save_algorithm_checkpoint(checkpoint)
            return route

        baseline = await self.execution.select_sources_baseline(requirement)
        if self.hybrid_selector is None:
            raise ValueError("hybrid selection port is not configured")
        try:
            hybrid = await self.hybrid_selector(requirement)
        except Exception:
            checkpoint = self.execution.algorithm_checkpoint()
            checkpoint.route = baseline
            checkpoint.selected_sources = list(baseline.sources)
            self.execution.save_algorithm_checkpoint(checkpoint)
            return baseline
        checkpoint = self.execution.algorithm_checkpoint()
        checkpoint.route = baseline
        checkpoint.shadow_route = hybrid
        checkpoint.selected_sources = list(baseline.sources)
        self.execution.save_algorithm_checkpoint(checkpoint)
        return baseline

    def decide_orchestration(
        self,
        requirement: Requirement,
        route: RoutePlan,
        profiles: list[RepositoryProfile],
        prior_failures: list[object],
    ):
        decision = decide_orchestration(
            requirement, route, profiles, prior_failures
        )
        checkpoint = self.execution.algorithm_checkpoint()
        checkpoint.orchestration = decision
        self.execution.save_algorithm_checkpoint(checkpoint)
        return decision

    async def review_candidate(
        self,
        attempt_id,
        draft,
        requirement,
        route,
        profile,
        policy: OrchestrationDecision,
        *,
        model=None,
        security_model=None,
    ):
        from app.agent.review import review_deterministic, review_with_model
        from app.agent.security import scan_security, security_review_with_model

        deterministic = review_deterministic(
            attempt_id, draft, requirement, route
        )
        security_rules = scan_security(
            attempt_id, draft, profile, policy
        )
        reports = [deterministic, security_rules]
        calls = []
        if policy.require_llm_review:
            if model is None:
                raise ValueError("LLM review policy requires a durable model")
            calls.append(
                review_with_model(
                    attempt_id, draft, requirement, route, model
                )
            )
        if policy.require_security_llm:
            selected_model = security_model or model
            if selected_model is None:
                raise ValueError("security review policy requires a durable model")
            calls.append(
                security_review_with_model(
                    attempt_id,
                    draft,
                    profile,
                    security_rules,
                    selected_model,
                )
            )
        if calls:
            reports.extend(await asyncio.gather(*calls))
        return reports

    def choose_healing(
        self, failure, policy, *, remaining_budget, runner_capacity
    ):
        from app.agent.healing import choose_healing

        decision = choose_healing(
            failure, policy, remaining_budget, runner_capacity
        )
        checkpoint = self.execution.algorithm_checkpoint()
        checkpoint.healing.append(decision)
        self.execution.save_algorithm_checkpoint(checkpoint)
        return decision
