from contextlib import contextmanager
from io import BytesIO
import os
from uuid import uuid4

import psycopg
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import select

from app.core.types import CapabilityContext


def _create_instance(session, *, owner=None, suffix="one"):
    from app.apps.models import App, Instance
    from app.models.user import User

    owner = owner or User(
        username=f"data-{uuid4().hex}",
        email=f"{uuid4().hex}@test",
        hashed_password="test-only",
    )
    if owner.id is None:
        session.add(owner)
        session.flush()
    app = App(owner_id=owner.id, name="记录", prompt="保存记录")
    session.add(app)
    session.flush()
    instance = Instance(owner_id=owner.id, app_id=app.id, status="RUNNING")
    session.add(instance)
    session.flush()
    return owner, app, instance


@contextmanager
def _data_store(session_factory, tmp_path):
    from app.capabilities.data import DataSpaceManager
    manager = DataSpaceManager(
        session_factory=session_factory,
        admin_database_url=os.environ["DATABASE_URL"],
        secrets_root=tmp_path / "secrets",
    )
    created = []
    original = manager.provision

    def tracked(instance_id):
        created.append(instance_id)
        return original(instance_id)

    manager.provision = tracked
    try:
        yield manager
    finally:
        for instance_id in reversed(list(dict.fromkeys(created))):
            try:
                manager.destroy(instance_id, confirmed=True)
            except Exception:
                pass


def _database_url(config, database=None):
    return (
        f"postgresql://{config['username']}:{config['password']}@"
        f"{config['host']}:{config['port']}/{database or config['database']}"
    )


def test_repeated_provision_preserves_instance_database_and_stopped_data(
    session_factory, tmp_path
):
    from app.apps.models import Instance

    with _data_store(session_factory, tmp_path) as data_store:
        with session_factory() as session:
            _, _, instance = _create_instance(session, suffix="persist")
            session.commit()
            instance_id = instance.id

        first = data_store.provision(instance_id)
        with psycopg.connect(_database_url(first), autocommit=True) as connection:
            connection.execute("CREATE TABLE notes(value text)")
            connection.execute("INSERT INTO notes(value) VALUES ('saved')")

        with session_factory() as session:
            session.get(Instance, instance_id).status = "STOPPED"
            session.commit()
        again = data_store.provision(instance_id)
        assert again == first
        with psycopg.connect(_database_url(again)) as connection:
            assert connection.execute("SELECT value FROM notes").fetchone() == ("saved",)


def test_instance_role_cannot_connect_control_or_another_instance_database(
    session_factory, tmp_path
):
    with _data_store(session_factory, tmp_path) as data_store:
        with session_factory() as session:
            owner, _, one = _create_instance(session, suffix="one")
            _, _, two = _create_instance(session, owner=owner, suffix="two")
            session.commit()
            one_id, two_id = one.id, two.id

        first = data_store.provision(one_id)
        second = data_store.provision(two_id)
        with pytest.raises(psycopg.OperationalError):
            psycopg.connect(_database_url(first, second["database"]), connect_timeout=2)
        with pytest.raises(psycopg.OperationalError):
            psycopg.connect(
                _database_url(first, data_store.control_database), connect_timeout=2
            )


def test_destroy_requires_confirmation_and_removes_database(session_factory, tmp_path):
    with _data_store(session_factory, tmp_path) as data_store:
        with session_factory() as session:
            _, _, instance = _create_instance(session, suffix="destroy")
            session.commit()
            instance_id = instance.id
        config = data_store.provision(instance_id)
        with pytest.raises(ValueError):
            data_store.destroy(instance_id, confirmed=False)
        data_store.destroy(instance_id, confirmed=True)
        with pytest.raises(psycopg.OperationalError):
            psycopg.connect(_database_url(config), connect_timeout=2)


