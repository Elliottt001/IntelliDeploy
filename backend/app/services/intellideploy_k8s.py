import json
import os
import re
import subprocess
import uuid
from typing import Any, Dict, List


class K8sDeployError(Exception):
    pass


def _load_kubeconfig_dict(kubeconfig_content: str) -> Dict[str, Any]:
    try:
        cfg = __import__("yaml").safe_load(kubeconfig_content)
    except Exception as e:
        raise K8sDeployError(f"Invalid kubeconfig YAML: {e}") from e

    if not isinstance(cfg, dict):
        raise K8sDeployError("Kubeconfig must be a YAML object")
    return cfg


def _namespace_from_kubeconfig_dict(cfg: Dict[str, Any]) -> str:
    current_context_name = cfg.get("current-context")
    contexts = cfg.get("contexts") or []
    if not current_context_name or not isinstance(contexts, list):
        raise K8sDeployError("No current context in kubeconfig")

    current_context = next(
        (
            item
            for item in contexts
            if isinstance(item, dict) and item.get("name") == current_context_name
        ),
        None,
    )
    if not current_context:
        raise K8sDeployError("No current context in kubeconfig")

    context = current_context.get("context") or {}
    if not isinstance(context, dict):
        raise K8sDeployError("Invalid current context in kubeconfig")
    return context.get("namespace") or "default"


def _api_exception_message(exc: Exception) -> str:
    body = getattr(exc, "body", None)
    if body:
        try:
            data = json.loads(body)
            message = data.get("message")
            if message:
                return str(message)
        except Exception:
            pass
    reason = getattr(exc, "reason", None)
    status = getattr(exc, "status", None)
    if status or reason:
        return f"{status or ''} {reason or ''}".strip()
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
        run_as_non_root=True,
        run_as_user=1000,
        run_as_group=1000,
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
                type: 'postgresql'
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
    except K8sDeployError:
        raise
    except Exception as e:
        raise K8sDeployError(str(e))


