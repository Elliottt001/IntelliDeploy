from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest


@dataclass
class InstanceContext:
    owner_id: int
    other_id: int
    app_id: str
    instance_id: str
    target_id: str
    version_id: str


@pytest.fixture
def instance_context(session_factory, tmp_path):
    from app.apps.models import App, AppVersion, Instance
    from app.billing.ledger import grant
    from app.capabilities.models import InstanceDataSpace
    from app.core.types import AppManifest, CheckResult, ServiceSpec, ValidationReport
    from app.models.user import User
    from app.runtime.manifest import manifest_hash
    from app.runtime.models import DeploymentTarget

    manifest = AppManifest(
        web_service="web",
        services=[
            ServiceSpec(
                name="web",
                image="registry.test/web@sha256:" + "a" * 64,
                port=3000,
                volumes={"data": "/data"},
                memory_mb=256,
                cpu_millis=250,
                storage_mb={"data": 100},
            )
        ],
    )
    report = ValidationReport(
        checks=[CheckResult(id="save", status="PASS", evidence="evidence")],
        required_ids=["save"],
        requirement_revision=1,
        attempt_id="attempt",
        manifest_hash=manifest_hash(manifest),
    )
    artifact = tmp_path / "release.zip"
    artifact.write_bytes(b"release")
    with session_factory() as session:
        owner = User(
            username=f"instance-{uuid4().hex}",
            email=f"{uuid4().hex}@test",
            hashed_password="test-only",
        )
        other = User(
            username=f"other-{uuid4().hex}",
            email=f"{uuid4().hex}@test",
            hashed_password="test-only",
        )
        session.add_all([owner, other])
        session.flush()
        grant(session, owner.id, f"instance-{uuid4().hex}", 1000, "FREE")
        target = DeploymentTarget(
            id=f"target-{uuid4().hex}",
            kind="LINUX",
            enabled=True,
            health="HEALTHY",
            architecture="amd64",
            capacity={"memory_mb": 4096, "cpu_millis": 4000, "storage_mb": 10000},
            domain_suffix="apps.test.invalid",
            secret_ref="test-target",
        )
        session.add(target)
        app = App(owner_id=owner.id, name="笔记", prompt="保存笔记")
        session.add(app)
        session.flush()
        version = AppVersion(
            app_id=app.id,
            requirement_revision=1,
            manifest=manifest.model_dump(mode="json"),
            validation=report.model_dump(mode="json"),
            artifact_path=str(artifact),
        )
        session.add(version)
        session.flush()
        app.active_version_id = version.id
        instance = Instance(
            owner_id=owner.id,
            app_id=app.id,
            version_id=version.id,
            target_id=target.id,
            status="RUNNING",
            desired_state="RUNNING",
            url="https://notes.apps.test.invalid",
            data_namespace=f"data-{uuid4().hex}",
            resource_spec={
                "services": [{"name": "web", "memory_mb": 256, "cpu_millis": 250}],
                "storage_mb": 100,
            },
            price_version="runtime-v1",
        )
        session.add(instance)
        session.flush()
        session.add(
            InstanceDataSpace(
                instance_id=instance.id,
                database_name=f"db_{uuid4().hex}",
                role_name=f"role_{uuid4().hex}",
                secret_ref="database-secret",
            )
        )
        session.commit()
        return InstanceContext(
            owner.id, other.id, app.id, instance.id, target.id, version.id
        )


class TargetAdapter:
    def __init__(self):
        self.state = "RUNNING"
        self.calls = []
        self.fail_start = False

    async def start(self, instance):
        self.calls.append(("START", instance.id))
        if self.fail_start:
            raise RuntimeError("capacity disappeared")
        self.state = "RUNNING"

    async def stop(self, instance):
        self.calls.append(("STOP", instance.id))
        self.state = "STOPPED"

    async def delete(self, instance, *, delete_data):
        self.calls.append(("DELETE", instance.id, delete_data))
        self.state = "DELETED"

    async def observe(self, instance):
        return {
            "state": self.state,
            "compute_state": "RUNNING" if self.state == "RUNNING" else "STOPPED",
            "resource_spec": instance.resource_spec,
            "storage_mb": instance.resource_spec["storage_mb"],
            "evidence": f"adapter:{self.state.lower()}",
        }


