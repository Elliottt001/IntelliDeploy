from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.utils.security import get_password_hash


def ensure_builtin_admin_user() -> None:
    """Create or refresh the local built-in admin account when enabled."""
    if not settings.ENABLE_BUILTIN_ADMIN:
        return

    db: Session = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter(User.username == settings.BUILTIN_ADMIN_USERNAME)
            .first()
        )
        password_hash = get_password_hash(settings.BUILTIN_ADMIN_PASSWORD)

        if user is None:
            user = User(
                username=settings.BUILTIN_ADMIN_USERNAME,
                email=settings.BUILTIN_ADMIN_EMAIL,
                hashed_password=password_hash,
                is_active=True,
            )
            db.add(user)
        else:
            user.hashed_password = password_hash
            user.is_active = True

        db.commit()
    finally:
        db.close()
