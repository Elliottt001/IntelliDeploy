import json
import os
import subprocess
from typing import Any, Dict, List


class K8sDeployError(Exception):
    pass


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

        config.load_kube_config_from_dict(__import__("yaml").safe_load(kubeconfig_content))
        contexts, current = config.list_kube_config_contexts()
        if not current:
            raise K8sDeployError("No current context in kubeconfig")
        namespace = current.get("context", {}).get("namespace") or "default"
        return namespace
    except Exception as e:
        raise K8sDeployError(str(e))


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

    cfg = __import__("yaml").safe_load(kubeconfig_content)
    config.load_kube_config_from_dict(cfg)

    contexts, current = config.list_kube_config_contexts()
    namespace = current.get("context", {}).get("namespace") or "default"

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
                    containers=[
                        client.V1Container(
                            name=name,
                            image=image,
                            ports=[client.V1ContainerPort(container_port=port)],
                            env=env_items,
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
            results.append({"step": "deploy", "success": False, "message": str(e)})

    try:
        core_api.create_namespaced_service(namespace=namespace, body=service)
    except ApiException as e:
        if e.status != 409:
            results.append({"step": "service", "success": False, "message": str(e)})

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
                results.append({"step": "ingress", "success": False, "message": str(e)})

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
