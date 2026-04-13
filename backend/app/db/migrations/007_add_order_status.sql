-- 007_add_order_status.sql
-- Add lifecycle status to orders (pending → confirmed → completed / cancelled).

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_status VARCHAR NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders (order_status);
