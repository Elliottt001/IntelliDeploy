from __future__ import annotations

import asyncio
import inspect
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.apps.models import Instance
from app.billing.ledger import grant_period
from app.billing.metering import process_resource_window
from app.billing.models import ProductSku, Subscription
from app.config import settings
from app.database import SessionLocal
from app.jobs.models import MaintenanceLease
from app.models.user import User
from app.runtime.operations import DatabaseTargetAdapter, execute_instance_operations
from app.runtime.reconcile import reconcile_instance


TaskCallback = Callable[[datetime], Awaitable[list[str] | None] | list[str] | None]


@dataclass(frozen=True)
class MaintenanceTask:
    name: str
    interval: timedelta
    callback: TaskCallback
    retry_delay: timedelta = timedelta(seconds=30)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _acquire(
    session_factory,
    name: str,
    worker_id: str,
    now: datetime,
    lease_seconds: int,
    interval: timedelta = timedelta(0),
):
    with session_factory() as session:
        session.execute(
            insert(MaintenanceLease)
            .values(name=name, generation=0)
            .on_conflict_do_nothing(index_elements=[MaintenanceLease.name])
        )
        lease = session.scalar(
            select(MaintenanceLease).where(MaintenanceLease.name == name).with_for_update()
        )
        if lease.retry_after and lease.retry_after > now:
            session.commit()
            return None
        if interval > timedelta(0) and lease.last_success:
            if lease.last_success + interval > now:
                session.commit()
                return None
        if lease.owner not in {None, worker_id} and lease.lease_until and lease.lease_until > now:
            session.commit()
            return None
        lease.owner = worker_id
        lease.lease_until = now + timedelta(seconds=lease_seconds)
        lease.generation += 1
        generation = lease.generation
        session.commit()
        return generation


def _heartbeat(session_factory, name, worker_id, generation, lease_seconds):
    with session_factory() as session:
        lease = session.scalar(
            select(MaintenanceLease)
            .where(
                MaintenanceLease.name == name,
                MaintenanceLease.owner == worker_id,
                MaintenanceLease.generation == generation,
            )
            .with_for_update()
        )
        if lease is None:
            return False
        lease.lease_until = datetime.now(timezone.utc) + timedelta(seconds=lease_seconds)
        session.commit()
        return True


def _release(
    session_factory,
    name,
    worker_id,
    generation,
    now,
    errors,
    retry_delay=timedelta(seconds=30),
):
    with session_factory() as session:
        lease = session.scalar(
            select(MaintenanceLease)
            .where(
                MaintenanceLease.name == name,
                MaintenanceLease.owner == worker_id,
                MaintenanceLease.generation == generation,
            )
            .with_for_update()
        )
        if lease is None:
            return
        lease.owner = None
        lease.lease_until = now
        lease.last_success = now if not errors else lease.last_success
        lease.retry_after = now + retry_delay if errors else None
        lease.error = {"messages": errors[:20]} if errors else None
        session.commit()


async def _run_task(
    task: MaintenanceTask,
    now: datetime,
    *,
    worker_id: str,
    session_factory,
    lease_seconds: int,
) -> bool:
    generation = _acquire(
        session_factory,
        task.name,
        worker_id,
        now,
        lease_seconds,
        task.interval,
    )
    if generation is None:
        return False
    stop_heartbeat = asyncio.Event()

    async def renew():
        while not stop_heartbeat.is_set():
            try:
                await asyncio.wait_for(
                    stop_heartbeat.wait(), timeout=max(0.1, lease_seconds / 3)
                )
            except TimeoutError:
                renewed = await asyncio.to_thread(
                    _heartbeat,
                    session_factory,
                    task.name,
                    worker_id,
                    generation,
                    lease_seconds,
                )
                if not renewed:
                    return

    renewal = asyncio.create_task(renew())
    errors: list[str] = []
    try:
        result = task.callback(now)
        result = await result if inspect.isawaitable(result) else result
        errors.extend(result or [])
    except Exception as exc:
        errors.append(f"{type(exc).__name__}: {exc}"[:1000])
    finally:
        stop_heartbeat.set()
        await asyncio.gather(renewal, return_exceptions=True)
        _release(
            session_factory,
            task.name,
            worker_id,
            generation,
            now,
            errors,
            task.retry_delay,
        )
    return True


