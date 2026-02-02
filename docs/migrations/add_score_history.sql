-- Score History Table Migration
-- Created: 2026-02-02
-- Purpose: Track Atlas Score changes over time for trend analysis and movers

-- Create score_history table in Supabase
CREATE TABLE IF NOT EXISTS public.score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kingdom_number INTEGER NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    tier VARCHAR(1) NOT NULL,
    
    -- Score breakdown components (for debugging/analysis)
    base_score DECIMAL(5,2),
    dom_inv_multiplier DECIMAL(4,3),
    recent_form_multiplier DECIMAL(4,3),
    streak_multiplier DECIMAL(4,3),
    experience_factor DECIMAL(4,2),
    history_bonus DECIMAL(4,2),
    
    -- Metadata
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    triggered_by VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'kvk_update', 'manual'
    
    -- Index for fast lookups
    CONSTRAINT score_history_kingdom_date_unique UNIQUE (kingdom_number, recorded_at)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_score_history_kingdom ON public.score_history(kingdom_number);
CREATE INDEX IF NOT EXISTS idx_score_history_recorded_at ON public.score_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_score_history_tier ON public.score_history(tier);

-- Enable RLS
ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;

-- Public read access (scores are public data)
CREATE POLICY "Score history is viewable by everyone"
ON public.score_history FOR SELECT
TO public
USING (true);

-- Only service role can insert/update
CREATE POLICY "Score history is managed by service role"
ON public.score_history FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create function to record score snapshot
CREATE OR REPLACE FUNCTION record_score_snapshot(
    p_kingdom_number INTEGER,
    p_score DECIMAL,
    p_tier VARCHAR,
    p_base_score DECIMAL DEFAULT NULL,
    p_dom_inv_multiplier DECIMAL DEFAULT NULL,
    p_recent_form_multiplier DECIMAL DEFAULT NULL,
    p_streak_multiplier DECIMAL DEFAULT NULL,
    p_experience_factor DECIMAL DEFAULT NULL,
    p_history_bonus DECIMAL DEFAULT NULL,
    p_triggered_by VARCHAR DEFAULT 'scheduled'
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO public.score_history (
        kingdom_number, score, tier,
        base_score, dom_inv_multiplier, recent_form_multiplier,
        streak_multiplier, experience_factor, history_bonus,
        triggered_by
    ) VALUES (
        p_kingdom_number, p_score, p_tier,
        p_base_score, p_dom_inv_multiplier, p_recent_form_multiplier,
        p_streak_multiplier, p_experience_factor, p_history_bonus,
        p_triggered_by
    )
    RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for tier movement analysis
CREATE OR REPLACE VIEW public.tier_movements AS
WITH ranked_scores AS (
    SELECT 
        kingdom_number,
        score,
        tier,
        recorded_at,
        LAG(tier) OVER (PARTITION BY kingdom_number ORDER BY recorded_at) as previous_tier,
        LAG(score) OVER (PARTITION BY kingdom_number ORDER BY recorded_at) as previous_score,
        LAG(recorded_at) OVER (PARTITION BY kingdom_number ORDER BY recorded_at) as previous_date
    FROM public.score_history
)
SELECT 
    kingdom_number,
    previous_tier as from_tier,
    tier as to_tier,
    previous_score as from_score,
    score as to_score,
    score - previous_score as score_change,
    previous_date as from_date,
    recorded_at as to_date
FROM ranked_scores
WHERE tier != previous_tier
ORDER BY recorded_at DESC;

-- Comment on table
COMMENT ON TABLE public.score_history IS 'Historical record of Atlas Score changes for trend analysis';
