"""Instance-scoped configuration; code/version copying never copies these values."""

import json
import os
from pathlib import Path
import re
import secrets
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.engine import URL
from app.apps.models import App, Instance
from app.capabilities.identity import provision_instance_credential
from app.capabilities.models import InstanceCredential


class ConfigurationMissing(ValueError):
    def __init__(self, names):
        self.names = names
        super().__init__("实例所需配置尚未提供")


class InstanceConfiguration:
    def __init__(self, session_factory, root, *, platform_url, data_manager=None):
        self.sessions = session_factory
        self.root = Path(root).resolve()
        self.platform_url = platform_url
        self.data_manager = data_manager

    def path(self, instance_id):
        UUID(instance_id)
        return self.root / "runtime-config" / f"{instance_id}.json"

    def _read(self, instance):
        path = self.path(instance.id)
        if path.exists():
            saved = json.loads(path.read_text())
            if saved["instance_id"] != instance.id:
                raise ValueError("configuration ownership mismatch")
            return saved
        # Recover only this instance's own earlier credential file, never a source instance's.
        if instance.secret_ref:
            legacy = Path(instance.secret_ref).resolve()
            if legacy.is_relative_to(self.root) and legacy.is_file():
                saved = json.loads(legacy.read_text())
                if saved.get("instance_id") == instance.id and saved.get(
                    "instance_token"
                ):
                    return {
                        "instance_id": instance.id,
                        "credentials": {"instance_token": saved["instance_token"]},
                        "custom": {},
                    }
        return {"instance_id": instance.id, "credentials": {}, "custom": {}}

    def _save(self, instance_id, value):
        path = self.path(instance_id)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = path.with_suffix(".tmp")
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "w") as file:
            json.dump(value, file)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)

    def bundle(self, instance_id, manifest, url):
        with self.sessions() as session:
            instance = session.get(Instance, instance_id)
            if instance is None:
                raise LookupError("instance not found")
            session.scalar(
                select(App).where(App.id == instance.app_id).with_for_update()
            )
            saved = self._read(instance)
            credentials = saved["credentials"]
            if not credentials.get("instance_token"):
                if session.get(InstanceCredential, instance.id) is not None:
                    raise ConfigurationMissing(["existing instance credential"])
                credentials["instance_token"] = provision_instance_credential(
                    session, instance.id
                )
            namespace = instance.data_namespace or "app_" + instance.id.replace("-", "")
            if not self.data_manager:
                instance.data_namespace = namespace
            credentials.setdefault(
                "database_user", "app_" + instance.id.replace("-", "")[:16]
            )
            credentials.setdefault("database_password", secrets.token_urlsafe(36))
            values = {
                "PLATFORM_INSTANCE_ID": instance.id,
                "PLATFORM_INSTANCE_TOKEN": credentials["instance_token"],
                "PLATFORM_CAPABILITY_URL": self.platform_url,
                "PLATFORM_LOGIN_CALLBACK": url.rstrip("/") + "/api/platform/callback",
                "NODE_ENV": "production",
            }
            needs_database = any(
                "DATABASE_URL" in service.env_refs for service in manifest.services
            )
            database = next(
                (
                    service
                    for service in manifest.services
                    if "postgres" in service.image.lower()
                    or "POSTGRES_PASSWORD" in service.env_refs
                ),
                None,
            )
            if needs_database:
                if self.data_manager:
                    # Provisioning has its own transaction; the App lock serializes configuration.
                    config = self.data_manager.provision(instance.id)
                    session.refresh(instance)
                    host = config["host"]
                    from app.config import settings

                    host = settings.INSTANCE_DATABASE_HOST or host
                    values["DATABASE_URL"] = URL.create(
                        "postgresql",
                        username=config["username"],
                        password=config["password"],
                        host=host,
                        port=config["port"],
                        database=config["database"],
                    ).render_as_string(hide_password=False)
                elif database:
                    values.update(
                        {
                            "POSTGRES_USER": credentials["database_user"],
                            "POSTGRES_PASSWORD": credentials["database_password"],
                            "POSTGRES_DB": instance.data_namespace,
                        }
                    )
                    values["DATABASE_URL"] = URL.create(
                        "postgresql",
                        username=values["POSTGRES_USER"],
                        password=values["POSTGRES_PASSWORD"],
                        host=database.name,
                        port=database.port or 5432,
                        database=values["POSTGRES_DB"],
                    ).render_as_string(hide_password=False)
                else:
                    raise ConfigurationMissing(["instance PostgreSQL connection"])
            if database:
                values.update(
                    {
                        "POSTGRES_USER": credentials["database_user"],
                        "POSTGRES_PASSWORD": credentials["database_password"],
                        "POSTGRES_DB": instance.data_namespace,
                    }
                )
            values.update(saved["custom"])
            result = {}
            missing = []
            for service in manifest.services:
                for name, reference in service.env_refs.items():
                    value = values.get(name)
                    if value is None:
                        missing.append(name)
                    elif reference in result and result[reference] != str(value):
                        raise ValueError("configuration reference collision")
                    else:
                        result[reference] = str(value)
            if missing:
                raise ConfigurationMissing(sorted(set(missing)))
            self._save(instance.id, saved)
            instance.secret_ref = str(self.path(instance.id))
            session.commit()
            return result

    def _owned(self, session, instance_id, owner):
        instance = session.get(Instance, instance_id)
        if not instance or instance.owner_id != owner or instance.kind != "PRODUCTION":
            raise PermissionError("instance is not owned")
        return instance

    def set_custom(self, instance_id, owner, values):
        if len(values) > 32 or any(
            not re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", name)
            or name.startswith("PLATFORM_")
            or name
            in {"DATABASE_URL", "POSTGRES_PASSWORD", "POSTGRES_USER", "POSTGRES_DB"}
            for name in values
        ):
            raise ValueError("platform configuration cannot be overridden")
        if any(
            not isinstance(value, str) or len(value) > 16384
            for value in values.values()
        ):
            raise ValueError("invalid configuration value")
        with self.sessions() as session:
            instance = self._owned(session, instance_id, owner)
            session.scalar(
                select(App).where(App.id == instance.app_id).with_for_update()
            )
            if instance.status == "DELETED":
                raise ValueError("instance is deleted")
            saved = self._read(instance)
            saved["custom"].update(values)
            self._save(instance_id, saved)
            session.commit()

    def public_state(self, instance_id, owner):
        with self.sessions() as session:
            instance = self._owned(session, instance_id, owner)
            saved = self._read(instance)
            return {
                "instance_id": instance.id,
                "configured": sorted(saved["custom"] or saved["credentials"]),
            }
