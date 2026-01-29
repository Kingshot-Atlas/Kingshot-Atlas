-- Migration: Add linked Kingshot player columns to profiles table
-- Run this in Supabase SQL Editor if you have an existing profiles table

-- Add linked player columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linked_player_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linked_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linked_avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linked_kingdom INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linked_tc_level INTEGER;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name LIKE 'linked_%';
