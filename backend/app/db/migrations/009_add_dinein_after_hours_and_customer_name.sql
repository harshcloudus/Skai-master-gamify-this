-- 009_add_dinein_after_hours_and_customer_name.sql
-- Adds two new toggles to restaurant_settings:
--   dinein_take_reservations_after_hours: allow dine-in reservations when closed
--   ask_customer_name: prompt callers for their name during orders

ALTER TABLE restaurant_settings
    ADD COLUMN IF NOT EXISTS dinein_take_reservations_after_hours BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ask_customer_name BOOLEAN NOT NULL DEFAULT false;
