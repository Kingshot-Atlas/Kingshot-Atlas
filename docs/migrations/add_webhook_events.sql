-- Migration: Add webhook_events table for Stripe webhook logging
-- Purpose: Track all webhook events for debugging, monitoring, and retry handling
-- Run this in Supabase SQL Editor

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,  -- Stripe event ID (evt_xxx)
    event_type TEXT NOT NULL,       -- e.g., checkout.session.completed
    status TEXT NOT NULL DEFAULT 'received',  -- received, processed, failed
    payload JSONB,                  -- Full event payload for debugging
    error_message TEXT,             -- Error message if processing failed
    processing_time_ms INTEGER,     -- How long it took to process
    retry_count INTEGER DEFAULT 0,  -- Number of retry attempts
    user_id UUID REFERENCES auth.users(id),  -- Associated user if applicable
    customer_id TEXT,               -- Stripe customer ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON webhook_events(user_id);

-- Enable RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook events (admin only)
CREATE POLICY "Service role can manage webhook events"
ON webhook_events
FOR ALL
USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE webhook_events IS 'Logs all Stripe webhook events for monitoring and debugging';
