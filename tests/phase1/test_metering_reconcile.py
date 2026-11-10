from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from test_instance_operations import TargetAdapter, instance_context


@pytest.fixture
def metered_context(session_factory, instance_context):
    from app.billing.ledger import grant
    from app.billing.models import PriceRule

    with session_factory() as session:
        session.add_all(
            [
                PriceRule(kind="runtime.compute", version="runtime-v1", numerator=1, denominator=1000),
                PriceRule(kind="runtime.storage", version="runtime-v1", numerator=1, denominator=1000),
            ]
        )
        grant(session, instance_context.owner_id, "runtime-test", 10_000, "FREE")
        session.commit()
    return instance_context


@pytest.mark.asyncio
async def test_same_resource_window_is_charged_once(session_factory, metered_context):
    from app.billing.metering import process_resource_window
    from app.billing.models import Reservation, UsageEntry

    start = datetime(2026, 11, 10, 1, 0, tzinfo=timezone.utc)
    adapter = TargetAdapter()
    await process_resource_window(
        metered_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=adapter,
    )
    await process_resource_window(
        metered_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=adapter,
    )
    with session_factory() as session:
        entries = list(
            session.scalars(
                select(UsageEntry).where(UsageEntry.payer_id == metered_context.owner_id)
            )
        )
        assert sorted(item.kind for item in entries) == ["runtime.compute", "runtime.storage"]
        reservations = list(
            session.scalars(
                select(Reservation).where(
                    Reservation.operation_id.like(
                        f"resource-window:{metered_context.instance_id}:%"
                    )
                )
            )
        )
        assert [row.status for row in reservations].count("OPEN") == 1
        assert [row.status for row in reservations].count("SETTLED") == 1


@pytest.mark.asyncio
async def test_stopped_window_charges_storage_not_compute(session_factory, metered_context):
    from app.apps.models import Instance
    from app.billing.metering import process_resource_window
    from app.billing.models import UsageEntry

    start = datetime(2026, 11, 10, 1, 1, tzinfo=timezone.utc)
    adapter = TargetAdapter()
    adapter.state = "STOPPED"
    with session_factory() as session:
        instance = session.get(Instance, metered_context.instance_id)
        instance.status = "STOPPED"
        instance.desired_state = "STOPPED"
        session.commit()
    await process_resource_window(
        metered_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=adapter,
    )
    with session_factory() as session:
        entries = list(session.scalars(select(UsageEntry)))
        assert [item.kind for item in entries] == ["runtime.storage"]


@pytest.mark.asyncio
async def test_unknown_target_window_is_pending_and_not_charged(
    session_factory, metered_context
):
    from app.billing.metering import process_resource_window
    from app.billing.models import UnknownUsage, UsageEntry

    class UnknownAdapter(TargetAdapter):
        async def observe(self, instance):
            return {
                "state": "UNKNOWN",
                "compute_state": "UNKNOWN",
                "resource_spec": instance.resource_spec,
                "storage_mb": instance.resource_spec["storage_mb"],
                "evidence": "target unreachable",
            }

    start = datetime(2026, 11, 10, 1, 2, tzinfo=timezone.utc)
    await process_resource_window(
        metered_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=UnknownAdapter(),
    )
    with session_factory() as session:
        assert session.scalar(select(UsageEntry)) is None
        unknown = session.scalar(select(UnknownUsage))
        assert unknown is not None
        assert unknown.status == "UNKNOWN"


@pytest.mark.asyncio
async def test_unknown_reserved_window_releases_quota_without_charging(
    session_factory, metered_context
):
    from app.billing.metering import process_resource_window
    from app.billing.models import Reservation, UsageEntry

    class UnknownAdapter(TargetAdapter):
        async def observe(self, instance):
            return {
                "state": "UNKNOWN",
                "compute_state": "UNKNOWN",
                "resource_spec": instance.resource_spec,
                "storage_mb": instance.resource_spec["storage_mb"],
                "evidence": "target unreachable",
            }

    start = datetime(2026, 11, 10, 1, 20, tzinfo=timezone.utc)
    await process_resource_window(
        metered_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=TargetAdapter(),
    )
    await process_resource_window(
        metered_context.instance_id,
        start + timedelta(minutes=1),
        start + timedelta(minutes=2),
        session_factory=session_factory,
        adapter=UnknownAdapter(),
    )

    with session_factory() as session:
        assert len(list(session.scalars(select(UsageEntry)))) == 2
        reservations = list(session.scalars(select(Reservation)))
        assert all(row.status == "SETTLED" for row in reservations)


