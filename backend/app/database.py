from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings


def validate_database_url(database_url: str) -> None:
    if database_url.startswith(("postgresql+psycopg://", "sqlite:///")):
        return
    raise ValueError(
        "DATABASE_URL must use PostgreSQL (postgresql+psycopg://...) "
        "or SQLite (sqlite:///...)."
    )


def build_engine_kwargs(database_url: str) -> dict:
    if database_url.startswith("sqlite:///"):
        return {"connect_args": {"check_same_thread": False}}
    return {
        # Keep long-lived API workers healthy against stale DB connections.
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    }


database_url = settings.DATABASE_URL.strip()
validate_database_url(database_url)

engine = create_engine(database_url, **build_engine_kwargs(database_url))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
