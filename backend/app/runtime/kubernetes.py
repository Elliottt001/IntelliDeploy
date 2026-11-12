from __future__ import annotations

import asyncio
import inspect
import json
import os
import re
import time
from pathlib import Path
from typing import Protocol

import yaml

from app.core.types import AppManifest, DeploymentResult, Requirement, ValidationReport
from app.runtime.manifest import validate_release_manifest
from app.runtime.validation import validate_application


DNS_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
DOMAIN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$")


class KubernetesDeploymentFailed(RuntimeError):
    pass


class KubernetesTargetUnavailable(RuntimeError):
    pass


class TargetProvider(Protocol):
    def get(self, target_id: str): ...


class KubeconfigResolver(Protocol):
    def resolve(self, reference: str) -> str: ...


class KubernetesExecutor(Protocol):
    async def preflight(self, namespace: str, resources: list[dict], images: list[str]): ...
    async def apply(self, resource: dict, *, field_manager: str, operation_id: str): ...
    async def wait_rollout(self, namespace: str, deployments: list[str], timeout: int): ...
    async def events(self, namespace: str, instance_id: str) -> list[str]: ...
    async def get_ingress(self, namespace: str, name: str): ...
    async def delete(self, resources: list[dict]): ...
    async def restore_ingress(self, ingress, *, field_manager: str, operation_id: str): ...


class DatabaseTargetProvider:
    def get(self, target_id: str):
        from app.database import SessionLocal
        from app.runtime.models import DeploymentTarget

        with SessionLocal() as session:
            target = session.get(DeploymentTarget, target_id)
            if target is None:
                return None
            return {
                "id": target.id,
                "kind": target.kind,
                "enabled": target.enabled,
                "health": target.health,
                "architecture": target.architecture,
                "capacity": target.capacity,
                "domain_suffix": target.domain_suffix,
                "secret_ref": target.secret_ref,
            }


class EnvironmentKubeconfigResolver:
    def resolve(self, reference: str) -> str:
        from app.config import settings
        if reference in settings.DEPLOYMENT_SECRET_FILES:
            path=Path(settings.DEPLOYMENT_SECRET_FILES[reference])
            if not path.is_absolute() or not path.is_file(): raise KubernetesTargetUnavailable('Kubeconfig file is not configured')
            return path.read_text()
        values = json.loads(os.environ.get("DEPLOYMENT_SECRET_VALUES", "{}"))
        value = values.get(reference)
        if not isinstance(value, str) or not value.strip():
            raise KubernetesTargetUnavailable("kubeconfig reference is not configured")
        return value


def _safe_label(value: str, kind: str) -> str:
    if not DNS_LABEL.fullmatch(value):
        raise ValueError(f"{kind} must be a Kubernetes DNS label")
    return value


def _labels(instance_id: str, service: str, release_name: str) -> dict[str, str]:
    return {
        "app.kubernetes.io/managed-by": "intellideploy",
        "app.kubernetes.io/instance": instance_id,
        "app.kubernetes.io/component": service,
        "intellideploy.dev/release": release_name,
    }


def _ingress(
    name: str,
    namespace: str,
    host: str,
    service_name: str,
    port: int,
    ingress_class: str | None,
    operation_id: str | None = None,
) -> dict:
    metadata: dict = {"name": name, "namespace": namespace}
    if operation_id:
        metadata["annotations"] = {"intellideploy.dev/operation-id": operation_id}
    spec: dict = {
        "rules": [
            {
                "host": host,
                "http": {
                    "paths": [
                        {
                            "path": "/",
                            "pathType": "Prefix",
                            "backend": {
                                "service": {
                                    "name": service_name,
                                    "port": {"number": port},
                                }
                            },
                        }
                    ]
                },
            }
        ]
    }
    if ingress_class:
        spec["ingressClassName"] = ingress_class
    return {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "Ingress",
        "metadata": metadata,
        "spec": spec,
    }