@pytest.fixture
def file_contexts(session_factory):
    from app.models.user import User

    with session_factory() as session:
        alice, app, one = _create_instance(session, suffix="files-one")
        bob = User(
            username=f"bob-{uuid4().hex}",
            email=f"{uuid4().hex}@test",
            hashed_password="test-only",
        )
        session.add(bob)
        session.flush()
        _, other_app, two = _create_instance(session, owner=alice, suffix="files-two")
        session.commit()
        return {
            "alice": CapabilityContext(
                app_id=app.id, instance_id=one.id, user_id=alice.id, payer_id=alice.id
            ),
            "bob": CapabilityContext(
                app_id=app.id, instance_id=one.id, user_id=bob.id, payer_id=bob.id
            ),
            "other_instance": CapabilityContext(
                app_id=other_app.id,
                instance_id=two.id,
                user_id=alice.id,
                payer_id=alice.id,
            ),
            "anonymous": CapabilityContext(
                app_id=app.id, instance_id=one.id, user_id=None, payer_id=alice.id
            ),
        }


def _file_store(session_factory, tmp_path):
    from app.capabilities.files import FileStore

    return FileStore(session_factory=session_factory, root=tmp_path / "files", max_bytes=8)


def test_private_files_are_scoped_to_instance_and_owner(
    session_factory, tmp_path, file_contexts
):
    from app.capabilities.files import FileAccessDenied

    file_store = _file_store(session_factory, tmp_path)
    file_id = file_store.create(
        file_contexts["alice"], BytesIO(b"dream"), "note.txt", public=False
    )
    assert file_store.read(file_contexts["alice"], file_id) == b"dream"
    with pytest.raises(FileAccessDenied):
        file_store.read(file_contexts["bob"], file_id)
    with pytest.raises(FileAccessDenied):
        file_store.read(file_contexts["other_instance"], file_id)

    public_id = file_store.create(
        file_contexts["alice"], BytesIO(b"public"), "public.txt", public=True
    )
    assert file_store.read(file_contexts["bob"], public_id) == b"public"


def test_file_upload_rejects_anonymous_private_path_type_and_size(
    session_factory, tmp_path, file_contexts
):
    from app.capabilities.files import FileAccessDenied, FileValidationError

    file_store = _file_store(session_factory, tmp_path)
    with pytest.raises(FileAccessDenied):
        file_store.create(
            file_contexts["anonymous"], BytesIO(b"x"), "private.txt", public=False
        )
    for filename, content in [
        ("../secret.txt", b"x"),
        ("program.exe", b"x"),
        ("large.txt", b"123456789"),
    ]:
        with pytest.raises(FileValidationError):
            file_store.create(file_contexts["alice"], BytesIO(content), filename)


def test_file_api_returns_only_scoped_file_identifier(
    api_client, owner_headers, session_factory, tmp_path, monkeypatch
):
    from app.capabilities.identity import issue_app_identity, provision_instance_credential
    from app.config import settings
    from app.models.user import User

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(
        settings,
        "APP_IDENTITY_PRIVATE_KEY",
        private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode(),
    )
    monkeypatch.setattr(
        settings,
        "APP_IDENTITY_PUBLIC_KEY",
        private_key.public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode(),
    )
    monkeypatch.setattr(settings, "INSTANCE_FILES_ROOT", str(tmp_path / "api-files"))

    with session_factory() as session:
        owner = session.scalar(select(User).where(User.username == "owner"))
        _, app, instance = _create_instance(session, owner=owner, suffix="api-file")
        instance_token = provision_instance_credential(session, instance.id)
        session.commit()
        identity = issue_app_identity(owner.id, app.id, instance.id)
        instance_id = instance.id

    headers = {
        "Authorization": "Bearer " + identity,
        "X-Instance-ID": instance_id,
        "X-Instance-Token": instance_token,
    }
    uploaded = api_client.post(
        "/api/capabilities/files",
        headers=headers,
        files={"file": ("note.txt", b"saved", "text/plain")},
    )
    assert uploaded.status_code == 201
    assert set(uploaded.json()) == {"file_id"}
    downloaded = api_client.get(
        f"/api/capabilities/files/{uploaded.json()['file_id']}", headers=headers
    )
    assert downloaded.status_code == 200
    assert downloaded.content == b"saved"

