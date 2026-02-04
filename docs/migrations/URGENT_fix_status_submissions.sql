-- URGENT: Fix Status Submissions - Run in Supabase Dashboard → SQL Editor
-- This creates the missing profiles table and fixes status_submissions RLS policies
-- Run this FIRST before any other migrations

-- ============================================================
-- STEP 1: Create profiles table (required by status_submissions RLS)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  avatar_url TEXT,
  home_kingdom INTEGER,
  alliance_tag VARCHAR(3),
  language TEXT,
  region TEXT,
  bio TEXT,
  theme_color TEXT DEFAULT '#22d3ee',
  badge_style TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  -- Linked Kingshot account fields
  linked_player_id TEXT,
  linked_username TEXT,
  linked_avatar_url TEXT,
  linked_kingdom INTEGER,
  linked_tc_level INTEGER,
  -- Discord linking fields
  discord_id TEXT,
  discord_username TEXT
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (prevents conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable" ON profiles;

-- Create profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- Allow public viewing of basic profile info (for linked accounts display)
CREATE POLICY "Public profiles are viewable" ON profiles FOR SELECT USING (true);

-- Create indexes on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_linked_player_id ON profiles(linked_player_id);
CREATE INDEX IF NOT EXISTS idx_profiles_discord_id ON profiles(discord_id);

-- ============================================================
-- STEP 2: Create/fix status_submissions table
-- ============================================================

CREATE TABLE IF NOT EXISTS status_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kingdom_number INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  notes TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE status_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Anyone can view approved submissions" ON status_submissions;
DROP POLICY IF EXISTS "Users can view own submissions" ON status_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON status_submissions;
DROP POLICY IF EXISTS "Authenticated users can submit" ON status_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON status_submissions;

-- Recreate policies
-- Anyone can view approved submissions
CREATE POLICY "Anyone can view approved submissions" 
  ON status_submissions FOR SELECT 
  USING (status = 'approved');

-- Authenticated users can view their own submissions
CREATE POLICY "Users can view own submissions" 
  ON status_submissions FOR SELECT 
  USING (auth.uid() = submitted_by);

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions" 
  ON status_submissions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Authenticated users can insert submissions
CREATE POLICY "Authenticated users can submit" 
  ON status_submissions FOR INSERT 
  WITH CHECK (auth.uid() = submitted_by);

-- Admins can update submissions (for review)
CREATE POLICY "Admins can update submissions" 
  ON status_submissions FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_status_submissions_kingdom ON status_submissions(kingdom_number);
CREATE INDEX IF NOT EXISTS idx_status_submissions_status ON status_submissions(status);
CREATE INDEX IF NOT EXISTS idx_status_submissions_submitted_by ON status_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_status_submissions_submitted_at ON status_submissions(submitted_at DESC);

-- ============================================================
-- STEP 3: Force PostgREST schema reload
-- ============================================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================================
-- STEP 4: Verify setup
-- ============================================================

SELECT 'profiles table' as table_name, count(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles'
UNION ALL
SELECT 'status_submissions table', count(*)
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'status_submissions';

-- ============================================================
-- STEP 5: Set yourself as admin (replace YOUR_USER_ID)
-- ============================================================
-- After running this, find your user ID from auth.users and run:
-- UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';
