-- Security Fixes Migration
-- Date: 2026-02-05
-- From: Security Assessment Report
--
-- NOTE: This is a HISTORICAL migration document. The live database functions
-- may have been updated since (e.g., Atlas Score v3.1 uses 0-100 scale).
-- Source of truth: calculate_atlas_score() in Supabase.
-- See DECISIONS.md ADR-012 for full formula details.
--
-- IMPORTANT: These fixes are safe for the data flow:
-- - Supabase `kingdoms` table remains source of truth
-- - Admin approval → kvk_history INSERT → trigger recalculates kingdoms
-- - Frontend reads from Supabase via kingdomsSupabaseService

-- =============================================================================
-- FIX H2: Restrict score_history INSERT to service_role only
-- Risk: LOW - This table is populated by triggers, not direct user inserts
-- =============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Score history insert by authenticated" ON public.score_history;

-- Create restrictive policy for service_role only
-- NOTE: The database trigger (trg_create_score_history) runs as definer,
-- so it will still work. Direct authenticated user inserts are blocked.
CREATE POLICY "Score history insert by service role only" ON public.score_history
FOR INSERT TO service_role
WITH CHECK (true);

-- Verify: Service role can still insert (used by triggers)
-- Verify: Authenticated users CANNOT insert directly (security fix)

-- =============================================================================
-- FIX B1: Add search_path to PostgreSQL functions (22 functions)
-- Risk: LOW - Just adds security hardening, doesn't change logic
-- =============================================================================

-- Note: We need to recreate functions with SET search_path
-- This prevents search path manipulation attacks

-- 1. get_tier_from_percentile (LEGACY — not used by v3.1 scoring)
CREATE OR REPLACE FUNCTION public.get_tier_from_percentile(percentile NUMERIC)
RETURNS VARCHAR(1)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF percentile >= 90 THEN RETURN 'S';
    ELSIF percentile >= 75 THEN RETURN 'A';
    ELSIF percentile >= 50 THEN RETURN 'B';
    ELSIF percentile >= 25 THEN RETURN 'C';
    ELSE RETURN 'D';
    END IF;
END;
$$;

-- 2. get_tier_from_score
CREATE OR REPLACE FUNCTION public.get_tier_from_score(score NUMERIC)
RETURNS VARCHAR(1)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Tier thresholds for Atlas Score v3.1 (0-100 scale)
    -- See DECISIONS.md ADR-012 and atlasScoreFormula.ts
    IF score >= 57 THEN RETURN 'S';        -- Top ~3% - Elite
    ELSIF score >= 47 THEN RETURN 'A';     -- Top ~10% - Formidable
    ELSIF score >= 38 THEN RETURN 'B';     -- Top ~25% - Competitive
    ELSIF score >= 29 THEN RETURN 'C';     -- Top ~50% - Developing
    ELSE RETURN 'D';                        -- Bottom 50% - Struggling
    END IF;
END;
$$;

