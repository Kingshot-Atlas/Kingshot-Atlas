-- Simple Supabase Setup (fixed verification query)
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Create profiles table (IF NOT EXISTS handles existing)
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

-- 2. Enable RLS (safe to run multiple times)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies (DROP IF EXISTS first)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Create user_data table (IF NOT EXISTS handles existing)
CREATE TABLE IF NOT EXISTS user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  favorites INTEGER[] DEFAULT '{}',
  recently_viewed INTEGER[] DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS for user_data (safe to run multiple times)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for user_data (DROP IF EXISTS first)
DROP POLICY IF EXISTS "Users can view own data" ON user_data;
CREATE POLICY "Users can view own data" ON user_data FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own data" ON user_data;
CREATE POLICY "Users can insert own data" ON user_data FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own data" ON user_data;
CREATE POLICY "Users can update own data" ON user_data FOR UPDATE USING (auth.uid() = user_id);

-- 7. Create indexes (IF NOT EXISTS handles existing)
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_linked_player_id ON profiles(linked_player_id);
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);

-- 8. Simple verification (fixed)
SELECT 'profiles' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY column_name
UNION ALL
SELECT 'user_data' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_data'
ORDER BY column_name;