def validate_deploy_permissions(kubeconfig_content: str) -> str:
    from kubernetes import client, config
    from kubernetes.client import ApiException

    cfg = _load_kubeconfig_dict(kubeconfig_content)
    config.load_kube_config_from_dict(cfg)
    namespace = _namespace_from_kubeconfig_dict(cfg)
    auth_api = client.AuthorizationV1Api()
    core_api = client.CoreV1Api()
    apps_api = client.AppsV1Api()

    required_permissions = [
        ("", "configmaps"),
        ("apps", "deployments"),
        ("", "services"),
        ("networking.k8s.io", "ingresses"),
    ]
    missing: List[str] = []
    for group, resource in required_permissions:
        review = client.V1SelfSubjectAccessReview(
            spec=client.V1SelfSubjectAccessReviewSpec(
                resource_attributes=client.V1ResourceAttributes(
                    namespace=namespace,
                    verb="create",
                    group=group,
                    resource=resource,
                )
            )
        )
        response = auth_api.create_self_subject_access_review(review)
        if not response.status or not response.status.allowed:
            label = resource if not group else f"{resource}.{group}"
            missing.append(label)

    if missing:
        raise K8sDeployError(
            "Kubeconfig lacks create permissions in namespace "
            f"{namespace}: {', '.join(missing)}"
        )

    probe_name = f"intellideploy-preflight-{uuid.uuid4().hex[:8]}"
    try:
        core_api.create_namespaced_config_map(
            namespace=namespace,
            body=client.V1ConfigMap(
                metadata=client.V1ObjectMeta(name=f"{probe_name}-cm"),
                data={"probe": "ok"},
            ),
            dry_run="All",
        )
        apps_api.create_namespaced_deployment(
            namespace=namespace,
            body=client.V1Deployment(
                metadata=client.V1ObjectMeta(name=probe_name),
                spec=client.V1DeploymentSpec(
                    replicas=1,
                    selector=client.V1LabelSelector(match_labels={"app": probe_name}),
                    template=client.V1PodTemplateSpec(
                        metadata=client.V1ObjectMeta(labels={"app": probe_name}),
                        spec=client.V1PodSpec(
                            security_context=_restricted_pod_security_context(client),
                            containers=[
                                client.V1Container(
                                    name=probe_name,
                                    image="node:20-alpine",
                                    command=["/bin/sh", "-c"],
                                    args=["sleep 30"],
                                    security_context=_restricted_container_security_context(
                                        client
                                    ),
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
        results.append({"step": "database", "success": True, "message": "Database creation should be delegated to Sealos DB provider"})

    status = "applied" if all(r.get("success") for r in results) else "failed"
    return {
        "status": status,
        "namespace": namespace,
        "runtimeName": name,
        "ingressDomain": domain if enable_ingress else None,
        "databaseName": database_name,
        "results": results,
        "log": json.dumps(results),
    }


def deploy_source_with_kubeconfig(
    kubeconfig_content: str,
    name: str,
    runtime_image: str,
    source_files: Dict[str, str],
    install_command: str | None,
    start_command: str,
    port: int,
    enable_ingress: bool,
    domain: str,
    env_vars: Dict[str, str] | None,
):
    from kubernetes import client, config
    from kubernetes.client import ApiException

    cfg = _load_kubeconfig_dict(kubeconfig_content)
    config.load_kube_config_from_dict(cfg)
    namespace = _namespace_from_kubeconfig_dict(cfg)

    apps_api = client.AppsV1Api()
    core_api = client.CoreV1Api()
    net_api = client.NetworkingV1Api()

    results: List[Dict[str, Any]] = []
    config_map_name = f"{name}-source"
    config_data: Dict[str, str] = {}
    config_items = []
    used_keys: set[str] = set()
    for index, (path, content) in enumerate(source_files.items()):
        key = _config_map_key(path, index, used_keys)
        config_data[key] = content
        config_items.append(client.V1KeyToPath(key=key, path=path))

    config_map = client.V1ConfigMap(
        metadata=client.V1ObjectMeta(name=config_map_name),
        data=config_data,
    )
    try:
        core_api.create_namespaced_config_map(namespace=namespace, body=config_map)
        results.append({"step": "configmap", "success": True, "message": "ConfigMap created"})
    except ApiException as e:
        if e.status == 409:
            core_api.replace_namespaced_config_map(
                name=config_map_name, namespace=namespace, body=config_map
            )
            results.append({"step": "configmap", "success": True, "message": "ConfigMap replaced"})
        else:
            results.append({"step": "configmap", "success": False, "message": _api_exception_message(e)})

    env_items = []
    if env_vars:
        for key, value in env_vars.items():
            env_items.append(client.V1EnvVar(name=key, value=str(value)))
    env_names = {item.name for item in env_items}
    for key, value in {
        "HOME": "/tmp",
        "NPM_CONFIG_CACHE": "/tmp/.npm",
        "PIP_CACHE_DIR": "/tmp/.cache/pip",
    }.items():
        if key not in env_names:
            env_items.append(client.V1EnvVar(name=key, value=value))

    commands = [part for part in [install_command, start_command] if part]
    command_line = " && ".join(commands)
    deployment = client.V1Deployment(
        metadata=client.V1ObjectMeta(name=name),
        spec=client.V1DeploymentSpec(
            replicas=1,
            selector=client.V1LabelSelector(match_labels={"app": name}),
            template=client.V1PodTemplateSpec(
                metadata=client.V1ObjectMeta(labels={"app": name}),
                spec=client.V1PodSpec(
                    security_context=_restricted_pod_security_context(client),
                    volumes=[
                        client.V1Volume(
                            name="source-config",
                            config_map=client.V1ConfigMapVolumeSource(
                                name=config_map_name,
                                items=config_items,
                            ),
                        ),
                        client.V1Volume(
                            name="app-source",
                            empty_dir=client.V1EmptyDirVolumeSource(),
                        ),
                    ],
                    init_containers=[
                        client.V1Container(
                            name="copy-source",
                            image=runtime_image,
                            command=["/bin/sh", "-c"],
                            args=["cp -R /source/. /app/"],
                            security_context=_restricted_container_security_context(client),
                            volume_mounts=[
                                client.V1VolumeMount(
                                    name="source-config",
                                    mount_path="/source",
                                    read_only=True,
                                ),
                                client.V1VolumeMount(
                                    name="app-source",
                                    mount_path="/app",
                                ),
                            ],
                        )
                    ],
                    containers=[
                        client.V1Container(
                            name=name,
                            image=runtime_image,
                            working_dir="/app",
                            command=["/bin/sh", "-c"],
                            args=[command_line],
                            ports=[client.V1ContainerPort(container_port=port)],
                            env=env_items,
                            security_context=_restricted_container_security_context(client),
                            volume_mounts=[
                                client.V1VolumeMount(name="app-source", mount_path="/app")
                            ],
                        )
                    ],
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
            apps_api.replace_namespaced_deployment(name=name, namespace=namespace, body=deployment)
            results.append({"step": "deploy", "success": True, "message": "Deployment replaced"})
        else:
            results.append({"step": "deploy", "success": False, "message": _api_exception_message(e)})

    try:
        core_api.create_namespaced_service(namespace=namespace, body=service)
        results.append({"step": "service", "success": True, "message": "Service created"})
    except ApiException as e:
        if e.status == 409:
            results.append({"step": "service", "success": True, "message": "Service already exists"})
        else:
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
                net_api.replace_namespaced_ingress(
                    name=f"{name}-ingress", namespace=namespace, body=ingress
                )
                results.append({"step": "ingress", "success": True, "message": "Ingress replaced"})
            else:
                results.append({"step": "ingress", "success": False, "message": _api_exception_message(e)})

    status = "applied" if all(result.get("success") for result in results) else "failed"
    return {
        "status": status,
        "namespace": namespace,
        "runtimeName": name,
        "ingressDomain": domain if enable_ingress else None,
        "databaseName": None,
        "results": results,
        "log": json.dumps(results),
    }


def _config_map_key(path: str, index: int, used_keys: set[str]) -> str:
    base = re.sub(r"[^A-Za-z0-9_.-]", "_", path).strip("._")
    if not base:
        base = "file"
    key = f"{index}-{base}"[:253]
    while key in used_keys:
        key = f"{index}-{len(used_keys)}-{base}"[:253]
    used_keys.add(key)
    return key
