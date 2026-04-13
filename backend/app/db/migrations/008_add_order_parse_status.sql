-- 008_add_order_parse_status.sql
-- Track whether the AI order-parsing pipeline succeeded, failed, or was skipped.
-- Allows retrying failed parses and surfacing errors in the dashboard.

ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS order_parse_status VARCHAR NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_calls_order_parse_status
    ON calls (order_parse_status);
