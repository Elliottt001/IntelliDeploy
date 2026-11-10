from __future__ import annotations

import inspect
from datetime import datetime, timezone

from sqlalchemy import select

from app.apps.models import Instance
from app.core.types import InstanceSnapshot, ResourceWindow
from app.database import SessionLocal
from app.runtime.models import ResourceObservation


async def _await(value):
    return await value if inspect.isawaitable(value) else value


async def _observe(instance_id, observed_at, session_factory, adapter):
    with session_factory() as session:
        instance = session.get(Instance, instance_id)
        if instance is None:
            raise LookupError("instance not found")
    value = await _await(adapter.observe(instance))
    state = str(value.get("state") or "UNKNOWN").upper()
    compute_state = str(value.get("compute_state") or "UNKNOWN").upper()
    resource_spec = value.get("resource_spec") or instance.resource_spec or {}
    storage_mb = int(value.get("storage_mb") or resource_spec.get("storage_mb") or 0)
    evidence = str(value.get("evidence") or "target observation")[:2000]
    with session_factory() as session:
        current = session.scalar(select(Instance).where(Instance.id == instance_id).with_for_update())
        existing = session.scalar(
            select(ResourceObservation).where(
                ResourceObservation.instance_id == instance_id,
                ResourceObservation.observed_at == observed_at,
            )
        )
        observation = existing or ResourceObservation(
            instance_id=current.id,
            target_id=current.target_id,
            observed_at=observed_at,
            state=state,
            compute_state=compute_state,
            resource_spec=resource_spec,
            storage_mb=storage_mb,
            evidence=evidence,
        )
        if existing is None:
            session.add(observation)
        if state in {"PENDING", "RUNNING", "STOPPED", "FAILED", "DELETED"}:
            current.status = state
            current.observed_at = observed_at
            if state == "FAILED" and current.stop_reason is None:
                current.stop_reason = "ERROR"
        session.commit()
        return observation, current


async def reconcile_instance(
    instance_id: str,
    *,
    session_factory=SessionLocal,
    adapter,
) -> InstanceSnapshot:
    observed_at = datetime.now(timezone.utc)
    _, instance = await _observe(instance_id, observed_at, session_factory, adapter)
    return InstanceSnapshot(
        id=instance.id,
        status=instance.status,
        desired_state=instance.desired_state,
        stop_reason=instance.stop_reason,
        url=instance.url,
        observed_at=instance.observed_at,
        active_operation_id=None,
    )


async def collect_resource_window(
    instance_id: str,
    window_start: datetime,
    window_end: datetime,
    *,
    session_factory=SessionLocal,
    adapter,
) -> ResourceWindow:
    if window_start.tzinfo is None or window_end.tzinfo is None or window_end <= window_start:
        raise ValueError("resource window must be timezone-aware and increasing")
    observation, instance = await _observe(
        instance_id, window_end, session_factory, adapter
    )
    seconds = max(1, int((window_end - window_start).total_seconds()))
    services = observation.resource_spec.get("services") or []
    allocated = sum(
        int(service.get("cpu_millis") or 0) + int(service.get("memory_mb") or 0)
        for service in services
    )
    compute_units = allocated * seconds if observation.compute_state == "RUNNING" else 0
    if observation.compute_state == "UNKNOWN":
        compute_units = None
    storage_units = observation.storage_mb * seconds
    return ResourceWindow(
        instance_id=instance.id,
        window_start=window_start,
        window_end=window_end,
        compute_state=observation.compute_state,
        compute_units=compute_units,
        storage_units=storage_units,
        price_version=instance.price_version,
        evidence_ref=observation.id,
    )