def render_resources(
    manifest: AppManifest,
    instance_id: str,
    namespace: str,
    secrets: dict[str, str],
    *,
    domain_suffix: str | None = None,
    storage_class: str | None = None,
    ingress_class: str | None = None,
    release_name: str | None = None,
    ingress_name: str | None = None,
    ingress_host: str | None = None,
    operation_id: str | None = None,
) -> list[dict]:
    validate_release_manifest(manifest)
    _safe_label(instance_id, "instance")
    _safe_label(namespace, "namespace")
    release_name = release_name or instance_id
    _safe_label(release_name, "release")
    if domain_suffix is not None and not DOMAIN.fullmatch(domain_suffix):
        raise ValueError("domain suffix is invalid")
    secret_name = f"{release_name}-runtime"
    resources: list[dict] = []
    if secrets:
        resources.append(
            {
                "apiVersion": "v1",
                "kind": "Secret",
                "metadata": {"name": secret_name, "namespace": namespace},
                "type": "Opaque",
                "stringData": secrets,
            }
        )

    seen_volumes: set[str] = set()
    for service in manifest.services:
        _safe_label(service.name, "service")
        for logical_name in service.volumes:
            _safe_label(logical_name, "volume")
            claim_name = f"{instance_id}-{logical_name}"
            _safe_label(claim_name, "volume claim")
            if claim_name in seen_volumes:
                continue
            seen_volumes.add(claim_name)
            size = service.storage_mb.get(logical_name, 1024)
            spec: dict = {
                "accessModes": ["ReadWriteOnce"],
                "resources": {"requests": {"storage": f"{size}Mi"}},
            }
            if storage_class:
                spec["storageClassName"] = storage_class
            resources.append(
                {
                    "apiVersion": "v1",
                    "kind": "PersistentVolumeClaim",
                    "metadata": {"name": claim_name, "namespace": namespace},
                    "spec": spec,
                }
            )

    for service in manifest.services:
        resource_name = f"{release_name}-{service.name}"
        _safe_label(resource_name, "resource")
        labels = _labels(instance_id, service.name, release_name)
        mounts = [
            {"name": logical_name, "mountPath": container_path}
            for logical_name, container_path in service.volumes.items()
        ]
        volumes = [
            {
                "name": logical_name,
                "persistentVolumeClaim": {"claimName": f"{instance_id}-{logical_name}"},
            }
            for logical_name in service.volumes
        ]
        environment = []
        for name, key in service.env_refs.items():
            if key not in secrets:
                raise ValueError("manifest secret reference is missing")
            environment.append(
                {
                    "name": name,
                    "valueFrom": {"secretKeyRef": {"name": secret_name, "key": key}},
                }
            )
        container: dict = {
            "name": service.name,
            "image": service.image,
            "securityContext": {
                "allowPrivilegeEscalation": False,
                "capabilities": {"drop": ["ALL"]},
                "seccompProfile": {"type": "RuntimeDefault"},
            },
            "resources": {
                "requests": {"memory": f"{service.memory_mb}Mi", "cpu": f"{service.cpu_millis}m"},
                "limits": {"memory": f"{service.memory_mb}Mi", "cpu": f"{service.cpu_millis}m"},
            },
        }
        if service.port is not None:
            container["ports"] = [{"name": "http", "containerPort": service.port}]
        if environment:
            container["env"] = environment
        if mounts:
            container["volumeMounts"] = mounts
        if service.health_path:
            if service.port is None:
                raise ValueError("health check requires a service port")
            probe = {
                "httpGet": {"path": service.health_path, "port": service.port},
                "initialDelaySeconds": 3,
                "periodSeconds": 5,
                "timeoutSeconds": 3,
                "failureThreshold": 12,
            }
            container["readinessProbe"] = probe
            container["livenessProbe"] = probe
        pod_spec: dict = {
            "securityContext": {
                "runAsNonRoot": True,
                "runAsUser": 10001,
                "runAsGroup": 10001,
                "fsGroup": 10001,
                "seccompProfile": {"type": "RuntimeDefault"},
            },
            "containers": [container],
        }
        if volumes:
            pod_spec["volumes"] = volumes
        annotations = {"intellideploy.dev/operation-id": operation_id} if operation_id else {}
        resources.append(
            {
                "apiVersion": "apps/v1",
                "kind": "Deployment",
                "metadata": {
                    "name": resource_name,
                    "namespace": namespace,
                    "labels": labels,
                    "annotations": annotations,
                },
                "spec": {
                    "replicas": 1,
                    "selector": {"matchLabels": labels},
                    "template": {
                        "metadata": {"labels": labels, "annotations": annotations},
                        "spec": pod_spec,
                    },
                },
            }
        )
        if service.port is not None:
            resources.append(
                {
                    "apiVersion": "v1",
                    "kind": "Service",
                    "metadata": {"name": resource_name, "namespace": namespace, "labels": labels},
                    "spec": {
                        "type": "ClusterIP",
                        "selector": labels,
                        "ports": [{"name": "http", "port": service.port, "targetPort": service.port}],
                    },
                }
            )

    if domain_suffix:
        web = next(service for service in manifest.services if service.name == manifest.web_service)
        if web.port is None:
            raise ValueError("web service requires a port")
        ingress_name = ingress_name or release_name
        ingress_host = ingress_host or f"{release_name}.{domain_suffix}"
        resources.append(
            _ingress(
                ingress_name,
                namespace,
                ingress_host,
                f"{release_name}-{manifest.web_service}",
                web.port,
                ingress_class,
                operation_id,
            )
        )
    return resources


