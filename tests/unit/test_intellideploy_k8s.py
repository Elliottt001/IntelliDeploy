from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services.intellideploy_k8s import (  # noqa: E402
    _api_exception_message,
    _restricted_container_security_context,
    _restricted_pod_security_context,
    validate_kubeconfig,
)


def test_validate_kubeconfig_reads_namespace_from_supplied_dict():
    kubeconfig = """
apiVersion: v1
kind: Config
clusters:
  - name: local
    cluster:
      server: https://127.0.0.1
      insecure-skip-tls-verify: true
contexts:
  - name: local-context
    context:
      cluster: local
      user: local-user
      namespace: ns-test
current-context: local-context
users:
  - name: local-user
    user:
      token: test-token
"""

    assert validate_kubeconfig(kubeconfig) == "ns-test"


def test_restricted_security_context_matches_sealos_podsecurity_requirements():
    from kubernetes import client

    pod_context = _restricted_pod_security_context(client)
    container_context = _restricted_container_security_context(client)

    assert pod_context.run_as_non_root is True
    assert pod_context.run_as_user == 1000
    assert pod_context.run_as_group == 1000
    assert pod_context.fs_group == 1000
    assert pod_context.seccomp_profile.type == "RuntimeDefault"
    assert container_context.allow_privilege_escalation is False
    assert container_context.capabilities.drop == ["ALL"]
    assert container_context.seccomp_profile.type == "RuntimeDefault"


def test_api_exception_message_prefers_kubernetes_status_body():
    class FakeApiException(Exception):
        status = 403
        reason = "Forbidden"
        body = (
            '{"kind":"Status","message":"admission webhook '
            '\\"debt.sealos.io\\" denied the request: subscription expired"}'
        )

    assert _api_exception_message(FakeApiException()) == (
        'admission webhook "debt.sealos.io" denied the request: subscription expired'
    )
