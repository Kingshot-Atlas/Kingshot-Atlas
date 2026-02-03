-- Migration: Add Kingdom 17 Bye for KvK #10
-- Purpose: Test Bye outcome display in KvK History
-- Run this in Supabase SQL Editor

-- Step 1: Update CHECK constraints to allow 'B' for Bye
ALTER TABLE kvk_history DROP CONSTRAINT IF EXISTS kvk_history_prep_result_check;
ALTER TABLE kvk_history DROP CONSTRAINT IF EXISTS kvk_history_battle_result_check;
ALTER TABLE kvk_history ADD CONSTRAINT kvk_history_prep_result_check CHECK (prep_result IN ('W', 'L', 'B'));
ALTER TABLE kvk_history ADD CONSTRAINT kvk_history_battle_result_check CHECK (battle_result IN ('W', 'L', 'B'));

-- Step 2: Insert Bye record
-- prep_result='B' and battle_result='B' indicate a Bye
INSERT INTO kvk_history (
  kingdom_number,
  kvk_number,
  opponent_kingdom,
  prep_result,
  battle_result,
  overall_result,
  kvk_date,
  order_index,
  created_at
) VALUES (
  17,                           -- kingdom_number
  10,                           -- kvk_number
  0,                             -- opponent_kingdom (0 = no opponent for Bye)
  'B',                          -- prep_result ('B' = Bye)
  'B',                          -- battle_result ('B' = Bye)
  'Bye',                        -- overall_result marks this as a Bye
  '2026-01-31',                 -- kvk_date (KvK #10 date)
  10,                           -- order_index (same as kvk_number)
  NOW()                         -- created_at
)
ON CONFLICT (kingdom_number, kvk_number) 
DO UPDATE SET
  opponent_kingdom = EXCLUDED.opponent_kingdom,
  prep_result = EXCLUDED.prep_result,
  battle_result = EXCLUDED.battle_result,
  overall_result = EXCLUDED.overall_result,
  kvk_date = EXCLUDED.kvk_date,
  order_index = EXCLUDED.order_index;

-- Verify the insert
SELECT * FROM kvk_history 
WHERE kingdom_number = 17 
ORDER BY kvk_number DESC 
LIMIT 5;
