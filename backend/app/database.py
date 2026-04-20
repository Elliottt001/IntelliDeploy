from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

database_url = settings.DATABASE_URL.strip()
is_sqlite = database_url.startswith("sqlite")

engine_kwargs = {}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Keep long-lived API workers healthy against stale DB connections.
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 1800

engine = create_engine(database_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_sqlite_compatibility_migrations() -> None:
    # Keep startup resilient for existing local SQLite databases
    # without Alembic.
    if not is_sqlite:
        return

    with engine.begin() as conn:
        columns = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
        column_names = {row[1] for row in columns}
        if "kubeconfig" not in column_names:
            conn.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN kubeconfig TEXT"
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


ensure_sqlite_compatibility_migrations()
