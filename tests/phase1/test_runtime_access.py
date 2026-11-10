import pytest


def test_public_access_is_checked_on_every_request():
    from app.runtime.access import AccessDenied, authorize_instance_access

    assert authorize_instance_access(
        owner_id=7,
        public_visible=True,
        authenticated_user_id=None,
        forwarded_user_id=None,
        trusted_gateway=False,
    ) is None
    with pytest.raises(AccessDenied):
        authorize_instance_access(
            owner_id=7,
            public_visible=False,
            authenticated_user_id=None,
            forwarded_user_id=None,
            trusted_gateway=False,
        )


def test_owner_access_requires_verified_identity_and_ignores_forged_header():
    from app.runtime.access import AccessDenied, authorize_instance_access

    with pytest.raises(AccessDenied):
        authorize_instance_access(
            owner_id=7,
            public_visible=False,
            authenticated_user_id=None,
            forwarded_user_id=7,
            trusted_gateway=False,
        )
    assert authorize_instance_access(
        owner_id=7,
        public_visible=False,
        authenticated_user_id=7,
        forwarded_user_id=999,
        trusted_gateway=False,
    ) == 7