def test_operation_request_is_idempotent_and_rejects_payload_reuse(
    session_factory, instance_context
):
    from app.runtime.operations import OperationConflict, request_instance_operation

    with session_factory() as session:
        first = request_instance_operation(
            session,
            instance_context.instance_id,
            instance_context.owner_id,
            "STOP",
            "stop-once",
        )
        again = request_instance_operation(
            session,
            instance_context.instance_id,
            instance_context.owner_id,
            "STOP",
            "stop-once",
        )
        assert first.id == again.id
        with pytest.raises(LookupError):
            request_instance_operation(
                session,
                instance_context.instance_id,
                instance_context.other_id,
                "STOP",
                "other-stop",
            )
        first.status = "SUCCEEDED"
        session.flush()
        with pytest.raises(OperationConflict):
            request_instance_operation(
                session,
                instance_context.instance_id,
                instance_context.owner_id,
                "DELETE",
                "delete-once",
                delete_data=False,
            )
            request_instance_operation(
                session,
                instance_context.instance_id,
                instance_context.owner_id,
                "DELETE",
                "delete-once",
                delete_data=True,
            )


def test_active_delivery_blocks_instance_operation(session_factory, instance_context):
    from app.jobs.models import Job
    from app.runtime.operations import OperationConflict, request_instance_operation

    with session_factory() as session:
        session.add(
            Job(
                app_id=instance_context.app_id,
                operation_id=f"active-{uuid4().hex}",
                kind="ADJUST",
                status="RUNNING",
                phase="releasing",
                requirement_revision=1,
                budget_units=100,
            )
        )
        session.commit()
    with session_factory() as session:
        with pytest.raises(OperationConflict, match="active delivery"):
            request_instance_operation(
                session,
                instance_context.instance_id,
                instance_context.owner_id,
                "STOP",
                "blocked-stop",
            )


@pytest.mark.asyncio
async def test_stop_then_start_preserves_url_version_and_data(
    session_factory, instance_context
):
    from app.apps.models import Instance
    from app.billing.models import PriceRule, Reservation
    from app.capabilities.models import InstanceDataSpace
    from app.runtime.operations import execute_instance_operations, request_instance_operation

    adapter = TargetAdapter()
    with session_factory() as session:
        request_instance_operation(
            session,
            instance_context.instance_id,
            instance_context.owner_id,
            "STOP",
            "stop-once",
        )
    await execute_instance_operations(session_factory=session_factory, adapter=adapter)
    with session_factory() as session:
        stopped = session.get(Instance, instance_context.instance_id)
        assert stopped.status == "STOPPED"
        assert stopped.url == "https://notes.apps.test.invalid"
        assert stopped.version_id == instance_context.version_id
        assert session.get(InstanceDataSpace, stopped.id).destroyed_at is None
        session.add_all(
            [
                PriceRule(
                    kind="runtime.compute",
                    version="runtime-v1",
                    numerator=1,
                    denominator=1000,
                ),
                PriceRule(
                    kind="runtime.storage",
                    version="runtime-v1",
                    numerator=1,
                    denominator=1000,
                ),
            ]
        )
        request_instance_operation(
            session,
            stopped.id,
            instance_context.owner_id,
            "START",
            "start-once",
        )
        reservation = session.query(Reservation).filter(
            Reservation.operation_id.like(
                f"resource-window:{instance_context.instance_id}:%"
            )
        ).one()
        assert reservation.status == "OPEN"
    await execute_instance_operations(session_factory=session_factory, adapter=adapter)
    with session_factory() as session:
        started = session.get(Instance, instance_context.instance_id)
        assert started.status == "RUNNING"
        assert started.url == "https://notes.apps.test.invalid"
        assert session.get(InstanceDataSpace, started.id).destroyed_at is None
    assert [call[0] for call in adapter.calls] == ["STOP", "START"]


