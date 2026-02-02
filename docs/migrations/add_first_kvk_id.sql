-- Migration: Add first_kvk_id to kingdoms and new_kingdom_submissions tables
-- Purpose: Track the first KvK a kingdom participated in to determine relevant KvK history
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add first_kvk_id column to kingdoms table
-- NULL means kingdom hasn't had their first KvK yet
ALTER TABLE kingdoms 
ADD COLUMN IF NOT EXISTS first_kvk_id INTEGER DEFAULT NULL;

-- Add index for filtering kingdoms by their first KvK
CREATE INDEX IF NOT EXISTS idx_kingdoms_first_kvk ON kingdoms(first_kvk_id);

-- 2. Add first_kvk_id column to new_kingdom_submissions table
ALTER TABLE new_kingdom_submissions 
ADD COLUMN IF NOT EXISTS first_kvk_id INTEGER DEFAULT NULL;

-- 3. Update recalculate_kingdom_stats function to preserve first_kvk_id
-- The first_kvk_id should NOT be recalculated from kvk_history - it's set once on kingdom creation
CREATE OR REPLACE FUNCTION recalculate_kingdom_stats(p_kingdom_number INTEGER)
RETURNS void AS $$
DECLARE
  v_total_kvks INTEGER;
  v_prep_wins INTEGER;
  v_prep_losses INTEGER;
  v_battle_wins INTEGER;
  v_battle_losses INTEGER;
  v_dominations INTEGER;
  v_invasions INTEGER;
  v_prep_streak INTEGER := 0;
  v_battle_streak INTEGER := 0;
  v_prep_loss_streak INTEGER := 0;
  v_battle_loss_streak INTEGER := 0;
  v_prep_best_streak INTEGER := 0;
  v_battle_best_streak INTEGER := 0;
  v_prep_win_rate NUMERIC;
  v_battle_win_rate NUMERIC;
  v_atlas_score NUMERIC;
  v_record RECORD;
  v_counting_prep_win BOOLEAN := TRUE;
  v_counting_battle_win BOOLEAN := TRUE;
  v_counting_prep_loss BOOLEAN := TRUE;
  v_counting_battle_loss BOOLEAN := TRUE;
  v_current_prep_streak INTEGER := 0;
  v_current_battle_streak INTEGER := 0;
  v_existing_first_kvk INTEGER;
