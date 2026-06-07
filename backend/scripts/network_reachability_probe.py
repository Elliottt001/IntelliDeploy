"""Network reachability probe: 在 ns-pib2mw6d 的 Pod 里测哪些 docker registry 能通。"""
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

REGISTRIES = [
    "ghcr.io",
    "gcr.io",
    "mirror.gcr.io",
    "registry-1.docker.io",
    "index.docker.io",
    "docker.io",
    "docker.m.daocloud.io",
    "dockerproxy.com",
    "mirror.ccs.tencentyun.com",
    "registry.cn-hangzhou.aliyuncs.com",
    "registry.cn-shanghai.aliyuncs.com",
    "quay.io",
]

cmds = []
for r in REGISTRIES:
    # /v2/ 是 OCI registry 的 ping endpoint；401 = 通且需鉴权, 200 = 公开通, timeout/dns = 不通
    cmds.append(
        f'printf "%-40s " "{r}"; '
        f'curl -sS -o /dev/null -m 8 -w "http=%{{http_code}} dns=%{{time_namelookup}}s conn=%{{time_connect}}s\\n" '
        f'https://{r}/v2/ 2>&1 || echo "FAIL"'
    )
script = "set +e; " + "; ".join(cmds)

pod_name = f"net-probe-{uuid.uuid4().hex[:6]}"
print(f"creating {pod_name}")

pod = client.V1Pod(
    metadata=client.V1ObjectMeta(name=pod_name, labels={"app": "net-probe"}),
    spec=client.V1PodSpec(
        restart_policy="Never",
        containers=[
            client.V1Container(
                name="probe",
                image="curlimages/curl:8.10.1",
                command=["sh", "-c"],
                args=[script + "; sleep 3"],
                security_context=client.V1SecurityContext(
                    allow_privilege_escalation=False,
                    capabilities=client.V1Capabilities(drop=["ALL"]),
                    seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
                ),
            )
        ],
    ),
)
core.create_namespaced_pod(namespace=ns, body=pod)

deadline = time.monotonic() + 300
last = None
while time.monotonic() < deadline:
    p = core.read_namespaced_pod(name=pod_name, namespace=ns)
    if p.status.phase != last:
        print(f"phase={p.status.phase}")
        last = p.status.phase
    if p.status.phase in ("Running", "Succeeded", "Failed"):
        break
    time.sleep(2)

time.sleep(min(8 * len(REGISTRIES) + 10, 120))  # let all curls finish

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
