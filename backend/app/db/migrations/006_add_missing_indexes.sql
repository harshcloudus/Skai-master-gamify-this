-- 006_add_missing_indexes.sql
-- Indexes for columns frequently used in lookups but not previously indexed.

CREATE INDEX IF NOT EXISTS idx_calls_elevenlabs_conversation
    ON calls (elevenlabs_conversation_id);

CREATE INDEX IF NOT EXISTS idx_restaurants_agent_id
    ON restaurants (elevenlabs_agent_id);

CREATE INDEX IF NOT EXISTS idx_restaurants_twilio_number
    ON restaurants (twilio_phone_number);
