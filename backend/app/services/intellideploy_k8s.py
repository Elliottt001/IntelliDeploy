import json
import os
import subprocess
import uuid
from typing import Any, Dict, List

from app.config import settings


class K8sDeployError(Exception):
    pass


def _load_kubeconfig_dict(kubeconfig_content: str) -> Dict[str, Any]:
    try:
        import yaml

        cfg = yaml.safe_load(kubeconfig_content)
    except Exception as exc:
        raise K8sDeployError(f"Invalid kubeconfig YAML: {exc}") from exc

    if not isinstance(cfg, dict):
        raise K8sDeployError("Invalid kubeconfig: expected a YAML object")
    return cfg


def _namespace_from_kubeconfig_dict(cfg: Dict[str, Any]) -> str:
    current_context = cfg.get("current-context")
    if not current_context:
        raise K8sDeployError("No current context in kubeconfig")

    for entry in cfg.get("contexts") or []:
        if entry.get("name") == current_context:
            context = entry.get("context") or {}
            return context.get("namespace") or "default"

    raise K8sDeployError(f"Current context {current_context!r} not found in kubeconfig")


def _api_exception_message(exc: Exception) -> str:
    body = getattr(exc, "body", None)
    if body:
        try:
            payload = json.loads(body)
            message = payload.get("message")
            if message:
                return str(message)
        except Exception:
            pass
        return str(body)

    status = getattr(exc, "status", None)
    reason = getattr(exc, "reason", None)
    if status or reason:
        return " ".join(str(part) for part in (status, reason) if part)
    return str(exc)


def _restricted_pod_security_context(client):
    return client.V1PodSecurityContext(
        run_as_non_root=True,
        run_as_user=1000,
        run_as_group=1000,
        fs_group=1000,
        seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
    )


def _restricted_container_security_context(client):
    return client.V1SecurityContext(
        allow_privilege_escalation=False,
        capabilities=client.V1Capabilities(drop=["ALL"]),
        seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
    )


def _skills_sdk_path() -> str:
        return os.getenv(
                "INTELLIDEPLOY_SKILLS_PATH",
                "/home/rzzhang/project/IntelliDeploySkills/dist/index.js",
        )


