from __future__ import annotations

import inspect
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlsplit

from app.core.types import AppManifest, CandidateRuntime, Requirement
from app.runtime.manifest import manifest_hash


class CandidateRuntimeUnavailable(RuntimeError):
    pass


class CandidateRunner(Protocol):
    async def start(self, **kwargs) -> dict: ...
    async def restart_service(self, runtime_id: str, service: str) -> None: ...
    async def stop(self, runtime_id: str, preserve_evidence: bool) -> None: ...


@dataclass
class _RuntimeRegistration:
    runner: CandidateRunner
    services: frozenset[str]


_runtimes: dict[str, _RuntimeRegistration] = {}
_default_runner: CandidateRunner | None = None


async def _await(value):
    return await value if inspect.isawaitable(value) else value


def configure_candidate_runner(runner: CandidateRunner | None) -> None:
    global _default_runner
    _default_runner = runner


class RuntimeController:
    def __init__(self, runtime_id: str, registration: _RuntimeRegistration):
        self.runtime_id = runtime_id
        self._registration = registration

    async def restart_service(self, name: str) -> None:
        if name not in self._registration.services:
            raise ValueError("service is not part of the candidate manifest")
        await _await(self._registration.runner.restart_service(self.runtime_id, name))


async def start_candidate(
    job_id: str,
    attempt_id: str,
    manifest: AppManifest,
    requirement: Requirement,
    *,
    runner: CandidateRunner | None = None,
) -> CandidateRuntime:
    selected = runner or _default_runner
    if selected is None:
        raise CandidateRuntimeUnavailable("candidate runner is not configured")
    raw = await _await(
        selected.start(
            job_id=job_id,
            attempt_id=attempt_id,
            manifest=manifest.model_dump(mode="json"),
            requirement=requirement.model_dump(mode="json"),
            isolated_network=True,
            empty_data=True,
            health_timeout_seconds=180,
        )
    )
    if not isinstance(raw, dict):
        raise CandidateRuntimeUnavailable("candidate runner returned an invalid response")
    runtime = CandidateRuntime(
        id=str(raw.get("id") or attempt_id),
        base_url=str(raw.get("base_url") or ""),
        manifest_hash=manifest_hash(manifest),
        data_namespace=str(raw.get("data_namespace") or ""),
        identity_refs=dict(raw.get("identity_refs") or {}),
    )
    parsed = urlsplit(runtime.base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise CandidateRuntimeUnavailable("candidate runner returned an invalid URL")
    if not runtime.data_namespace or not {"owner", "other"} <= set(runtime.identity_refs):
        raise CandidateRuntimeUnavailable("candidate runner did not isolate data and test identities")
    if runtime.id in _runtimes:
        raise CandidateRuntimeUnavailable("candidate runtime ID is already active")
    _runtimes[runtime.id] = _RuntimeRegistration(
        runner=selected,
        services=frozenset(service.name for service in manifest.services),
    )
    return runtime


def candidate_controller(runtime_id: str) -> RuntimeController:
    registration = _runtimes.get(runtime_id)
    if registration is None:
        raise CandidateRuntimeUnavailable("candidate runtime is not active")
    return RuntimeController(runtime_id, registration)


async def stop_candidate(runtime_id: str, preserve_evidence: bool = True) -> None:
    registration = _runtimes.get(runtime_id)
    if registration is None:
        return
    await _await(registration.runner.stop(runtime_id, preserve_evidence))
    _runtimes.pop(runtime_id, None)