@pytest.mark.asyncio
async def test_insufficient_runtime_quota_queues_stop_without_deleting_data(
    session_factory, instance_context
):
    from app.apps.models import Instance
    from app.billing.ledger import grant
    from app.billing.metering import process_resource_window
    from app.billing.models import PriceRule, QuotaGrant
    from app.capabilities.models import InstanceDataSpace
    from app.runtime.operations import InstanceOperation

    with session_factory() as session:
        session.add_all(
            [
                PriceRule(kind="runtime.compute", version="runtime-v1", numerator=1, denominator=1),
                PriceRule(kind="runtime.storage", version="runtime-v1", numerator=1, denominator=1),
            ]
        )
        grant(session, instance_context.owner_id, "tiny-runtime", 1, "FREE")
        session.commit()
    start = datetime(2026, 11, 10, 1, 3, tzinfo=timezone.utc)
    await process_resource_window(
        instance_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=TargetAdapter(),
    )
    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        operation = session.scalar(
            select(InstanceOperation).where(
                InstanceOperation.instance_id == instance_context.instance_id,
                InstanceOperation.kind == "STOP",
            )
        )
        grant_row = session.scalar(select(QuotaGrant))
        assert instance.desired_state == "STOPPED"
        assert instance.stop_reason == "QUOTA"
        assert operation is not None
        assert session.get(InstanceDataSpace, instance.id).destroyed_at is None
        assert grant_row.balance_units >= 0


@pytest.mark.asyncio
async def test_unfunded_stopped_storage_is_recorded_without_new_stop(
    session_factory, instance_context
):
    from app.apps.models import Instance, InstanceOperation
    from app.billing.ledger import grant
    from app.billing.metering import process_resource_window
    from app.billing.models import PriceRule, ResourceMeterWindow, UnknownUsage, UsageEntry

    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        instance.status = "STOPPED"
        instance.desired_state = "STOPPED"
        instance.stop_reason = "USER"
        session.add_all(
            [
                PriceRule(kind="runtime.compute", version="runtime-v1", numerator=1, denominator=1),
                PriceRule(kind="runtime.storage", version="runtime-v1", numerator=1, denominator=1),
            ]
        )
        session.commit()
    adapter = TargetAdapter()
    adapter.state = "STOPPED"
    start = datetime(2026, 11, 10, 1, 5, tzinfo=timezone.utc)
    await process_resource_window(
        instance_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=adapter,
    )

    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        window = session.scalar(select(ResourceMeterWindow))
        unknown = session.scalar(select(UnknownUsage))
        assert instance.desired_state == "STOPPED"
        assert instance.stop_reason == "USER"
        assert session.scalar(select(InstanceOperation)) is None
        assert session.scalar(select(UsageEntry)) is None
        assert window.status == "STORAGE_UNFUNDED"
        assert unknown.status == "UNFUNDED_STORAGE"
        grant(session, instance_context.owner_id, "storage-top-up", 10_000, "PURCHASE")
        session.commit()

    await process_resource_window(
        instance_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=adapter,
    )
    with session_factory() as session:
        assert session.scalar(select(UsageEntry)) is None


@pytest.mark.asyncio
async def test_price_version_changes_only_on_the_next_window(
    session_factory, metered_context
):
    from app.apps.models import Instance
    from app.billing.metering import process_resource_window
    from app.billing.models import PriceRule, UsageEntry

    start = datetime(2026, 11, 10, 1, 6, tzinfo=timezone.utc)
    adapter = TargetAdapter()
    await process_resource_window(
        metered_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=adapter,
    )
    with session_factory() as session:
        session.add_all(
            [
                PriceRule(kind="runtime.compute", version="runtime-v2", numerator=2, denominator=1000),
                PriceRule(kind="runtime.storage", version="runtime-v2", numerator=2, denominator=1000),
            ]
        )
        session.get(Instance, metered_context.instance_id).price_version = "runtime-v2"
        session.commit()
    await process_resource_window(
        metered_context.instance_id,
        start + timedelta(minutes=1),
        start + timedelta(minutes=2),
        session_factory=session_factory,
        adapter=adapter,
    )
    await process_resource_window(
        metered_context.instance_id,
        start + timedelta(minutes=2),
        start + timedelta(minutes=3),
        session_factory=session_factory,
        adapter=adapter,
    )

    with session_factory() as session:
        versions = sorted(entry.price_version for entry in session.scalars(select(UsageEntry)))
        assert versions == [
            "runtime-v1",
            "runtime-v1",
            "runtime-v1",
            "runtime-v1",
            "runtime-v2",
            "runtime-v2",
        ]


