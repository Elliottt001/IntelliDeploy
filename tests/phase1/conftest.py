import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
TEST_URL = os.environ.get('TEST_DATABASE_URL', 'postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_test')
if make_url(TEST_URL).database != 'intellideploy_test' or make_url(TEST_URL).get_backend_name() != 'postgresql':
    raise RuntimeError('Phase one tests require the dedicated intellideploy_test PostgreSQL database')
os.environ['DATABASE_URL'] = TEST_URL
os.environ['SECRET_KEY'] = 'test-only-phase-one-secret'


@pytest.fixture
def pg_engine():
    engine = create_engine(TEST_URL)
    yield engine
    engine.dispose()


@pytest.fixture
def pg_session(pg_engine):
    with pg_engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode='create_savepoint') as session:
            yield session
        transaction.rollback()
