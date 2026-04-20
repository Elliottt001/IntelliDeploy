from __future__ import annotations

import hashlib
from pathlib import Path

from fallback.schemas.plan import GeneratedFile, ModifiedFile
from fallback.schemas.workspace import PatchApplyResult


class PatchApplyError(RuntimeError):
    pass


def _resolve_workspace_path(workspace_path: Path, relative_path: str) -> Path:
    candidate = (workspace_path / relative_path).resolve()
    workspace_root = workspace_path.resolve()
    try:
        candidate.relative_to(workspace_root)
    except ValueError as exc:
        raise PatchApplyError(f"Path escapes workspace root: {relative_path}") from exc
    return candidate


def _is_text_path(path: str) -> bool:
    return "\x00" not in path


def _extract_replacement_content(modified_file: ModifiedFile) -> str:
    patch = modified_file.patch
    marker = "\n\n"
    if marker in patch:
        return patch.split(marker, 1)[1]
    return patch


def _digest(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]


def apply_patch_plan(
    *,
    workspace_path: Path,
    generated_files: list[GeneratedFile],
    modified_files: list[ModifiedFile],
    dry_run: bool = False,
) -> PatchApplyResult:
    result = PatchApplyResult()

    for generated_file in generated_files:
        if not _is_text_path(generated_file.path):
            raise PatchApplyError(f"Unsupported generated file path: {generated_file.path}")
        target = _resolve_workspace_path(workspace_path, generated_file.path)
        if target.exists():
            result.skipped_files.append(generated_file.path)
            result.logs.append(f"skip_existing:{generated_file.path}")
            continue
        if dry_run:
            result.created_files.append(generated_file.path)
            result.logs.append(f"dry_run_create:{generated_file.path}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(generated_file.content, encoding="utf-8")
        result.created_files.append(generated_file.path)
        result.logs.append(f"created:{generated_file.path}:after={_digest(generated_file.content)}")

    for modified_file in modified_files:
        if not _is_text_path(modified_file.path):
            raise PatchApplyError(f"Unsupported modified file path: {modified_file.path}")
        target = _resolve_workspace_path(workspace_path, modified_file.path)
        if not target.exists():
            result.conflicts.append(modified_file.path)
            result.logs.append(f"missing_target:{modified_file.path}")
            continue
        replacement_content = _extract_replacement_content(modified_file)
        before_content = target.read_text(encoding="utf-8")
        if before_content == replacement_content:
            result.skipped_files.append(modified_file.path)
            result.logs.append(f"skip_unchanged:{modified_file.path}")
            continue
        if dry_run:
            result.updated_files.append(modified_file.path)
            result.logs.append(
                f"dry_run_update:{modified_file.path}:before={_digest(before_content)}:after={_digest(replacement_content)}"
            )
            continue
        target.write_text(replacement_content, encoding="utf-8")
        result.updated_files.append(modified_file.path)
        result.logs.append(
            f"updated:{modified_file.path}:before={_digest(before_content)}:after={_digest(replacement_content)}"
        )

    return result