@pytest.mark.asyncio
async def test_user_can_restart_after_quota_stop_and_top_up(
    session_factory, instance_context
):
    from app.apps.models import Instance
    from app.billing.ledger import grant
    from app.billing.metering import process_resource_window
    from app.billing.models import PriceRule
    from app.capabilities.models import InstanceDataSpace
    from app.runtime.operations import execute_instance_operations, request_instance_operation

    with session_factory() as session:
        session.add_all(
            [
                PriceRule(kind="runtime.compute", version="runtime-v1", numerator=1, denominator=1),
                PriceRule(kind="runtime.storage", version="runtime-v1", numerator=1, denominator=1),
            ]
        )
        session.commit()
    adapter = TargetAdapter()
    start = datetime(2026, 11, 10, 1, 8, tzinfo=timezone.utc)
    await process_resource_window(
        instance_context.instance_id,
        start,
        start + timedelta(minutes=1),
        session_factory=session_factory,
        adapter=adapter,
    )
    await execute_instance_operations(session_factory=session_factory, adapter=adapter)
    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        assert instance.status == "STOPPED"
        assert instance.stop_reason == "QUOTA"
        grant(session, instance_context.owner_id, "runtime-top-up", 100_000, "PURCHASE")
        session.commit()
        request_instance_operation(
            session,
            instance.id,
            instance_context.owner_id,
            "START",
            "restart-after-top-up",
        )
    await execute_instance_operations(session_factory=session_factory, adapter=adapter)

    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        assert instance.status == "RUNNING"
        assert instance.stop_reason is None
        assert session.get(InstanceDataSpace, instance.id).destroyed_at is None


def test_quota_stop_does_not_commit_the_callers_transaction(
    session_factory, instance_context
):
    from app.apps.models import Instance, InstanceOperation
    from app.billing.metering import reserve_next_window_or_stop
    from app.billing.models import PriceRule
    from app.core.types import ResourceWindow

    start = datetime(2026, 11, 10, 1, 4, tzinfo=timezone.utc)
    with session_factory() as session:
        session.add_all(
            [
                PriceRule(
                    kind="runtime.compute",
                    version="runtime-v1",
                    numerator=1,
                    denominator=1,
                ),
                PriceRule(
                    kind="runtime.storage",
                    version="runtime-v1",
                    numerator=1,
                    denominator=1,
                ),
            ]
        )
        session.flush()
        instance = session.get(Instance, instance_context.instance_id)
        result = reserve_next_window_or_stop(
            session,
            instance,
            ResourceWindow(
                instance_id=instance.id,
                window_start=start,
                window_end=start + timedelta(minutes=1),
                compute_state="RUNNING",
                compute_units=30_000,
                storage_units=6_000,
                price_version="runtime-v1",
                evidence_ref="rollback-test",
            ),
        )
        assert result is None
        session.rollback()

    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        assert instance.desired_state == "RUNNING"
        assert instance.stop_reason is None
        assert session.scalar(select(InstanceOperation)) is None


@pytest.mark.asyncio
async def test_reconcile_updates_observed_state_from_target(session_factory, instance_context):
    from app.apps.models import Instance
    from app.runtime.reconcile import reconcile_instance

    adapter = TargetAdapter()
    adapter.state = "STOPPED"
    snapshot = await reconcile_instance(
        instance_context.instance_id,
        session_factory=session_factory,
        adapter=adapter,
    )
    assert snapshot.status == "STOPPED"
    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        assert instance.status == "STOPPED"
        assert instance.observed_at is not None


@pytest.mark.asyncio
async def test_maintenance_lease_prevents_duplicate_worker(
    session_factory, instance_context
):
    from app.jobs.maintenance import run_maintenance_once
    from app.jobs.models import MaintenanceLease

    now = datetime(2026, 11, 10, 2, 0, tzinfo=timezone.utc)
    with session_factory() as session:
        session.add(
            MaintenanceLease(
                name="runtime",
                owner="other-worker",
                lease_until=now + timedelta(seconds=20),
                generation=1,
            )
        )
        session.commit()
    adapter = TargetAdapter()
    acquired = await run_maintenance_once(
        now,
        worker_id="current-worker",
        session_factory=session_factory,
        adapter=adapter,
        tasks=[],
    )
    assert acquired is False
    assert adapter.calls == []


