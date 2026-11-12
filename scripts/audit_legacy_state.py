"""Read-only audit for the legacy IntelliDeploy SQLite database."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


LEGACY_TABLES = (
    "analyses",
    "deployments",
    "github_accounts",
    "projects",
    "users",
)
BUSINESS_TABLES = ("projects", "deployments", "analyses", "github_accounts")
TARGET_USER_COLUMNS = {
    "id",
    "username",
    "email",
    "hashed_password",
    "kubeconfig",
    "is_active",
    "is_developer",
    "created_at",
}


def _read_only(path: Path) -> sqlite3.Connection:
    source = Path(path).resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    return sqlite3.connect(f"file:{source}?mode=ro", uri=True)


def audit_legacy(path: Path) -> dict:
    with _read_only(path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        table_counts = {}
        for table in LEGACY_TABLES:
            table_counts[table] = (
                connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
                if table in tables
                else 0
            )
        user_columns = {
            row[1]
            for row in connection.execute('PRAGMA table_info("users")')
        } if "users" in tables else set()

    blocked = {
        table: table_counts[table]
        for table in BUSINESS_TABLES
        if table_counts[table]
    }
    return {
        "table_counts": table_counts,
        "schema_differences": {
            "users_missing_in_legacy": sorted(TARGET_USER_COLUMNS - user_columns),
            "users_legacy_only": sorted(user_columns - TARGET_USER_COLUMNS),
        },
        "migratable_users": table_counts["users"] if not blocked else 0,
        "migration_blocked": bool(blocked),
        "blocked_tables": blocked,
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args(argv)
    print(json.dumps(audit_legacy(args.path), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
