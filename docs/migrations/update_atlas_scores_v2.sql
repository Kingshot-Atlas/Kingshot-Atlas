-- Atlas Score v2.0 Migration
-- Updates overall_score column in kingdoms table using the new formula
-- Formula: (Base × Multipliers × Experience) + History Bonus

-- Constants
-- BAYESIAN_PRIOR = 2.5
-- BAYESIAN_TOTAL_PRIOR = 5
-- MAX_HISTORY_BONUS = 1.5
-- HISTORY_BONUS_PER_KVK = 0.05

-- Step 1: Create helper function for Bayesian adjusted win rate
CREATE OR REPLACE FUNCTION bayesian_adjusted_rate(wins INTEGER, total INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  bayesian_prior NUMERIC := 2.5;
  bayesian_total_prior NUMERIC := 5;
BEGIN
  IF total = 0 THEN
    RETURN 0.5;
  END IF;
  RETURN (wins + bayesian_prior) / (total + bayesian_total_prior);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Create helper function for experience factor
CREATE OR REPLACE FUNCTION get_experience_factor(total_kvks INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  IF total_kvks = 0 THEN RETURN 0.0; END IF;
  IF total_kvks = 1 THEN RETURN 0.4; END IF;
  IF total_kvks = 2 THEN RETURN 0.6; END IF;
  IF total_kvks = 3 THEN RETURN 0.75; END IF;
  IF total_kvks = 4 THEN RETURN 0.9; END IF;
  -- Full credit at 5+ KvKs
  RETURN LEAST(1.0, 1.0 + 0.05 * (LOG(total_kvks + 1) / LOG(17)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Create helper function for history bonus
CREATE OR REPLACE FUNCTION get_history_bonus(total_kvks INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  RETURN LEAST(1.5, total_kvks * 0.05);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Create function to get recent outcomes for a kingdom
CREATE OR REPLACE FUNCTION get_recent_form_multiplier(p_kingdom_number INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  weights NUMERIC[] := ARRAY[1.0, 0.8, 0.6, 0.4, 0.2];
  outcome_scores RECORD;
  weighted_score NUMERIC := 0;
  total_weight NUMERIC := 0;
  normalized_score NUMERIC;
  kvk_row RECORD;
  idx INTEGER := 0;
  score NUMERIC;
BEGIN
  FOR kvk_row IN 
    SELECT prep_result, battle_result 
    FROM kvk_history 
    WHERE kingdom_number = p_kingdom_number 
    ORDER BY kvk_number DESC 
    LIMIT 5
  LOOP
    idx := idx + 1;
    
    -- Determine outcome score
    IF kvk_row.prep_result IN ('Win', 'W') AND kvk_row.battle_result IN ('Win', 'W') THEN
      score := 1.0;  -- Domination
    ELSIF kvk_row.prep_result IN ('Loss', 'L') AND kvk_row.battle_result IN ('Win', 'W') THEN
      score := 0.75; -- Comeback
    ELSIF kvk_row.prep_result IN ('Win', 'W') AND kvk_row.battle_result IN ('Loss', 'L') THEN
      score := 0.6;  -- Reversal
    ELSE
      score := 0.0;  -- Invasion
    END IF;
    
    weighted_score := weighted_score + (score * weights[idx]);
    total_weight := total_weight + weights[idx];
  END LOOP;
  
  IF total_weight = 0 THEN
    RETURN 1.0;
  END IF;
  
  normalized_score := weighted_score / total_weight;
  
  -- Convert to multiplier: 0.85 to 1.15 range
  RETURN GREATEST(0.85, LEAST(1.15, 1.0 + (normalized_score - 0.5) * 0.3));
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 5: Create function to get current streaks
CREATE OR REPLACE FUNCTION get_streak_multiplier(p_kingdom_number INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  prep_streak INTEGER := 0;
  battle_streak INTEGER := 0;
  kvk_row RECORD;
  is_first_prep BOOLEAN := TRUE;
  is_first_battle BOOLEAN := TRUE;
  prep_bonus NUMERIC;
  battle_bonus NUMERIC;
  prep_penalty NUMERIC := 0;
  battle_penalty NUMERIC := 0;
BEGIN
  FOR kvk_row IN 
    SELECT prep_result, battle_result 
    FROM kvk_history 
    WHERE kingdom_number = p_kingdom_number 
    ORDER BY kvk_number DESC
  LOOP
    -- Calculate prep streak
    IF is_first_prep THEN
      IF kvk_row.prep_result IN ('Win', 'W') THEN
        prep_streak := 1;
      ELSE
        prep_streak := -1;
      END IF;
      is_first_prep := FALSE;
    ELSIF (kvk_row.prep_result IN ('Win', 'W') AND prep_streak > 0) OR 
          (kvk_row.prep_result IN ('Loss', 'L') AND prep_streak < 0) THEN
      IF kvk_row.prep_result IN ('Win', 'W') THEN
        prep_streak := prep_streak + 1;
      ELSE
        prep_streak := prep_streak - 1;
      END IF;
    ELSE
      is_first_prep := TRUE; -- Stop counting prep streak
    END IF;
    
    -- Calculate battle streak
    IF is_first_battle THEN
      IF kvk_row.battle_result IN ('Win', 'W') THEN
        battle_streak := 1;
      ELSE
        battle_streak := -1;
      END IF;
      is_first_battle := FALSE;
    ELSIF (kvk_row.battle_result IN ('Win', 'W') AND battle_streak > 0) OR 
          (kvk_row.battle_result IN ('Loss', 'L') AND battle_streak < 0) THEN
      IF kvk_row.battle_result IN ('Win', 'W') THEN
        battle_streak := battle_streak + 1;
      ELSE
        battle_streak := battle_streak - 1;
      END IF;
    ELSE
      is_first_battle := TRUE; -- Stop counting battle streak
    END IF;
    
    -- Exit early if both streaks are broken
    IF is_first_prep AND is_first_battle THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Convert negative streaks to 0 for bonus calculation (use abs for penalty)
  IF prep_streak > 0 THEN
    prep_bonus := LEAST(prep_streak, 6) * 0.01;
  ELSE
    prep_bonus := 0;
    prep_penalty := LEAST(ABS(prep_streak), 3) * 0.01;
  END IF;
  
  IF battle_streak > 0 THEN
    battle_bonus := LEAST(battle_streak, 6) * 0.015;
  ELSE
    battle_bonus := 0;
    battle_penalty := LEAST(ABS(battle_streak), 3) * 0.015;
  END IF;
  
  RETURN GREATEST(0.91, LEAST(1.15, 1.0 + prep_bonus + battle_bonus - prep_penalty - battle_penalty));
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 6: Create main Atlas Score calculation function
CREATE OR REPLACE FUNCTION calculate_atlas_score_v2(p_kingdom_number INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  k RECORD;
  prep_total INTEGER;
  battle_total INTEGER;
  adj_prep_rate NUMERIC;
  adj_battle_rate NUMERIC;
  base_score NUMERIC;
  dom_rate NUMERIC;
  inv_rate NUMERIC;
  dom_inv_multiplier NUMERIC;
  recent_form_multiplier NUMERIC;
  streak_multiplier NUMERIC;
  experience_factor NUMERIC;
  history_bonus NUMERIC;
  raw_score NUMERIC;
  scaled_score NUMERIC;
  final_score NUMERIC;
BEGIN
  -- Get kingdom stats
  SELECT * INTO k FROM kingdoms WHERE kingdom_number = p_kingdom_number;
  
  IF k IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate totals
  prep_total := COALESCE(k.prep_wins, 0) + COALESCE(k.prep_losses, 0);
  battle_total := COALESCE(k.battle_wins, 0) + COALESCE(k.battle_losses, 0);
  
  -- Base Score: Bayesian adjusted win rates (Prep 40%, Battle 60%)
  adj_prep_rate := bayesian_adjusted_rate(COALESCE(k.prep_wins, 0), prep_total);
  adj_battle_rate := bayesian_adjusted_rate(COALESCE(k.battle_wins, 0), battle_total);
  base_score := (adj_prep_rate * 0.40 + adj_battle_rate * 0.60) * 10;
  
  -- Domination/Invasion Multiplier
  IF COALESCE(k.total_kvks, 0) = 0 THEN
    dom_inv_multiplier := 1.0;
  ELSE
    dom_rate := COALESCE(k.dominations, 0)::NUMERIC / k.total_kvks;
    inv_rate := COALESCE(k.invasions, COALESCE(k.defeats, 0))::NUMERIC / k.total_kvks;
    dom_inv_multiplier := GREATEST(0.85, LEAST(1.15, 1.0 + (dom_rate * 0.15) - (inv_rate * 0.15)));
  END IF;
  
  -- Recent Form Multiplier (from kvk_history)
  recent_form_multiplier := get_recent_form_multiplier(p_kingdom_number);
  
  -- Streak Multiplier (from kvk_history)
  streak_multiplier := get_streak_multiplier(p_kingdom_number);
  
  -- Experience Factor
  experience_factor := get_experience_factor(COALESCE(k.total_kvks, 0));
  
  -- History Bonus
  history_bonus := get_history_bonus(COALESCE(k.total_kvks, 0));
  
  -- Final calculation: (Base × Multipliers × Experience) + History Bonus
  raw_score := base_score * dom_inv_multiplier * recent_form_multiplier * streak_multiplier;
  scaled_score := raw_score * experience_factor;
  final_score := GREATEST(0, LEAST(15, scaled_score + history_bonus));
  
  RETURN ROUND(final_score::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 7: Update all kingdom scores
UPDATE kingdoms
SET overall_score = calculate_atlas_score_v2(kingdom_number);

-- Step 8: Verify update with a sample
SELECT 
  kingdom_number,
  overall_score as new_score,
  total_kvks,
  prep_wins,
  battle_wins,
  dominations
FROM kingdoms
WHERE kingdom_number IN (231, 1, 100, 500)
ORDER BY kingdom_number;
