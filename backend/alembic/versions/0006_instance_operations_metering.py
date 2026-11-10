"""instance operations, observations, and metering windows"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0006_instance_runtime"
down_revision = "0005_instance_data"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("instances", sa.Column("desired_state", sa.String(), nullable=False, server_default="RUNNING"))
    op.add_column("instances", sa.Column("stop_reason", sa.String()))
    op.add_column("instances", sa.Column("observed_at", sa.DateTime(timezone=True)))
    op.add_column("instances", sa.Column("resource_spec", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("instances", sa.Column("price_version", sa.String(), nullable=False, server_default="dev-v1"))
    op.add_column("instances", sa.Column("state_version", sa.BigInteger(), nullable=False, server_default="0"))
    op.create_table(
        "instance_operations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instance_id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("operation_id", sa.String(), nullable=False),
        sa.Column("payload_hash", sa.String(), nullable=False),
        sa.Column("delete_data", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("reservation_operation_id", sa.String()),
        sa.Column("effect_started_at", sa.DateTime(timezone=True)),
        sa.Column("lease_owner", sa.String()),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("lease_generation", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["instance_id"], ["instances.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_id", "instance_id", "kind", "operation_id"),
    )
    op.create_index("ix_instance_operations_instance_id", "instance_operations", ["instance_id"])
    op.create_table(
        "resource_observations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instance_id", sa.String(), nullable=False),
        sa.Column("target_id", sa.String()),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("compute_state", sa.String(), nullable=False),
        sa.Column("resource_spec", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("storage_mb", sa.BigInteger(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["instance_id"], ["instances.id"]),
        sa.ForeignKeyConstraint(["target_id"], ["deployment_targets.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("instance_id", "observed_at"),
    )
    op.create_index("ix_resource_observations_instance_id", "resource_observations", ["instance_id"])
    op.create_table(
        "resource_meter_windows",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instance_id", sa.String(), nullable=False),
        sa.Column("payer_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("compute_state", sa.String(), nullable=False),
        sa.Column("compute_units", sa.BigInteger()),
        sa.Column("storage_units", sa.BigInteger()),
        sa.Column("price_version", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("evidence_ref", sa.String(), nullable=False),
        sa.Column("reservation_operation_id", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("window_end > window_start"),
        sa.ForeignKeyConstraint(["instance_id"], ["instances.id"]),
        sa.ForeignKeyConstraint(["payer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("instance_id", "window_start", "kind"),
    )
    op.create_index("ix_resource_meter_windows_instance_id", "resource_meter_windows", ["instance_id"])
    op.create_table(
        "maintenance_leases",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("owner", sa.String()),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("generation", sa.BigInteger(), nullable=False),
        sa.Column("last_success", sa.DateTime(timezone=True)),
        sa.Column("retry_after", sa.DateTime(timezone=True)),
        sa.Column("error", postgresql.JSONB(astext_type=sa.Text())),
        sa.PrimaryKeyConstraint("name"),
    )


def downgrade():
    op.drop_table("maintenance_leases")
    op.drop_index("ix_resource_meter_windows_instance_id", table_name="resource_meter_windows")
    op.drop_table("resource_meter_windows")
    op.drop_index("ix_resource_observations_instance_id", table_name="resource_observations")
    op.drop_table("resource_observations")
    op.drop_index("ix_instance_operations_instance_id", table_name="instance_operations")
    op.drop_table("instance_operations")
    op.drop_column("instances", "state_version")
    op.drop_column("instances", "price_version")
    op.drop_column("instances", "resource_spec")
    op.drop_column("instances", "observed_at")
    op.drop_column("instances", "stop_reason")
    op.drop_column("instances", "desired_state")
