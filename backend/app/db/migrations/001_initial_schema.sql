-- 001_initial_schema.sql
-- SKAI Backend — Full initial database schema
-- Run this against your Supabase project via the SQL editor.

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Tables
-- ============================================================

-- Restaurants
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    timezone VARCHAR NOT NULL DEFAULT 'America/New_York',
    elevenlabs_agent_id VARCHAR,
    twilio_phone_number VARCHAR,
    agent_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (id matches Supabase Auth user ID)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    email VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL DEFAULT '',
    role VARCHAR NOT NULL DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business Hours
CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TIME,
    close_time TIME,
    UNIQUE (restaurant_id, day_of_week)
);

-- Restaurant Settings (one row per restaurant)
CREATE TABLE IF NOT EXISTS restaurant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
    dinein_transfer_enabled BOOLEAN NOT NULL DEFAULT false,
    dinein_max_hourly_capacity INT NOT NULL DEFAULT 0,
    takeaway_enabled BOOLEAN NOT NULL DEFAULT false,
    takeaway_stop_minutes_before_close INT NOT NULL DEFAULT 0,
    divert_enabled BOOLEAN NOT NULL DEFAULT false,
    divert_threshold_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    sms_order_ready_enabled BOOLEAN NOT NULL DEFAULT false
);

-- Menu Items (with pgvector embedding)
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    pos_name VARCHAR NOT NULL,
    title VARCHAR,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    category VARCHAR,
    is_active BOOLEAN NOT NULL DEFAULT true,
    pos_item_id VARCHAR,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calls
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    twilio_call_sid VARCHAR UNIQUE,
    elevenlabs_conversation_id VARCHAR,
    phone_number VARCHAR,
    customer_name VARCHAR,
    call_status VARCHAR NOT NULL DEFAULT 'completed',
    call_duration_seconds INT,
    transcript JSONB,
    summary TEXT,
    has_order BOOLEAN NOT NULL DEFAULT false,
    call_started_at TIMESTAMPTZ,
    call_ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    phone_number VARCHAR,
    customer_name VARCHAR,
    order_type VARCHAR NOT NULL DEFAULT 'takeaway',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    items_count INT NOT NULL DEFAULT 0,
    raw_parsed_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    modifiers JSONB DEFAULT '[]'::jsonb
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_business_hours_restaurant ON business_hours(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_calls_restaurant ON calls(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_calls_phone ON calls(phone_number);
CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_call ON orders(call_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- pgvector index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_menu_items_embedding
ON menu_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- Functions
-- ============================================================

-- Semantic menu item matching via pgvector
CREATE OR REPLACE FUNCTION match_menu_items(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 5,
    p_restaurant_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    pos_name text,
    title text,
    description text,
    price decimal,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mi.id,
        mi.pos_name::text,
        mi.title::text,
        mi.description,
        mi.price,
        1 - (mi.embedding <=> query_embedding) AS similarity
    FROM menu_items mi
    WHERE mi.is_active = true
        AND mi.restaurant_id = p_restaurant_id
        AND 1 - (mi.embedding <=> query_embedding) > match_threshold
    ORDER BY mi.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
