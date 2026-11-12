"""Persistent, leased cleanup actions preserve resources until absence is confirmed."""
from alembic import op
import sqlalchemy as sa

revision='0013_resource_cleanup'
down_revision='0012_platform_admin'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('cleanup_actions',sa.Column('id',sa.String(),primary_key=True),
        sa.Column('resource_id',sa.String(),sa.ForeignKey('resource_records.id'),nullable=False),
        sa.Column('action_kind',sa.String(),nullable=False),sa.Column('status',sa.String(),nullable=False),
        sa.Column('reason',sa.String(),nullable=False),sa.Column('previous_state',sa.String()),sa.Column('error_code',sa.String()),
        sa.Column('lease_token',sa.String()),sa.Column('lease_until',sa.DateTime(timezone=True)),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False),
        sa.UniqueConstraint('resource_id','action_kind'))

def downgrade(): op.drop_table('cleanup_actions')
