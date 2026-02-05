-- Migration: Create kingdom_reviews table for community reviews
-- Run this in Supabase SQL Editor
-- Date: 2026-02-05

-- Create kingdom_reviews table
CREATE TABLE IF NOT EXISTS kingdom_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kingdom_number INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL CHECK (char_length(comment) >= 10 AND char_length(comment) <= 1000),
    
    -- Snapshot of author's profile at time of review (for historical display)
    author_linked_username TEXT NOT NULL,
    author_linked_avatar_url TEXT,
    author_linked_kingdom INTEGER,
    author_linked_tc_level INTEGER NOT NULL CHECK (author_linked_tc_level >= 20),
    author_subscription_tier VARCHAR(20) DEFAULT 'free',
    
    -- Helpful voting
    helpful_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create helpful_votes junction table for tracking who voted
CREATE TABLE IF NOT EXISTS review_helpful_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES kingdom_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_id, user_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_kingdom_reviews_kingdom ON kingdom_reviews(kingdom_number);
CREATE INDEX IF NOT EXISTS idx_kingdom_reviews_user ON kingdom_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_kingdom_reviews_created ON kingdom_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kingdom_reviews_helpful ON kingdom_reviews(helpful_count DESC);
CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_review ON review_helpful_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_user ON review_helpful_votes(user_id);

-- Enable RLS
ALTER TABLE kingdom_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for kingdom_reviews
-- ============================================

-- Policy: Anyone can read reviews (public)
DROP POLICY IF EXISTS "Anyone can read reviews" ON kingdom_reviews;
CREATE POLICY "Anyone can read reviews" ON kingdom_reviews
    FOR SELECT
    USING (true);

-- Policy: Authenticated users with linked account + TC 20+ can create reviews
DROP POLICY IF EXISTS "Linked users can create reviews" ON kingdom_reviews;
CREATE POLICY "Linked users can create reviews" ON kingdom_reviews
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND author_linked_tc_level >= 20
    );

-- Policy: Users can update their own reviews
DROP POLICY IF EXISTS "Users can update own reviews" ON kingdom_reviews;
CREATE POLICY "Users can update own reviews" ON kingdom_reviews
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own reviews
DROP POLICY IF EXISTS "Users can delete own reviews" ON kingdom_reviews;
CREATE POLICY "Users can delete own reviews" ON kingdom_reviews
    FOR DELETE
    USING (auth.uid() = user_id);

-- Policy: Admins can delete any review (moderation)
DROP POLICY IF EXISTS "Admins can delete any review" ON kingdom_reviews;
CREATE POLICY "Admins can delete any review" ON kingdom_reviews
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- ============================================
-- RLS Policies for review_helpful_votes
-- ============================================

-- Policy: Anyone can see vote counts (via reviews)
DROP POLICY IF EXISTS "Anyone can read helpful votes" ON review_helpful_votes;
CREATE POLICY "Anyone can read helpful votes" ON review_helpful_votes
    FOR SELECT
    USING (true);

-- Policy: Authenticated users can vote
DROP POLICY IF EXISTS "Users can vote helpful" ON review_helpful_votes;
CREATE POLICY "Users can vote helpful" ON review_helpful_votes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can remove their own vote
DROP POLICY IF EXISTS "Users can remove own vote" ON review_helpful_votes;
CREATE POLICY "Users can remove own vote" ON review_helpful_votes
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- Triggers
-- ============================================

-- Updated_at trigger for reviews
CREATE OR REPLACE FUNCTION update_kingdom_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kingdom_reviews_updated_at ON kingdom_reviews;
CREATE TRIGGER kingdom_reviews_updated_at
    BEFORE UPDATE ON kingdom_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_kingdom_reviews_updated_at();

-- Trigger to update helpful_count when votes change
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE kingdom_reviews 
        SET helpful_count = helpful_count + 1 
        WHERE id = NEW.review_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE kingdom_reviews 
        SET helpful_count = helpful_count - 1 
        WHERE id = OLD.review_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS review_helpful_vote_count ON review_helpful_votes;
CREATE TRIGGER review_helpful_vote_count
    AFTER INSERT OR DELETE ON review_helpful_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_review_helpful_count();

-- ============================================
-- Grants
-- ============================================

GRANT SELECT ON kingdom_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON kingdom_reviews TO authenticated;
GRANT SELECT ON review_helpful_votes TO anon;
GRANT SELECT, INSERT, DELETE ON review_helpful_votes TO authenticated;

-- ============================================
-- Verification
-- ============================================

SELECT 'kingdom_reviews table created' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'kingdom_reviews'
ORDER BY ordinal_position;
