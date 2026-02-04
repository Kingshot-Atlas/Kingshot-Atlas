-- Create discord_link_attempts table for tracking OAuth attempts
-- Run this migration in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS discord_link_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    discord_id VARCHAR(50),
    discord_username VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_code VARCHAR(50),
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_discord_link_attempts_user_id ON discord_link_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_link_attempts_status ON discord_link_attempts(status);
CREATE INDEX IF NOT EXISTS idx_discord_link_attempts_created_at ON discord_link_attempts(created_at DESC);

-- Enable RLS
ALTER TABLE discord_link_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can insert (API uses service role)
DROP POLICY IF EXISTS "Service role can insert link attempts" ON discord_link_attempts;
CREATE POLICY "Service role can insert link attempts" ON discord_link_attempts
    FOR INSERT
    WITH CHECK (true);

-- Policy: Only service role can read (for admin dashboard)
DROP POLICY IF EXISTS "Service role can read link attempts" ON discord_link_attempts;
CREATE POLICY "Service role can read link attempts" ON discord_link_attempts
    FOR SELECT
    USING (true);

-- Comment on table
COMMENT ON TABLE discord_link_attempts IS 'Tracks Discord OAuth link attempts for monitoring and debugging';