BEGIN
  -- Preserve existing first_kvk_id if already set
  SELECT first_kvk_id INTO v_existing_first_kvk
  FROM kingdoms
  WHERE kingdom_number = p_kingdom_number;

  -- Count aggregate stats
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE prep_result = 'W'),
    COUNT(*) FILTER (WHERE prep_result = 'L'),
    COUNT(*) FILTER (WHERE battle_result = 'W'),
    COUNT(*) FILTER (WHERE battle_result = 'L'),
    COUNT(*) FILTER (WHERE prep_result = 'W' AND battle_result = 'W'),
    COUNT(*) FILTER (WHERE prep_result = 'L' AND battle_result = 'L')
  INTO v_total_kvks, v_prep_wins, v_prep_losses, v_battle_wins, v_battle_losses, v_dominations, v_invasions
  FROM kvk_history
  WHERE kingdom_number = p_kingdom_number;

  -- Calculate win rates
  IF v_total_kvks > 0 THEN
    v_prep_win_rate := v_prep_wins::NUMERIC / v_total_kvks;
    v_battle_win_rate := v_battle_wins::NUMERIC / v_total_kvks;
  ELSE
    v_prep_win_rate := 0;
    v_battle_win_rate := 0;
  END IF;

  -- Calculate streaks (ordered by kvk_number DESC = most recent first)
  FOR v_record IN 
    SELECT prep_result, battle_result 
    FROM kvk_history 
    WHERE kingdom_number = p_kingdom_number 
    ORDER BY kvk_number DESC
  LOOP
    -- Current win streaks (from most recent)
    IF v_counting_prep_win THEN
      IF v_record.prep_result = 'W' THEN
        v_prep_streak := v_prep_streak + 1;
      ELSE
        v_counting_prep_win := FALSE;
      END IF;
    END IF;
    
    IF v_counting_battle_win THEN
      IF v_record.battle_result = 'W' THEN
        v_battle_streak := v_battle_streak + 1;
      ELSE
        v_counting_battle_win := FALSE;
      END IF;
    END IF;

    -- Current loss streaks
    IF v_counting_prep_loss THEN
      IF v_record.prep_result = 'L' THEN
        v_prep_loss_streak := v_prep_loss_streak + 1;
      ELSE
        v_counting_prep_loss := FALSE;
      END IF;
    END IF;

    IF v_counting_battle_loss THEN
      IF v_record.battle_result = 'L' THEN
        v_battle_loss_streak := v_battle_loss_streak + 1;
      ELSE
        v_counting_battle_loss := FALSE;
      END IF;
    END IF;
  END LOOP;

  -- Calculate best streaks (iterate through all records chronologically)
  v_current_prep_streak := 0;
  v_current_battle_streak := 0;
  FOR v_record IN 
    SELECT prep_result, battle_result 
    FROM kvk_history 
    WHERE kingdom_number = p_kingdom_number 
    ORDER BY kvk_number ASC
  LOOP
    IF v_record.prep_result = 'W' THEN
      v_current_prep_streak := v_current_prep_streak + 1;
      v_prep_best_streak := GREATEST(v_prep_best_streak, v_current_prep_streak);
    ELSE
      v_current_prep_streak := 0;
    END IF;

    IF v_record.battle_result = 'W' THEN
      v_current_battle_streak := v_current_battle_streak + 1;
      v_battle_best_streak := GREATEST(v_battle_best_streak, v_current_battle_streak);
    ELSE
      v_current_battle_streak := 0;
    END IF;
  END LOOP;

  -- Calculate Atlas Score using Bayesian formula
  v_atlas_score := calculate_atlas_score(
    v_total_kvks, v_prep_wins, v_prep_losses, 
    v_battle_wins, v_battle_losses, v_dominations, v_invasions
  );

  -- Upsert kingdom record (preserving first_kvk_id)
  INSERT INTO kingdoms (
    kingdom_number, total_kvks, prep_wins, prep_losses, prep_win_rate,
    prep_streak, prep_loss_streak, prep_best_streak,
    battle_wins, battle_losses, battle_win_rate,
    battle_streak, battle_loss_streak, battle_best_streak,
    dominations, reversals, comebacks, invasions, atlas_score, 
    first_kvk_id, last_updated
  ) VALUES (
    p_kingdom_number, v_total_kvks, v_prep_wins, v_prep_losses, v_prep_win_rate,
    v_prep_streak, v_prep_loss_streak, v_prep_best_streak,
    v_battle_wins, v_battle_losses, v_battle_win_rate,
    v_battle_streak, v_battle_loss_streak, v_battle_best_streak,
    v_dominations, 0, 0, v_invasions, v_atlas_score, 
    v_existing_first_kvk, NOW()
  )
  ON CONFLICT (kingdom_number) DO UPDATE SET
    total_kvks = EXCLUDED.total_kvks,
    prep_wins = EXCLUDED.prep_wins,
    prep_losses = EXCLUDED.prep_losses,
    prep_win_rate = EXCLUDED.prep_win_rate,
    prep_streak = EXCLUDED.prep_streak,
    prep_loss_streak = EXCLUDED.prep_loss_streak,
    prep_best_streak = EXCLUDED.prep_best_streak,
    battle_wins = EXCLUDED.battle_wins,
    battle_losses = EXCLUDED.battle_losses,
    battle_win_rate = EXCLUDED.battle_win_rate,
    battle_streak = EXCLUDED.battle_streak,
    battle_loss_streak = EXCLUDED.battle_loss_streak,
    battle_best_streak = EXCLUDED.battle_best_streak,
    dominations = EXCLUDED.dominations,
    invasions = EXCLUDED.invasions,
    reversals = EXCLUDED.reversals,
    comebacks = EXCLUDED.comebacks,
    atlas_score = EXCLUDED.atlas_score,
    -- Preserve first_kvk_id if already set, otherwise use new value
    first_kvk_id = COALESCE(kingdoms.first_kvk_id, EXCLUDED.first_kvk_id),
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to create a new kingdom with first_kvk_id
CREATE OR REPLACE FUNCTION create_kingdom_with_first_kvk(
  p_kingdom_number INTEGER,
  p_first_kvk_id INTEGER DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO kingdoms (
    kingdom_number, 
    first_kvk_id,
    total_kvks,
    atlas_score,
    most_recent_status,
    created_at,
    last_updated
  ) VALUES (
    p_kingdom_number,
    p_first_kvk_id,
    0,
    0,
    'Unannounced',
    NOW(),
    NOW()
  )
  ON CONFLICT (kingdom_number) DO UPDATE SET
    first_kvk_id = COALESCE(kingdoms.first_kvk_id, EXCLUDED.first_kvk_id),
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. Verify migration
SELECT 
  'kingdoms' as table_name,
  COUNT(*) as total,
  COUNT(first_kvk_id) as with_first_kvk,
  COUNT(*) - COUNT(first_kvk_id) as without_first_kvk
FROM kingdoms;
