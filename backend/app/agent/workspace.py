import re
import shutil
import tarfile
from pathlib import Path


def safe_path(root: Path | str, relative: str) -> Path:
    if not relative or Path(relative).is_absolute():
        raise ValueError("path must be relative to workspace")
    base = Path(root).resolve()
    target = (base / relative).resolve()
    if not target.is_relative_to(base):
        raise ValueError("path outside workspace")
    return target


class WorkspaceManager:
    def __init__(self, root: Path | str):
        self.root = Path(root).resolve()

    def create_workspace(self, job_id: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", job_id):
            raise ValueError("invalid job id")
        path = self.root / job_id
        self.root.mkdir(parents=True,exist_ok=True)
        from app.config import settings
        if not path.exists() and shutil.disk_usage(self.root).free < settings.WORKSPACE_MIN_FREE_MB*1024*1024:
            raise ValueError('Execution storage is full; preserved tasks cannot be evicted')
        if path.is_symlink(): raise ValueError('Workspace identity cannot be a symbolic link')
        path.mkdir(parents=True, exist_ok=True)
        (path / ".tool-results").mkdir(exist_ok=True)
        return str(path)

    def snapshot_workspace(self, workspace_id: str, destination: Path) -> Path:
        root = Path(workspace_id).resolve()
        if not root.is_relative_to(self.root) or not root.is_dir():
            raise ValueError("unknown workspace")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(destination, "w:gz") as archive:
            for path in sorted(root.rglob("*")):
                if ".tool-results" not in path.parts:
                    archive.add(path, arcname=path.relative_to(root), recursive=False)
        return destination