class KubernetesApiExecutor:
    def __init__(self, kubeconfig_content: str):
        from kubernetes import client, config, dynamic

        config_dict = yaml.safe_load(kubeconfig_content)
        if not isinstance(config_dict, dict):
            raise KubernetesTargetUnavailable("kubeconfig is invalid")
        self.api_client = config.new_client_from_config_dict(config_dict)
        self.dynamic = dynamic.DynamicClient(self.api_client)
        self.apps = client.AppsV1Api(self.api_client)
        self.core = client.CoreV1Api(self.api_client)
        self.networking = client.NetworkingV1Api(self.api_client)
        self.batch = client.BatchV1Api(self.api_client)
        self.api_exception = client.ApiException

    def _resource(self, value: dict):
        return self.dynamic.resources.get(
            api_version=value["apiVersion"], kind=value["kind"]
        )

    async def preflight(self, namespace: str, resources: list[dict], images: list[str]):
        del images
        for resource in resources:
            api = self._resource(resource)
            await asyncio.to_thread(
                api.patch,
                name=resource["metadata"]["name"],
                namespace=namespace,
                body=resource,
                content_type="application/apply-patch+yaml",
                field_manager="intellideploy-preflight",
                force=True,
                dry_run="All",
            )

    async def apply(self, resource: dict, *, field_manager: str, operation_id: str):
        del operation_id
        api = self._resource(resource)
        await asyncio.to_thread(
            api.patch,
            name=resource["metadata"]["name"],
            namespace=resource["metadata"]["namespace"],
            body=resource,
            content_type="application/apply-patch+yaml",
            field_manager=field_manager,
            force=True,
        )

    async def wait_rollout(self, namespace: str, deployments: list[str], timeout: int):
        deadline = time.monotonic() + timeout
        pending = set(deployments)
        while pending and time.monotonic() < deadline:
            for name in list(pending):
                value = await asyncio.to_thread(
                    self.apps.read_namespaced_deployment_status, name, namespace
                )
                desired = value.spec.replicas or 1
                if (
                    value.status.observed_generation == value.metadata.generation
                    and (value.status.available_replicas or 0) >= desired
                ):
                    pending.remove(name)
            if pending:
                await asyncio.sleep(2)
        if pending:
            raise RuntimeError(f"rollout timed out: {', '.join(sorted(pending))}")

    async def events(self, namespace: str, instance_id: str) -> list[str]:
        values = await asyncio.to_thread(self.core.list_namespaced_event, namespace)
        result = []
        for event in values.items[-50:]:
            involved = getattr(event.involved_object, "name", "") or ""
            if instance_id in involved:
                result.append(f"{involved}: {event.reason}: {event.message}"[:2000])
        return result

    async def wait_job(self,namespace,name,timeout):
        deadline=time.monotonic()+timeout
        while time.monotonic()<deadline:
            value=await asyncio.to_thread(self.batch.read_namespaced_job_status,name,namespace)
            if value.status.succeeded:return
            if value.status.failed:raise RuntimeError('candidate migration job failed')
            await asyncio.sleep(2)
        raise RuntimeError('candidate migration job timed out')

    async def get_ingress(self, namespace: str, name: str):
        from kubernetes import client

        api = client.NetworkingV1Api(self.api_client)
        try:
            value = await asyncio.to_thread(api.read_namespaced_ingress, name, namespace)
        except self.api_exception as exc:
            if getattr(exc, "status", None) == 404:
                return None
            raise
        return self.api_client.sanitize_for_serialization(value)

    async def delete(self, resources: list[dict]):
        for resource in reversed(resources):
            api = self._resource(resource)
            try:
                await asyncio.to_thread(
                    api.delete,
                    name=resource["metadata"]["name"],
                    namespace=resource["metadata"]["namespace"],
                    body={},
                )
            except self.api_exception as exc:
                if getattr(exc, "status", None) != 404:
                    raise

    async def restore_ingress(self, ingress, *, field_manager: str, operation_id: str):
        if ingress is None:
            return
        await self.apply(
            ingress, field_manager=field_manager, operation_id=operation_id
        )

    async def scale_instance(self, namespace: str, instance_id: str, replicas: int):
        deployments = await asyncio.to_thread(
            self.apps.list_namespaced_deployment,
            namespace,
            label_selector=f"app.kubernetes.io/instance={instance_id}",
        )
        if not deployments.items:
            raise KubernetesDeploymentFailed("instance deployments are missing")
        for deployment in deployments.items:
            await asyncio.to_thread(
                self.apps.patch_namespaced_deployment_scale,
                deployment.metadata.name,
                namespace,
                {"spec": {"replicas": replicas}},
            )

    async def observe_instance(self, namespace: str, instance_id: str):
        try:
            deployments = await asyncio.to_thread(
                self.apps.list_namespaced_deployment,
                namespace,
                label_selector=f"app.kubernetes.io/instance={instance_id}",
            )
        except self.api_exception as exc:
            if getattr(exc, "status", None) == 404:
                return {"state": "DELETED", "compute_state": "STOPPED"}
            raise
        if not deployments.items:
            return {"state": "DELETED", "compute_state": "STOPPED"}
        desired = [deployment.spec.replicas or 0 for deployment in deployments.items]
        available = [
            deployment.status.available_replicas or 0
            for deployment in deployments.items
        ]
        if not any(desired):
            return {"state": "STOPPED", "compute_state": "STOPPED"}
        if all(current >= wanted for current, wanted in zip(available, desired)):
            return {"state": "RUNNING", "compute_state": "RUNNING"}
        return {"state": "PENDING", "compute_state": "RUNNING"}

    async def delete_instance(self, namespace: str, instance_id: str, delete_data: bool):
        selector = f"app.kubernetes.io/instance={instance_id}"
        deployments = await asyncio.to_thread(
            self.apps.list_namespaced_deployment, namespace, label_selector=selector
        )
        services = await asyncio.to_thread(
            self.core.list_namespaced_service, namespace, label_selector=selector
        )
        secrets = await asyncio.to_thread(self.core.list_namespaced_secret, namespace)
        for item in deployments.items:
            await asyncio.to_thread(
                self.apps.delete_namespaced_deployment, item.metadata.name, namespace
            )
        for item in services.items:
            await asyncio.to_thread(
                self.core.delete_namespaced_service, item.metadata.name, namespace
            )
        for item in secrets.items:
            if item.metadata.name.startswith(f"{instance_id}-"):
                await asyncio.to_thread(
                    self.core.delete_namespaced_secret, item.metadata.name, namespace
                )
        try:
            await asyncio.to_thread(
                self.networking.delete_namespaced_ingress, instance_id, namespace
            )
        except self.api_exception as exc:
            if getattr(exc, "status", None) != 404:
                raise
        if delete_data:
            claims = await asyncio.to_thread(
                self.core.list_namespaced_persistent_volume_claim,
                namespace,
            )
            for item in claims.items:
                if item.metadata.name.startswith(f"{instance_id}-"):
                    await asyncio.to_thread(
                        self.core.delete_namespaced_persistent_volume_claim,
                        item.metadata.name,
                        namespace,
                    )