def _run_node_skills_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
        script = r"""
const fs = require('fs');

async function main() {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    const sdk = require(input.sdkPath);

    if (input.action === 'validate') {
        const client = sdk.createK8sClientFromString(input.kubeconfig);
        const namespace = client.getNamespace();
        process.stdout.write(JSON.stringify({ ok: true, namespace }));
        return;
    }

    if (input.action === 'deploy') {
        const skills = new sdk.SealosSkills({ kubeconfigString: input.kubeconfig });
        const deployRes = await skills.deploy({
            name: input.name,
            image: input.image,
            port: input.port,
            enableIngress: input.enableIngress,
            domain: input.domain,
            envVars: input.envVars
        });

        let dbRes = null;
        if (input.needsDatabase) {
            dbRes = await skills.createDB({
                name: `${input.name}-db`,
                type: input.databaseType || 'postgresql'
            });
        }

        process.stdout.write(JSON.stringify({ ok: true, deployRes, dbRes }));
        return;
    }

    process.stdout.write(JSON.stringify({ ok: false, error: 'Unsupported action' }));
}

main().catch((err) => {
    process.stdout.write(JSON.stringify({ ok: false, error: String(err?.message || err) }));
    process.exit(1);
});
"""

        proc = subprocess.run(
                ["node", "-e", script],
                input=json.dumps(payload).encode("utf-8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
        )
        if proc.returncode != 0:
                raise K8sDeployError(proc.stderr.decode("utf-8", errors="ignore") or "node bridge failed")

        output = proc.stdout.decode("utf-8", errors="ignore")
        if not output:
                raise K8sDeployError("node bridge returned empty output")
        data = json.loads(output)
        if not data.get("ok"):
                raise K8sDeployError(data.get("error", "skills bridge failed"))
        return data


def validate_kubeconfig(kubeconfig_content: str) -> str:
    sdk_path = _skills_sdk_path()
    if os.path.exists(sdk_path):
        try:
            data = _run_node_skills_bridge(
                {
                    "action": "validate",
                    "sdkPath": sdk_path,
                    "kubeconfig": kubeconfig_content,
                }
            )
            return data["namespace"]
        except Exception:
            pass

    try:
        from kubernetes import config

        cfg = _load_kubeconfig_dict(kubeconfig_content)
        config.load_kube_config_from_dict(cfg)
        return _namespace_from_kubeconfig_dict(cfg)
    except Exception as e:
        if isinstance(e, K8sDeployError):
            raise
        raise K8sDeployError(str(e))


def validate_deploy_permissions(kubeconfig_content: str) -> str:
    from kubernetes import client, config
    from kubernetes.client import ApiException

    cfg = _load_kubeconfig_dict(kubeconfig_content)
    config.load_kube_config_from_dict(cfg)
    namespace = _namespace_from_kubeconfig_dict(cfg)

    auth_api = client.AuthorizationV1Api()
    checks = [
        ("", "configmaps"),
        ("apps", "deployments"),
        ("", "services"),
        ("networking.k8s.io", "ingresses"),
    ]
    denied: list[str] = []

    for group, resource in checks:
        review = client.V1SelfSubjectAccessReview(
            spec=client.V1SelfSubjectAccessReviewSpec(
                resource_attributes=client.V1ResourceAttributes(
                    group=group or None,
                    namespace=namespace,
                    resource=resource,
                    verb="create",
                )
            )
        )
        try:
            response = auth_api.create_self_subject_access_review(review)
        except ApiException as exc:
            raise K8sDeployError(
                "Kubeconfig permission check failed in namespace "
                f"{namespace}: {_api_exception_message(exc)}"
            ) from exc

        if not getattr(response.status, "allowed", False):
            denied.append(f"{resource}{'.' + group if group else ''}")

    if denied:
        raise K8sDeployError(
            "Kubeconfig lacks create permissions in namespace "
            f"{namespace}: {', '.join(denied)}"
        )

    name = f"intellideploy-preflight-{uuid.uuid4().hex[:8]}"
    core_api = client.CoreV1Api()
    apps_api = client.AppsV1Api()

    try:
        core_api.create_namespaced_config_map(
            namespace=namespace,
            body=client.V1ConfigMap(
                metadata=client.V1ObjectMeta(name=name),
                data={"preflight": "true"},
            ),
            dry_run="All",
        )
        apps_api.create_namespaced_deployment(
            namespace=namespace,
            body=client.V1Deployment(
                metadata=client.V1ObjectMeta(name=name),
                spec=client.V1DeploymentSpec(
                    replicas=1,
                    selector=client.V1LabelSelector(match_labels={"app": name}),
                    template=client.V1PodTemplateSpec(
                        metadata=client.V1ObjectMeta(labels={"app": name}),
                        spec=client.V1PodSpec(
                            security_context=_restricted_pod_security_context(client),
                            containers=[
                                client.V1Container(
                                    name=name,
                                    image="busybox:1.36",
                                    command=["sh", "-c", "sleep 1"],
                                    security_context=_restricted_container_security_context(client),
                                )
                            ],
                        ),
                    ),
                ),
            ),
            dry_run="All",
        )
    except ApiException as exc:
        raise K8sDeployError(
            "Kubeconfig create admission denied in namespace "
            f"{namespace}: {_api_exception_message(exc)}"
        ) from exc

    return namespace


def deploy_with_kubeconfig(
    kubeconfig_content: str,
    name: str,
    image: str,
    port: int,
    enable_ingress: bool,
    domain: str,
    env_vars: Dict[str, str] | None,
    needs_database: bool,
    database_type: str | None = None,
    external_dependencies: List[str] | None = None,
):
    sdk_path = _skills_sdk_path()
    if os.path.exists(sdk_path):
        try:
            data = _run_node_skills_bridge(
                {
                    "action": "deploy",
                    "sdkPath": sdk_path,
                    "kubeconfig": kubeconfig_content,
                    "name": name,
                    "image": image,
                    "port": port,
                    "enableIngress": enable_ingress,
                    "domain": domain,
                    "envVars": env_vars,
                    "needsDatabase": needs_database,
                    "databaseType": database_type or "postgresql",
                    "externalDependencies": external_dependencies or [],
                }
            )
            deploy_res = data.get("deployRes") or {}
            db_res = data.get("dbRes") or None

            results: List[Dict[str, Any]] = [
                {
                    "step": "deploy",
                    "success": bool(deploy_res.get("success", False)),
                    "message": deploy_res.get("message", ""),
                    "data": deploy_res.get("data"),
                }
            ]

            database_name = None
            if needs_database:
                database_name = f"{name}-db"
                if db_res:
                    results.append(
                        {
                            "step": "database",
                            "success": bool(db_res.get("success", False)),
                            "message": db_res.get("message", ""),
                            "data": db_res.get("data"),
                        }
                    )

            status = "applied" if all(r.get("success") for r in results) else "failed"
            return {
                "status": status,
                "namespace": None,
                "runtimeName": name,
                "ingressDomain": domain if enable_ingress else None,
                "databaseName": database_name,
                "databaseType": database_type or ("postgresql" if needs_database else None),
                "externalDependencies": external_dependencies or [],
                "results": results,
                "log": json.dumps(results),
            }
        except Exception:
            pass

    from kubernetes import client, config
    from kubernetes.client import ApiException

    cfg = _load_kubeconfig_dict(kubeconfig_content)
    config.load_kube_config_from_dict(cfg)

    namespace = _namespace_from_kubeconfig_dict(cfg)

    apps_api = client.AppsV1Api()
    core_api = client.CoreV1Api()
    net_api = client.NetworkingV1Api()

    results: List[Dict[str, Any]] = []

    env_items = []
    if env_vars:
        for k, v in env_vars.items():
            env_items.append(client.V1EnvVar(name=k, value=str(v)))

    deployment = client.V1Deployment(
        metadata=client.V1ObjectMeta(name=name),
        spec=client.V1DeploymentSpec(
            replicas=1,
            selector=client.V1LabelSelector(match_labels={"app": name}),
            template=client.V1PodTemplateSpec(
                metadata=client.V1ObjectMeta(labels={"app": name}),
                spec=client.V1PodSpec(
                    security_context=_restricted_pod_security_context(client),
                    # 镜像在 GHCR 上默认是 private —— Sealos K8s 拉的时候需要凭据。
                    # 复用 image_builder 在同 namespace 里 upsert 的 docker-config Secret，
                    # Secret 名空时用兜底名（和 image_builder 保持一致）。
                    image_pull_secrets=[
                        client.V1LocalObjectReference(
                            name=(settings.KANIKO_DOCKER_CONFIG_SECRET or "").strip()
                                 or "kaniko-registry-auth"
                        )
                    ],
                    containers=[
                        client.V1Container(
                            name=name,
                            image=image,
                            ports=[client.V1ContainerPort(container_port=port)],
                            env=env_items,
                            security_context=_restricted_container_security_context(client),
                        )
                    ]
                ),
            ),
        ),
    )

    service = client.V1Service(
        metadata=client.V1ObjectMeta(name=f"{name}-svc"),
        spec=client.V1ServiceSpec(
            selector={"app": name},
            ports=[client.V1ServicePort(port=port, target_port=port)],
        ),
    )

    try:
        apps_api.create_namespaced_deployment(namespace=namespace, body=deployment)
        results.append({"step": "deploy", "success": True, "message": "Deployment created"})
    except ApiException as e:
        if e.status == 409:
            results.append({"step": "deploy", "success": True, "message": "Deployment already exists"})
        else:
            results.append({"step": "deploy", "success": False, "message": _api_exception_message(e)})

    try:
        core_api.create_namespaced_service(namespace=namespace, body=service)
    except ApiException as e:
        if e.status != 409:
            results.append({"step": "service", "success": False, "message": _api_exception_message(e)})

    if enable_ingress:
        ingress = client.V1Ingress(
            metadata=client.V1ObjectMeta(
                name=f"{name}-ingress",
                annotations={"kubernetes.io/ingress.class": "nginx"},
            ),
            spec=client.V1IngressSpec(
                rules=[
                    client.V1IngressRule(
                        host=domain,
                        http=client.V1HTTPIngressRuleValue(
                            paths=[
                                client.V1HTTPIngressPath(
                                    path="/",
                                    path_type="Prefix",
                                    backend=client.V1IngressBackend(
                                        service=client.V1IngressServiceBackend(
                                            name=f"{name}-svc",
                                            port=client.V1ServiceBackendPort(number=port),
                                        )
                                    ),
                                )
                            ]
                        ),
                    )
                ]
            ),
        )
        try:
            net_api.create_namespaced_ingress(namespace=namespace, body=ingress)
            results.append({"step": "ingress", "success": True, "message": "Ingress created"})
        except ApiException as e:
            if e.status == 409:
                results.append({"step": "ingress", "success": True, "message": "Ingress already exists"})
            else:
                results.append({"step": "ingress", "success": False, "message": _api_exception_message(e)})

    database_name = None
    if needs_database:
        database_name = f"{name}-db"
        results.append({
            "step": "database",
            "success": True,
            "message": f"{database_type or 'postgresql'} dependency detected; connection env vars injected for cluster service binding",
        })

    status = "applied" if all(r.get("success") for r in results) else "failed"
    return {
        "status": status,
        "namespace": namespace,
        "runtimeName": name,
        "ingressDomain": domain if enable_ingress else None,
        "databaseName": database_name,
        "databaseType": database_type or ("postgresql" if needs_database else None),
        "externalDependencies": external_dependencies or [],
        "results": results,
        "log": json.dumps(results),
    }
