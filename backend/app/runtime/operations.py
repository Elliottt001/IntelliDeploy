from __future__ import annotations

import asyncio
import hashlib
import inspect
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import and_, or_, select

from app.apps.models import Instance, InstanceOperation
from app.billing.ledger import InsufficientQuota, balance, settle
from app.billing.models import Reservation, ResourceMeterWindow
from app.capabilities.models import InstanceCredential, InstanceDataSpace
from app.jobs.models import ACTIVE_STATUSES, Job
from app.runtime.models import DeploymentTarget


class OperationConflict(RuntimeError):
    pass


class DatabaseTargetAdapter:
    def __init__(self, session_factory, *, linux=None, kubernetes=None):
        self.session_factory = session_factory
        self.linux = linux
        self.kubernetes = kubernetes

    def _adapter(self, instance):
        with self.session_factory() as session:
            target = session.get(DeploymentTarget, instance.target_id)
            kind = target.kind if target is not None else None
        if kind == "LINUX":
            if self.linux is None:
                from app.runtime.linux import LinuxInstanceAdapter

                self.linux = LinuxInstanceAdapter()
            return self.linux
        if kind in {"KUBERNETES", "SEALOS"}:
            if self.kubernetes is None:
                from app.runtime.kubernetes import KubernetesInstanceAdapter

                self.kubernetes = KubernetesInstanceAdapter()
            return self.kubernetes
        raise OperationConflict("deployment target kind is unsupported")

    async def start(self, instance):
        return await _await(self._adapter(instance).start(instance))

    async def stop(self, instance):
        return await _await(self._adapter(instance).stop(instance))

    async def delete(self, instance, *, delete_data: bool):
        return await _await(
            self._adapter(instance).delete(instance, delete_data=delete_data)
        )

    async def observe(self, instance):
        return await _await(self._adapter(instance).observe(instance))


