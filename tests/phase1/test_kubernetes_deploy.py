from __future__ import annotations

import os

import pytest

from app.core.types import (
    AppManifest,
    CheckResult,
    Requirement,
    ServiceSpec,
    ValidationReport,
)
from app.runtime.kubernetes import (
    KubernetesDeploymentFailed,
    KubernetesApiExecutor,
    KubernetesTargetUnavailable,
    deploy_kubernetes,
    render_resources,
)


def manifest_fixture(image: str | None = None) -> AppManifest:
    return AppManifest(
        web_service="web",
        services=[
            ServiceSpec(
                name="web",
                image=image or "registry.test/web@sha256:" + "a" * 64,
                port=3000,
                volumes={"data": "/data"},
                storage_mb={"data": 2048},
                env_refs={"DATABASE_PASSWORD": "database-password"},
                depends_on=["db"],
                health_path="/health",
            ),
            ServiceSpec(
                name="db",
                image="registry.test/postgres@sha256:" + "b" * 64,
                port=5432,
                volumes={"postgres": "/var/lib/postgresql/data"},
                storage_mb={"postgres": 4096},
            ),
        ],
    )


def test_official_command_preserves_image_entrypoint_on_kubernetes():
    manifest=manifest_fixture()
    manifest.services[0].command=['node','server.js']
    manifest.services[0].env_values={'NODE_ENV':'production'}
    resources=render_resources(manifest,'instance','test-ns',{'database-password':'test-only'})
    deployment=next(r for r in resources if r['kind']=='Deployment' and r['spec']['template']['spec']['containers'][0]['name']=='web')
    container=deployment['spec']['template']['spec']['containers'][0]
    assert container['args']==['node','server.js']
    assert 'command' not in container
    assert {'name':'NODE_ENV','value':'production'} in container['env']


def target() -> dict:
    return {
        "id": "kube-test",
        "kind": "KUBERNETES",
        "enabled": True,
        "health": "HEALTHY",
        "architecture": "amd64",
        "domain_suffix": "apps.test.invalid",
        "secret_ref": "kubeconfig-test",
        "capacity": {
            "namespace": "tenant-test",
            "storage_class": "standard",
            "ingress_class": "nginx",
            "memory_mb": 8192,
            "cpu_millis": 8000,
            "storage_mb": 100000,
        },
    }


class Targets:
    def __init__(self, value=None):
        self.value = value

    def get(self, target_id):
        assert target_id == "kube-test"
        return self.value


class FakeKubernetes:
    def __init__(self, *, fail_preflight=False, fail_rollout=False, fail_apply_name=None):
        self.fail_preflight = fail_preflight
        self.fail_rollout = fail_rollout
        self.fail_apply_name = fail_apply_name
        self.preflights = []
        self.applied = []
        self.waited = []
        self.deleted = []
        self.restored = []
        self.previous_ingress = {
            "apiVersion": "networking.k8s.io/v1",
            "kind": "Ingress",
            "metadata": {"name": "instance-1", "namespace": "tenant-test"},
            "spec": {"rules": []},
        }

    async def preflight(self, namespace, resources, images):
        self.preflights.append((namespace, resources, images))
        if self.fail_preflight:
            raise PermissionError("ingress create denied")

    async def apply(self, resource, *, field_manager, operation_id):
        if resource["metadata"]["name"] == self.fail_apply_name:
            raise PermissionError("stable ingress apply denied")
        self.applied.append((resource, field_manager, operation_id))

    async def wait_rollout(self, namespace, deployments, timeout):
        self.waited.append((namespace, deployments, timeout))
        if self.fail_rollout:
            raise RuntimeError("web ImagePullBackOff")

    async def events(self, namespace, instance_id):
        return ["web: ImagePullBackOff", "db: probe failed"]

    async def get_ingress(self, namespace, name):
        return self.previous_ingress

    async def delete(self, resources):
        self.deleted.append(resources)

    async def restore_ingress(self, ingress, *, field_manager, operation_id):
        self.restored.append((ingress, field_manager, operation_id))


def passing_report() -> ValidationReport:
    return ValidationReport(
        checks=[CheckResult(id="save", status="PASS", evidence="evidence/save")],
        required_ids=["save"],
        requirement_revision=1,
        attempt_id="attempt-1",
        manifest_hash="manifest-1",
    )


def requirement() -> Requirement:
    return Requirement(prompt="保存笔记", acceptance=[])


