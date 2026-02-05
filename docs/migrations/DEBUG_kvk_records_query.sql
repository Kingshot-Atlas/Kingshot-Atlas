-- DEBUG QUERY: Run this in Supabase Dashboard → SQL Editor
-- This will help identify why some kingdoms show 0-0 records

-- Step 1: Check if kingdom_score column exists and what values it has for KvK #10
SELECT 
  kingdom_number,
  opponent_kingdom,
  kvk_number,
  prep_result,
  battle_result,
  overall_result,
  kingdom_score
FROM kvk_history
WHERE kvk_number = 10
ORDER BY kingdom_number
LIMIT 20;

-- Step 2: Check Kingdom 231's full history (one of the kingdoms showing 0-0)
SELECT 
  kingdom_number,
  kvk_number,
  prep_result,
  battle_result,
  overall_result,
  kingdom_score
FROM kvk_history
WHERE kingdom_number = 231
ORDER BY kvk_number;

-- Step 3: Check Kingdom 86's full history (one showing correct 7-1 records)
SELECT 
  kingdom_number,
  kvk_number,
  prep_result,
  battle_result,
  overall_result,
  kingdom_score
FROM kvk_history
WHERE kingdom_number = 86
ORDER BY kvk_number;

-- Step 4: Count historical records for each kingdom in KvK #10
SELECT 
  kingdom_number,
  COUNT(*) as prior_kvk_count,
  SUM(CASE WHEN prep_result = 'W' THEN 1 ELSE 0 END) as prep_wins,
  SUM(CASE WHEN prep_result = 'L' THEN 1 ELSE 0 END) as prep_losses,
  SUM(CASE WHEN battle_result = 'W' THEN 1 ELSE 0 END) as battle_wins,
  SUM(CASE WHEN battle_result = 'L' THEN 1 ELSE 0 END) as battle_losses
FROM kvk_history
WHERE kingdom_number IN (SELECT DISTINCT kingdom_number FROM kvk_history WHERE kvk_number = 10)
  AND kvk_number < 10
  AND prep_result IS NOT NULL
  AND prep_result != 'B'
GROUP BY kingdom_number
ORDER BY kingdom_number;

-- Step 5: Check if there are any records with unexpected prep_result values
SELECT DISTINCT prep_result, battle_result, COUNT(*) as count
FROM kvk_history
GROUP BY prep_result, battle_result
ORDER BY count DESC;
