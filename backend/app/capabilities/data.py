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
            "connect_timeout":10,
            **{key:value for key,value in self.admin_url.query.items() if key in {'sslmode','sslrootcert','sslcert','sslkey'}},
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

    def _instance_connection(self,instance_id):
        with self.session_factory() as session:
            record=session.get(InstanceDataSpace,instance_id)
            if not record or record.destroyed_at:raise DataSpaceError('instance database is not available')
            return self._read_secret(Path(record.secret_ref))

    def _pg_environment(self,config):
        return {'PATH':os.environ.get('PATH','/usr/bin:/bin'),'PGHOST':str(config['host']),'PGPORT':str(config['port']),'PGUSER':str(config['username']),'PGPASSWORD':str(config['password']),'PGDATABASE':str(config['database']),**{('PG'+key.upper()):str(value) for key,value in self.admin_url.query.items() if key in {'sslmode','sslrootcert'}}}

    def snapshot(self,instance_id,operation_id):
        import shutil,subprocess
        executable=shutil.which('pg_dump')
        if not executable:raise DataSpaceError('PostgreSQL snapshot tooling is not installed')
        config=self._instance_connection(instance_id)
        root=self.secrets_root/'recovery';root.mkdir(parents=True,exist_ok=True,mode=0o700)
        name=hashlib.sha256((instance_id+':'+operation_id).encode()).hexdigest()
        path=root/(name+'.dump')
        if path.is_file():return path
        temporary=path.with_suffix('.tmp')
        result=subprocess.run([executable,'--format=custom','--no-owner','--no-acl','--file',str(temporary)],env=self._pg_environment(config),stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=300)
        if result.returncode:temporary.unlink(missing_ok=True);raise DataSpaceError('instance snapshot failed')
        temporary.chmod(0o600);os.replace(temporary,path)
        return path

    def restore(self,instance_id,snapshot):
        import shutil,subprocess
        executable=shutil.which('pg_restore')
        snapshot=Path(snapshot).resolve()
        if not executable or not snapshot.is_relative_to(self.secrets_root.resolve()/'recovery') or not snapshot.is_file():raise DataSpaceError('valid recovery material and PostgreSQL tools are required')
        config=self._instance_connection(instance_id)
        result=subprocess.run([executable,'--clean','--if-exists','--no-owner','--no-acl','--dbname',config['database'],str(snapshot)],env=self._pg_environment(config),stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=300)
        if result.returncode:raise DataSpaceError('instance recovery could not be verified')

    def clone(self,source_instance,target_instance,operation_id):
        with self.session_factory() as session:
            source=session.get(Instance,source_instance);target=session.get(Instance,target_instance)
            if not source or not target or target.kind!='CANDIDATE' or source.app_id!=target.app_id or source.owner_id!=target.owner_id:
                raise DataSpaceError('data copies are limited to the same app candidate')
        self.provision(target_instance)
        snapshot=self.snapshot(source_instance,operation_id)
        self.restore(target_instance,snapshot)
        return snapshot

    def data_proof(self,instance_id,baseline=None):
        from collections import Counter
        config=self._instance_connection(instance_id)
        with psycopg.connect(host=config['host'],port=config['port'],dbname=config['database'],user=config['username'],password=config['password'],connect_timeout=10) as connection:
            tables=[row[0] for row in connection.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")]
            result={}
            for table in tables:
                if baseline is not None and table not in baseline:continue
                columns=[row[0] for row in connection.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY column_name",(table,))]
                if baseline is not None:
                    wanted=baseline[table]['columns']
                    if not set(wanted)<=set(columns):return False
                    columns=wanted
                statement=sql.SQL('SELECT {} FROM {}').format(sql.SQL(',').join(sql.Identifier(column) for column in columns),sql.Identifier('public',table))
                hashes=Counter(hashlib.sha256(json.dumps(row,default=str,separators=(',',':')).encode()).hexdigest() for row in connection.execute(statement))
                if baseline is not None:
                    if any(hashes[key]<count for key,count in baseline[table]['rows'].items()):return False
                else:result[table]={'columns':columns,'rows':dict(hashes)}
            if baseline is not None:return set(baseline)<=set(tables)
            return result


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

