-- Kingshot Atlas Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- User Data table for cross-device sync (favorites, recently viewed, etc.)
CREATE TABLE IF NOT EXISTS user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  favorites INTEGER[] DEFAULT '{}',
  recently_viewed INTEGER[] DEFAULT '{}',
  compare_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own data" ON user_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON user_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON user_data
  FOR UPDATE USING (auth.uid() = user_id);

-- Status Submissions table for community-sourced status updates
CREATE TABLE IF NOT EXISTS status_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kingdom_number INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL CHECK (new_status IN ('Leading', 'Ordinary', 'Unannounced')),
  notes TEXT DEFAULT '',
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  -- Prevent duplicate pending submissions from same user for same kingdom
  CONSTRAINT unique_pending_submission UNIQUE (kingdom_number, submitted_by, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Enable RLS
ALTER TABLE status_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved submissions
CREATE POLICY "Anyone can view approved submissions" ON status_submissions
  FOR SELECT USING (status = 'approved');

-- Users can view their own submissions (any status)
CREATE POLICY "Users can view own submissions" ON status_submissions
  FOR SELECT USING (auth.uid() = submitted_by);

-- Authenticated users can submit
CREATE POLICY "Authenticated users can submit" ON status_submissions
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Create index for efficient queries
CREATE INDEX idx_status_submissions_kingdom ON status_submissions(kingdom_number);
CREATE INDEX idx_status_submissions_status ON status_submissions(status);
CREATE INDEX idx_status_submissions_submitted_by ON status_submissions(submitted_by);

-- Kingdom Reviews table
CREATE TABLE IF NOT EXISTS kingdom_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kingdom_number INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT DEFAULT '',
  pros TEXT[] DEFAULT '{}',
  cons TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One review per user per kingdom
  CONSTRAINT unique_user_kingdom_review UNIQUE (kingdom_number, user_id)
);

-- Enable RLS
ALTER TABLE kingdom_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews
CREATE POLICY "Anyone can view reviews" ON kingdom_reviews
  FOR SELECT USING (true);

-- Users can insert their own reviews
CREATE POLICY "Users can insert own reviews" ON kingdom_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON kingdom_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews" ON kingdom_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_kingdom_reviews_kingdom ON kingdom_reviews(kingdom_number);

-- Admin table for moderation
CREATE TABLE IF NOT EXISTS admins (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT DEFAULT 'moderator' CHECK (role IN ('moderator', 'admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin list
CREATE POLICY "Admins can view admin list" ON admins
  FOR SELECT USING (EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()));

-- Admin-only policy for status_submissions moderation
CREATE POLICY "Admins can view all submissions" ON status_submissions
  FOR SELECT USING (EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update submissions" ON status_submissions
  FOR UPDATE USING (EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()));

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_kingdom_reviews_updated_at
  BEFORE UPDATE ON kingdom_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