class KubernetesInstanceAdapter:
    def __init__(self, *, target_provider=None, kubeconfig_resolver=None, kube_executor=None):
        self.target_provider = target_provider or DatabaseTargetProvider()
        self.kubeconfig_resolver = kubeconfig_resolver or EnvironmentKubeconfigResolver()
        self.kube_executor = kube_executor

    def _context(self, instance):
        target = _target_dict(self.target_provider.get(instance.target_id))
        if (
            target.get("kind") not in {"KUBERNETES", "SEALOS"}
            or not target.get("enabled")
            or target.get("health") != "HEALTHY"
        ):
            raise KubernetesTargetUnavailable("Kubernetes target is unavailable")
        namespace = (target.get("capacity") or {}).get("namespace")
        if not isinstance(namespace, str) or not DNS_LABEL.fullmatch(namespace):
            raise KubernetesTargetUnavailable("Kubernetes namespace is invalid")
        executor = self.kube_executor
        if executor is None:
            secret_ref = target.get("secret_ref")
            if not secret_ref:
                raise KubernetesTargetUnavailable("Kubernetes kubeconfig reference is missing")
            executor = KubernetesApiExecutor(self.kubeconfig_resolver.resolve(secret_ref))
        return namespace, executor

    async def start(self, instance):
        namespace, executor = self._context(instance)
        await executor.scale_instance(namespace, instance.id, 1)

    async def stop(self, instance):
        namespace, executor = self._context(instance)
        await executor.scale_instance(namespace, instance.id, 0)

    async def delete(self, instance, *, delete_data: bool):
        namespace, executor = self._context(instance)
        await executor.delete_instance(namespace, instance.id, delete_data)

    async def observe(self, instance):
        try:
            namespace, executor = self._context(instance)
            value = await executor.observe_instance(namespace, instance.id)
        except Exception as exc:
            return {
                "state": "UNKNOWN",
                "compute_state": "UNKNOWN",
                "resource_spec": instance.resource_spec,
                "storage_mb": (instance.resource_spec or {}).get("storage_mb", 0),
                "evidence": f"Kubernetes observation failed: {type(exc).__name__}",
            }
        return {
            **value,
            "resource_spec": instance.resource_spec,
            "storage_mb": (instance.resource_spec or {}).get("storage_mb", 0),
            "evidence": "Kubernetes workload state observed",
        }


