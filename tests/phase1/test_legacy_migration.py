import importlib.util
import sqlite3
from datetime import datetime
from pathlib import Path

import pytest
from sqlalchemy import select, text

from app.models.user import User
from app.utils.security import get_password_hash, verify_password


ROOT = Path(__file__).resolve().parents[2]
AUDIT_SCRIPT = ROOT / "scripts" / "audit_legacy_state.py"
MIGRATE_SCRIPT = ROOT / "scripts" / "migrate_legacy_users.py"


def _load(path: Path, name: str):
    assert path.is_file(), f"{path.name} is not implemented"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def legacy_database(tmp_path):
    path = tmp_path / "legacy.db"
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                hashed_password TEXT NOT NULL,
                is_active BOOLEAN,
                created_at DATETIME,
                kubeconfig TEXT
            );
            CREATE TABLE projects (id INTEGER PRIMARY KEY, owner_id INTEGER);
            CREATE TABLE deployments (id INTEGER PRIMARY KEY, project_id INTEGER);
            CREATE TABLE analyses (id INTEGER PRIMARY KEY, project_id INTEGER);
            CREATE TABLE github_accounts (id INTEGER PRIMARY KEY, user_id INTEGER);
            """
        )
        for user_id in range(1, 5):
            connection.execute(
                "INSERT INTO users VALUES(?,?,?,?,?,?,?)",
                (
                    user_id,
                    f"legacy-{user_id}",
                    f"legacy-{user_id}@test",
                    get_password_hash(f"password-{user_id}"),
                    True,
                    datetime(2026, 1, user_id).isoformat(),
                    "sensitive-kubeconfig",
                ),
            )
        connection.commit()
    return path


def test_legacy_audit_is_read_only_and_never_returns_password_material(
    legacy_database,
):
    module = _load(AUDIT_SCRIPT, "audit_legacy_state")
    before = legacy_database.read_bytes()
    result = module.audit_legacy(legacy_database)
    assert result["table_counts"] == {
        "analyses": 0,
        "deployments": 0,
        "github_accounts": 0,
        "projects": 0,
        "users": 4,
    }
    assert result["migratable_users"] == 4
    assert result["migration_blocked"] is False
    assert "hashed_password" not in str(result)
    assert "sensitive-kubeconfig" not in str(result)
    assert legacy_database.read_bytes() == before


def test_legacy_users_import_is_idempotent(legacy_database, pg_session):
    module = _load(MIGRATE_SCRIPT, "migrate_legacy_users")
    one = module.migrate_users(legacy_database, pg_session)
    two = module.migrate_users(legacy_database, pg_session)
    assert one == {"created": 4, "existing": 0}
    assert two == {"created": 0, "existing": 4}

    users = list(
        pg_session.scalars(
            select(User).where(User.username.like("legacy-%")).order_by(User.id)
        )
    )
    assert [user.id for user in users] == [1, 2, 3, 4]
    assert verify_password("password-3", users[2].hashed_password)
    assert all(user.is_developer is False for user in users)
    assert all(user.kubeconfig is None for user in users)


def test_legacy_import_advances_the_postgresql_user_id_sequence(
    legacy_database, pg_session
):
    module = _load(MIGRATE_SCRIPT, "migrate_legacy_users_sequence")
    pg_session.execute(
        text(
            "SELECT setval(pg_get_serial_sequence('users','id'), 1, false)"
        )
    )
    module.migrate_users(legacy_database, pg_session)
    new_user = User(
        username="post-migration",
        email="post-migration@test",
        hashed_password=get_password_hash("post-migration-password"),
    )
    pg_session.add(new_user)
    pg_session.flush()
    assert new_user.id > 4


def test_conflicting_identity_rolls_back_the_entire_batch(legacy_database, pg_session):
    module = _load(MIGRATE_SCRIPT, "migrate_legacy_users_conflict")
    pg_session.add(
        User(
            id=1,
            username="different-user",
            email="different@test",
            hashed_password=get_password_hash("different-password"),
        )
    )
    pg_session.flush()
    with pytest.raises(module.LegacyMigrationConflict, match="legacy user identity conflict"):
        module.migrate_users(legacy_database, pg_session)
    assert pg_session.scalar(select(User).where(User.username == "legacy-2")) is None


def test_nonempty_legacy_business_tables_block_user_migration(
    legacy_database, pg_session
):
    module = _load(MIGRATE_SCRIPT, "migrate_legacy_users_blocked")
    with sqlite3.connect(legacy_database) as connection:
        connection.execute("INSERT INTO projects VALUES(1,1)")
        connection.commit()
    with pytest.raises(module.LegacyDataRequiresMapping, match="projects"):
        module.migrate_users(legacy_database, pg_session)
    assert pg_session.scalar(select(User).where(User.username == "legacy-1")) is None


def test_snapshot_is_consistent_and_does_not_modify_the_source(legacy_database, tmp_path):
    module = _load(MIGRATE_SCRIPT, "migrate_legacy_users_snapshot")
    snapshot = tmp_path / "snapshot.db"
    module.create_snapshot(legacy_database, snapshot)
    with sqlite3.connect(legacy_database) as connection:
        connection.execute(
            "INSERT INTO users VALUES(?,?,?,?,?,?,?)",
            (
                5,
                "late-user",
                "late@test",
                get_password_hash("late-password"),
                True,
                datetime(2026, 1, 5).isoformat(),
                None,
            ),
        )
        connection.commit()
    with sqlite3.connect(f"file:{snapshot}?mode=ro", uri=True) as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 4


def test_product_api_does_not_mount_retired_legacy_routes():
    from app.main import app

    paths = {route.path for route in app.routes}
    assert {"/api/apps", "/api/jobs/{job_id}", "/api/quota/balance"} <= paths
    assert {
        "/api/rag/search",
        "/api/nl-deploy/start",
        "/api/generation/start",
        "/api/projects",
    }.isdisjoint(paths)
