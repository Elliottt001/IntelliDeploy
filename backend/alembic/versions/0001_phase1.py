"""phase one persistent foundation"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = '0001_phase1'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('deployment_targets',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('enabled', sa.Boolean(), nullable=False),
    sa.Column('health', sa.String(), nullable=False),
    sa.Column('architecture', sa.String(), nullable=False),
    sa.Column('capacity', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('domain_suffix', sa.String(), nullable=True),
    sa.Column('secret_ref', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('username', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('hashed_password', sa.String(), nullable=False),
    sa.Column('kubeconfig', sa.String(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_table('apps',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('prompt', sa.Text(), nullable=False),
    sa.Column('active_version_id', sa.String(), nullable=True),
    sa.Column('source_version_id', sa.String(), nullable=True),
    sa.Column('candidate_version_id', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_apps_owner_id'), 'apps', ['owner_id'], unique=False)
    op.create_table('app_versions',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('app_id', sa.String(), nullable=False),
    sa.Column('requirement_revision', sa.Integer(), nullable=False),
    sa.Column('sources', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('template_version', sa.String(), nullable=True),
    sa.Column('manifest', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('validation', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('artifact_path', sa.Text(), nullable=True),
    sa.Column('immutable', sa.Boolean(), nullable=False),
    sa.Column('delivery', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['app_id'], ['apps.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_app_versions_app_id'), 'app_versions', ['app_id'], unique=False)
    op.create_table('conversations',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('app_id', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['app_id'], ['apps.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('app_id')
    )
    op.create_table('jobs',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('app_id', sa.String(), nullable=False),
    sa.Column('operation_id', sa.String(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('phase', sa.String(), nullable=False),
    sa.Column('lease_owner', sa.String(), nullable=True),
    sa.Column('lease_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('lease_generation', sa.BigInteger(), nullable=False),
    sa.Column('checkpoint', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('requirement_revision', sa.Integer(), nullable=True),
    sa.Column('reservation_id', sa.String(), nullable=True),
    sa.Column('budget_units', sa.BigInteger(), nullable=False),
    sa.Column('used_units', sa.BigInteger(), nullable=False),
    sa.Column('question', sa.Text(), nullable=True),
    sa.Column('error', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('cancel_requested', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('budget_units > 0 AND used_units >= 0'),
    sa.ForeignKeyConstraint(['app_id'], ['apps.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('operation_id')
    )
    op.create_index('one_active_job_per_app', 'jobs', ['app_id'], unique=True, postgresql_where=sa.text("status IN ('QUEUED','RUNNING','WAITING_USER','PAUSED_QUOTA')"))
    op.create_table('messages',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('app_id', sa.String(), nullable=False),
    sa.Column('sequence', sa.BigInteger(), nullable=False),
    sa.Column('role', sa.String(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['app_id'], ['apps.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('app_id', 'sequence')
    )
    op.create_table('requirement_records',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('app_id', sa.String(), nullable=False),
    sa.Column('revision', sa.Integer(), nullable=False),
    sa.Column('requirement', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('review', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['app_id'], ['apps.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('app_id', 'revision')
    )
    op.create_table('instances',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('app_id', sa.String(), nullable=False),
    sa.Column('version_id', sa.String(), nullable=True),
    sa.Column('target_id', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('url', sa.Text(), nullable=True),
    sa.Column('data_namespace', sa.String(), nullable=True),
    sa.Column('secret_ref', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['app_id'], ['apps.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['target_id'], ['deployment_targets.id'], ),
    sa.ForeignKeyConstraint(['version_id'], ['app_versions.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('data_namespace')
    )
    op.create_index(op.f('ix_instances_app_id'), 'instances', ['app_id'], unique=False)
    op.create_table('job_events',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('job_id', sa.String(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('public_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_job_events_job_id'), 'job_events', ['job_id'], unique=False)
    op.create_table('resource_records',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('type', sa.String(), nullable=False),
    sa.Column('target_id', sa.String(), nullable=True),
    sa.Column('app_id', sa.String(), nullable=True),
    sa.Column('job_id', sa.String(), nullable=True),
    sa.Column('version_id', sa.String(), nullable=True),
    sa.Column('operation_id', sa.String(), nullable=False),
    sa.Column('state', sa.String(), nullable=False),
    sa.Column('reference', sa.Text(), nullable=False),
    sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['app_id'], ['apps.id'], ),
    sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
    sa.ForeignKeyConstraint(['target_id'], ['deployment_targets.id'], ),
    sa.ForeignKeyConstraint(['version_id'], ['app_versions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_resource_records_operation_id'), 'resource_records', ['operation_id'], unique=False)
    op.create_table('tool_call_records',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('job_id', sa.String(), nullable=False),
    sa.Column('call_id', sa.String(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('input_summary', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('usage', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('job_id', 'call_id')
    )

def downgrade():
    op.drop_table('tool_call_records')
    op.drop_index(op.f('ix_resource_records_operation_id'), table_name='resource_records')
    op.drop_table('resource_records')
    op.drop_index(op.f('ix_job_events_job_id'), table_name='job_events')
    op.drop_table('job_events')
    op.drop_index(op.f('ix_instances_app_id'), table_name='instances')
    op.drop_table('instances')
    op.drop_table('requirement_records')
    op.drop_table('messages')
    op.drop_index('one_active_job_per_app', table_name='jobs', postgresql_where=sa.text("status IN ('QUEUED','RUNNING','WAITING_USER','PAUSED_QUOTA')"))
    op.drop_table('jobs')
    op.drop_table('conversations')
    op.drop_index(op.f('ix_app_versions_app_id'), table_name='app_versions')
    op.drop_table('app_versions')
    op.drop_index(op.f('ix_apps_owner_id'), table_name='apps')
    op.drop_table('apps')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_table('deployment_targets')
