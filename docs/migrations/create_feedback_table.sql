-- Create feedback table for user feedback collection
-- Run this migration in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('bug', 'feature', 'general')),
    message TEXT NOT NULL,
    email VARCHAR(255),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    page_url TEXT,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert feedback (even anonymous users)
DROP POLICY IF EXISTS "Anyone can submit feedback" ON feedback;
CREATE POLICY "Anyone can submit feedback" ON feedback
    FOR INSERT
    WITH CHECK (true);

-- Policy: Only authenticated users can view their own feedback
DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
CREATE POLICY "Users can view their own feedback" ON feedback
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can do anything (for admin dashboard)
DROP POLICY IF EXISTS "Service role has full access" ON feedback;
CREATE POLICY "Service role has full access" ON feedback
    FOR ALL
    USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

-- Grant permissions
GRANT INSERT ON feedback TO anon;
GRANT INSERT, SELECT ON feedback TO authenticated;
