from __future__ import annotations

import re
from pathlib import Path

from app.agent.contracts import ReviewFinding, ReviewReport
from app.runtime.manifest import manifest_hash


_BINARY_SUFFIXES = {".bin", ".dll", ".dylib", ".exe", ".so"}
_SECRET_PATTERN = re.compile(
    r"(?im)^\s*(?:api[_-]?key|secret|token|password)\s*=\s*[^$<{][^\s]{7,}\s*$"
)
_REMOTE_PIPE = re.compile(r"(?i)\b(?:curl|wget)\b[^\n|]*\|\s*(?:ba)?sh\b")
_ROOT_USER = re.compile(r"(?im)^\s*USER\s+(?:0|root)\s*$")


def _finding(attempt_id, digest, finding_id, severity, message):
    return ReviewFinding(
        id=finding_id,
        severity=severity,
        category="SECURITY",
        message=message,
        evidence_ref=f"security:{attempt_id}:{digest}:{finding_id}",
        acceptance_ids=[],
    )


def _candidate_files(draft):
    root = Path(draft.workspace_id).resolve()
    for relative in draft.source_tree:
        path = (root / relative).resolve()
        if root not in path.parents or not path.is_file() or path.is_symlink():
            yield relative, None, True
            continue
        data = path.read_bytes()
        is_binary = path.suffix.lower() in _BINARY_SUFFIXES or b"\x00" in data
        text = None if is_binary else data[:262_144].decode("utf-8", errors="replace")
        yield relative, text, is_binary


def scan_security(attempt_id, draft, profile, policy) -> ReviewReport:
    del profile, policy
    digest = manifest_hash(draft.manifest)
    findings: list[ReviewFinding] = []
    seen: set[str] = set()

    def add(finding_id, severity, message):
        if finding_id not in seen:
            findings.append(
                _finding(attempt_id, digest, finding_id, severity, message)
            )
            seen.add(finding_id)

    for relative, text, binary in _candidate_files(draft):
        if binary:
            add(
                "security:suspicious-binary",
                "BLOCKING",
                "候选源码包含不可审查的二进制或不安全路径",
            )
            continue
        if text is None:
            continue
        if _REMOTE_PIPE.search(text):
            add(
                "security:remote-pipe",
                "BLOCKING",
                "候选包含下载后直接执行的远程脚本",
            )
        if _ROOT_USER.search(text):
            add(
                "security:root-container",
                "BLOCKING",
                "候选容器显式以 root 用户运行",
            )
        if _SECRET_PATTERN.search(text):
            add(
                "security:secret-literal",
                "BLOCKING",
                "候选源码包含疑似明文凭据",
            )
        if "/var/run/docker.sock" in text or re.search(
            r"(?m)(?:^|[\s:-])/(?:proc|sys|dev|etc)(?:/|\s|$)", text
        ):
            add(
                "security:unsafe-mount",
                "BLOCKING",
                "候选包含高权限宿主路径挂载",
            )
        if Path(relative).name.lower().startswith("dockerfile") and not re.search(
            r"(?im)^\s*USER\s+[^\s]+\s*$", text
        ):
            add(
                "security:container-user-unspecified",
                "WARNING",
                "容器未声明非 root 运行用户",
            )

    return ReviewReport(
        attempt_id=attempt_id,
        requirement_revision=int(getattr(draft, "requirement_revision", 1)),
        manifest_hash=digest,
        reviewer_kind="SECURITY_RULES",
        findings=findings,
    )
