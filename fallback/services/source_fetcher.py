from __future__ import annotations

import shutil
import subprocess
import zipfile
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

from pydantic import BaseModel, ConfigDict, Field

from .logger import get_fallback_logger


class RepoFetchError(RuntimeError):
    pass


class RepoNotFoundError(RepoFetchError):
    pass


class RepoAuthError(RepoFetchError):
    pass


class SourceFetchResult(BaseModel):
    source_path: Path
    resolved_commit_sha: str | None = None
    default_branch: str | None = None
    logs: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


def _safe_reset_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def _write_seed_files(source_path: Path, seed_files: dict[str, str]) -> list[str]:
    logs: list[str] = []
    for relative_path, content in seed_files.items():
        target = source_path / Path(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        logs.append(f"seeded:{relative_path}")
    return logs


def _git_clone(repo_url: str, branch: str | None, source_path: Path) -> tuple[str | None, list[str]]:
    logs: list[str] = [f"strategy=git_clone", f"repo_url={repo_url}"]
    command = ["git", "clone", "--depth", "1"]
    if branch:
        command.extend(["--branch", branch])
    command.extend([repo_url, str(source_path)])
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    logs.append(f"command={' '.join(command)}")
    if result.stdout.strip():
        logs.append(f"stdout={result.stdout.strip()}")
    if result.stderr.strip():
        logs.append(f"stderr={result.stderr.strip()}")
    if result.returncode != 0:
        stderr_lower = result.stderr.lower()
        if "authentication" in stderr_lower or "permission denied" in stderr_lower:
            raise RepoAuthError(result.stderr.strip() or "Repository authentication failed.")
        if "not found" in stderr_lower or "repository" in stderr_lower:
            raise RepoNotFoundError(result.stderr.strip() or "Repository not found.")
        raise RepoFetchError(result.stderr.strip() or "git clone failed.")

    sha_result = subprocess.run(
        ["git", "-C", str(source_path), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=False,
    )
    resolved_sha = sha_result.stdout.strip() or None
    if resolved_sha:
        logs.append(f"resolved_commit_sha={resolved_sha}")
    return resolved_sha, logs


def _download_archive(repo_url: str, branch: str | None, source_path: Path) -> tuple[str | None, list[str]]:
    parsed = urlparse(repo_url)
    path_parts = parsed.path.strip("/").split("/")
    if parsed.netloc != "github.com" or len(path_parts) < 2:
        raise RepoFetchError("Archive download is only supported for GitHub repositories.")

    owner, repo = path_parts[:2]
    ref = branch or "main"
    archive_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{ref}.zip"
    logs = [f"strategy=archive_download", f"archive_url={archive_url}"]
    archive_path = source_path.parent / f"{source_path.name}-{ref}.zip"

    try:
        with urlopen(archive_url, timeout=30) as response:  # noqa: S310
            archive_path.write_bytes(response.read())
    except Exception as exc:  # pragma: no cover - network failure path
        raise RepoFetchError(f"Archive download failed: {exc}") from exc

    with zipfile.ZipFile(archive_path) as archive:
        archive.extractall(source_path.parent)

    extracted_root = next(source_path.parent.glob(f"{repo}-*"), None)
    if extracted_root is None or not extracted_root.is_dir():
        raise RepoFetchError("Archive extraction did not produce a repository root.")

    shutil.move(str(extracted_root), str(source_path))
    archive_path.unlink(missing_ok=True)
    logs.append("archive_extracted=true")
    return None, logs


def fetch_source(
    *,
    repo_url: str | None,
    default_branch: str | None,
    task_id: str,
    destination_root: Path,
    commit_sha: str | None = None,
    seed_files: dict[str, str] | None = None,
) -> SourceFetchResult:
    logger = get_fallback_logger("fallback.source_fetcher")
    source_path = destination_root / task_id / "source"
    source_path.parent.mkdir(parents=True, exist_ok=True)
    _safe_reset_directory(source_path)

    logs: list[str] = [f"task_id={task_id}"]
    resolved_commit_sha = commit_sha

    if seed_files:
        logs.extend(_write_seed_files(source_path, seed_files))
        if commit_sha:
            logs.append(f"provided_commit_sha={commit_sha}")
        logger.info("source_fetch task_id=%s strategy=seeded_snapshot files=%s", task_id, len(seed_files))
        return SourceFetchResult(
            source_path=source_path,
            resolved_commit_sha=resolved_commit_sha,
            default_branch=default_branch,
            logs=logs,
        )

    if not repo_url:
        raise RepoFetchError("repo_url/source_repo_url is required when no seeded files are available.")

    try:
        resolved_commit_sha, fetch_logs = _git_clone(repo_url, default_branch, source_path)
        logs.extend(fetch_logs)
    except RepoFetchError as primary_error:
        logs.append(f"git_clone_failed={primary_error}")
        _safe_reset_directory(source_path)
        try:
            resolved_commit_sha, archive_logs = _download_archive(repo_url, default_branch, source_path)
            logs.extend(archive_logs)
        except RepoFetchError:
            raise primary_error

    logger.info(
        "source_fetch task_id=%s repo=%s branch=%s commit=%s",
        task_id,
        repo_url,
        default_branch,
        resolved_commit_sha,
    )
    return SourceFetchResult(
        source_path=source_path,
        resolved_commit_sha=resolved_commit_sha,
        default_branch=default_branch,
        logs=logs,
    )
