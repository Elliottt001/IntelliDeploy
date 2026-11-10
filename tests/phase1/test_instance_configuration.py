from uuid import uuid4
import json
import pytest
from app.apps.models import App, Instance
from app.models.user import User
from app.core.types import AppManifest, ServiceSpec


@pytest.fixture
def config_instances(session_factory):
    with session_factory() as session:
        owner = User(
            username="config-" + uuid4().hex,
            email=uuid4().hex + "@test",
            hashed_password="test-only",
        )
        other = User(
            username="other-" + uuid4().hex,
            email=uuid4().hex + "@test",
            hashed_password="test-only",
        )
        session.add_all([owner, other])
        session.flush()
        app = App(owner_id=owner.id, name="notes", prompt="notes")
        session.add(app)
        session.flush()
        one = Instance(owner_id=owner.id, app_id=app.id)
        two = Instance(owner_id=owner.id, app_id=app.id)
        session.add_all([one, two])
        session.commit()
        return owner.id, other.id, app.id, one.id, two.id


def db_manifest():
    return AppManifest(
        web_service="web",
        services=[
            ServiceSpec(
                name="web",
                image="registry.test/web@sha256:" + "a" * 64,
                port=3000,
                env_refs={"DATABASE_URL": "db-url", "PLATFORM_INSTANCE_TOKEN": "token"},
            ),
            ServiceSpec(
                name="db",
                image="postgres@sha256:" + "b" * 64,
                env_refs={
                    "POSTGRES_PASSWORD": "db-password",
                    "POSTGRES_USER": "db-user",
                    "POSTGRES_DB": "db-name",
                },
                volumes={"data": "/var/lib/postgresql/data"},
            ),
        ],
    )


def test_instance_configs_are_fresh_and_stable_and_never_return_secret_values(
    config_instances, session_factory, tmp_path
):
    from app.runtime.configuration import InstanceConfiguration

    owner, other, app, one, two = config_instances
    manager = InstanceConfiguration(
        session_factory, tmp_path, platform_url="https://api.platform.test"
    )
    first = manager.bundle(one, db_manifest(), "https://one.apps.test")
    again = manager.bundle(one, db_manifest(), "https://one.apps.test")
    second = manager.bundle(two, db_manifest(), "https://two.apps.test")
    assert first == again
    assert first["token"] != second["token"]
    assert first["db-url"] != second["db-url"]
    assert manager.public_state(one, owner)["configured"]
    assert "values" not in manager.public_state(one, owner)
    assert manager.path(one).stat().st_mode & 0o777 == 0o600
    with pytest.raises(PermissionError):
        manager.public_state(one, other)


def test_custom_config_cannot_override_platform_credentials(
    config_instances, session_factory, tmp_path
):
    from app.runtime.configuration import InstanceConfiguration

    owner, other, app, one, two = config_instances
    manager = InstanceConfiguration(
        session_factory, tmp_path, platform_url="https://api.platform.test"
    )
    with pytest.raises(ValueError):
        manager.set_custom(one, owner, {"PLATFORM_INSTANCE_TOKEN": "forged"})
    with pytest.raises(PermissionError):
        manager.set_custom(one, other, {"VENDOR_API_KEY": "private"})
    manager.set_custom(one, owner, {"VENDOR_API_KEY": "private"})
    assert manager.public_state(one, owner)["configured"] == ["VENDOR_API_KEY"]
    assert "private" not in json.dumps(manager.public_state(one, owner))


def test_candidate_runtime_does_not_replace_public_instance_or_enter_hosting_meter(
    config_instances, session_factory
):
    from app.apps.service import app_summary

    owner, other, app, one, two = config_instances
    with session_factory() as session:
        instance = session.get(Instance, two)
        instance.kind = "CANDIDATE"
        instance.status = "RUNNING"
        session.commit()
        session.get(Instance, one).status = "STOPPED"
        session.commit()
        assert app_summary(session, session.get(App, app)).instance_status == "STOPPED"


def test_missing_third_party_config_is_reported_without_reusing_owner_secret(
    config_instances, session_factory, tmp_path
):
    from app.runtime.configuration import InstanceConfiguration, ConfigurationMissing

    owner, other, app, one, two = config_instances
    manager = InstanceConfiguration(
        session_factory, tmp_path, platform_url="https://api.platform.test"
    )
    manager.set_custom(one, owner, {"VENDOR_API_KEY": "original-private"})
    manifest = AppManifest(
        web_service="web",
        services=[
            ServiceSpec(
                name="web",
                port=3000,
                image="registry.test/web@sha256:" + "a" * 64,
                env_refs={"VENDOR_API_KEY": "vendor"},
            )
        ],
    )
    with pytest.raises(ConfigurationMissing):
        manager.bundle(two, manifest, "https://two.apps.test")
