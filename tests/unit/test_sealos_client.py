from __future__ import annotations

import asyncio
from pathlib import Path
import sys
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services.sealos_client import DeploymentStatus, SealosClient  # noqa: E402


class ApiExceptionStub(Exception):
    def __init__(self, status: int):
        super().__init__(f"status={status}")
        self.status = status


class AppsApiStub:
    def __init__(self):
        self.deleted = []

    def read_namespaced_deployment(self, name, namespace):
        return SimpleNamespace(
            spec=SimpleNamespace(replicas=1),
            status=SimpleNamespace(
                available_replicas=1,
                ready_replicas=1,
                unavailable_replicas=0,
                conditions=[],
            ),
        )

    def delete_namespaced_deployment(self, name, namespace):
        self.deleted.append((name, namespace))


class CoreApiStub:
    def __init__(self, pod_phase="Running", waiting_reason=None):
        self.deleted = []
        self.pod_phase = pod_phase
        self.waiting_reason = waiting_reason

    def list_namespaced_pod(self, namespace, label_selector):
        waiting = SimpleNamespace(reason=self.waiting_reason) if self.waiting_reason else None
        return SimpleNamespace(
            items=[
                SimpleNamespace(
                    metadata=SimpleNamespace(name="app-1-pod"),
                    spec=SimpleNamespace(
                        node_name="node-a",
                        containers=[SimpleNamespace(name="app-1")],
                    ),
                    status=SimpleNamespace(
                        phase=self.pod_phase,
                        pod_ip="10.0.0.2",
                        container_statuses=[
                            SimpleNamespace(
                                ready=self.pod_phase == "Running" and not self.waiting_reason,
                                restart_count=2 if self.waiting_reason else 0,
                                state=SimpleNamespace(waiting=waiting),
                            )
                        ],
                    ),
                )
            ]
        )

    def read_namespaced_pod_log(self, name, namespace, container=None, tail_lines=100, timestamps=True):
        return f"{name}/{container}: hello"

    def delete_namespaced_service(self, name, namespace):
        self.deleted.append((name, namespace))


class NetApiStub:
    def __init__(self):
        self.deleted = []

    def delete_namespaced_ingress(self, name, namespace):
        self.deleted.append((name, namespace))


def build_client(apps=None, core=None, net=None):
    client = SealosClient(kubeconfig="fake")
    apps = apps or AppsApiStub()
    core = core or CoreApiStub()
    net = net or NetApiStub()
    client._k8s_clients = lambda: (apps, core, net, "ns-a", ApiExceptionStub)
    return client, apps, core, net


def test_get_app_status_reads_deployment_and_pods():
    async def run():
        client, _, _, _ = build_client()

        status = await client.get_app_status("app-1")

        assert status["status"] == DeploymentStatus.RUNNING.value
        assert status["ready"] is True
        assert status["namespace"] == "ns-a"
        assert status["pods"][0]["name"] == "app-1-pod"

    asyncio.run(run())


def test_get_app_status_maps_crash_loop():
    async def run():
        client, _, _, _ = build_client(core=CoreApiStub(pod_phase="Running", waiting_reason="CrashLoopBackOff"))

        status = await client.get_app_status("app-1")

        assert status["status"] == DeploymentStatus.CRASH_LOOP.value
        assert status["phase"] == "CrashLoopBackOff"
        assert status["ready"] is False

    asyncio.run(run())


def test_get_app_logs_reads_matching_pods():
    async def run():
        client, _, _, _ = build_client()

        logs = await client.get_app_logs("app-1", tail_lines=20)

        assert "== app-1-pod/app-1 ==" in logs
        assert "hello" in logs

    asyncio.run(run())


def test_delete_app_deletes_deployment_service_and_ingress():
    async def run():
        client, apps, core, net = build_client()

        result = await client.delete_app("app-1")

        assert result["namespace"] == "ns-a"
        assert apps.deleted == [("app-1", "ns-a")]
        assert core.deleted == [("app-1-svc", "ns-a")]
        assert net.deleted == [("app-1-ingress", "ns-a")]

    asyncio.run(run())
