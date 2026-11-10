from __future__ import annotations

import mimetypes
import os
from pathlib import Path, PurePath
from uuid import uuid4

from app.apps.models import Instance
from app.capabilities.models import FileRecord
from app.config import settings
from app.core.types import CapabilityContext
from app.database import SessionLocal


ALLOWED_TYPES = {
    "application/json",
    "application/pdf",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/csv",
    "text/markdown",
    "text/plain",
}


class FileAccessDenied(PermissionError):
    pass


class FileValidationError(ValueError):
    pass


class FileStore:
    def __init__(self, *, session_factory, root: Path, max_bytes: int):
        self.session_factory = session_factory
        self.root = Path(root).resolve()
        self.max_bytes = max_bytes

    def _validate_filename(self, filename: str) -> tuple[str, str]:
        if (
            not filename
            or PurePath(filename).name != filename
            or "/" in filename
            or "\\" in filename
            or "\x00" in filename
        ):
            raise FileValidationError("invalid filename")
        content_type = mimetypes.guess_type(filename)[0]
        if content_type not in ALLOWED_TYPES:
            raise FileValidationError("file type is not allowed")
        return filename, content_type

    def create(
        self,
        context: CapabilityContext,
        stream,
        filename: str,
        public: bool = False,
    ) -> str:
        filename, content_type = self._validate_filename(filename)
        if not public and context.user_id is None:
            raise FileAccessDenied("private uploads require an authenticated user")
        instance_root = (self.root / context.instance_id).resolve()
        if not instance_root.is_relative_to(self.root):
            raise FileValidationError("invalid instance path")
        instance_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        path = instance_root / uuid4().hex
        size = 0
        try:
            with path.open("xb") as output:
                while True:
                    chunk = stream.read(64 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > self.max_bytes:
                        raise FileValidationError("file exceeds size limit")
                    output.write(chunk)
            os.chmod(path, 0o600)
            with self.session_factory() as session:
                instance = session.get(Instance, context.instance_id)
                if instance is None or instance.app_id != context.app_id:
                    raise FileAccessDenied("instance context mismatch")
                record = FileRecord(
                    instance_id=context.instance_id,
                    owner_id=context.user_id,
                    path=str(path),
                    filename=filename,
                    content_type=content_type,
                    public=public,
                    size=size,
                )
                session.add(record)
                session.commit()
                return record.id
        except Exception:
            path.unlink(missing_ok=True)
            raise

    def record(self, context: CapabilityContext, file_id: str) -> FileRecord:
        with self.session_factory() as session:
            record = session.get(FileRecord, file_id)
            if record is None or record.instance_id != context.instance_id:
                raise FileAccessDenied("file is not available in this instance")
            if not record.public and (
                context.user_id is None or record.owner_id != context.user_id
            ):
                raise FileAccessDenied("file is private")
            session.expunge(record)
            return record

    def read(self, context: CapabilityContext, file_id: str) -> bytes:
        record = self.record(context, file_id)
        path = Path(record.path).resolve()
        if not path.is_relative_to(self.root) or not path.is_file():
            raise FileAccessDenied("file content is unavailable")
        return path.read_bytes()


def _store() -> FileStore:
    return FileStore(
        session_factory=SessionLocal,
        root=Path(settings.INSTANCE_FILES_ROOT),
        max_bytes=settings.INSTANCE_FILE_MAX_BYTES,
    )


def create_file(
    context: CapabilityContext, stream, filename: str, public: bool = False
) -> str:
    return _store().create(context, stream, filename, public)


def read_file(context: CapabilityContext, file_id: str) -> bytes:
    return _store().read(context, file_id)

