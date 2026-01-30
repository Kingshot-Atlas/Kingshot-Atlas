-- Migration: Enable Public Profile Viewing
-- Run this in Supabase Dashboard → SQL Editor

-- Allow anyone to view profiles (public profiles feature)
-- This replaces the restrictive "Users can view own profile" policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create new policy allowing anyone to view any profile
CREATE POLICY "Anyone can view profiles" ON profiles
  FOR SELECT USING (true);

-- Keep existing policies for update/insert (only own profile)
-- These should already exist:
-- - "Users can update own profile" 
-- - "Users can insert own profile"

-- Verify the new policy
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';
