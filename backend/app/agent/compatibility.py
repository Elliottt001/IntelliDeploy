from pathlib import Path

from app.core.types import AppManifest, CompatibilityReport, Requirement


class TargetUnavailable(RuntimeError):
    retryable = True


def assess_compatibility(profile: dict, requirement: Requirement) -> CompatibilityReport:
    files = set(profile.get("file_tree") or profile.get("files") or [])
    key_files = profile.get("key_files") or {}
    text = " ".join([profile.get("description") or "", *key_files.values()]).lower()
    unsupported = []
    for marker in ("gpu", "cuda", "windows gui", "win32", "android native", "ios native"):
        if marker in text:
            unsupported.append(marker)
    if unsupported:
        return CompatibilityReport(status="UNSUPPORTED", reasons=[f"requires {marker}" for marker in unsupported], evidence={"profile": text[:500]})
    runtime = None
    if "package.json" in {Path(path).name for path in files}: runtime = "node"
    elif {"requirements.txt", "pyproject.toml"} & {Path(path).name for path in files}: runtime = "python"
    elif any(Path(path).name == "Dockerfile" for path in files): runtime = "container"
    elif any(path.endswith((".html", ".css", ".js")) for path in files): runtime = "static"
    databases = [name for name in ("postgresql", "mysql", "redis", "sqlite") if name in text]
    if "psycopg" in text and "postgresql" not in databases:
        databases.append("postgresql")
    evidence = {"files": ",".join(sorted(files)[:20])} if files else {}
    if not runtime or not key_files:
        return CompatibilityReport(status="UNKNOWN", reasons=["runtime or key dependency evidence is incomplete"], runtime=runtime, databases=databases, evidence=evidence)
    return CompatibilityReport(status="SUPPORTED", reasons=["Linux amd64 web runtime is supported"], runtime=runtime, databases=databases, evidence=evidence)


def select_deploy_target(manifest: AppManifest, targets: list[dict]) -> str:
    memory = sum(service.memory_mb for service in manifest.services)
    cpu = sum(service.cpu_millis for service in manifest.services)
    for target in targets:
        capacity = target.get("capacity") or {}
        if (target.get("enabled") and target.get("health") == "HEALTHY"
                and target.get("architecture", "amd64") == "amd64"
                and capacity.get("memory_mb", 0) >= memory
                and capacity.get("cpu_millis", 0) >= cpu):
            return target["id"]
    raise TargetUnavailable("no compatible healthy deployment target")

