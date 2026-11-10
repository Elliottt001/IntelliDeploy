from __future__ import annotations

import hashlib
import json
import re

from app.core.types import AppManifest


DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")


def manifest_hash(manifest: AppManifest) -> str:
    payload = json.dumps(
        manifest.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    return hashlib.sha256(payload).hexdigest()


def digest_pinned(image: str) -> bool:
    return "@sha256:" in image and DIGEST_RE.fullmatch(image.rsplit("@", 1)[1]) is not None


def pin_image(image: str, digest: str) -> str:
    if not DIGEST_RE.fullmatch(digest):
        raise ValueError("image digest must be sha256")
    return f"{image.split('@', 1)[0]}@{digest}"


def validate_release_manifest(manifest: AppManifest) -> None:
    if any(not digest_pinned(service.image) for service in manifest.services):
        raise ValueError("release manifest images must be pinned by digest")
