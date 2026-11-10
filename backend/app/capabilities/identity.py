from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy import select

from app.apps.models import Instance
from app.capabilities.models import AppLoginCode, InstanceCredential
from app.config import settings
from app.core.types import CapabilityContext


class IdentityError(HTTPException):
    def __init__(self, message: str = "应用身份无效"):
        super().__init__(
            401,
            {"code": "IDENTITY_INVALID", "message": message, "retryable": False},
        )


class IdentityRequired(IdentityError):
    def __init__(self):
        super().__init__("该能力需要登录身份")


class IdentityCodeConflict(HTTPException):
    def __init__(self):
        super().__init__(
            409,
            {"code": "LOGIN_CODE_USED", "message": "登录凭证已使用", "retryable": False},
        )


class SponsorLimitExceeded(HTTPException):
    def __init__(self):
        super().__init__(
            402,
            {
                "code": "SPONSOR_LIMIT_REACHED",
                "message": "发布者赞助额度已用完",
                "retryable": False,
            },
        )


def _key(value: str) -> str:
    if not value:
        raise IdentityError("平台应用身份密钥未配置")
    if "BEGIN " in value:
        return value
    path = Path(value)
    if not path.is_file():
        raise IdentityError("平台应用身份密钥不可用")
    return path.read_text(encoding="utf-8")


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def issue_app_identity(user_id: int, app_id: str, instance_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "aud": app_id,
            "instance_id": instance_id,
            "iss": settings.APP_IDENTITY_ISSUER,
            "iat": now,
            "exp": now + timedelta(seconds=settings.APP_IDENTITY_TTL_SECONDS),
        },
        _key(settings.APP_IDENTITY_PRIVATE_KEY),
        algorithm="RS256",
    )


def verify_app_identity(token: str, app_id: str, instance_id: str) -> int:
    try:
        claims = jwt.decode(
            token,
            _key(settings.APP_IDENTITY_PUBLIC_KEY),
            algorithms=["RS256"],
            audience=app_id,
            issuer=settings.APP_IDENTITY_ISSUER,
        )
        if claims.get("instance_id") != instance_id:
            raise IdentityError("实例身份不匹配")
        return int(claims["sub"])
    except IdentityError:
        raise
    except (JWTError, KeyError, TypeError, ValueError) as exc:
        raise IdentityError() from exc


def provision_instance_credential(session, instance_id: str) -> str:
    if session.get(Instance, instance_id) is None:
        raise IdentityError("实例不存在")
    token = secrets.token_urlsafe(48)
    record = session.get(InstanceCredential, instance_id)
    if record is None:
        session.add(InstanceCredential(instance_id=instance_id, token_hash=_digest(token)))
    else:
        record.token_hash = _digest(token)
        record.created_at = datetime.now(timezone.utc)
        record.revoked_at = None
    session.flush()
    return token


def revoke_instance_credential(session, instance_id: str) -> None:
    record = session.get(InstanceCredential, instance_id)
    if record is not None and record.revoked_at is None:
        record.revoked_at = datetime.now(timezone.utc)
        session.flush()


def _verify_instance_credential(session, instance_id: str, token: str) -> None:
    record = session.get(InstanceCredential, instance_id)
    if (
        record is None
        or record.revoked_at is not None
        or not token
        or not hmac.compare_digest(record.token_hash, _digest(token))
    ):
        raise IdentityError("实例凭据无效")


def candidate_context(session,instance,user_id):
    from datetime import datetime,timezone
    from app.jobs.models import Job
    from app.runtime.models import ResourceRecord
    record=session.scalar(select(ResourceRecord).where(ResourceRecord.type.in_(['CANDIDATE_RUNTIME','LIVE_VALIDATION']),ResourceRecord.reference==instance.id,ResourceRecord.state=='RUNNING'))
    if not record:
        if instance.kind=='CANDIDATE':raise IdentityError('候选身份已失效')
        return None
    job=session.get(Job,record.job_id);grant=record.metadata_json
    if not job or job.status!='RUNNING' or job.cancel_requested or job.lease_owner!=grant['worker_id'] or job.lease_generation!=grant['generation'] or job.lease_until<=datetime.now(timezone.utc):
        if instance.kind=='CANDIDATE':raise IdentityError('候选任务租约已失效')
        return None
    if user_id not in {grant.get('test_owner_id',grant['owner_id']),grant['other_id']} and not (user_id is None and grant.get('anonymous_allowed')):
        if instance.kind!='CANDIDATE':return None
        raise IdentityError('未登记的候选测试身份')
    return CapabilityContext(app_id=instance.app_id,instance_id=instance.id,user_id=user_id,payer_id=grant['owner_id'],reservation_operation_id=grant['reservation_operation_id'],job_id=job.id)


