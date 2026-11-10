from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database import Base
from app.models.user import User
from app.apps import models as apps_models
from app.jobs import models as jobs_models
from app.runtime import models as runtime_models
from app.billing import models as billing_models

config = context.config
TABLES = {'users', 'apps', 'conversations', 'messages', 'requirement_records', 'app_versions', 'instances', 'jobs', 'job_events', 'tool_call_records', 'deployment_targets', 'resource_records', 'request_records'}
TABLES |= {'price_rules','quota_grants','quota_reservations','reservation_allocations','usage_entries','unknown_usage','product_skus','subscriptions'}


def include_object(obj, name, type_, reflected, compare_to):
    return type_ != 'table' or name in TABLES


def run(connection):
    context.configure(connection=connection, target_metadata=Base.metadata, include_object=include_object)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    context.configure(url=settings.DATABASE_URL, target_metadata=Base.metadata, literal_binds=True, dialect_opts={'paramstyle': 'named'})
    with context.begin_transaction():
        context.run_migrations()
elif config.attributes.get('connection') is not None:
    run(config.attributes['connection'])
else:
    section = config.get_section(config.config_ini_section, {})
    section['sqlalchemy.url'] = settings.DATABASE_URL
    connectable = engine_from_config(section, prefix='sqlalchemy.', poolclass=pool.NullPool)
    with connectable.connect() as connection:
        run(connection)
