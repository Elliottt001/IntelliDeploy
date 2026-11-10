import os
import sys
from uuid import uuid4
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


@pytest.fixture
def session_factory(pg_engine):
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import text
    with pg_engine.begin() as connection:
        connection.execute(text('TRUNCATE users, deployment_targets CASCADE'))
        if connection.execute(text("SELECT to_regclass('price_rules')")).scalar():
            connection.execute(text('TRUNCATE price_rules, product_skus CASCADE'))
        if connection.execute(text("SELECT to_regclass('maintenance_leases')")).scalar():
            connection.execute(text('TRUNCATE maintenance_leases'))
    yield sessionmaker(bind=pg_engine, expire_on_commit=False)
    with pg_engine.begin() as connection:
        connection.execute(text('TRUNCATE users, deployment_targets CASCADE'))
        if connection.execute(text("SELECT to_regclass('maintenance_leases')")).scalar():
            connection.execute(text('TRUNCATE maintenance_leases'))


@pytest.fixture
def job_factory(session_factory):
    from app.models.user import User
    from app.apps.models import App
    from app.jobs.models import Job
    from datetime import datetime, timedelta, timezone
    def create(status='QUEUED', checkpoint=None, expired=False):
        with session_factory() as session:
            user = User(username='user-' + uuid4().hex, email=uuid4().hex + '@test', hashed_password='test-only')
            session.add(user)
            session.flush()
            app = App(owner_id=user.id, name='笔记', prompt='保存笔记')
            session.add(app)
            session.flush()
            job = Job(app_id=app.id, operation_id=uuid4().hex, kind='GENERATE', status='RUNNING' if expired else status, budget_units=100, checkpoint=checkpoint or {})
            if expired:
                job.lease_owner = 'old'
                job.lease_until = datetime.now(timezone.utc) - timedelta(seconds=5)
            session.add(job)
            session.commit()
            return job
    return create


@pytest.fixture
def api_client(session_factory):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database import get_db
    def database():
        with session_factory() as session:
            yield session
    app.dependency_overrides[get_db] = database
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def owner_headers(api_client):
    response = api_client.post('/auth/register', json={'username':'owner', 'email':'owner@test', 'password':'a-secure-test-password'})
    assert response.status_code == 201
    token = api_client.post('/auth/login', json={'username':'owner', 'password':'a-secure-test-password'}).json()['access_token']
    return {'Authorization': 'Bearer ' + token}


@pytest.fixture
def other_headers(api_client):
    response = api_client.post('/auth/register', json={'username':'other', 'email':'other@test', 'password':'a-secure-test-password'})
    assert response.status_code == 201
    token = api_client.post('/auth/login', json={'username':'other', 'password':'a-secure-test-password'}).json()['access_token']
    return {'Authorization': 'Bearer ' + token}