def _origin(url: str) -> tuple[str, str, int | None]:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("callback must be HTTP(S)")
    if parsed.username or parsed.password or parsed.fragment:
        raise ValueError("callback contains forbidden URL components")
    return parsed.scheme, parsed.hostname.lower(), parsed.port


def validate_callback(instance_url: str | None, callback: str) -> str:
    if not instance_url or _origin(instance_url) != _origin(callback):
        raise ValueError("callback origin is not registered for this instance")
    return callback


def issue_login_code(session, instance_id: str, user_id: int, callback: str) -> str:
    instance = session.get(Instance, instance_id)
    from app.community.service import active_publication
    if instance is None or (instance.owner_id != user_id and (instance.status != 'RUNNING' or active_publication(session, instance_id) is None)):
        raise IdentityError("实例不存在或无权访问")
    validate_callback(instance.url, callback)
    code = secrets.token_urlsafe(32)
    session.add(
        AppLoginCode(
            code_hash=_digest(code),
            instance_id=instance_id,
            user_id=user_id,
            callback=callback,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=60),
        )
    )
    session.flush()
    return code


def consume_login_code(
    session, code: str, callback: str, instance_token: str
) -> tuple[int, Instance]:
    record = session.scalar(
        select(AppLoginCode)
        .where(AppLoginCode.code_hash == _digest(code))
        .with_for_update()
    )
    if record is None:
        raise IdentityError("登录凭证无效")
    _verify_instance_credential(session, record.instance_id, instance_token)
    if record.consumed_at is not None:
        raise IdentityCodeConflict()
    now = datetime.now(timezone.utc)
    if record.expires_at <= now or not hmac.compare_digest(record.callback, callback):
        raise IdentityError("登录凭证已过期或 callback 不匹配")
    instance = session.get(Instance, record.instance_id)
    if instance is None:
        raise IdentityError("实例不存在")
    from app.community.service import active_publication
    if instance.owner_id != record.user_id and active_publication(session, instance.id) is None:
        raise IdentityError('应用已取消公开')
    record.consumed_at = now
    session.flush()
    return record.user_id, instance


def select_payer(
    policy: str,
    *,
    owner_id: int,
    user_id: int | None,
    sponsor_remaining_units: int,
) -> int:
    if policy == "OWNER":
        if user_id != owner_id:
            raise IdentityRequired()
        return owner_id
    if policy == "VISITOR":
        if user_id is None:
            raise IdentityRequired()
        return user_id
    if policy == "SPONSOR":
        if sponsor_remaining_units <= 0:
            raise SponsorLimitExceeded()
        return owner_id
    raise IdentityError("未知付费策略")


def resolve_context(
    session,
    instance_id: str,
    user_token: str | None,
    instance_token: str,
) -> CapabilityContext:
    instance = session.get(Instance, instance_id)
    if instance is None:
        raise IdentityError("实例不存在")
    _verify_instance_credential(session, instance_id, instance_token)
    user_id = (
        verify_app_identity(user_token, instance.app_id, instance.id) if user_token else None
    )
    validation=candidate_context(session,instance,user_id)
    if validation:return validation
    from app.community.service import active_publication
    publication = active_publication(session, instance.id)
    if instance.status in {'STOPPED', 'FAILED', 'DELETED'}:
        raise IdentityError('应用暂不可用')
    policy = 'OWNER' if user_id == instance.owner_id or publication is None else publication.payer_policy
    payer_id = select_payer(
        policy,
        owner_id=instance.owner_id,
        user_id=user_id,
        sponsor_remaining_units=publication.sponsor_limit_units if publication else 0,
    )
    return CapabilityContext(
        app_id=instance.app_id,
        instance_id=instance.id,
        user_id=user_id,
        payer_id=payer_id,
        publication_id=publication.id if publication and policy=='SPONSOR' else None,
    )

