-- Migration: Add Historical Atlas Scores to kvk_history
-- Purpose: Store each kingdom's Atlas Score at the time of each KvK
-- This enables the KvK Seasons page to show accurate historical matchup data
-- 
-- Key Logic:
-- - KvK #1: Kingdoms have NO Atlas Score (first participation = no history)
-- - KvK #2+: Atlas Score is calculated from all KvKs BEFORE this one
-- 
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================================================
-- STEP 1: Add kingdom_score column to kvk_history
-- ============================================================================
-- This stores the Atlas Score the kingdom had GOING INTO this KvK
-- (i.e., calculated from all their previous KvK results)
ALTER TABLE kvk_history 
ADD COLUMN IF NOT EXISTS kingdom_score DECIMAL(5,2) DEFAULT NULL;

-- Add index for queries that sort by score
CREATE INDEX IF NOT EXISTS idx_kvk_history_score ON kvk_history(kingdom_score DESC NULLS LAST);

-- ============================================================================
-- STEP 2: Create function to calculate historical Atlas Score
-- ============================================================================
-- This calculates what a kingdom's Atlas Score would have been
-- based ONLY on KvKs BEFORE the specified kvk_number
CREATE OR REPLACE FUNCTION calculate_historical_atlas_score(
  p_kingdom_number INTEGER,
  p_before_kvk_number INTEGER
) RETURNS DECIMAL AS $$
DECLARE
  v_total_kvks INTEGER;
  v_prep_wins INTEGER;
  v_prep_losses INTEGER;
  v_battle_wins INTEGER;
  v_battle_losses INTEGER;
  v_dominations INTEGER;
  v_invasions INTEGER;
  v_prep_total INTEGER;
  v_battle_total INTEGER;
  v_adj_prep_rate DECIMAL;
  v_adj_battle_rate DECIMAL;
  v_base_score DECIMAL;
  v_dom_rate DECIMAL;
  v_inv_rate DECIMAL;
  v_dom_inv_multiplier DECIMAL;
  v_experience_factor DECIMAL;
  v_history_bonus DECIMAL;
  v_raw_score DECIMAL;
  v_final_score DECIMAL;
  -- Bayesian priors (matching atlasScoreFormula.ts)
  v_bayesian_prior DECIMAL := 2.5;
  v_bayesian_total_prior DECIMAL := 5;
BEGIN
  -- Count stats from KvKs BEFORE this one (not including current)
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
  WHERE kingdom_number = p_kingdom_number
    AND kvk_number < p_before_kvk_number
    AND prep_result IS NOT NULL 
    AND prep_result != 'B';  -- Exclude byes

  -- No previous KvKs = no score (first participation)
  IF v_total_kvks = 0 OR v_total_kvks IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate totals
  v_prep_total := v_prep_wins + v_prep_losses;
  v_battle_total := v_battle_wins + v_battle_losses;

  -- Bayesian adjusted win rates (matching atlasScoreFormula.ts)
  IF v_prep_total = 0 THEN
    v_adj_prep_rate := 0.5;
  ELSE
    v_adj_prep_rate := (v_prep_wins + v_bayesian_prior) / (v_prep_total + v_bayesian_total_prior);
  END IF;

  IF v_battle_total = 0 THEN
    v_adj_battle_rate := 0.5;
  ELSE
    v_adj_battle_rate := (v_battle_wins + v_bayesian_prior) / (v_battle_total + v_bayesian_total_prior);
  END IF;

  -- Base Score: Prep 40%, Battle 60% (matching atlasScoreFormula.ts)
  v_base_score := (v_adj_prep_rate * 0.40 + v_adj_battle_rate * 0.60) * 10;

  -- Domination/Invasion Multiplier
  v_dom_rate := v_dominations::DECIMAL / v_total_kvks;
  v_inv_rate := v_invasions::DECIMAL / v_total_kvks;
  v_dom_inv_multiplier := GREATEST(0.85, LEAST(1.15, 1.0 + (v_dom_rate * 0.15) - (v_inv_rate * 0.15)));

  -- Experience Factor (matching atlasScoreFormula.ts)
  IF v_total_kvks = 0 THEN v_experience_factor := 0.0;
  ELSIF v_total_kvks = 1 THEN v_experience_factor := 0.4;
  ELSIF v_total_kvks = 2 THEN v_experience_factor := 0.6;
  ELSIF v_total_kvks = 3 THEN v_experience_factor := 0.75;
  ELSIF v_total_kvks = 4 THEN v_experience_factor := 0.9;
  ELSE v_experience_factor := LEAST(1.0, 1.0 + 0.05 * (LOG(v_total_kvks + 1) / LOG(17)));
  END IF;

  -- History Bonus: 0.05 per KvK, max 1.5 (matching atlasScoreFormula.ts)
  v_history_bonus := LEAST(1.5, v_total_kvks * 0.05);

  -- Final calculation (simplified - not including recent form/streak since historical)
  -- For historical accuracy, we use base formula without dynamic multipliers
  v_raw_score := v_base_score * v_dom_inv_multiplier;
  v_final_score := GREATEST(0, LEAST(15, (v_raw_score * v_experience_factor) + v_history_bonus));

  RETURN ROUND(v_final_score, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 3: Backfill historical Atlas Scores for all kvk_history records
-- ============================================================================
DO $$
DECLARE
  v_record RECORD;
  v_score DECIMAL;
  v_updated INTEGER := 0;
BEGIN
  -- Loop through all kvk_history records ordered by kvk_number
  FOR v_record IN 
    SELECT id, kingdom_number, kvk_number 
    FROM kvk_history 
    WHERE kingdom_score IS NULL
    ORDER BY kvk_number, kingdom_number
  LOOP
    -- Calculate the historical score (what they had BEFORE this KvK)
    v_score := calculate_historical_atlas_score(v_record.kingdom_number, v_record.kvk_number);
    
    -- Update the record
    UPDATE kvk_history 
    SET kingdom_score = v_score
    WHERE id = v_record.id;
    
    v_updated := v_updated + 1;
    
    -- Progress logging every 100 records
    IF v_updated % 100 = 0 THEN
      RAISE NOTICE 'Updated % records...', v_updated;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: Updated % total records', v_updated;
END $$;

-- ============================================================================
-- STEP 4: Create trigger to auto-calculate score on new kvk_history inserts
-- ============================================================================
CREATE OR REPLACE FUNCTION set_historical_atlas_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate the kingdom's Atlas Score at the time of this KvK
  NEW.kingdom_score := calculate_historical_atlas_score(NEW.kingdom_number, NEW.kvk_number);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kvk_history_set_score ON kvk_history;
CREATE TRIGGER kvk_history_set_score
  BEFORE INSERT ON kvk_history
  FOR EACH ROW
  EXECUTE FUNCTION set_historical_atlas_score();

-- ============================================================================
-- STEP 5: Verify migration
-- ============================================================================
SELECT 
  kvk_number,
  COUNT(*) as total_records,
  COUNT(kingdom_score) as with_score,
  COUNT(*) - COUNT(kingdom_score) as without_score,
  ROUND(AVG(kingdom_score)::NUMERIC, 2) as avg_score
FROM kvk_history
GROUP BY kvk_number
ORDER BY kvk_number;

-- Sample data to verify
SELECT 
  kvk_number, 
  kingdom_number, 
  prep_result, 
  battle_result, 
  kingdom_score
FROM kvk_history 
WHERE kvk_number <= 3
ORDER BY kvk_number, kingdom_number
LIMIT 30;
