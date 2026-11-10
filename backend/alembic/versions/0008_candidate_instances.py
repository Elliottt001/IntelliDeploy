"""Distinguish temporary candidates from user production instances."""
from alembic import op
import sqlalchemy as sa
revision='0008_candidate_instances'
down_revision='0007_community'
branch_labels=None
depends_on=None

def upgrade():op.add_column('instances',sa.Column('kind',sa.String(),nullable=False,server_default='PRODUCTION'))
def downgrade():op.drop_column('instances','kind')
