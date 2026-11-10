"""instance-scoped capability identity"""

from alembic import op
import sqlalchemy as sa


revision = "0004_capability_identity"
down_revision = "0003_billing"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "instance_credentials",
        sa.Column("instance_id", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["instance_id"], ["instances.id"]),
        sa.PrimaryKeyConstraint("instance_id"),
    )
    op.create_table(
        "app_login_codes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column("instance_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("callback", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["instance_id"], ["instances.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code_hash"),
    )
    op.create_index("ix_app_login_codes_code_hash", "app_login_codes", ["code_hash"])
    op.create_index("ix_app_login_codes_instance_id", "app_login_codes", ["instance_id"])


def downgrade():
    op.drop_index("ix_app_login_codes_instance_id", table_name="app_login_codes")
    op.drop_index("ix_app_login_codes_code_hash", table_name="app_login_codes")
    op.drop_table("app_login_codes")
    op.drop_table("instance_credentials")

