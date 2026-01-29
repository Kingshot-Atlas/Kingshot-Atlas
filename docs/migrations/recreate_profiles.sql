-- Force PostgREST Restart
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Drop and recreate the profiles table (last resort)
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. Recreate profiles table
CREATE TABLE profiles (
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

-- 3. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Create indexes
CREATE INDEX idx_profiles_id ON profiles(id);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_linked_player_id ON profiles(linked_player_id);

-- 6. Force PostgREST to restart
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- 7. Verify table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY column_name;
