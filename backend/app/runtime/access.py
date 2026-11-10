class AccessDenied(PermissionError):
    pass


def authorize_instance_access(
    *,
    owner_id: int,
    public_visible: bool,
    authenticated_user_id: int | None,
    forwarded_user_id: int | None,
    trusted_gateway: bool,
) -> int | None:
    if public_visible:
        return authenticated_user_id
    if authenticated_user_id == owner_id:
        return owner_id
    if trusted_gateway and forwarded_user_id == owner_id:
        return owner_id
    raise AccessDenied("instance access denied")

