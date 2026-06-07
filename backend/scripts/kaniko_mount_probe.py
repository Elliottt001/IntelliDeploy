"""mount probe v2: 以 root 运行，深度遍历 /kaniko/.docker，搞清 items 投影是不是真的工作。"""
from __future__ import annotations
import sys, time, uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import yaml  # noqa: E402
from app.config import settings  # noqa: E402
from kubernetes import client, config  # noqa: E402

config.load_kube_config_from_dict(yaml.safe_load(settings.KANIKO_KUBECONFIG))
core = client.CoreV1Api()
ns = settings.KANIKO_NAMESPACE
secret_name = (settings.KANIKO_DOCKER_CONFIG_SECRET or "").strip() or "kaniko-registry-auth"

# clean leftovers
for p in core.list_namespaced_pod(namespace=ns, label_selector="app=kaniko-mount-probe2").items:
    try:
        core.delete_namespaced_pod(
            name=p.metadata.name, namespace=ns,
            body=client.V1DeleteOptions(grace_period_seconds=0),
        )
    except Exception:
        pass

pod_name = f"kaniko-mount-probe2-{uuid.uuid4().hex[:6]}"
print(f"creating {pod_name}")

# 不设 runAsNonRoot 这次，root 跑，权限不应是阻碍
restricted_sc = client.V1SecurityContext(
    allow_privilege_escalation=False,
    capabilities=client.V1Capabilities(drop=["ALL"]),
    seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
)

pod = client.V1Pod(
    metadata=client.V1ObjectMeta(name=pod_name, labels={"app": "kaniko-mount-probe2"}),
    spec=client.V1PodSpec(
        restart_policy="Never",
        containers=[
            client.V1Container(
                name="probe",
                image="busybox:1.36",
                command=["sh", "-c"],
                args=[
                    "set -x; "
                    "ls -laR /kaniko/.docker/ 2>&1; "
                    "echo '=== readlink config.json ==='; "
                    "readlink /kaniko/.docker/config.json; "
                    "echo '=== cat config.json (head, mask token) ==='; "
                    "cat /kaniko/.docker/config.json 2>&1 | "
                    "  sed 's/ghp_[A-Za-z0-9]*/ghp_REDACTED/g'; "
                    "echo '=== stat config.json ==='; "
                    "stat /kaniko/.docker/config.json 2>&1 || true; "
                    "sleep 3"
                ],
                volume_mounts=[
                    client.V1VolumeMount(name="dc", mount_path="/kaniko/.docker"),
                ],
                security_context=restricted_sc,
            )
        ],
        volumes=[
            client.V1Volume(
                name="dc",
                secret=client.V1SecretVolumeSource(
                    secret_name=secret_name,
                    items=[
                        client.V1KeyToPath(
                            key=".dockerconfigjson", path="config.json"
                        )
                    ],
                ),
            )
        ],
    ),
)
core.create_namespaced_pod(namespace=ns, body=pod)

deadline = time.monotonic() + 180
last_phase = None
while time.monotonic() < deadline:
    p = core.read_namespaced_pod(name=pod_name, namespace=ns)
    if p.status.phase != last_phase:
        print(f"phase={p.status.phase}")
        last_phase = p.status.phase
    if p.status.phase in ("Running", "Succeeded", "Failed"):
        break
    time.sleep(2)

time.sleep(6)
print("\n--- logs ---")
try:
    print(core.read_namespaced_pod_log(name=pod_name, namespace=ns))
except Exception as e:
    print(f"log fetch failed: {e}")

try:
    core.delete_namespaced_pod(
        name=pod_name, namespace=ns,
        body=client.V1DeleteOptions(grace_period_seconds=0),
    )
except Exception:
    pass
