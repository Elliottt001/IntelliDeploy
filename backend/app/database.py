from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

database_url = settings.DATABASE_URL.strip()
if not database_url.startswith("postgresql+psycopg://"):
    raise ValueError(
        "DATABASE_URL must use PostgreSQL (postgresql+psycopg://...)."
    )

engine_kwargs = {
    # Keep long-lived API workers healthy against stale DB connections.
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}

engine = create_engine(database_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
