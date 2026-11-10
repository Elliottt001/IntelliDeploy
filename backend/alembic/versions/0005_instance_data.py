"""instance data spaces and files"""

from alembic import op
import sqlalchemy as sa


revision = "0005_instance_data"
down_revision = "0004_capability_identity"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "instance_data_spaces",
        sa.Column("instance_id", sa.String(), nullable=False),
        sa.Column("database_name", sa.String(), nullable=False),
        sa.Column("role_name", sa.String(), nullable=False),
        sa.Column("secret_ref", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("destroyed_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["instance_id"], ["instances.id"]),
        sa.PrimaryKeyConstraint("instance_id"),
        sa.UniqueConstraint("database_name"),
        sa.UniqueConstraint("role_name"),
    )
    op.create_table(
        "file_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instance_id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer()),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("public", sa.Boolean(), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["instance_id"], ["instances.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_file_records_instance_id", "file_records", ["instance_id"])


def downgrade():
    op.drop_index("ix_file_records_instance_id", table_name="file_records")
    op.drop_table("file_records")
    op.drop_table("instance_data_spaces")

