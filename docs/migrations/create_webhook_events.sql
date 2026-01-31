-- Migration: Create webhook_events table for Stripe webhook logging
-- Run this in Supabase SQL Editor
-- Required for monitoring Stripe webhook processing
-- 
-- STATUS: PENDING - Run this migration in Supabase Dashboard

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,  -- Stripe event ID (evt_xxx)
    event_type TEXT NOT NULL,       -- e.g., checkout.session.completed
    status TEXT NOT NULL DEFAULT 'received',  -- received, processed, failed
    payload JSONB,                  -- Full event payload
    error_message TEXT,             -- Error message if failed
    processing_time_ms INTEGER,     -- How long processing took
    user_id UUID REFERENCES profiles(id),  -- Associated user
    customer_id TEXT,               -- Stripe customer ID
    processed_at TIMESTAMPTZ,       -- When processing completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_customer_id ON webhook_events(customer_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webhook_events_updated_at ON webhook_events;
CREATE TRIGGER webhook_events_updated_at
    BEFORE UPDATE ON webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_events_updated_at();

-- RLS Policies
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/update (from API webhooks)
CREATE POLICY "Service role full access on webhook_events"
    ON webhook_events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Admins can read webhook events
CREATE POLICY "Admins can view webhook_events"
    ON webhook_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- Verify table was created
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'webhook_events'
ORDER BY ordinal_position;