def issue_periodic_grants(now: datetime, *, session_factory=SessionLocal) -> None:
    if now.tzinfo is None:
        raise ValueError("grant time must be timezone-aware")
    now = now.astimezone(timezone.utc)
    free_period = timedelta(days=settings.FREE_GRANT_DAYS)
    with session_factory() as session:
        if settings.FREE_GRANT_UNITS:
            for user in session.scalars(select(User).where(User.is_active.is_(True))):
                created_at = _as_utc(user.created_at)
                elapsed = now - created_at
                period_number = elapsed // free_period
                if period_number < 1:
                    continue
                period_start = created_at + period_number * free_period
                grant_period(
                    session,
                    user.id,
                    settings.FREE_GRANT_POLICY_VERSION,
                    settings.FREE_GRANT_UNITS,
                    period_start,
                    period_start + free_period,
                    "FREE",
                )
        subscriptions = session.scalars(
            select(Subscription).where(
                Subscription.status.in_(("ACTIVE", "TRIALING", "PAID")),
                Subscription.period_start <= now,
                Subscription.period_end > now,
                Subscription.payment_order_id.is_(None),
            )
        )
        for subscription in subscriptions:
            sku = session.get(ProductSku, subscription.sku_id)
            if sku is None or not sku.enabled or sku.units <= 0:
                continue
            grant_period(
                session,
                subscription.payer_id,
                f"sku:{sku.id}",
                sku.units,
                subscription.period_start,
                subscription.period_end,
                "SUBSCRIPTION",
            )
        session.commit()


async def _run_runtime_maintenance(now, *, session_factory, adapter, worker_id):
    errors = []
    await execute_instance_operations(
        session_factory=session_factory,
        adapter=adapter,
        worker_id=worker_id,
    )
    with session_factory() as session:
        instance_ids = list(session.scalars(select(Instance.id).where(Instance.kind=='PRODUCTION')))
    window_end = now.replace(second=0, microsecond=0)
    window_start = window_end - timedelta(minutes=1)
    for instance_id in instance_ids:
        try:
            await reconcile_instance(instance_id, session_factory=session_factory, adapter=adapter)
            await process_resource_window(
                instance_id,
                window_start,
                window_end,
                session_factory=session_factory,
                adapter=adapter,
            )
        except Exception as exc:
            errors.append(f"{instance_id}: {type(exc).__name__}: {exc}"[:1000])
    return errors


async def run_maintenance_once(
    now: datetime,
    *,
    worker_id: str | None = None,
    session_factory=SessionLocal,
    adapter=None,
    tasks: list[MaintenanceTask] | None = None,
    lease_seconds: int = 25,
    include_runtime: bool = True,
) -> bool:
    if now.tzinfo is None:
        raise ValueError("maintenance time must be timezone-aware")
    worker_id = worker_id or f"maintenance-{uuid4().hex}"
    adapter = adapter or DatabaseTargetAdapter(session_factory)
    selected = list(tasks) if tasks is not None else [
        MaintenanceTask(
            "periodic-grants",
            timedelta(seconds=30),
            lambda task_now: issue_periodic_grants(
                task_now, session_factory=session_factory
            ),
        )
    ]
    if include_runtime:
        selected.insert(
            0,
            MaintenanceTask(
                "runtime",
                timedelta(0),
                lambda task_now: _run_runtime_maintenance(
                    task_now,
                    session_factory=session_factory,
                    adapter=adapter,
                    worker_id=worker_id,
                ),
            ),
        )
    ran = False
    for task in selected:
        ran = (
            await _run_task(
                task,
                now,
                worker_id=worker_id,
                session_factory=session_factory,
                lease_seconds=lease_seconds,
            )
            or ran
        )
    return ran


async def run_maintenance_loop(
    stop: asyncio.Event,
    *,
    session_factory=SessionLocal,
    adapter=None,
    interval_seconds: int = 30,
    tasks: list[MaintenanceTask] | None = None,
) -> None:
    worker_id = f"maintenance-{uuid4().hex}"
    while not stop.is_set():
        await run_maintenance_once(
            datetime.now(timezone.utc),
            worker_id=worker_id,
            session_factory=session_factory,
            adapter=adapter,
            tasks=tasks,
        )
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval_seconds)
        except TimeoutError:
            pass
