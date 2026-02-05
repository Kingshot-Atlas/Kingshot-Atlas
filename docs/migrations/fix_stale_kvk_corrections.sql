-- Fix Stale KvK Corrections
-- Run this in Supabase Dashboard → SQL Editor
-- 
-- PROBLEM: The kvk_corrections table has stale records that override correct kvk_history data
-- The corrections table was meant for audit trail but is being applied at display time,
-- causing the UI to show wrong data even when kvk_history is correct.

-- 1. Delete the stale correction for K45 KvK#10 that's causing wrong display
-- The kvk_history already has correct data (prep_result='L', battle_result='W')
-- but kvk_corrections is overriding it with wrong values (prep='W', battle='W')
DELETE FROM public.kvk_corrections 
WHERE kingdom_number = 45 AND kvk_number = 10;

-- 2. Also check for the opponent (K86) and remove any stale correction
DELETE FROM public.kvk_corrections 
WHERE kingdom_number = 86 AND kvk_number = 10;

-- 3. Verify kvk_history has correct data
SELECT 'K45 KvK#10 in kvk_history:' as info;
SELECT kingdom_number, kvk_number, prep_result, battle_result, overall_result 
FROM kvk_history 
WHERE kingdom_number = 45 AND kvk_number = 10;

SELECT 'K86 KvK#10 in kvk_history:' as info;
SELECT kingdom_number, kvk_number, prep_result, battle_result, overall_result 
FROM kvk_history 
WHERE kingdom_number = 86 AND kvk_number = 10;

-- 4. Verify no more stale corrections exist
SELECT 'Remaining corrections for these records:' as info;
SELECT * FROM kvk_corrections 
WHERE (kingdom_number = 45 OR kingdom_number = 86) AND kvk_number = 10;

-- 5. Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