def test_resources_keep_volume_name_between_versions_and_only_expose_web():
    one = render_resources(
        manifest_fixture(),
        "instance-1",
        "tenant-test",
        {"database-password": "test-secret"},
        domain_suffix="apps.test.invalid",
        storage_class="standard",
        ingress_class="nginx",
    )
    two = render_resources(
        manifest_fixture(image="registry.test/web@sha256:" + "c" * 64),
        "instance-1",
        "tenant-test",
        {"database-password": "test-secret"},
        domain_suffix="apps.test.invalid",
        storage_class="standard",
        ingress_class="nginx",
    )

    pvc_one = [item["metadata"]["name"] for item in one if item["kind"] == "PersistentVolumeClaim"]
    pvc_two = [item["metadata"]["name"] for item in two if item["kind"] == "PersistentVolumeClaim"]
    assert pvc_one == pvc_two == ["instance-1-data", "instance-1-postgres"]
    ingresses = [item for item in one if item["kind"] == "Ingress"]
    assert len(ingresses) == 1
    assert ingresses[0]["spec"]["rules"][0]["host"] == "instance-1.apps.test.invalid"
    services = [item for item in one if item["kind"] == "Service"]
    assert {item["metadata"]["name"] for item in services} == {"instance-1-web", "instance-1-db"}
    assert all(item["spec"]["type"] == "ClusterIP" for item in services)


def test_resources_scope_secrets_and_apply_restricted_security_context():
    resources = render_resources(
        manifest_fixture(),
        "instance-1",
        "tenant-test",
        {"database-password": "test-secret"},
        domain_suffix="apps.test.invalid",
    )
    secret = next(item for item in resources if item["kind"] == "Secret")
    assert secret["metadata"]["name"] == "instance-1-runtime"
    assert secret["stringData"] == {"database-password": "test-secret"}
    deployment = next(
        item
        for item in resources
        if item["kind"] == "Deployment" and item["metadata"]["name"] == "instance-1-web"
    )
    pod = deployment["spec"]["template"]["spec"]
    container = pod["containers"][0]
    assert pod["securityContext"]["runAsNonRoot"] is True
    assert container["securityContext"] == {
        "allowPrivilegeEscalation": False,
        "capabilities": {"drop": ["ALL"]},
        "seccompProfile": {"type": "RuntimeDefault"},
    }
    assert container["env"] == [
        {
            "name": "DATABASE_PASSWORD",
            "valueFrom": {
                "secretKeyRef": {"name": "instance-1-runtime", "key": "database-password"}
            },
        }
    ]
    assert "test-secret" not in str(deployment)


@pytest.mark.asyncio
async def test_kubernetes_deploy_validates_candidate_then_switches_stable_ingress():
    client = FakeKubernetes()
    urls = []

    async def validate(url, requirement, checks, **kwargs):
        urls.append(url)
        return passing_report()

    result = await deploy_kubernetes(
        "kube-test",
        "instance-1",
        "version-1",
        manifest_fixture(),
        "operation-1",
        requirement(),
        target_provider=Targets(target()),
        kube_executor=client,
        validator=validate,
        browser_checks=[],
        secrets={"database-password": "test-secret"},
    )

    assert result.url == "https://instance-1.apps.test.invalid"
    assert urls == [
        "https://instance-1-candidate-operation-1.apps.test.invalid",
        "https://instance-1.apps.test.invalid",
    ]
    assert client.preflights and client.waited
    stable_ingress = client.applied[-1][0]
    assert stable_ingress["kind"] == "Ingress"
    assert stable_ingress["metadata"]["name"] == "instance-1"
    backend = stable_ingress["spec"]["rules"][0]["http"]["paths"][0]["backend"]["service"]["name"]
    assert backend == "instance-1-candidate-operation-1-web"
    assert client.restored == []


@pytest.mark.asyncio
async def test_permission_denial_stops_before_apply():
    client = FakeKubernetes(fail_preflight=True)
    with pytest.raises(KubernetesTargetUnavailable, match="denied"):
        await deploy_kubernetes(
            "kube-test",
            "instance-1",
            "version-1",
            manifest_fixture(),
            "operation-2",
            requirement(),
            target_provider=Targets(target()),
            kube_executor=client,
            browser_checks=[],
            secrets={"database-password": "test-secret"},
        )
    assert client.applied == []


@pytest.mark.asyncio
async def test_rollout_failure_preserves_events_and_never_switches_ingress():
    client = FakeKubernetes(fail_rollout=True)
    with pytest.raises(KubernetesDeploymentFailed, match="ImagePullBackOff"):
        await deploy_kubernetes(
            "kube-test",
            "instance-1",
            "version-1",
            manifest_fixture(),
            "operation-3",
            requirement(),
            target_provider=Targets(target()),
            kube_executor=client,
            browser_checks=[],
            secrets={"database-password": "test-secret"},
        )
    assert client.deleted
    assert not any(item[0]["metadata"]["name"] == "instance-1" for item in client.applied)


