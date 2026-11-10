from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwt
from sqlalchemy import select


@pytest.fixture(autouse=True)
def identity_keys(monkeypatch):
    from app.config import settings

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    monkeypatch.setitem(settings.__dict__, "APP_IDENTITY_PRIVATE_KEY", private_pem)
    monkeypatch.setitem(settings.__dict__, "APP_IDENTITY_PUBLIC_KEY", public_pem)
    monkeypatch.setitem(settings.__dict__, "APP_IDENTITY_ISSUER", "intellideploy-test")
    monkeypatch.setitem(settings.__dict__, "APP_IDENTITY_TTL_SECONDS", 300)
    return private_pem, public_pem


def _create_instance(session, *, owner=None, suffix="one", url="https://app.example"):
    from app.apps.models import App, Instance
    from app.models.user import User

    owner = owner or User(
        username=f"owner-{uuid4().hex}",
        email=f"{uuid4().hex}@test",
        hashed_password="test-only",
    )
    if owner.id is None:
        session.add(owner)
        session.flush()
    app = App(owner_id=owner.id, name="笔记", prompt="保存私有笔记")
    session.add(app)
    session.flush()
    instance = Instance(
        owner_id=owner.id,
        app_id=app.id,
        status="RUNNING",
        url=url,
        data_namespace=f"identity-{suffix}-{uuid4().hex}",
    )
    session.add(instance)
    session.flush()
    return owner, app, instance


def test_app_identity_is_scoped_to_audience_instance_and_expiry(identity_keys):
    from app.capabilities.identity import IdentityError, issue_app_identity, verify_app_identity
    from app.config import settings

    token = issue_app_identity(7, "app-a", "instance-a")
    assert verify_app_identity(token, "app-a", "instance-a") == 7
    with pytest.raises(IdentityError):
        verify_app_identity(token, "app-b", "instance-a")
    with pytest.raises(IdentityError):
        verify_app_identity(token, "app-a", "instance-b")

    private_pem, _ = identity_keys
    expired = jwt.encode(
        {
            "sub": "7",
            "aud": "app-a",
            "instance_id": "instance-a",
            "iss": settings.APP_IDENTITY_ISSUER,
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        },
        private_pem,
        algorithm="RS256",
    )
    with pytest.raises(IdentityError):
        verify_app_identity(expired, "app-a", "instance-a")


def test_instance_credential_and_context_cannot_cross_instances(session_factory):
    from app.capabilities.identity import (
        IdentityError,
        issue_app_identity,
        provision_instance_credential,
        resolve_context,
    )

    with session_factory() as session:
        owner, app, one = _create_instance(session, suffix="one")
        _, other_app, two = _create_instance(session, owner=owner, suffix="two")
        one_secret = provision_instance_credential(session, one.id)
        two_secret = provision_instance_credential(session, two.id)
        session.commit()

        user_token = issue_app_identity(owner.id, app.id, one.id)
        context = resolve_context(session, one.id, user_token, one_secret)
        assert context.model_dump() == {
            "app_id": app.id,
            "instance_id": one.id,
            "user_id": owner.id,
            "payer_id": owner.id,
            "publication_id": None,
            "reservation_operation_id": None,
            "job_id": None,
        }
        with pytest.raises(IdentityError):
            resolve_context(session, two.id, user_token, one_secret)
        with pytest.raises(IdentityError):
            resolve_context(session, two.id, user_token, two_secret)
        assert other_app.id != app.id


def test_payer_policy_never_accepts_client_selected_payer():
    from app.capabilities.identity import IdentityRequired, SponsorLimitExceeded, select_payer

    with pytest.raises(IdentityRequired):
        select_payer("VISITOR", owner_id=1, user_id=None, sponsor_remaining_units=0)
    assert select_payer("VISITOR", owner_id=1, user_id=8, sponsor_remaining_units=0) == 8
    assert select_payer("SPONSOR", owner_id=1, user_id=None, sponsor_remaining_units=5) == 1
    with pytest.raises(SponsorLimitExceeded):
        select_payer("SPONSOR", owner_id=1, user_id=None, sponsor_remaining_units=0)
    with pytest.raises(IdentityRequired):
        select_payer("OWNER", owner_id=1, user_id=8, sponsor_remaining_units=0)


def test_login_code_is_callback_bound_single_use_and_instance_authenticated(
    api_client, owner_headers, other_headers, session_factory
):
    from app.capabilities.identity import provision_instance_credential
    from app.models.user import User

    with session_factory() as session:
        owner = session.scalar(select(User).where(User.username == "owner"))
        _, _, instance = _create_instance(session, owner=owner, suffix="api")
        instance_token = provision_instance_credential(session, instance.id)
        session.commit()
        instance_id = instance.id

    endpoint = f"/api/instances/{instance_id}/login-code"
    callback = "https://app.example/auth/callback"
    assert api_client.post(endpoint, headers=other_headers, json={"callback": callback}).status_code == 404
    assert api_client.post(
        endpoint,
        headers=owner_headers,
        json={"callback": "https://evil.example/callback"},
    ).status_code == 422
    issued = api_client.post(endpoint, headers=owner_headers, json={"callback": callback})
    assert issued.status_code == 200
    assert issued.json()["expires_in"] == 60

    exchange = "/api/capabilities/identity/exchange"
    wrong_instance = api_client.post(
        exchange,
        json={
            "code": issued.json()["code"],
            "callback": callback,
            "instance_token": "wrong-instance-token",
        },
    )
    assert wrong_instance.status_code == 401
    success = api_client.post(
        exchange,
        json={
            "code": issued.json()["code"],
            "callback": callback,
            "instance_token": instance_token,
        },
    )
    assert success.status_code == 200
    assert "access_token" in success.json()
    replay = api_client.post(
        exchange,
        json={
            "code": issued.json()["code"],
            "callback": callback,
            "instance_token": instance_token,
        },
    )
    assert replay.status_code == 409


def test_expired_login_code_and_changed_callback_are_rejected(session_factory):
    from app.capabilities.identity import (
        IdentityError,
        consume_login_code,
        issue_login_code,
        provision_instance_credential,
    )

    with session_factory() as session:
        owner, _, instance = _create_instance(session, suffix="expired")
        instance_token = provision_instance_credential(session, instance.id)
        code = issue_login_code(
            session, instance.id, owner.id, "https://app.example/auth/callback"
        )
        record = session.scalar(select(__import__("app.capabilities.models", fromlist=["AppLoginCode"]).AppLoginCode))
        record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        session.flush()
        with pytest.raises(IdentityError):
            consume_login_code(
                session,
                code,
                "https://app.example/auth/callback",
                instance_token,
            )

        fresh = issue_login_code(
            session, instance.id, owner.id, "https://app.example/auth/callback"
        )
        with pytest.raises(IdentityError):
            consume_login_code(
                session,
                fresh,
                "https://app.example/other",
                instance_token,
            )

