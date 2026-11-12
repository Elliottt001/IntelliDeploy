"""Server-side administration audit and persistent claim controls."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0012_platform_admin'
down_revision = '0011_payment_audit'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('admin_audits', sa.Column('id',sa.String(),primary_key=True),
        sa.Column('actor',sa.String(),nullable=False),sa.Column('action',sa.String(),nullable=False),
        sa.Column('subject',sa.String(),nullable=False),sa.Column('details',postgresql.JSONB(),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.create_table('platform_controls',sa.Column('name',sa.String(),primary_key=True),
        sa.Column('value',postgresql.JSONB(),nullable=False),sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False))

def downgrade():
    op.drop_table('platform_controls')
    op.drop_table('admin_audits')
