"""Publications, per-user library and sponsor reservations."""
from alembic import op
import sqlalchemy as sa

revision='0007_community'
down_revision='0006_instance_runtime'
branch_labels=None
depends_on=None


def upgrade():
    op.create_table('publications',
        sa.Column('id',sa.String(),primary_key=True),
        sa.Column('app_id',sa.String(),sa.ForeignKey('apps.id'),nullable=False,unique=True),
        sa.Column('instance_id',sa.String(),sa.ForeignKey('instances.id'),nullable=False),
        sa.Column('version_id',sa.String(),sa.ForeignKey('app_versions.id'),nullable=False),
        sa.Column('owner_id',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('payer_policy',sa.String(),nullable=False),
        sa.Column('sponsor_period',sa.String(),nullable=False),
        sa.Column('sponsor_limit_units',sa.BigInteger(),nullable=False),
        sa.Column('visible',sa.Boolean(),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False),
        sa.CheckConstraint('sponsor_limit_units > 0'))
    for name in ('publication_favorites','publication_recent_uses'):
        columns=[sa.Column('user_id',sa.Integer(),sa.ForeignKey('users.id'),primary_key=True),sa.Column('publication_id',sa.String(),sa.ForeignKey('publications.id'),primary_key=True),sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False)]
        if name=='publication_recent_uses': columns.append(sa.Column('instance_id',sa.String(),sa.ForeignKey('instances.id'),nullable=False))
        op.create_table(name,*columns)
    op.create_table('sponsor_reservations',sa.Column('operation_id',sa.String(),sa.ForeignKey('quota_reservations.operation_id'),primary_key=True),sa.Column('publication_id',sa.String(),sa.ForeignKey('publications.id'),nullable=False),sa.Column('period_start',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_sponsor_reservations_publication_id','sponsor_reservations',['publication_id'])


def downgrade():
    op.drop_table('sponsor_reservations')
    op.drop_table('publication_recent_uses')
    op.drop_table('publication_favorites')
    op.drop_table('publications')
