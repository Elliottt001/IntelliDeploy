"""Migrate legacy users from a consistent SQLite snapshot into PostgreSQL."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path

from sqlalchemy import or_, select, text

from app.database import SessionLocal
from app.models.user import User

try:
    from scripts.audit_legacy_state import audit_legacy
except ModuleNotFoundError:  # Direct `python scripts/migrate_legacy_users.py` execution.
    from audit_legacy_state import audit_legacy


class LegacyMigrationConflict(RuntimeError):
    pass


class LegacyDataRequiresMapping(RuntimeError):
    pass


def create_snapshot(source_path: Path, snapshot_path: Path) -> Path:
    source_path = Path(source_path).resolve()
    snapshot_path = Path(snapshot_path).resolve()
    if source_path == snapshot_path:
        raise ValueError("snapshot path must differ from source path")
    if snapshot_path.exists():
        raise FileExistsError(snapshot_path)
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
    try:
        with sqlite3.connect(snapshot_path) as snapshot:
            source.backup(snapshot)
    finally:
        source.close()
    os.chmod(snapshot_path, 0o600)
    return snapshot_path


def _created_at(value: object) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


def _legacy_users(snapshot: Path) -> list[sqlite3.Row]:
    source = Path(snapshot).resolve()
    connection = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        return list(
            connection.execute(
                """SELECT id,username,email,hashed_password,is_active,created_at
                   FROM users ORDER BY id"""
            )
        )
    finally:
        connection.close()


def _synchronize_user_id_sequence(target_session) -> None:
    target_session.execute(
        text(
            """SELECT setval(
                   pg_get_serial_sequence('users','id'),
                   COALESCE(MAX(id), 1),
                   COUNT(*) > 0
               )
               FROM users"""
        )
    )


def migrate_users(source_snapshot: Path, target_session) -> dict:
    audit = audit_legacy(source_snapshot)
    if audit["migration_blocked"]:
        tables = ",".join(sorted(audit["blocked_tables"]))
        raise LegacyDataRequiresMapping(
            f"legacy business data requires an explicit mapping: {tables}"
        )
    rows = _legacy_users(source_snapshot)
    created = []
    existing = 0
    try:
        with target_session.begin_nested():
            for row in rows:
                matches = list(
                    target_session.scalars(
                        select(User).where(
                            or_(
                                User.id == row["id"],
                                User.username == row["username"],
                                User.email == row["email"],
                            )
                        )
                    )
                )
                if matches:
                    if len(matches) != 1:
                        raise LegacyMigrationConflict(
                            "legacy user identity conflict"
                        )
                    user = matches[0]
                    if not (
                        user.id == row["id"]
                        and user.username == row["username"]
                        and user.email == row["email"]
                        and user.hashed_password == row["hashed_password"]
                    ):
                        raise LegacyMigrationConflict(
                            "legacy user identity conflict"
                        )
                    existing += 1
                    continue
                user = User(
                    id=row["id"],
                    username=row["username"],
                    email=row["email"],
                    hashed_password=row["hashed_password"],
                    kubeconfig=None,
                    is_active=bool(row["is_active"]),
                    is_developer=False,
                    created_at=_created_at(row["created_at"]),
                )
                target_session.add(user)
                created.append(user)
            target_session.flush()
            _synchronize_user_id_sequence(target_session)
    except Exception:
        for user in created:
            if user in target_session:
                target_session.expunge(user)
        raise
    return {"created": len(created), "existing": existing}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--snapshot", required=True, type=Path)
    args = parser.parse_args(argv)
    snapshot = create_snapshot(args.source, args.snapshot)
    with SessionLocal() as session:
        result = migrate_users(snapshot, session)
        session.commit()
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
