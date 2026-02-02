-- Migration: Add display_name column to profiles table
-- Purpose: Allow users to set a custom display name (shown publicly instead of OAuth username)
-- Date: 2026-02-02

-- Add the display_name column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.display_name IS 'Custom display name shown publicly instead of OAuth username (Google/Discord). NULL means use username.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
