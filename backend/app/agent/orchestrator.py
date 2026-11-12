from __future__ import annotations

from app.core.types import Requirement, RoutePlan


class AlgorithmOrchestrator:
    def __init__(self, execution):
        self.execution = execution

    async def select_sources(self, requirement: Requirement) -> RoutePlan:
        return await self.execution.select_sources_baseline(requirement)
