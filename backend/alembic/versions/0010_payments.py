"""Payment orders, immutable SKU snapshots and provider receipts."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0010_payments'
down_revision = '0009_developer_evaluation'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('product_skus', sa.Column('stripe_price_id', sa.String()))
    op.create_table('payment_orders',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('operation_id', sa.String(), nullable=False),
        sa.Column('sku_id', sa.String(), sa.ForeignKey('product_skus.id'), nullable=False),
        sa.Column('sku_snapshot', postgresql.JSONB(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False),
        sa.Column('amount_minor', sa.BigInteger(), nullable=False),
        sa.Column('units', sa.BigInteger(), nullable=False),
        sa.Column('period', sa.String()), sa.Column('period_start', sa.DateTime(timezone=True)), sa.Column('period_end', sa.DateTime(timezone=True)),
        sa.Column('status', sa.String(), nullable=False), sa.Column('checkout_state', sa.String(), nullable=False),
        sa.Column('checkout_url', sa.String()), sa.Column('payment_url', sa.String()), sa.Column('checkout_kind', sa.String()),
        sa.Column('provider_checkout_id', sa.String()), sa.Column('transaction_id', sa.String()), sa.Column('paid_at', sa.DateTime(timezone=True)),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'operation_id'), sa.CheckConstraint('amount_minor > 0 AND units > 0'))
    op.create_index('ix_payment_orders_user_id', 'payment_orders', ['user_id'])
    op.create_table('payment_receipts',
        sa.Column('id', sa.String(), primary_key=True), sa.Column('provider', sa.String(), nullable=False),
        sa.Column('event_id', sa.String(), nullable=False), sa.Column('transaction_id', sa.String(), nullable=False),
        sa.Column('order_id', sa.String(), sa.ForeignKey('payment_orders.id'), nullable=False),
        sa.Column('amount_minor', sa.BigInteger(), nullable=False), sa.Column('currency', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('provider', 'event_id'), sa.UniqueConstraint('provider', 'transaction_id'))
    op.add_column('subscriptions', sa.Column('payment_order_id', sa.String(), sa.ForeignKey('payment_orders.id')))
    op.add_column('subscriptions', sa.Column('provider_subscription_id', sa.String()))
    op.create_unique_constraint('uq_subscriptions_provider_subscription_id', 'subscriptions', ['provider_subscription_id'])
    op.add_column('subscriptions', sa.Column('provider_customer_id', sa.String()))


def downgrade():
    op.drop_column('subscriptions', 'provider_customer_id')
    op.drop_constraint('uq_subscriptions_provider_subscription_id', 'subscriptions', type_='unique')
    op.drop_column('subscriptions', 'provider_subscription_id')
    op.drop_column('subscriptions', 'payment_order_id')
    op.drop_table('payment_receipts')
    op.drop_index('ix_payment_orders_user_id', table_name='payment_orders')
    op.drop_table('payment_orders')
    op.drop_column('product_skus', 'stripe_price_id')