def _payload_hash(kind: str, delete_data: bool) -> str:
    return hashlib.sha256(
        json.dumps(
            {"kind": kind, "delete_data": bool(delete_data)},
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()


def _owned_instance(session, instance_id: str, owner_id: int) -> Instance:
    instance = session.scalar(
        select(Instance)
        .where(Instance.id == instance_id, Instance.owner_id == owner_id)
        .with_for_update()
    )
    if instance is None:
        raise LookupError("instance not found")
    return instance


def _enqueue_instance_operation(
    session,
    instance_id: str,
    owner_id: int,
    kind: str,
    operation_id: str,
    delete_data: bool = False,
) -> InstanceOperation:
    kind = kind.upper()
    if kind not in {"START", "STOP", "DELETE"}:
        raise ValueError("instance operation kind is invalid")
    if not isinstance(operation_id, str) or not operation_id.strip() or len(operation_id) > 200:
        raise ValueError("operation ID is required")
    instance = _owned_instance(session, instance_id, owner_id)
    payload_hash = _payload_hash(kind, delete_data)
    existing = session.scalar(
        select(InstanceOperation).where(
            InstanceOperation.owner_id == owner_id,
            InstanceOperation.instance_id == instance_id,
            InstanceOperation.kind == kind,
            InstanceOperation.operation_id == operation_id,
        )
    )
    if existing is not None:
        if existing.payload_hash != payload_hash:
            raise OperationConflict("idempotency key was reused with different payload")
        return existing
    active_job = session.scalar(
        select(Job.id).where(Job.app_id == instance.app_id, Job.status.in_(ACTIVE_STATUSES))
    )
    if active_job is not None:
        raise OperationConflict("active delivery blocks instance operations")
    active_operation = session.scalar(
        select(InstanceOperation.id).where(
            InstanceOperation.instance_id == instance.id,
            InstanceOperation.status.in_(("QUEUED", "RUNNING")),
        )
    )
    if active_operation is not None:
        raise OperationConflict("another instance operation is active")
    if kind == "START":
        if instance.status == "DELETED" or instance.desired_state == "DELETED":
            raise OperationConflict("deleted instance cannot be started")
        if instance.version_id is None or not instance.url:
            raise OperationConflict("instance has no published release")
        target = session.get(DeploymentTarget, instance.target_id)
        if target is None or not target.enabled or target.health != "HEALTHY":
            raise OperationConflict("deployment target is unavailable")
        capacity = target.capacity or {}
        services = (instance.resource_spec or {}).get("services") or []
        required_memory = sum(int(item.get("memory_mb") or 0) for item in services)
        required_cpu = sum(int(item.get("cpu_millis") or 0) for item in services)
        required_storage = int((instance.resource_spec or {}).get("storage_mb") or 0)
        if (
            required_memory > int(capacity.get("memory_mb", 0))
            or required_cpu > int(capacity.get("cpu_millis", 0))
            or required_storage > int(capacity.get("storage_mb", 0))
        ):
            raise OperationConflict("deployment target capacity is insufficient")
        if balance(session, owner_id)["available_units"] <= 0:
            raise OperationConflict("runtime quota is insufficient")
    terminal = (
        (kind == "START" and instance.status == "RUNNING")
        or (kind == "STOP" and instance.status == "STOPPED")
        or (kind == "DELETE" and instance.status == "DELETED")
    )
    desired = {"START": "RUNNING", "STOP": "STOPPED", "DELETE": "DELETED"}[kind]
    instance.desired_state = desired
    instance.state_version += 1
    if kind == "STOP":
        instance.stop_reason = instance.stop_reason or "USER"
    elif kind == "START":
        instance.stop_reason = None
    operation = InstanceOperation(
        instance_id=instance.id,
        owner_id=owner_id,
        kind=kind,
        operation_id=operation_id,
        payload_hash=payload_hash,
        delete_data=bool(delete_data),
        status="SUCCEEDED" if terminal else "QUEUED",
    )
    session.add(operation)
    session.flush()
    return operation


def request_instance_operation(
    session,
    instance_id: str,
    owner_id: int,
    kind: str,
    operation_id: str,
    delete_data: bool = False,
) -> InstanceOperation:
    kind = kind.upper()
    try:
        with session.begin_nested():
            operation = _enqueue_instance_operation(
                session,
                instance_id,
                owner_id,
                kind,
                operation_id,
                delete_data,
            )
            if (
                kind == "START"
                and operation.status == "QUEUED"
                and operation.reservation_operation_id is None
            ):
                from app.billing.metering import reserve_start_window

                reservation = reserve_start_window(session, session.get(Instance, instance_id))
                operation.reservation_operation_id = reservation.operation_id
    except InsufficientQuota as exc:
        raise OperationConflict("runtime quota is insufficient") from exc
    session.commit()
    session.refresh(operation)
    return operation


async def _await(value):
    return await value if inspect.isawaitable(value) else value


def _claim_operation(session_factory, worker_id: str, lease_seconds: int = 60):
    with session_factory() as session:
        operation = session.scalar(
            select(InstanceOperation)
            .where(
                or_(
                    InstanceOperation.status == "QUEUED",
                    and_(
                        InstanceOperation.status == "RUNNING",
                        InstanceOperation.lease_until < datetime.now(timezone.utc),
                    ),
                )
            )
            .order_by(InstanceOperation.created_at, InstanceOperation.id)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if operation is None:
            session.commit()
            return None
        recovered = operation.status == "RUNNING"
        operation.status = "RUNNING"
        operation.lease_owner = worker_id
        operation.lease_generation += 1
        operation.lease_until = datetime.now(timezone.utc) + timedelta(seconds=lease_seconds)
        instance = session.get(Instance, operation.instance_id)
        snapshot = {
            "operation_id": operation.id,
            "lease_generation": operation.lease_generation,
            "kind": operation.kind,
            "delete_data": operation.delete_data,
            "instance": instance,
            "recovered": recovered,
            "effect_started_at": operation.effect_started_at,
        }
        session.commit()
        return snapshot


def _mark_effect_started(session_factory, claimed) -> bool:
    with session_factory() as session:
        operation = session.scalar(
            select(InstanceOperation)
            .where(
                InstanceOperation.id == claimed["operation_id"],
                InstanceOperation.status == "RUNNING",
                InstanceOperation.lease_generation == claimed["lease_generation"],
            )
            .with_for_update()
        )
        if operation is None:
            return False
        operation.effect_started_at = operation.effect_started_at or datetime.now(timezone.utc)
        session.commit()
        claimed["effect_started_at"] = operation.effect_started_at
        return True


def _heartbeat_operation(session_factory, claimed, lease_seconds: int) -> bool:
    with session_factory() as session:
        operation = session.scalar(
            select(InstanceOperation)
            .where(
                InstanceOperation.id == claimed["operation_id"],
                InstanceOperation.status == "RUNNING",
                InstanceOperation.lease_generation == claimed["lease_generation"],
            )
            .with_for_update()
        )
        if operation is None:
            return False
        operation.lease_until = datetime.now(timezone.utc) + timedelta(seconds=lease_seconds)
        session.commit()
        return True


def _defer_reconciliation(session_factory, claimed, lease_seconds: int) -> None:
    with session_factory() as session:
        operation = session.scalar(
            select(InstanceOperation)
            .where(
                InstanceOperation.id == claimed["operation_id"],
                InstanceOperation.status == "RUNNING",
                InstanceOperation.lease_generation == claimed["lease_generation"],
            )
            .with_for_update()
        )
        if operation is None:
            return
        operation.lease_until = datetime.now(timezone.utc) + timedelta(seconds=lease_seconds)
        session.commit()


def _release_runtime_reservation(session, operation: InstanceOperation) -> None:
    if not operation.reservation_operation_id:
        return
    reservation = session.scalar(
        select(Reservation).where(
            Reservation.operation_id == operation.reservation_operation_id
        )
    )
    if reservation is not None and reservation.status == "OPEN":
        settle(session, reservation.operation_id)
    reserved_window = session.scalar(
        select(ResourceMeterWindow).where(
            ResourceMeterWindow.reservation_operation_id
            == operation.reservation_operation_id,
            ResourceMeterWindow.status == "RESERVED",
        )
    )
    if reserved_window is not None:
        session.delete(reserved_window)


def _finish_operation(session_factory, claimed, observation=None, error: Exception | None = None):
    with session_factory() as session:
        operation = session.scalar(
            select(InstanceOperation)
            .where(
                InstanceOperation.id == claimed["operation_id"],
                InstanceOperation.status == "RUNNING",
                InstanceOperation.lease_generation == claimed["lease_generation"],
            )
            .with_for_update()
        )
        if operation is None:
            return
        instance = session.scalar(
            select(Instance).where(Instance.id == operation.instance_id).with_for_update()
        )
        if error is not None:
            operation.status = "FAILED"
            operation.error = {
                "code": "INSTANCE_OPERATION_FAILED",
                "message": str(error)[:500],
                "retryable": True,
            }
            instance.status = "FAILED"
            instance.stop_reason = "ERROR"
            _release_runtime_reservation(session, operation)
        else:
            state = str((observation or {}).get("state") or operation.kind).upper()
            expected = {"START": "RUNNING", "STOP": "STOPPED", "DELETE": "DELETED"}[
                operation.kind
            ]
            if state != expected:
                operation.status = "FAILED"
                operation.error = {
                    "code": "OBSERVED_STATE_MISMATCH",
                    "message": f"target reported {state}, expected {expected}",
                    "retryable": True,
                }
                instance.status = "FAILED"
                instance.stop_reason = "ERROR"
                _release_runtime_reservation(session, operation)
            else:
                operation.status = "SUCCEEDED"
                operation.error = None
                instance.status = expected
                instance.observed_at = datetime.now(timezone.utc)
                if operation.kind == "START":
                    instance.stop_reason = None
                elif operation.kind == "DELETE":
                    credential = session.get(InstanceCredential, instance.id)
                    if credential is not None and credential.revoked_at is None:
                        credential.revoked_at = datetime.now(timezone.utc)
                    data = session.get(InstanceDataSpace, instance.id)
                    if operation.delete_data and data is not None and data.destroyed_at is None:
                        data.destroyed_at = datetime.now(timezone.utc)
                        instance.data_namespace = None
                        instance.resource_spec = {
                            **(instance.resource_spec or {}),
                            "services": [],
                            "storage_mb": 0,
                        }
                    instance.url = None
                    instance.secret_ref = None
        operation.lease_owner = None
        operation.lease_until = None
        session.commit()


async def execute_instance_operations(
    *,
    session_factory,
    adapter,
    limit: int = 100,
    worker_id: str | None = None,
    lease_seconds: int = 60,
) -> int:
    worker_id = worker_id or f"instance-worker-{uuid4().hex}"
    processed = 0
    for _ in range(limit):
        claimed = _claim_operation(session_factory, worker_id, lease_seconds)
        if claimed is None:
            break
        instance = claimed["instance"]
        try:
            if claimed["recovered"]:
                observed = await _await(adapter.observe(instance))
                expected = {
                    "START": "RUNNING",
                    "STOP": "STOPPED",
                    "DELETE": "DELETED",
                }[claimed["kind"]]
                if str(observed.get("state") or "UNKNOWN").upper() == expected:
                    _finish_operation(session_factory, claimed, observation=observed)
                    processed += 1
                    continue
                if claimed["effect_started_at"] is not None:
                    _defer_reconciliation(session_factory, claimed, lease_seconds)
                    processed += 1
                    continue
            if not _mark_effect_started(session_factory, claimed):
                processed += 1
                continue

            stop_heartbeat = asyncio.Event()

            async def renew_operation_lease():
                while not stop_heartbeat.is_set():
                    try:
                        await asyncio.wait_for(
                            stop_heartbeat.wait(), timeout=max(0.1, lease_seconds / 3)
                        )
                    except TimeoutError:
                        renewed = await asyncio.to_thread(
                            _heartbeat_operation, session_factory, claimed, lease_seconds
                        )
                        if not renewed:
                            return

            renewal = asyncio.create_task(renew_operation_lease())
            if claimed["kind"] == "START":
                await _await(adapter.start(instance))
            elif claimed["kind"] == "STOP":
                await _await(adapter.stop(instance))
            else:
                await _await(adapter.delete(instance, delete_data=claimed["delete_data"]))
            observation = await _await(adapter.observe(instance))
            _finish_operation(session_factory, claimed, observation=observation)
        except Exception as exc:
            _finish_operation(session_factory, claimed, error=exc)
        finally:
            if "stop_heartbeat" in locals():
                stop_heartbeat.set()
                await asyncio.gather(renewal, return_exceptions=True)
                del stop_heartbeat, renewal
        processed += 1
    return processed

