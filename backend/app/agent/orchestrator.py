from __future__ import annotations

from app.agent.policy import decide_orchestration
from app.agent.contracts import RepositoryProfile
from app.core.types import Requirement, RoutePlan


class AlgorithmOrchestrator:
    def __init__(self, execution, hybrid_selector=None):
        self.execution = execution
        self.hybrid_selector = hybrid_selector or execution.select_sources_hybrid

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
            route = await self.hybrid_selector(requirement)
            checkpoint = self.execution.algorithm_checkpoint()
            checkpoint.route = route
            checkpoint.selected_sources = list(route.sources)
            self.execution.save_algorithm_checkpoint(checkpoint)
            return route

        baseline = await self.execution.select_sources_baseline(requirement)
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
