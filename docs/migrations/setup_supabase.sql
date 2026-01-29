-- Complete Supabase Setup for Kingshot Atlas
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Create profiles table
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
  linked_tc_level INTEGER
);

-- 2. Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Create user_data table for cross-device sync
CREATE TABLE IF NOT EXISTS user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  favorites INTEGER[] DEFAULT '{}',
  recently_viewed INTEGER[] DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable RLS for user_data
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for user_data
CREATE POLICY "Users can view own data" ON user_data
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own data" ON user_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own data" ON user_data
  FOR UPDATE USING (auth.uid() = user_id);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_linked_player_id ON profiles(linked_player_id);
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);

-- 9. Verify table structures
SELECT 'profiles' as table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
UNION ALL
SELECT 'user_data' as table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_data'
ORDER BY table_name, ordinal_position;
