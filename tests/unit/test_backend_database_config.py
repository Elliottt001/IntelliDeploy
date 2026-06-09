from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.config import Settings  # noqa: E402
from app.database import build_engine_kwargs, validate_database_url  # noqa: E402


def test_default_database_url_uses_local_sqlite_for_dev_startup():
    settings = Settings(_env_file=None)

    assert settings.DATABASE_URL.startswith("sqlite:///")


def test_database_module_accepts_sqlite_and_sets_threading_connect_args():
    url = "sqlite:///./intellideploy.db"

    validate_database_url(url)
    kwargs = build_engine_kwargs(url)

    assert kwargs["connect_args"] == {"check_same_thread": False}


def test_database_module_accepts_postgresql_with_pool_health_checks():
    url = "postgresql+psycopg://postgres:secret@127.0.0.1:5432/intellideploy"

    validate_database_url(url)
    kwargs = build_engine_kwargs(url)

    assert kwargs["pool_pre_ping"] is True
    assert kwargs["pool_recycle"] == 1800
