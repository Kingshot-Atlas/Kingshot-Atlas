-- Supabase Kingdoms Table Migration
-- Purpose: Single source of truth for kingdom aggregate statistics
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Create kingdoms table
CREATE TABLE IF NOT EXISTS kingdoms (
  kingdom_number INTEGER PRIMARY KEY,
  total_kvks INTEGER DEFAULT 0,
  prep_wins INTEGER DEFAULT 0,
  prep_losses INTEGER DEFAULT 0,
  prep_win_rate NUMERIC(5,4) DEFAULT 0,
  prep_streak INTEGER DEFAULT 0,
  prep_loss_streak INTEGER DEFAULT 0,
  prep_best_streak INTEGER DEFAULT 0,
  battle_wins INTEGER DEFAULT 0,
  battle_losses INTEGER DEFAULT 0,
  battle_win_rate NUMERIC(5,4) DEFAULT 0,
  battle_streak INTEGER DEFAULT 0,
  battle_loss_streak INTEGER DEFAULT 0,
  battle_best_streak INTEGER DEFAULT 0,
  dominations INTEGER DEFAULT 0,
  reversals INTEGER DEFAULT 0,
  comebacks INTEGER DEFAULT 0,
  invasions INTEGER DEFAULT 0,
  atlas_score NUMERIC(6,2) DEFAULT 0,
  most_recent_status TEXT DEFAULT 'Unannounced',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_kingdoms_atlas_score ON kingdoms(atlas_score DESC);
CREATE INDEX IF NOT EXISTS idx_kingdoms_status ON kingdoms(most_recent_status);
CREATE INDEX IF NOT EXISTS idx_kingdoms_total_kvks ON kingdoms(total_kvks DESC);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE kingdoms ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
-- Everyone can read kingdom data (public data)
DROP POLICY IF EXISTS "Anyone can view kingdoms" ON kingdoms;
CREATE POLICY "Anyone can view kingdoms" ON kingdoms FOR SELECT USING (true);

-- Only authenticated users with admin role can modify (via service role key in API)
-- The API will use service role key to bypass RLS for writes

-- 5. Create function to recalculate kingdom stats from kvk_history
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
BEGIN
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
  -- Base: weighted average of prep and battle (1:2 ratio)
  -- Then apply experience scaling and momentum
  v_atlas_score := calculate_atlas_score(
    v_total_kvks, v_prep_wins, v_prep_losses, 
    v_battle_wins, v_battle_losses, v_dominations, v_invasions
  );

  -- Upsert kingdom record
  INSERT INTO kingdoms (
    kingdom_number, total_kvks, prep_wins, prep_losses, prep_win_rate,
    prep_streak, prep_loss_streak, prep_best_streak,
    battle_wins, battle_losses, battle_win_rate,
    battle_streak, battle_loss_streak, battle_best_streak,
    dominations, reversals, comebacks, invasions, atlas_score, last_updated
  ) VALUES (
    p_kingdom_number, v_total_kvks, v_prep_wins, v_prep_losses, v_prep_win_rate,
    v_prep_streak, v_prep_loss_streak, v_prep_best_streak,
    v_battle_wins, v_battle_losses, v_battle_win_rate,
    v_battle_streak, v_battle_loss_streak, v_battle_best_streak,
    v_dominations, 0, 0, v_invasions, v_atlas_score, NOW()
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
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. Create Atlas Score calculation function
CREATE OR REPLACE FUNCTION calculate_atlas_score(
  p_total_kvks INTEGER,
  p_prep_wins INTEGER,
  p_prep_losses INTEGER,
  p_battle_wins INTEGER,
  p_battle_losses INTEGER,
  p_dominations INTEGER,
  p_invasions INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_prep_win_rate NUMERIC;
  v_battle_win_rate NUMERIC;
  v_base_score NUMERIC;
  v_experience_factor NUMERIC;
  v_dominance_bonus NUMERIC;
  v_invasion_penalty NUMERIC;
  v_final_score NUMERIC;
  -- Bayesian prior parameters
  v_prior_mean NUMERIC := 0.5;
  v_prior_strength INTEGER := 3;
BEGIN
  IF p_total_kvks = 0 THEN
    RETURN 0;
  END IF;

  -- Bayesian adjusted win rates (shrink towards 50% for small samples)
  v_prep_win_rate := (p_prep_wins + v_prior_strength * v_prior_mean) / 
                     (p_total_kvks + v_prior_strength);
  v_battle_win_rate := (p_battle_wins + v_prior_strength * v_prior_mean) / 
                       (p_total_kvks + v_prior_strength);

  -- Base score: weighted average (prep:battle = 1:2)
  v_base_score := (v_prep_win_rate + 2 * v_battle_win_rate) / 3;

  -- Experience factor: confidence grows with more KvKs (caps at 5)
  v_experience_factor := LEAST(p_total_kvks, 5) / 5.0;

  -- Dominance bonus: reward complete victories (W+W)
  v_dominance_bonus := (p_dominations::NUMERIC / GREATEST(p_total_kvks, 1)) * 0.1;

  -- Invasion penalty: penalize complete losses (L+L)
  v_invasion_penalty := (p_invasions::NUMERIC / GREATEST(p_total_kvks, 1)) * 0.05;

  -- Final score: scale to 0-15 range
  v_final_score := (v_base_score * v_experience_factor + v_dominance_bonus - v_invasion_penalty) * 15;

  -- Clamp to valid range
  RETURN GREATEST(0, LEAST(15, ROUND(v_final_score, 2)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Create trigger to auto-update kingdoms when kvk_history changes
CREATE OR REPLACE FUNCTION trigger_recalculate_kingdom()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_kingdom_stats(OLD.kingdom_number);
    RETURN OLD;
  ELSE
    PERFORM recalculate_kingdom_stats(NEW.kingdom_number);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kvk_history_kingdom_update ON kvk_history;
CREATE TRIGGER kvk_history_kingdom_update
  AFTER INSERT OR UPDATE OR DELETE ON kvk_history
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_kingdom();

-- 8. Populate kingdoms table from existing kvk_history data
DO $$
DECLARE
  v_kingdom INTEGER;
BEGIN
  FOR v_kingdom IN SELECT DISTINCT kingdom_number FROM kvk_history ORDER BY kingdom_number
  LOOP
    PERFORM recalculate_kingdom_stats(v_kingdom);
  END LOOP;
END $$;

-- 9. Verify migration
SELECT 
  'kingdoms' as table_name,
  COUNT(*) as row_count,
  AVG(atlas_score) as avg_score,
  MAX(atlas_score) as max_score
FROM kingdoms;
