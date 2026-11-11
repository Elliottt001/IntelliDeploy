"""Add the server-managed developer evaluation permission."""

from alembic import op
import sqlalchemy as sa


revision = "0009_developer_evaluation"
down_revision = "0008_candidate_instances"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "is_developer",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade():
    op.drop_column("users", "is_developer")
