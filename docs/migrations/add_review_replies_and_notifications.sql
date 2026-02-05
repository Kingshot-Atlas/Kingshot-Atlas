-- Migration: Add review replies and notifications for community reviews
-- Run this in Supabase SQL Editor
-- Date: 2026-02-05

-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: update_updated_at_column
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- REVIEW REPLIES TABLE
-- Allows kingdom recruiters/admins to respond to reviews
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES kingdom_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kingdom_number INTEGER NOT NULL,
    
    -- Reply content
    reply_text TEXT NOT NULL CHECK (char_length(reply_text) >= 5 AND char_length(reply_text) <= 500),
    
    -- Author info snapshot (for display)
    author_linked_username TEXT NOT NULL,
    author_linked_avatar_url TEXT,
    author_subscription_tier VARCHAR(20) DEFAULT 'free',
    is_official_reply BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one official reply per review (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_official_reply_per_review 
    ON review_replies (review_id) 
    WHERE is_official_reply = true;

-- Index for fetching replies by review
CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON review_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_kingdom ON review_replies(kingdom_number);

-- ═══════════════════════════════════════════════════════════════════════════════
-- REVIEW NOTIFICATIONS TABLE
-- Notifies users when their reviews get helpful votes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Notification type: 'helpful_vote', 'reply', etc.
    notification_type VARCHAR(50) NOT NULL,
    
    -- Related entities
    review_id UUID REFERENCES kingdom_reviews(id) ON DELETE CASCADE,
    reply_id UUID REFERENCES review_replies(id) ON DELETE CASCADE,
    
    -- Notification content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching user notifications
CREATE INDEX IF NOT EXISTS idx_review_notifications_user ON review_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_review_notifications_created ON review_notifications(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_notifications ENABLE ROW LEVEL SECURITY;

-- Review Replies: Anyone can read, only recruiters/admins can create for their kingdom
CREATE POLICY "Anyone can read review replies"
    ON review_replies FOR SELECT
    USING (true);

CREATE POLICY "Users can create replies"
    ON review_replies FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own replies"
    ON review_replies FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies"
    ON review_replies FOR DELETE
    USING (auth.uid() = user_id);

-- Notifications: Users can only see/modify their own
CREATE POLICY "Users can read own notifications"
    ON review_notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
    ON review_notifications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
    ON review_notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON review_notifications FOR DELETE
    USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: Create notification when someone votes a review helpful
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_helpful_vote_notification()
RETURNS TRIGGER AS $$
DECLARE
    review_author_id UUID;
    review_kingdom INTEGER;
    voter_username TEXT;
BEGIN
    -- Get the review author and kingdom
    SELECT user_id, kingdom_number INTO review_author_id, review_kingdom
    FROM kingdom_reviews
    WHERE id = NEW.review_id;
    
    -- Don't notify if user voted their own review
    IF review_author_id = NEW.user_id THEN
        RETURN NEW;
    END IF;
    
    -- Get voter's username from profiles
    SELECT linked_username INTO voter_username
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Create notification
    INSERT INTO review_notifications (
        user_id,
        notification_type,
        review_id,
        title,
        message
    ) VALUES (
        review_author_id,
        'helpful_vote',
        NEW.review_id,
        'Your review was marked helpful!',
        COALESCE(voter_username, 'Someone') || ' found your review of Kingdom ' || review_kingdom || ' helpful.'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_helpful_vote_create_notification ON review_helpful_votes;

-- Create trigger
CREATE TRIGGER on_helpful_vote_create_notification
    AFTER INSERT ON review_helpful_votes
    FOR EACH ROW
    EXECUTE FUNCTION create_helpful_vote_notification();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: Create notification when someone replies to a review
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_reply_notification()
RETURNS TRIGGER AS $$
DECLARE
    review_author_id UUID;
    review_kingdom INTEGER;
BEGIN
    -- Get the review author
    SELECT user_id, kingdom_number INTO review_author_id, review_kingdom
    FROM kingdom_reviews
    WHERE id = NEW.review_id;
    
    -- Don't notify if user replied to their own review
    IF review_author_id = NEW.user_id THEN
        RETURN NEW;
    END IF;
    
    -- Create notification
    INSERT INTO review_notifications (
        user_id,
        notification_type,
        review_id,
        reply_id,
        title,
        message
    ) VALUES (
        review_author_id,
        'reply',
        NEW.review_id,
        NEW.id,
        'New reply to your review',
        NEW.author_linked_username || ' replied to your review of Kingdom ' || review_kingdom || '.'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_reply_create_notification ON review_replies;

-- Create trigger
CREATE TRIGGER on_reply_create_notification
    AFTER INSERT ON review_replies
    FOR EACH ROW
    EXECUTE FUNCTION create_reply_notification();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: Update updated_at on review_replies
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER update_review_replies_updated_at
    BEFORE UPDATE ON review_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON review_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON review_notifications TO authenticated;
GRANT SELECT ON review_replies TO anon;
