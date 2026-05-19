from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

database_url = settings.DATABASE_URL.strip()
if database_url.startswith("sqlite:///"):
    engine_kwargs = {
        "connect_args": {"check_same_thread": False},
    }
elif database_url.startswith("postgresql+psycopg://"):
    engine_kwargs = {
        # Keep long-lived API workers healthy against stale DB connections.
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    }
else:
    raise ValueError(
        "DATABASE_URL must use SQLite (sqlite:///...) or PostgreSQL "
        "(postgresql+psycopg://...)."
    )

engine = create_engine(database_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
