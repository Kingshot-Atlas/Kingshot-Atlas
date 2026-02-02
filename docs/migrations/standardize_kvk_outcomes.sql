-- ============================================================================
-- KvK Outcome Standardization Migration
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- 
-- This migration:
-- 1. Standardizes outcome values to: Domination, Reversal, Comeback, Invasion
-- 2. Populates kvk_date for all records based on KvK number
-- 3. Adds unique constraint to prevent duplicate records
-- ============================================================================

-- Step 1: Check current state (run this first to see what we're working with)
SELECT 
  overall_result,
  COUNT(*) as count
FROM kvk_history
GROUP BY overall_result
ORDER BY count DESC;

-- ============================================================================
-- Step 2: Standardize outcome values
-- ============================================================================

-- Convert 'Win' to 'Domination' (W+W)
UPDATE kvk_history
SET overall_result = 'Domination'
WHERE overall_result IN ('Win', 'W')
  AND prep_result = 'W' 
  AND battle_result = 'W';

-- Convert 'Loss' to 'Invasion' (L+L)
UPDATE kvk_history
SET overall_result = 'Invasion'
WHERE overall_result IN ('Loss', 'L', 'Defeat')
  AND prep_result = 'L' 
  AND battle_result = 'L';

-- Convert 'Preparation' to 'Reversal' (W+L)
UPDATE kvk_history
SET overall_result = 'Reversal'
WHERE overall_result IN ('Preparation', 'Prep Only')
  AND prep_result = 'W' 
  AND battle_result = 'L';

-- Convert 'Battle' to 'Comeback' (L+W)
UPDATE kvk_history
SET overall_result = 'Comeback'
WHERE overall_result IN ('Battle')
  AND prep_result = 'L' 
  AND battle_result = 'W';

-- Fix any records where outcome doesn't match prep/battle results
-- (This ensures data integrity)
UPDATE kvk_history
SET overall_result = CASE
  WHEN prep_result = 'W' AND battle_result = 'W' THEN 'Domination'
  WHEN prep_result = 'W' AND battle_result = 'L' THEN 'Reversal'
  WHEN prep_result = 'L' AND battle_result = 'W' THEN 'Comeback'
  WHEN prep_result = 'L' AND battle_result = 'L' THEN 'Invasion'
  ELSE overall_result
END
WHERE overall_result NOT IN ('Domination', 'Reversal', 'Comeback', 'Invasion');

-- ============================================================================
-- Step 3: Populate kvk_date based on KvK number
-- ============================================================================

-- KvK dates (every 28 days cycle)
UPDATE kvk_history SET kvk_date = '2025-05-24' WHERE kvk_number = 1 AND kvk_date IS NULL;
UPDATE kvk_history SET kvk_date = '2025-06-21' WHERE kvk_number = 2 AND kvk_date IS NULL;
UPDATE kvk_history SET kvk_date = '2025-07-19' WHERE kvk_number = 3 AND kvk_date IS NULL;
UPDATE kvk_history SET kvk_date = '2025-08-16' WHERE kvk_number = 4 AND kvk_date IS NULL;
UPDATE kvk_history SET kvk_date = '2025-09-13' WHERE kvk_number = 5 AND kvk_date IS NULL;
UPDATE kvk_history SET kvk_date = '2025-10-11' WHERE kvk_number = 6 AND kvk_date IS NULL;
UPDATE kvk_history SET kvk_date = '2025-11-08' WHERE kvk_number = 7 AND kvk_date IS NULL;
UPDATE kvk_history SET kvk_date = '2025-12-06' WHERE kvk_number = 8 AND kvk_date IS NULL;
UPDATE kvk_history SET kvk_date = '2026-01-03' WHERE kvk_number = 9 AND kvk_date IS NULL;
UPDATE kvk_history SET kvk_date = '2026-01-31' WHERE kvk_number = 10 AND kvk_date IS NULL;

-- ============================================================================
-- Step 4: Add unique constraint (if not exists)
-- ============================================================================

-- First, check for and remove any duplicates
-- This query finds duplicates:
SELECT kingdom_number, kvk_number, COUNT(*) as duplicate_count
FROM kvk_history
GROUP BY kingdom_number, kvk_number
HAVING COUNT(*) > 1;

-- If duplicates exist, keep only the most recent one:
DELETE FROM kvk_history a
USING kvk_history b
WHERE a.id < b.id
  AND a.kingdom_number = b.kingdom_number
  AND a.kvk_number = b.kvk_number;

-- Now add the unique constraint
ALTER TABLE kvk_history
DROP CONSTRAINT IF EXISTS kvk_history_kingdom_kvk_unique;

ALTER TABLE kvk_history
ADD CONSTRAINT kvk_history_kingdom_kvk_unique 
UNIQUE (kingdom_number, kvk_number);

-- ============================================================================
-- Step 5: Verify migration
-- ============================================================================

-- Check outcome distribution after migration
SELECT 
  overall_result,
  COUNT(*) as count
FROM kvk_history
GROUP BY overall_result
ORDER BY count DESC;

-- Check kvk_date population
SELECT 
  kvk_number,
  kvk_date,
  COUNT(*) as count
FROM kvk_history
GROUP BY kvk_number, kvk_date
ORDER BY kvk_number;

-- Verify no duplicates
SELECT kingdom_number, kvk_number, COUNT(*) as cnt
FROM kvk_history
GROUP BY kingdom_number, kvk_number
HAVING COUNT(*) > 1;

-- Total record count
SELECT COUNT(*) as total_records FROM kvk_history;

-- ============================================================================
-- DONE! All outcomes are now standardized to:
-- - Domination (W+W)
-- - Reversal (W+L)  
-- - Comeback (L+W)
-- - Invasion (L+L)
-- ============================================================================