@pytest.mark.asyncio
async def test_failed_start_never_reports_running(session_factory, instance_context):
    from app.apps.models import Instance
    from app.billing.models import PriceRule, Reservation
    from app.runtime.operations import execute_instance_operations, request_instance_operation

    adapter = TargetAdapter()
    adapter.state = "STOPPED"
    adapter.fail_start = True
    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        instance.status = "STOPPED"
        instance.desired_state = "STOPPED"
        session.add_all(
            [
                PriceRule(
                    kind="runtime.compute",
                    version="runtime-v1",
                    numerator=1,
                    denominator=1000,
                ),
                PriceRule(
                    kind="runtime.storage",
                    version="runtime-v1",
                    numerator=1,
                    denominator=1000,
                ),
            ]
        )
        session.commit()
        request_instance_operation(
            session,
            instance.id,
            instance_context.owner_id,
            "START",
            "failed-start",
        )
    await execute_instance_operations(session_factory=session_factory, adapter=adapter)
    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        assert instance.status == "FAILED"
        assert instance.stop_reason == "ERROR"
        reservation = session.query(Reservation).filter(
            Reservation.operation_id.like(
                f"resource-window:{instance_context.instance_id}:%"
            )
        ).one()
        assert reservation.status == "SETTLED"


@pytest.mark.asyncio
async def test_start_state_mismatch_releases_reserved_window(
    session_factory, instance_context
):
    from app.apps.models import Instance
    from app.billing.models import PriceRule, Reservation
    from app.runtime.operations import execute_instance_operations, request_instance_operation

    class NoopStartAdapter(TargetAdapter):
        async def start(self, instance):
            self.calls.append(("START", instance.id))

    adapter = NoopStartAdapter()
    adapter.state = "STOPPED"
    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)
        instance.status = "STOPPED"
        instance.desired_state = "STOPPED"
        session.add_all(
            [
                PriceRule(kind="runtime.compute", version="runtime-v1", numerator=1, denominator=1000),
                PriceRule(kind="runtime.storage", version="runtime-v1", numerator=1, denominator=1000),
            ]
        )
        session.commit()
        request_instance_operation(
            session,
            instance.id,
            instance_context.owner_id,
            "START",
            "mismatch-start",
        )

    await execute_instance_operations(session_factory=session_factory, adapter=adapter)

    with session_factory() as session:
        reservation = session.query(Reservation).filter(
            Reservation.operation_id.like(
                f"resource-window:{instance_context.instance_id}:%"
            )
        ).one()
        assert reservation.status == "SETTLED"


@pytest.mark.asyncio
async def test_expired_running_operation_reconciles_before_replay(
    session_factory, instance_context
):
    from app.runtime.operations import (
        InstanceOperation,
        execute_instance_operations,
        request_instance_operation,
    )

    with session_factory() as session:
        operation = request_instance_operation(
            session,
            instance_context.instance_id,
            instance_context.owner_id,
            "STOP",
            "recover-stop",
        )
        operation = session.get(InstanceOperation, operation.id)
        operation.status = "RUNNING"
        operation.lease_owner = "dead-worker"
        operation.lease_generation = 1
        operation.lease_until = datetime.now(timezone.utc) - timedelta(seconds=1)
        session.commit()
    adapter = TargetAdapter()
    adapter.state = "STOPPED"

    await execute_instance_operations(session_factory=session_factory, adapter=adapter)

    with session_factory() as session:
        operation = session.get(InstanceOperation, operation.id)
        assert operation.status == "SUCCEEDED"
    assert adapter.calls == []


@pytest.mark.asyncio
async def test_expired_operation_with_started_effect_never_replays_side_effect(
    session_factory, instance_context
):
    from app.apps.models import InstanceOperation
    from app.runtime.operations import execute_instance_operations, request_instance_operation

    with session_factory() as session:
        operation = request_instance_operation(
            session,
            instance_context.instance_id,
            instance_context.owner_id,
            "STOP",
            "uncertain-stop",
        )
        operation = session.get(InstanceOperation, operation.id)
        operation.status = "RUNNING"
        operation.effect_started_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        operation.lease_owner = "dead-worker"
        operation.lease_generation = 1
        operation.lease_until = datetime.now(timezone.utc) - timedelta(seconds=1)
        session.commit()

    adapter = TargetAdapter()
    adapter.state = "RUNNING"
    await execute_instance_operations(session_factory=session_factory, adapter=adapter)

    with session_factory() as session:
        operation = session.get(InstanceOperation, operation.id)
        assert operation.status == "RUNNING"
        assert operation.lease_until > datetime.now(timezone.utc)
    assert adapter.calls == []


