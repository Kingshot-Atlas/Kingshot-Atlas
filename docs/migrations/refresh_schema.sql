-- Refresh Supabase Schema Cache
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Force schema cache refresh by touching the tables
NOTIFY pgrst, 'reload schema';

-- 2. Verify the email column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'email';

-- 3. Check all profiles columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY column_name;
