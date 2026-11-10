from __future__ import annotations

import hashlib
import json
import os
import secrets
from pathlib import Path

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

from app.apps.models import Instance
from app.capabilities.models import InstanceDataSpace
from app.config import settings
from app.database import SessionLocal


class DataSpaceError(RuntimeError):
    pass


class DataSpaceManager:
    def __init__(self, *, session_factory, admin_database_url: str, secrets_root: Path):
        self.session_factory = session_factory
        self.admin_url = make_url(admin_database_url)
        self.control_database = self.admin_url.database
        if not self.control_database or self.admin_url.get_backend_name() != "postgresql":
            raise DataSpaceError("instance data provisioning requires PostgreSQL")
        self.secrets_root = Path(secrets_root).resolve()

    def _admin_kwargs(self, database: str | None = None) -> dict:
        return {
            "host": self.admin_url.host or "127.0.0.1",
            "port": self.admin_url.port or 5432,
            "dbname": database or self.control_database,
            "user": self.admin_url.username,
            "password": self.admin_url.password,
        }

    def _names(self, instance_id: str) -> tuple[str, str]:
        suffix = hashlib.sha256(instance_id.encode()).hexdigest()[:20]
        return f"id_app_{suffix}", f"id_role_{suffix}"

    def _secret_path(self, instance_id: str) -> Path:
        return self.secrets_root / (
            hashlib.sha256(instance_id.encode()).hexdigest() + ".json"
        )

    def _write_secret(self, path: Path, config: dict[str, str | int]) -> None:
        self.secrets_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.secrets_root, 0o700)
        temporary = path.with_suffix(".tmp")
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                json.dump(config, output)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, path)
            os.chmod(path, 0o600)
        finally:
            temporary.unlink(missing_ok=True)

    def _read_secret(self, path: Path) -> dict[str, str | int]:
        if not path.is_file():
            raise DataSpaceError("instance database secret is missing")
        return json.loads(path.read_text(encoding="utf-8"))

    def _create_database(self, database: str, role: str, password: str) -> None:
        with psycopg.connect(**self._admin_kwargs(), autocommit=True) as connection:
            connection.execute(
                sql.SQL("REVOKE CONNECT ON DATABASE {} FROM PUBLIC").format(
                    sql.Identifier(self.control_database)
                )
            )
            exists = connection.execute(
                "SELECT 1 FROM pg_roles WHERE rolname = %s", (role,)
            ).fetchone()
            statement = (
                "ALTER ROLE {} WITH LOGIN PASSWORD {}"
                if exists
                else "CREATE ROLE {} LOGIN PASSWORD {}"
            )
            connection.execute(
                sql.SQL(statement).format(sql.Identifier(role), sql.Literal(password))
            )
            if not connection.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s", (database,)
            ).fetchone():
                connection.execute(
                    sql.SQL("CREATE DATABASE {} OWNER {}").format(
                        sql.Identifier(database), sql.Identifier(role)
                    )
                )
            connection.execute(
                sql.SQL("REVOKE CONNECT ON DATABASE {} FROM PUBLIC").format(
                    sql.Identifier(database)
                )
            )
            connection.execute(
                sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                    sql.Identifier(database), sql.Identifier(role)
                )
            )

    def provision(self, instance_id: str) -> dict[str, str | int]:
        with self.session_factory() as session:
            instance = session.get(Instance, instance_id)
            if instance is None:
                raise DataSpaceError("instance does not exist")
            record = session.get(InstanceDataSpace, instance_id)
            if record is not None and record.destroyed_at is None:
                return self._read_secret(Path(record.secret_ref))

            database, role = self._names(instance_id)
            password = secrets.token_urlsafe(36)
            config = {
                "host": self.admin_url.host or "127.0.0.1",
                "port": self.admin_url.port or 5432,
                "database": database,
                "username": role,
                "password": password,
            }
            self._create_database(database, role, password)
            secret_path = self._secret_path(instance_id)
            self._write_secret(secret_path, config)
            if record is None:
                record = InstanceDataSpace(
                    instance_id=instance_id,
                    database_name=database,
                    role_name=role,
                    secret_ref=str(secret_path),
                )
                session.add(record)
            else:
                record.database_name = database
                record.role_name = role
                record.secret_ref = str(secret_path)
                record.destroyed_at = None
            instance.data_namespace = database
            instance.secret_ref = str(secret_path)
            session.commit()
            return config

    def destroy(self, instance_id: str, *, confirmed: bool) -> None:
        if not confirmed:
            raise ValueError("data space destruction requires confirmation")
        with self.session_factory() as session:
            record = session.get(InstanceDataSpace, instance_id)
            instance = session.get(Instance, instance_id)
            if record is None or record.destroyed_at is not None:
                return
            with psycopg.connect(**self._admin_kwargs(), autocommit=True) as connection:
                connection.execute(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = %s AND pid <> pg_backend_pid()",
                    (record.database_name,),
                )
                connection.execute(
                    sql.SQL("DROP DATABASE IF EXISTS {}").format(
                        sql.Identifier(record.database_name)
                    )
                )
                connection.execute(
                    sql.SQL("DROP ROLE IF EXISTS {}").format(
                        sql.Identifier(record.role_name)
                    )
                )
            Path(record.secret_ref).unlink(missing_ok=True)
            from datetime import datetime, timezone

            record.destroyed_at = datetime.now(timezone.utc)
            if instance is not None:
                instance.data_namespace = None
                instance.secret_ref = None
            session.commit()


def _manager() -> DataSpaceManager:
    return DataSpaceManager(
        session_factory=SessionLocal,
        admin_database_url=settings.DATABASE_URL,
        secrets_root=Path(settings.INSTANCE_SECRETS_ROOT),
    )


def provision_data_space(instance_id: str) -> dict[str, str | int]:
    return _manager().provision(instance_id)


def destroy_data_space(instance_id: str, confirmed: bool) -> None:
    _manager().destroy(instance_id, confirmed=confirmed)