def _target_dict(value) -> dict:
    if isinstance(value, dict):
        return value
    return {
        name: getattr(value, name)
        for name in (
            "id",
            "kind",
            "enabled",
            "health",
            "architecture",
            "capacity",
            "domain_suffix",
            "secret_ref",
        )
    }


def _validated_target(value, manifest: AppManifest) -> dict:
    if value is None:
        raise KubernetesTargetUnavailable("Kubernetes target is not configured")
    target = _target_dict(value)
    if target.get("kind") not in {"KUBERNETES", "SEALOS"} or not target.get("enabled") or target.get("health") != "HEALTHY":
        raise KubernetesTargetUnavailable("Kubernetes target is unavailable")
    capacity = target.get("capacity") or {}
    namespace = capacity.get("namespace")
    domain = target.get("domain_suffix")
    if not isinstance(namespace, str) or not DNS_LABEL.fullmatch(namespace):
        raise KubernetesTargetUnavailable("Kubernetes namespace is invalid")
    if not isinstance(domain, str) or not DOMAIN.fullmatch(domain):
        raise KubernetesTargetUnavailable("Kubernetes domain suffix is invalid")
    required_memory = sum(service.memory_mb for service in manifest.services)
    required_cpu = sum(service.cpu_millis for service in manifest.services)
    required_storage = sum(sum(service.storage_mb.values()) for service in manifest.services)
    if required_memory > int(capacity.get("memory_mb", 0)) or required_cpu > int(capacity.get("cpu_millis", 0)):
        raise KubernetesTargetUnavailable("Kubernetes compute capacity is insufficient")
    if required_storage > int(capacity.get("storage_mb", 0)):
        raise KubernetesTargetUnavailable("Kubernetes storage capacity is insufficient")
    return target


async def _call_validator(validator, *args, **kwargs) -> ValidationReport:
    value = validator(*args, **kwargs)
    if inspect.isawaitable(value):
        value = await value
    return ValidationReport.model_validate(value)


def _candidate_name(instance_id: str, operation_id: str) -> str:
    value = f"{instance_id}-candidate-{operation_id}"
    return _safe_label(value, "candidate release")


