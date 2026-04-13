-- 002_add_takeaway_enabled.sql
-- Adds missing takeaway_enabled column to restaurant_settings.
-- Run this against your Supabase project via the SQL editor.

ALTER TABLE restaurant_settings
ADD COLUMN IF NOT EXISTS takeaway_enabled BOOLEAN NOT NULL DEFAULT false;
