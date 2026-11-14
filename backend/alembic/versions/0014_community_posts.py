"""Persist substantive community posts without fabricated engagement metrics."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0014_community_posts'
down_revision = '0013_resource_cleanup'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'community_posts',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String()),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('tags', postgresql.JSONB(), nullable=False),
        sa.Column('visibility', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("visibility IN ('PUBLIC', 'HIDDEN')"),
    )
    op.create_index('ix_community_posts_author_id', 'community_posts', ['author_id'])


def downgrade():
    op.drop_index('ix_community_posts_author_id', table_name='community_posts')
    op.drop_table('community_posts')