@pytest.mark.asyncio
async def test_maintenance_processes_operation_and_window_once(
    session_factory, instance_context
):
    from app.billing.models import PriceRule, UsageEntry
    from app.jobs.maintenance import run_maintenance_once
    from app.runtime.operations import InstanceOperation, request_instance_operation

    with session_factory() as session:
        session.add_all(
            [
                PriceRule(kind="runtime.compute", version="runtime-v1", numerator=1, denominator=1000),
                PriceRule(kind="runtime.storage", version="runtime-v1", numerator=1, denominator=1000),
            ]
        )
        request_instance_operation(
            session,
            instance_context.instance_id,
            instance_context.owner_id,
            "STOP",
            "maintenance-stop",
        )
    adapter = TargetAdapter()
    now = datetime(2026, 11, 10, 2, 1, tzinfo=timezone.utc)
    first = await run_maintenance_once(
        now,
        worker_id="worker-one",
        session_factory=session_factory,
        adapter=adapter,
    )
    second = await run_maintenance_once(
        now,
        worker_id="worker-two",
        session_factory=session_factory,
        adapter=adapter,
    )
    with session_factory() as session:
        operation = session.scalar(select(InstanceOperation))
        entries = list(session.scalars(select(UsageEntry)))
        assert operation.status == "SUCCEEDED"
        assert [item.kind for item in entries] == ["runtime.storage"]
    assert first is True
    assert second is True
    assert [item[0] for item in adapter.calls] == ["STOP"]


@pytest.mark.asyncio
async def test_maintenance_renews_lease_during_slow_task(
    session_factory, instance_context
):
    from app.jobs.maintenance import MaintenanceTask, run_maintenance_once

    started = asyncio.Event()
    finish = asyncio.Event()

    async def slow_task(now):
        del now
        started.set()
        await finish.wait()

    first = asyncio.create_task(
        run_maintenance_once(
            datetime.now(timezone.utc),
            worker_id="slow-worker",
            session_factory=session_factory,
            adapter=TargetAdapter(),
            tasks=[MaintenanceTask("slow", timedelta(0), slow_task)],
            lease_seconds=1,
            include_runtime=False,
        )
    )
    await started.wait()
    await asyncio.sleep(1.2)
    second = await run_maintenance_once(
        datetime.now(timezone.utc),
        worker_id="other-worker",
        session_factory=session_factory,
        adapter=TargetAdapter(),
        tasks=[MaintenanceTask("slow", timedelta(0), slow_task)],
        lease_seconds=1,
        include_runtime=False,
    )
    finish.set()
    assert await first is True
    assert second is False


@pytest.mark.asyncio
async def test_maintenance_tasks_resume_independently_after_failure(
    session_factory, instance_context
):
    from app.jobs.maintenance import MaintenanceTask, run_maintenance_once
    from app.jobs.models import MaintenanceLease

    calls = []
    index_attempts = 0

    async def grants(now):
        calls.append(("grants", now))

    async def index(now):
        nonlocal index_attempts
        index_attempts += 1
        calls.append(("index", now))
        if index_attempts == 1:
            raise RuntimeError("temporary index failure")

    async def cleanup(now):
        calls.append(("cleanup", now))

    now = datetime(2026, 11, 10, 3, 0, tzinfo=timezone.utc)
    tasks = [
        MaintenanceTask("periodic-grants", timedelta(days=1), grants),
        MaintenanceTask("repository-index", timedelta(days=1), index),
        MaintenanceTask("resource-cleanup", timedelta(days=1), cleanup),
    ]
    assert await run_maintenance_once(
        now,
        worker_id="checkpoint-worker",
        session_factory=session_factory,
        adapter=TargetAdapter(),
        tasks=tasks,
        include_runtime=False,
    )
    assert await run_maintenance_once(
        now + timedelta(seconds=31),
        worker_id="checkpoint-worker",
        session_factory=session_factory,
        adapter=TargetAdapter(),
        tasks=tasks,
        include_runtime=False,
    )

    assert [name for name, _ in calls] == [
        "grants",
        "index",
        "cleanup",
        "index",
    ]
    with session_factory() as session:
        leases = {
            row.name: row for row in session.scalars(select(MaintenanceLease))
        }
        assert leases["periodic-grants"].last_success == now
        assert leases["repository-index"].last_success == now + timedelta(seconds=31)
        assert leases["resource-cleanup"].last_success == now


def test_periodic_free_grant_is_issued_once_after_initial_period(
    session_factory, instance_context
):
    from app.billing.models import QuotaGrant
    from app.jobs.maintenance import issue_periodic_grants
    from app.models.user import User

    now = datetime(2026, 11, 10, 4, 0, tzinfo=timezone.utc)
    with session_factory() as session:
        owner = session.get(User, instance_context.owner_id)
        owner.created_at = (now - timedelta(days=31)).replace(tzinfo=None)
        session.commit()

    issue_periodic_grants(now, session_factory=session_factory)
    issue_periodic_grants(now, session_factory=session_factory)

    with session_factory() as session:
        periodic = list(
            session.scalars(
                select(QuotaGrant).where(
                    QuotaGrant.payer_id == instance_context.owner_id,
                    QuotaGrant.grant_key.like("period:FREE:%"),
                )
            )
        )
        assert len(periodic) == 1
