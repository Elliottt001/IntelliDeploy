from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import zipfile
from pathlib import Path
from typing import Protocol

from app.core.types import AppManifest, ValidationReport
from app.runtime.manifest import digest_pinned, manifest_hash, pin_image, validate_release_manifest


IGNORED_DIRS = {
    ".git",
    ".intellideploy",
    ".next",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    ".tool-results",
    "__pycache__",
    "build",
    "dist",
    "instance-data",
    "node_modules",
    "uploads",
    "venv",
}
SECRET_NAMES = {
    "credentials.json",
    "id_rsa",
    "id_ed25519",
    "secrets.json",
}
SECRET_SUFFIXES = {".key", ".pem", ".p12", ".pfx"}


class BuildFailed(RuntimeError):
    pass


class BuildExecutor(Protocol):
    async def build(self, argv: list[str]) -> None: ...
    async def resolve(self, image: str) -> str: ...


class BuildctlExecutor:
    async def build(self, argv: list[str]) -> None:
        process = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        output, _ = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(output.decode(errors="replace")[-8_000:])

    async def resolve(self, image: str) -> str:
        process = await asyncio.create_subprocess_exec(
            "crane",
            "digest",
            image,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        output, error = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(error.decode(errors="replace")[-8_000:])
        return output.decode().strip()


def _inside(root: Path, relative: str, *, kind: str) -> Path:
    if not relative or Path(relative).is_absolute():
        raise ValueError(f"{kind} must be inside workspace")
    path = (root / relative).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"{kind} must be inside workspace") from exc
    return path


def _request_hash(manifest: AppManifest, registry: str) -> str:
    payload = {
        "manifest": manifest.model_dump(mode="json"),
        "registry": registry,
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _operation_file(workspace: Path, operation_id: str) -> Path:
    key = hashlib.sha256(operation_id.encode()).hexdigest()
    return workspace / ".intellideploy" / "build-operations" / f"{key}.json"


async def build_release(
    workspace_id: str | Path,
    manifest: AppManifest,
    operation_id: str,
    *,
    build_executor: BuildExecutor | None = None,
    registry: str | None = None,
) -> AppManifest:
    workspace = Path(workspace_id).resolve()
    if not workspace.is_dir():
        raise ValueError("workspace does not exist")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", operation_id):
        raise ValueError("operation ID must be a safe build identifier")
    registry = (registry or os.environ.get("BUILD_REGISTRY", "")).strip().strip("/")
    if not registry:
        raise BuildFailed("dedicated build registry is not configured")
    executor = build_executor or BuildctlExecutor()
    operation_file = _operation_file(workspace, operation_id)
    request_hash = _request_hash(manifest, registry)
    if operation_file.exists():
        saved = json.loads(operation_file.read_text())
        if saved.get("request_hash") != request_hash:
            raise ValueError("operation ID was reused for a different build request")
        return AppManifest.model_validate(saved["manifest"])

    builds = {item.service: item for item in manifest.builds}
    result = manifest.model_copy(deep=True)
    metadata_root = workspace / ".intellideploy" / "build-metadata"
    metadata_root.mkdir(parents=True, exist_ok=True)
    try:
        for service in result.services:
            build = builds.get(service.name)
            if build is None:
                if not digest_pinned(service.image):
                    digest = await executor.resolve(service.image)
                    service.image = pin_image(service.image, digest)
                continue
            context = _inside(workspace, build.context, kind="build context")
            dockerfile = _inside(workspace, build.dockerfile, kind="dockerfile")
            if not context.is_dir() or not dockerfile.is_file():
                raise ValueError("build context or dockerfile does not exist")
            try:
                dockerfile.relative_to(context)
            except ValueError as exc:
                raise ValueError("dockerfile must be inside build context") from exc
            metadata_file = metadata_root / f"{operation_id}-{service.name}.json"
            image_name = f"{registry}/{service.name}:{operation_id}"
            argv = [
                "buildctl",
                "build",
                "--frontend",
                "dockerfile.v0",
                "--local",
                f"context={context}",
                "--local",
                f"dockerfile={dockerfile.parent}",
                "--opt",
                f"filename={dockerfile.name}",
                "--output",
                f"type=image,name={image_name},push=true",
                "--metadata-file",
                str(metadata_file),
            ]
            await executor.build(argv)
            if not metadata_file.is_file():
                raise RuntimeError("builder did not write metadata")
            metadata = json.loads(metadata_file.read_text())
            digest = metadata.get("containerimage.digest")
            service.image = pin_image(f"{registry}/{service.name}", digest)
        validate_release_manifest(result)
    except Exception as exc:
        if isinstance(exc, (ValueError, BuildFailed)):
            raise
        raise BuildFailed(str(exc)) from exc

    operation_file.parent.mkdir(parents=True, exist_ok=True)
    temporary = operation_file.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(
            {"request_hash": request_hash, "manifest": result.model_dump(mode="json")},
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    os.replace(temporary, operation_file)
    return result


def _sensitive(path: Path) -> bool:
    if any(part in IGNORED_DIRS for part in path.parts):
        return True
    if any(
        path.parts[index : index + 2] in {("data", "runtime"), ("data", "production")}
        for index in range(max(0, len(path.parts) - 1))
    ):
        return True
    name = path.name.lower()
    return (
        name == ".env"
        or name.startswith(".env.")
        or name in SECRET_NAMES
        or path.suffix.lower() in SECRET_SUFFIXES
    )


def snapshot_release(
    workspace_id: str | Path,
    manifest: AppManifest,
    report: ValidationReport,
) -> str:
    workspace = Path(workspace_id).resolve()
    if not workspace.is_dir():
        raise ValueError("workspace does not exist")
    source_descriptor = workspace / ".intellideploy" / "source.json"
    source = (
        json.loads(source_descriptor.read_text())
        if source_descriptor.exists() and not source_descriptor.is_symlink()
        else {}
    )
    files: dict[str, str] = {}
    included: list[Path] = []
    for path in sorted(workspace.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(workspace)
        if _sensitive(relative):
            continue
        included.append(path)
        files[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    metadata = {
        **source,
        "files": files,
        "lock_files": [
            name for name in files if Path(name).name in {"package-lock.json", "pnpm-lock.yaml", "poetry.lock", "uv.lock"}
        ],
    }
    identity = hashlib.sha256(
        json.dumps(
            {
                "manifest": manifest_hash(manifest),
                "report": report.model_dump(mode="json"),
                "files": files,
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    output = workspace / ".intellideploy" / "releases" / f"{identity}.zip"
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in included:
            archive.write(path, f"source/{path.relative_to(workspace).as_posix()}")
        archive.writestr(
            "release-manifest.json",
            json.dumps(manifest.model_dump(mode="json"), ensure_ascii=False, sort_keys=True),
        )
        archive.writestr(
            "validation-report.json",
            json.dumps(report.model_dump(mode="json"), ensure_ascii=False, sort_keys=True),
        )
        archive.writestr(
            "source-metadata.json",
            json.dumps(metadata, ensure_ascii=False, sort_keys=True),
        )
    os.replace(temporary, output)
    return str(output)
