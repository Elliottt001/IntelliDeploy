from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text


def test_upgrade_downgrade_in_isolated_schema_preserves_user_contract(pg_engine):
    schema = 'migration_' + uuid4().hex
    config = Config(str(Path('backend/alembic.ini').resolve()))
    with pg_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA {schema}'))
        connection.execute(text(f'SET search_path TO {schema}'))
        config.attributes['connection'] = connection
        try:
            command.upgrade(config, 'head')
            inspector = inspect(connection)
            assert {'apps', 'jobs', 'job_events', 'requirement_records', 'app_versions', 'instances', 'deployment_targets', 'resource_records', 'users'} <= set(inspector.get_table_names())
            columns = {c['name'] for c in inspector.get_columns('jobs')}
            assert {'lease_owner', 'lease_until', 'lease_generation', 'checkpoint', 'operation_id', 'requirement_revision'} <= columns
            connection.execute(text("INSERT INTO users (username,email,hashed_password,is_active) VALUES ('legacy','legacy@test','preserved',true)"))
            assert connection.execute(text('SELECT hashed_password FROM users')).scalar_one() == 'preserved'
            command.downgrade(config, 'base')
            assert 'jobs' not in inspect(connection).get_table_names()
            command.upgrade(config, 'head')
            assert 'jobs' in inspect(connection).get_table_names()
        finally:
            connection.execute(text('SET search_path TO public'))
            connection.execute(text(f'DROP SCHEMA {schema} CASCADE'))