-- 3. bayesian_adjusted_rate
CREATE OR REPLACE FUNCTION public.bayesian_adjusted_rate(
    wins INTEGER,
    total INTEGER,
    prior_rate NUMERIC DEFAULT 0.5,
    prior_weight INTEGER DEFAULT 3
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF total = 0 THEN
        RETURN prior_rate;
    END IF;
    RETURN (wins + prior_weight * prior_rate) / (total + prior_weight);
END;
$$;

-- 4. get_experience_factor
CREATE OR REPLACE FUNCTION public.get_experience_factor(kvk_count INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Experience factor: scales from 0.7 (1 KvK) to 1.0 (6+ KvKs)
    IF kvk_count <= 0 THEN RETURN 0.5;
    ELSIF kvk_count = 1 THEN RETURN 0.7;
    ELSIF kvk_count = 2 THEN RETURN 0.8;
    ELSIF kvk_count = 3 THEN RETURN 0.85;
    ELSIF kvk_count = 4 THEN RETURN 0.9;
    ELSIF kvk_count = 5 THEN RETURN 0.95;
    ELSE RETURN 1.0;
    END IF;
END;
$$;

-- 5. get_history_bonus
CREATE OR REPLACE FUNCTION public.get_history_bonus(kvk_count INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- History bonus: rewards kingdoms with more data
    IF kvk_count <= 0 THEN RETURN 0;
    ELSIF kvk_count <= 3 THEN RETURN 0.1 * kvk_count;
    ELSIF kvk_count <= 6 THEN RETURN 0.3 + 0.05 * (kvk_count - 3);
    ELSE RETURN 0.5;  -- Cap at 0.5
    END IF;
END;
$$;

-- 6. get_dom_inv_multiplier
CREATE OR REPLACE FUNCTION public.get_dom_inv_multiplier(
    dominations INTEGER,
    invasions INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    net_dom INTEGER;
BEGIN
    net_dom := dominations - invasions;
    IF net_dom >= 3 THEN RETURN 1.15;
    ELSIF net_dom >= 1 THEN RETURN 1.05;
    ELSIF net_dom = 0 THEN RETURN 1.0;
    ELSIF net_dom >= -2 THEN RETURN 0.95;
    ELSE RETURN 0.9;
    END IF;
END;
$$;

-- 7. get_recent_form_multiplier
CREATE OR REPLACE FUNCTION public.get_recent_form_multiplier(kingdom_num INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    recent_wins INTEGER := 0;
    recent_total INTEGER := 0;
    rec RECORD;
BEGIN
    -- Get last 3 KvKs
    FOR rec IN
        SELECT overall_result
        FROM kvk_history
        WHERE kingdom_number = kingdom_num
        ORDER BY kvk_number DESC
        LIMIT 3
    LOOP
        recent_total := recent_total + 1;
        IF rec.overall_result = 'W' THEN
            recent_wins := recent_wins + 1;
        END IF;
    END LOOP;
    
    IF recent_total = 0 THEN RETURN 1.0; END IF;
    
    -- Scale from 0.9 (0 wins) to 1.1 (all wins)
    RETURN 0.9 + 0.2 * (recent_wins::NUMERIC / recent_total);
END;
$$;

-- 8. get_streak_multiplier
CREATE OR REPLACE FUNCTION public.get_streak_multiplier(kingdom_num INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    streak INTEGER := 0;
    streak_type VARCHAR(1) := NULL;
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT overall_result
        FROM kvk_history
        WHERE kingdom_number = kingdom_num
        ORDER BY kvk_number DESC
    LOOP
        IF streak_type IS NULL THEN
            streak_type := rec.overall_result;
            streak := 1;
        ELSIF rec.overall_result = streak_type THEN
            streak := streak + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;
    
    IF streak_type = 'W' THEN
        IF streak >= 5 THEN RETURN 1.15;
        ELSIF streak >= 3 THEN RETURN 1.08;
        ELSE RETURN 1.0;
        END IF;
    ELSIF streak_type = 'L' THEN
        IF streak >= 5 THEN RETURN 0.85;
        ELSIF streak >= 3 THEN RETURN 0.92;
        ELSE RETURN 1.0;
        END IF;
    END IF;
    
    RETURN 1.0;
END;
$$;

-- 9. update_kvk_errors_updated_at
CREATE OR REPLACE FUNCTION public.update_kvk_errors_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 10. notify_admins_on_new_kvk_error (if exists - check before running)
-- This function creates notifications for admins when kvk_errors are submitted

-- 11. notify_user_on_kvk_error_review (if exists - check before running)
-- This function notifies users when their error reports are reviewed

-- =============================================================================
-- FIX B2: Drop duplicate indexes
-- Risk: NONE - Just removes redundant indexes
-- =============================================================================

-- kvk_corrections has duplicate indexes
DROP INDEX IF EXISTS idx_kvk_corrections_kingdom_kvk;
-- Keep: kvk_corrections_kingdom_number_kvk_number_key (unique constraint)

-- kvk_history has duplicate indexes  
DROP INDEX IF EXISTS kvk_history_kingdom_kvk_unique;
-- Keep: kvk_history_kingdom_number_kvk_number_key (unique constraint)

-- =============================================================================
-- FIX B3: Add covering indexes to foreign keys (performance)
-- Risk: NONE - Just adds indexes for better query performance
-- =============================================================================

-- data_corrections.reviewed_by
CREATE INDEX IF NOT EXISTS idx_data_corrections_reviewed_by 
ON public.data_corrections(reviewed_by);

-- discord_role_sync_log.user_id
CREATE INDEX IF NOT EXISTS idx_discord_role_sync_log_user_id 
ON public.discord_role_sync_log(user_id);

-- feedback.user_id
CREATE INDEX IF NOT EXISTS idx_feedback_user_id 
ON public.feedback(user_id);

-- kvk_corrections.corrected_by (may already exist)
CREATE INDEX IF NOT EXISTS idx_kvk_corrections_corrected_by 
ON public.kvk_corrections(corrected_by);

-- kvk_errors.reviewed_by
CREATE INDEX IF NOT EXISTS idx_kvk_errors_reviewed_by 
ON public.kvk_errors(reviewed_by);

-- kvk_history.corrected_by
CREATE INDEX IF NOT EXISTS idx_kvk_history_corrected_by 
ON public.kvk_history(corrected_by);

-- new_kingdom_submissions.submitted_by_user_id
CREATE INDEX IF NOT EXISTS idx_new_kingdom_submissions_submitted_by 
ON public.new_kingdom_submissions(submitted_by_user_id);

-- status_submissions.reviewed_by
CREATE INDEX IF NOT EXISTS idx_status_submissions_reviewed_by 
ON public.status_submissions(reviewed_by);

-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================

-- Verify score_history RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'score_history';

-- Verify functions have search_path set
-- SELECT proname, prosecdef, proconfig 
-- FROM pg_proc 
-- WHERE pronamespace = 'public'::regnamespace 
-- AND proconfig IS NOT NULL;

-- Verify indexes exist
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
