from io import BytesIO
from pathlib import Path
import stat
import zipfile
from app.agent.workspace import safe_path
from app.runtime.build import _sensitive


def source_archive(root):
    root = Path(root).resolve()
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(root.rglob("*")):
            relative = path.relative_to(root)
            if path.is_file() and not path.is_symlink() and not _sensitive(relative):
                archive.write(path, relative.as_posix())
    return output.getvalue()


def unpack_source(data, root):
    root = Path(root)
    files = []
    with zipfile.ZipFile(BytesIO(data)) as archive:
        if sum(item.file_size for item in archive.infolist()) > 128 * 1024 * 1024:
            raise ValueError("source archive exceeds limit")
        # Validate all names before creating files.
        for item in archive.infolist():
            path = Path(item.filename)
            if (
                path.is_absolute()
                or ".." in path.parts
                or stat.S_ISLNK(item.external_attr >> 16)
            ):
                raise ValueError("source archive contains unsafe paths")
        for item in archive.infolist():
            if item.is_dir() or item.filename in {
                "release-manifest.json",
                "validation-report.json",
                "source-metadata.json",
            }:
                continue
            relative = Path(item.filename)
            if relative.parts[0] == "source":
                relative = Path(*relative.parts[1:])
            if _sensitive(relative):
                continue
            target = safe_path(root, relative.as_posix())
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(item))
            files.append(relative.as_posix())
    return files