@pytest.mark.asyncio
async def test_slow_instance_effect_renews_lease_and_runs_once(
    session_factory, instance_context
):
    from app.runtime.operations import execute_instance_operations, request_instance_operation

    started = asyncio.Event()
    finish = asyncio.Event()

    class SlowAdapter(TargetAdapter):
        async def stop(self, instance):
            self.calls.append(("STOP", instance.id))
            started.set()
            await finish.wait()
            self.state = "STOPPED"

    adapter = SlowAdapter()
    with session_factory() as session:
        request_instance_operation(
            session,
            instance_context.instance_id,
            instance_context.owner_id,
            "STOP",
            "slow-stop",
        )

    first = asyncio.create_task(
        execute_instance_operations(
            session_factory=session_factory,
            adapter=adapter,
            worker_id="first-operation-worker",
            lease_seconds=1,
            limit=1,
        )
    )
    await started.wait()
    await asyncio.sleep(1.2)
    second = await execute_instance_operations(
        session_factory=session_factory,
        adapter=adapter,
        worker_id="second-operation-worker",
        lease_seconds=1,
        limit=1,
    )
    finish.set()
    assert await first == 1
    assert second == 0
    assert [call[0] for call in adapter.calls] == ["STOP"]


@pytest.mark.asyncio
async def test_linux_and_kubernetes_lifecycle_adapters_use_control_plane_only(
    session_factory, instance_context
):
    import json

    from app.apps.models import Instance
    from app.runtime.kubernetes import KubernetesInstanceAdapter
    from app.runtime.linux import LinuxInstanceAdapter

    with session_factory() as session:
        instance = session.get(Instance, instance_context.instance_id)

    class Provider:
        def __init__(self, kind):
            self.kind = kind

        def get(self, target_id):
            del target_id
            return {
                "id": "target",
                "kind": self.kind,
                "enabled": True,
                "health": "HEALTHY",
                "architecture": "amd64",
                "capacity": {
                    "ssh_host": "linux.test.invalid",
                    "ssh_user": "runtime",
                    "deployment_root": "/srv/intellideploy",
                    "namespace": "apps",
                },
                "domain_suffix": "apps.test.invalid",
                "secret_ref": "target-secret",
            }

    class Resolver:
        def resolve(self, reference):
            assert reference == "target-secret"
            return "/tmp/test-key"

    class SSH:
        def __init__(self):
            self.actions = []

        async def run(self, argv, stdin, timeout):
            assert argv[0] == "ssh"
            assert timeout == 300
            action = json.loads(stdin)["action"]
            self.actions.append(action)
            if action == "observe":
                return {"state": "STOPPED", "compute_state": "STOPPED"}
            return {"ok": True}

    ssh = SSH()
    linux = LinuxInstanceAdapter(
        target_provider=Provider("LINUX"),
        secret_resolver=Resolver(),
        ssh_executor=ssh,
    )
    await linux.stop(instance)
    linux_observation = await linux.observe(instance)
    assert ssh.actions == ["stop", "observe"]
    assert linux_observation["state"] == "STOPPED"

    class Kube:
        def __init__(self):
            self.calls = []

        async def scale_instance(self, namespace, instance_id, replicas):
            self.calls.append(("scale", namespace, instance_id, replicas))

        async def delete_instance(self, namespace, instance_id, delete_data):
            self.calls.append(("delete", namespace, instance_id, delete_data))

        async def observe_instance(self, namespace, instance_id):
            self.calls.append(("observe", namespace, instance_id))
            return {"state": "RUNNING", "compute_state": "RUNNING"}

    kube_executor = Kube()
    kubernetes = KubernetesInstanceAdapter(
        target_provider=Provider("KUBERNETES"), kube_executor=kube_executor
    )
    await kubernetes.start(instance)
    observation = await kubernetes.observe(instance)
    assert kube_executor.calls == [
        ("scale", "apps", instance.id, 1),
        ("observe", "apps", instance.id),
    ]
    assert observation["state"] == "RUNNING"


