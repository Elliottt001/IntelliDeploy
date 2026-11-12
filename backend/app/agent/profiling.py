from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit, urlunsplit

from app.agent.checkpoint import stage_input_hash
from app.agent.compatibility import assess_compatibility
from app.agent.contracts import (
    EnvRequirement,
    EvidenceRef,
    Finding,
    RepositoryProfile,
)
from app.core.types import Requirement, RetrievalCandidate
from fallback.classifier.conflict_detector import detect_all_conflicts
from fallback.classifier.entrypoint_detector import (
    detect_build_commands,
    detect_entry_candidates,
    detect_ports,
    detect_start_commands,
)
from fallback.classifier.env_detector import detect_env_vars
from fallback.classifier.framework_detector import detect_framework
from fallback.classifier.package_manager_detector import detect_package_manager
from fallback.classifier.risk_detector import detect_all_risks


PROFILER_VERSION = "profile-v1"


def _canonical_url(value: str) -> str:
    parsed = urlsplit(value)
    path = parsed.path.rstrip("/")
    if path.endswith(".git"):
        path = path[:-4]
    return urlunsplit(
        (parsed.scheme.lower(), parsed.netloc.lower(), path, "", "")
    )


def _unsafe_path(value: str) -> bool:
    normalized = value.replace("\\", "/")
    path = PurePosixPath(normalized)
    return (
        path.is_absolute()
        or ".." in path.parts
        or "->" in normalized
        or normalized.startswith(".git/")
    )


def _docker_start_command(key_files: dict[str, str]) -> list[str]:
    dockerfile = next(
        (
            content
            for name, content in key_files.items()
            if Path(name).name.lower() == "dockerfile"
        ),
        "",
    )
    for line in dockerfile.splitlines():
        stripped = line.strip()
        if not stripped.upper().startswith(("CMD ", "ENTRYPOINT ")):
            continue
        value = stripped.split(maxsplit=1)[1]
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return [value]
        if isinstance(parsed, list) and all(isinstance(item, str) for item in parsed):
            return [" ".join(parsed)]
    return []


def _license_status(key_files: dict[str, str]) -> str:
    text = " ".join(
        content
        for name, content in key_files.items()
        if Path(name).name.lower().startswith(("license", "copying", "notice"))
    ).lower()
    if any(marker in text for marker in ("mit license", "apache license", "bsd license", "isc license")):
        return "ALLOWED"
    if any(marker in text for marker in ("affero general public license", "all rights reserved")):
        return "BLOCKED"
    return "UNKNOWN"


def _secret_env(name: str) -> bool:
    return any(
        marker in name
        for marker in ("SECRET", "TOKEN", "PASSWORD", "PRIVATE", "API_KEY", "DATABASE_URL")
    )


def _feature_list(blob: str, markers: dict[str, tuple[str, ...]]) -> list[str]:
    return [
        name for name, values in markers.items() if any(value in blob for value in values)
    ]


