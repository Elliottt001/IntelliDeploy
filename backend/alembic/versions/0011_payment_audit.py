"""Keep order closures and quota reclamation evidence without deleting usage history."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0011_payment_audit'
down_revision = '0010_payments'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('payment_orders', sa.Column('audit', postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))

def downgrade():
    op.drop_column('payment_orders', 'audit')