@pytest.mark.asyncio
async def test_kubernetes_executor_scales_and_observes_all_instance_services():
    from types import SimpleNamespace

    from app.runtime.kubernetes import KubernetesApiExecutor

    class Apps:
        def __init__(self):
            self.scaled = []
            self.items = [
                SimpleNamespace(
                    metadata=SimpleNamespace(name="instance-1-web"),
                    spec=SimpleNamespace(replicas=1),
                    status=SimpleNamespace(available_replicas=1),
                ),
                SimpleNamespace(
                    metadata=SimpleNamespace(name="instance-1-db"),
                    spec=SimpleNamespace(replicas=1),
                    status=SimpleNamespace(available_replicas=1),
                ),
            ]

        def list_namespaced_deployment(self, namespace, label_selector):
            assert namespace == "apps"
            assert label_selector == "app.kubernetes.io/instance=instance-1"
            return SimpleNamespace(items=self.items)

        def patch_namespaced_deployment_scale(self, name, namespace, body):
            self.scaled.append((name, namespace, body["spec"]["replicas"]))

    executor = object.__new__(KubernetesApiExecutor)
    executor.apps = Apps()
    await executor.scale_instance("apps", "instance-1", 0)
    assert executor.apps.scaled == [
        ("instance-1-web", "apps", 0),
        ("instance-1-db", "apps", 0),
    ]
    for item in executor.apps.items:
        item.spec.replicas = 0
        item.status.available_replicas = 0
    assert await executor.observe_instance("apps", "instance-1") == {
        "state": "STOPPED",
        "compute_state": "STOPPED",
    }


def test_instance_api_requires_auth_owner_and_delete_confirmation(
    api_client, session_factory, instance_context
):
    from app.apps.models import Instance
    from app.models.user import User

    with session_factory() as session:
        owner = session.get(User, instance_context.owner_id)
        other = session.get(User, instance_context.other_id)
        owner.username = "runtime-owner"
        owner.hashed_password = __import__("app.utils.security", fromlist=["get_password_hash"]).get_password_hash(
            "runtime-password"
        )
        other.username = "runtime-other"
        other.hashed_password = __import__("app.utils.security", fromlist=["get_password_hash"]).get_password_hash(
            "other-password"
        )
        session.commit()
    token = api_client.post(
        "/auth/login", json={"username": "runtime-owner", "password": "runtime-password"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Idempotency-Key": "api-stop"}
    other_token = api_client.post(
        "/auth/login", json={"username": "runtime-other", "password": "other-password"}
    ).json()["access_token"]
    other_headers = {
        "Authorization": f"Bearer {other_token}",
        "Idempotency-Key": "other-stop",
    }

    detail = api_client.get(
        f"/api/instances/{instance_context.instance_id}", headers=headers
    )
    assert detail.status_code == 200
    assert detail.json()["status"] == "RUNNING"
    queued = api_client.post(
        f"/api/instances/{instance_context.instance_id}/stop", headers=headers
    )
    assert queued.status_code == 202
    assert queued.json()["kind"] == "STOP"
    assert api_client.get(
        f"/api/instances/{instance_context.instance_id}", headers=other_headers
    ).status_code == 404
    assert api_client.post(
        f"/api/instances/{instance_context.instance_id}/stop", headers=other_headers
    ).status_code == 404
    assert api_client.get(
        f"/api/instance-operations/{queued.json()['id']}", headers=other_headers
    ).status_code == 404
    rejected = api_client.request(
        "DELETE",
        f"/api/instances/{instance_context.instance_id}",
        headers={**headers, "Idempotency-Key": "api-delete"},
        json={"confirmation": "delete", "delete_data": False},
    )
    assert rejected.status_code == 409
    with session_factory() as session:
        assert session.get(Instance, instance_context.instance_id).status == "RUNNING"

