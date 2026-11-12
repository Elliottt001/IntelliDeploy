import os
from pathlib import Path
import subprocess


class WorkspaceQuota:
    """Persistent bounded ext4 image, mounted only by the trusted Linux runner."""

    def __init__(self, limit_mb=1024):
        if os.uname().sysname != "Linux" or os.geteuid() != 0:
            raise RuntimeError(
                "production runner requires a dedicated Linux node with filesystem quota authority"
            )
        if not 128 <= limit_mb <= 8192:
            raise ValueError("workspace quota is outside allowed range")
        self.limit_mb = limit_mb

    def prepare(self, job_root):
        source = Path(job_root) / "source"
        source.mkdir(exist_ok=True)
        image = Path(job_root) / "workspace.ext4"
        if not image.exists():
            with image.open("wb") as file:
                file.truncate(self.limit_mb * 1024 * 1024)
            image.chmod(0o600)
            subprocess.run(["mkfs.ext4", "-q", "-F", str(image)], check=True)
        if not os.path.ismount(source):
            subprocess.run(
                ["mount", "-o", "loop,nosuid,nodev", str(image), str(source)],
                check=True,
            )
        os.chown(source, 10001, 10001)
        source.chmod(0o700)
        return source

    def destroy(self,job_root):
        source=Path(job_root)/'source'
        if os.path.ismount(source): subprocess.run(['umount',str(source)],check=True)