def profile_repository(
    candidate: RetrievalCandidate, requirement: Requirement
) -> RepositoryProfile:
    if not candidate.commit:
        raise ValueError("repository profile requires an immutable commit")
    file_tree = list(candidate.file_tree)
    key_files = dict(candidate.key_files)
    package = detect_package_manager(file_tree, key_files)
    entries = detect_entry_candidates(file_tree, key_files)
    framework = detect_framework(
        file_tree,
        key_files,
        package["dependency_files"],
        entries,
    )
    start_commands = _docker_start_command(key_files) or detect_start_commands(
        key_files
    )
    build_commands = detect_build_commands(key_files)
    ports = detect_ports(key_files, framework)
    env_result = detect_env_vars(key_files, file_tree)
    fact_summary = {
        "entry_candidates": entries,
        "detected_ports": ports,
        "detected_framework": framework["detected_framework"],
        "has_build_script": bool(build_commands),
        "detected_env_vars": env_result["detected_env_vars"],
    }
    conflicts = detect_all_conflicts(fact_summary, key_files)["conflict_items"]
    risks = detect_all_risks(
        candidate.model_dump(mode="json"), fact_summary, key_files, file_tree
    )["risk_items"]
    compatibility = assess_compatibility(
        candidate.model_dump(mode="json"), requirement
    )
    evidence_ref = f"{_canonical_url(candidate.repo_url)}@{candidate.commit}"
    unknowns = list(framework.get("uncertain_points") or [])
    unknowns.extend(package.get("warnings") or [])
    if not entries:
        unknowns.append("missing_entrypoint")
    if any(_unsafe_path(path) for path in [*file_tree, *key_files]):
        unknowns.append("unsafe_path")
    if compatibility.status == "UNKNOWN":
        unknowns.append("runtime_compatibility")

    blob = "\n".join(key_files.values()).lower()
    databases = list(compatibility.databases)
    for name, markers in {
        "postgresql": ("postgresql", "psycopg", "postgres://"),
        "mysql": ("mysql",),
        "mongodb": ("mongodb", "mongoose"),
        "sqlite": ("sqlite",),
        "redis": ("redis",),
    }.items():
        if name not in databases and any(marker in blob for marker in markers):
            databases.append(name)

    dockerfile = next(
        (
            content
            for name, content in key_files.items()
            if Path(name).name.lower() == "dockerfile"
        ),
        "",
    )
    compose = next(
        (
            content
            for name, content in key_files.items()
            if Path(name).name.lower() in {"compose.yml", "docker-compose.yml"}
        ),
        "",
    )
    compose_services = [
        match.group(1)
        for match in re.finditer(r"^\s{2}([A-Za-z0-9_.-]+):\s*$", compose, re.MULTILINE)
        if match.group(1) != "services"
    ]
    required_envs = [
        EnvRequirement(
            name=detail.name,
            required=detail.required,
            source_ref=env_result["env_var_sources"].get(detail.name, "detected"),
            secret=_secret_env(detail.name),
        )
        for detail in env_result["env_var_details"]
    ]
    source_evidence = EvidenceRef(
        kind="REPOSITORY",
        reference=evidence_ref,
        digest=stage_input_hash(candidate),
        access="PRIVATE",
    )
    return RepositoryProfile(
        repo_url=_canonical_url(candidate.repo_url),
        commit=candidate.commit,
        languages=(
            []
            if framework["detected_language"] == "unknown"
            else [framework["detected_language"]]
        ),
        frameworks=framework["detected_frameworks"],
        project_type=framework["detected_project_type_by_rule"],
        dependency_files=package["dependency_files"],
        lock_files=package["lock_files"],
        package_manager=(
            None if package["package_manager"] == "unknown" else package["package_manager"]
        ),
        entrypoints=entries,
        start_commands=start_commands,
        build_commands=build_commands,
        ports=ports,
        databases=databases,
        persistent_paths=sorted(
            set(re.findall(r"(?:^|\s)(/[A-Za-z0-9_./-]+)", compose))
        ),
        required_envs=required_envs,
        has_dockerfile=bool(dockerfile),
        dockerfile_valid=bool(
            dockerfile
            and re.search(r"^\s*FROM\s+\S+", dockerfile, re.MULTILINE | re.IGNORECASE)
            and re.search(r"^\s*(CMD|ENTRYPOINT)\s+", dockerfile, re.MULTILINE | re.IGNORECASE)
        ),
        compose_services=compose_services,
        identity_features=_feature_list(
            blob,
            {"authentication": ("auth", "login"), "authorization": ("role", "permission")},
        ),
        file_features=_feature_list(blob, {"upload": ("upload", "multipart")}),
        ai_features=_feature_list(blob, {"model_api": ("openai", "deepseek", "anthropic")}),
        search_features=_feature_list(blob, {"search": ("search", "elasticsearch", "meilisearch")}),
        license_status=_license_status(key_files),
        compatibility=compatibility,
        conflicts=[
            Finding(
                code=code,
                message=f"repository conflict detected: {code}",
                severity="WARNING",
                evidence_ref=evidence_ref,
            )
            for code in conflicts
        ],
        risks=[
            Finding(
                code=code,
                message=f"repository risk detected: {code}",
                severity="WARNING",
                evidence_ref=evidence_ref,
            )
            for code in risks
        ],
        unknowns=sorted(set(unknowns)),
        evidence_refs=[source_evidence],
    )


class ProfileCache:
    def __init__(self, root: Path):
        self.root = root

    @staticmethod
    def _identity(repo_url: str, commit: str, profiler_version: str) -> str:
        value = json.dumps(
            [_canonical_url(repo_url), commit.lower(), profiler_version],
            ensure_ascii=False,
            separators=(",", ":"),
        )
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def _path(self, repo_url: str, commit: str, profiler_version: str) -> Path:
        return self.root / f"{self._identity(repo_url, commit, profiler_version)}.json"

    def load(
        self, repo_url: str, commit: str, profiler_version: str
    ) -> RepositoryProfile | None:
        path = self._path(repo_url, commit, profiler_version)
        if not path.is_file():
            return None
        try:
            profile = RepositoryProfile.model_validate_json(path.read_text())
        except Exception:
            return None
        if (
            _canonical_url(profile.repo_url) != _canonical_url(repo_url)
            or profile.commit.lower() != commit.lower()
        ):
            return None
        return profile

    def store(self, profile: RepositoryProfile) -> EvidenceRef:
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        path = self._path(profile.repo_url, profile.commit, PROFILER_VERSION)
        payload = profile.model_dump_json(indent=2).encode("utf-8")
        descriptor, temporary_name = tempfile.mkstemp(dir=self.root)
        temporary = Path(temporary_name)
        try:
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "wb") as output:
                output.write(payload)
                output.flush()
                os.fsync(output.fileno())
            RepositoryProfile.model_validate_json(temporary.read_text())
            os.replace(temporary, path)
            os.chmod(path, 0o600)
        finally:
            if temporary.exists():
                temporary.unlink()
        return EvidenceRef(
            kind="PROFILE",
            reference=str(path),
            digest=hashlib.sha256(payload).hexdigest(),
            access="PRIVATE",
        )