@pytest.mark.asyncio
async def test_failed_candidate_validation_deletes_candidate_without_switching():
    client = FakeKubernetes()
    failed = ValidationReport(
        checks=[CheckResult(id="save", status="FAIL", evidence="evidence/save")],
        required_ids=["save"],
    )

    async def validate(*args, **kwargs):
        return failed

    with pytest.raises(KubernetesDeploymentFailed, match="candidate validation"):
        await deploy_kubernetes(
            "kube-test",
            "instance-1",
            "version-1",
            manifest_fixture(),
            "operation-4",
            requirement(),
            target_provider=Targets(target()),
            kube_executor=client,
            validator=validate,
            browser_checks=[],
            secrets={"database-password": "test-secret"},
        )
    assert client.deleted
    assert client.restored == []


@pytest.mark.asyncio
async def test_failed_final_validation_restores_previous_ingress():
    client = FakeKubernetes()
    reports = [passing_report(), ValidationReport(
        checks=[CheckResult(id="save", status="FAIL", evidence="evidence/final")],
        required_ids=["save"],
    )]

    async def validate(*args, **kwargs):
        return reports.pop(0)

    with pytest.raises(KubernetesDeploymentFailed, match="release validation"):
        await deploy_kubernetes(
            "kube-test",
            "instance-1",
            "version-1",
            manifest_fixture(),
            "operation-5",
            requirement(),
            target_provider=Targets(target()),
            kube_executor=client,
            validator=validate,
            browser_checks=[],
            secrets={"database-password": "test-secret"},
        )
    assert client.restored[0][0] == client.previous_ingress


@pytest.mark.asyncio
async def test_failed_final_validation_deletes_new_stable_ingress_when_none_existed():
    client = FakeKubernetes()
    client.previous_ingress = None
    reports = [
        passing_report(),
        ValidationReport(
            checks=[CheckResult(id="save", status="FAIL", evidence="evidence/final")],
            required_ids=["save"],
        ),
    ]

    async def validate(*args, **kwargs):
        return reports.pop(0)

    with pytest.raises(KubernetesDeploymentFailed, match="release validation"):
        await deploy_kubernetes(
            "kube-test",
            "instance-1",
            "version-1",
            manifest_fixture(),
            "operation-6",
            requirement(),
            target_provider=Targets(target()),
            kube_executor=client,
            validator=validate,
            browser_checks=[],
            secrets={"database-password": "test-secret"},
        )

    deleted_names = [
        resource["metadata"]["name"]
        for batch in client.deleted
        for resource in batch
    ]
    assert "instance-1" in deleted_names


@pytest.mark.asyncio
async def test_stable_ingress_apply_failure_keeps_old_entry_and_cleans_candidate():
    client = FakeKubernetes(fail_apply_name="instance-1")

    async def validate(*args, **kwargs):
        return passing_report()

    with pytest.raises(KubernetesDeploymentFailed, match="activation"):
        await deploy_kubernetes(
            "kube-test",
            "instance-1",
            "version-1",
            manifest_fixture(),
            "operation-7",
            requirement(),
            target_provider=Targets(target()),
            kube_executor=client,
            validator=validate,
            browser_checks=[],
            secrets={"database-password": "test-secret"},
        )

    assert client.deleted
    assert client.restored == []


@pytest.mark.asyncio
async def test_default_executor_restore_preserves_operation_identity():
    executor = object.__new__(KubernetesApiExecutor)
    calls = []

    async def apply(resource, *, field_manager, operation_id):
        calls.append((resource, field_manager, operation_id))

    executor.apply = apply
    ingress = {"kind": "Ingress", "metadata": {"name": "instance-1"}}

    await executor.restore_ingress(
        ingress, field_manager="intellideploy", operation_id="rollback-1"
    )

    assert calls == [(ingress, "intellideploy", "rollback-1")]


def test_invalid_namespace_or_instance_is_rejected_before_rendering():
    with pytest.raises(ValueError, match="namespace"):
        render_resources(manifest_fixture(), "instance-1", "../system", {})
    with pytest.raises(ValueError, match="instance"):
        render_resources(manifest_fixture(), "../instance", "tenant-test", {})


@pytest.mark.real
@pytest.mark.skipif(
    not os.environ.get("TEST_KUBERNETES_TARGET_ID"),
    reason="explicit test/boe Kubernetes target is not configured",
)
def test_real_kubernetes_target_is_reserved_for_acceptance_runner():
    pytest.skip("run scripts/verify_kubernetes_target.py after explicit target authorization")