async def preflight_kubernetes_target(
    target_id: str,
    manifest: AppManifest,
    *,
    target_provider: TargetProvider | None = None,
    kubeconfig_resolver: KubeconfigResolver | None = None,
    kube_executor: KubernetesExecutor | None = None,
) -> dict:
    target = _validated_target(
        (target_provider or DatabaseTargetProvider()).get(target_id), manifest
    )
    capacity = target["capacity"]
    executor = kube_executor
    if executor is None:
        secret_ref = target.get("secret_ref")
        if not isinstance(secret_ref, str) or not secret_ref:
            raise KubernetesTargetUnavailable("Kubernetes kubeconfig reference is missing")
        executor = KubernetesApiExecutor(
            (kubeconfig_resolver or EnvironmentKubeconfigResolver()).resolve(secret_ref)
        )
    resources = render_resources(
        manifest,
        "probe",
        capacity["namespace"],
        {},
        domain_suffix=target["domain_suffix"],
        storage_class=capacity.get("storage_class"),
        ingress_class=capacity.get("ingress_class"),
        operation_id="preflight",
    )
    try:
        await executor.preflight(
            capacity["namespace"], resources, [service.image for service in manifest.services]
        )
    except Exception as exc:
        raise KubernetesTargetUnavailable(f"Kubernetes preflight denied: {exc}") from exc
    return {"ok": True, "namespace": capacity["namespace"]}


async def deploy_kubernetes(
    target_id: str,
    instance_id: str,
    version_id: str,
    manifest: AppManifest,
    operation_id: str,
    requirement: Requirement,
    *,
    target_provider: TargetProvider | None = None,
    kubeconfig_resolver: KubeconfigResolver | None = None,
    kube_executor: KubernetesExecutor | None = None,
    validator=validate_application,
    browser_checks: list | None = None,
    secrets: dict[str, str] | None = None,
    gateway_image: str | None = None,
) -> DeploymentResult:
    _safe_label(instance_id, "instance")
    _safe_label(version_id, "version")
    _safe_label(operation_id, "operation")
    target = _validated_target(
        (target_provider or DatabaseTargetProvider()).get(target_id), manifest
    )
    capacity = target["capacity"]
    namespace = capacity["namespace"]
    executor = kube_executor
    if executor is None:
        secret_ref = target.get("secret_ref")
        if not isinstance(secret_ref, str) or not secret_ref:
            raise KubernetesTargetUnavailable("Kubernetes kubeconfig reference is missing")
        executor = KubernetesApiExecutor(
            (kubeconfig_resolver or EnvironmentKubeconfigResolver()).resolve(secret_ref)
        )
    candidate_name = _candidate_name(instance_id, operation_id)
    candidate_host = f"{candidate_name}.{target['domain_suffix']}"
    candidate_resources = render_resources(
        manifest,
        instance_id,
        namespace,
        secrets or {},
        domain_suffix=target["domain_suffix"],
        storage_class=capacity.get("storage_class"),
        ingress_class=capacity.get("ingress_class"),
        release_name=candidate_name,
        ingress_name=candidate_name,
        ingress_host=candidate_host,
        operation_id=operation_id,
    )
    if gateway_image:
        from app.runtime.manifest import digest_pinned
        if not digest_pinned(gateway_image):raise ValueError('gateway image must be digest pinned')
        web_deployment=next(resource for resource in candidate_resources if resource['kind']=='Deployment' and resource['metadata']['name']==candidate_name+'-'+manifest.web_service)
        container=web_deployment['spec']['template']['spec']['containers'][0]
        web=next(service for service in manifest.services if service.name==manifest.web_service)
        environment=[item for item in container.get('env',[]) if item['name'] in {'PLATFORM_INSTANCE_ID','PLATFORM_INSTANCE_TOKEN','PLATFORM_CAPABILITY_URL'}]
        environment.extend([{'name':'RUNTIME_ALLOWED_HOSTS','value':candidate_host+','+f'{instance_id}.{target["domain_suffix"]}'},{'name':'RUNTIME_UPSTREAM_URL','value':f'http://127.0.0.1:{web.port}'}])
        web_deployment['spec']['template']['spec']['containers'].append({'name':'platform-gateway','image':gateway_image,'command':['python','-m','app.runner.gateway'],'env':environment,'ports':[{'containerPort':8080}],'securityContext':{'runAsNonRoot':True,'runAsUser':10001,'allowPrivilegeEscalation':False,'readOnlyRootFilesystem':True,'capabilities':{'drop':['ALL']}},'resources':{'requests':{'cpu':'100m','memory':'128Mi'},'limits':{'cpu':'500m','memory':'256Mi'}}})
        for resource in candidate_resources:
            if resource['kind']=='Service' and resource['metadata']['name']==candidate_name+'-'+manifest.web_service:
                resource['spec']['ports'][0]['targetPort']=8080
    try:
        await executor.preflight(
            namespace, candidate_resources, [service.image for service in manifest.services]
        )
    except Exception as exc:
        raise KubernetesTargetUnavailable(f"Kubernetes preflight denied: {exc}") from exc
    try:
        for resource in candidate_resources:
            if manifest.migration and resource['kind']=='Deployment' and resource['metadata']['name']==candidate_name+'-'+manifest.web_service:
                continue
            await executor.apply(
                resource, field_manager="intellideploy", operation_id=operation_id
            )
        deployments = [
            resource["metadata"]["name"]
            for resource in candidate_resources
            if resource["kind"] == "Deployment"
            and not (manifest.migration and resource['metadata']['name']==candidate_name+'-'+manifest.web_service)
        ]
        await executor.wait_rollout(namespace, deployments, 300)
        if manifest.migration:
            import copy
            web_deployment=next(resource for resource in candidate_resources if resource['kind']=='Deployment' and resource['metadata']['name']==candidate_name+'-'+manifest.web_service)
            pod=copy.deepcopy(web_deployment['spec']['template']);pod['spec']['containers']=pod['spec']['containers'][:1]
            pod['spec']['containers'][0]['command']=manifest.migration;pod['spec']['restartPolicy']='Never'
            job={'apiVersion':'batch/v1','kind':'Job','metadata':{'name':candidate_name+'-migration','namespace':namespace,'labels':web_deployment['metadata']['labels']},'spec':{'template':pod,'backoffLimit':0,'activeDeadlineSeconds':600,'ttlSecondsAfterFinished':60}}
            await executor.apply(job,field_manager='intellideploy',operation_id=operation_id)
            await executor.wait_job(namespace,job['metadata']['name'],600)
            await executor.delete([job])
            await executor.apply(web_deployment,field_manager='intellideploy',operation_id=operation_id)
            await executor.wait_rollout(namespace,[web_deployment['metadata']['name']],300)
    except Exception as exc:
        events = await executor.events(namespace, candidate_name)
        await executor.delete(candidate_resources)
        detail = "; ".join(events) if events else str(exc)
        raise KubernetesDeploymentFailed(f"Kubernetes rollout failed: {detail}") from exc

    candidate_report = await _call_validator(
        validator,
        f"https://{candidate_host}",
        requirement,
        browser_checks or [],
        attempt_id=operation_id,
    )
    if not candidate_report.passed:
        await executor.delete(candidate_resources)
        raise KubernetesDeploymentFailed("Kubernetes candidate validation failed")

    previous_ingress = await executor.get_ingress(namespace, instance_id)
    web = next(service for service in manifest.services if service.name == manifest.web_service)
    stable_ingress = _ingress(
        instance_id,
        namespace,
        f"{instance_id}.{target['domain_suffix']}",
        f"{candidate_name}-{manifest.web_service}",
        web.port,
        capacity.get("ingress_class"),
        operation_id,
    )
    try:
        await executor.apply(
            stable_ingress, field_manager="intellideploy", operation_id=operation_id
        )
    except Exception as exc:
        await executor.delete(candidate_resources)
        raise KubernetesDeploymentFailed(
            f"Kubernetes activation failed: {exc}"
        ) from exc
    url = f"https://{instance_id}.{target['domain_suffix']}"
    report = await _call_validator(
        validator,
        url,
        requirement,
        browser_checks or [],
        attempt_id=operation_id,
    )
    if not report.passed:
        if previous_ingress is None:
            await executor.delete([stable_ingress])
        else:
            await executor.restore_ingress(
                previous_ingress,
                field_manager="intellideploy",
                operation_id=f"{operation_id}-rollback",
            )
        await executor.delete(candidate_resources)
        raise KubernetesDeploymentFailed("Kubernetes release validation failed")
    candidate_ingress = [
        resource for resource in candidate_resources if resource["kind"] == "Ingress"
    ]
    if candidate_ingress:
        await executor.delete(candidate_ingress)
    return DeploymentResult(
        operation_id=operation_id,
        instance_id=instance_id,
        url=url,
        report=report,
    )
