-- Security Hardening Migration
-- Applied: 2026-02-03
-- Fixes: 26 security issues identified by Supabase security advisor

-- =============================================================================
-- 1. ENABLE RLS ON APP_CONFIG TABLE (ERROR-level fix)
-- =============================================================================
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read app_config (it's public config like current_kvk)
DROP POLICY IF EXISTS "Anyone can read app_config" ON public.app_config;
CREATE POLICY "Anyone can read app_config"
  ON public.app_config
  FOR SELECT
  USING (true);

-- Only admins can modify app_config
DROP POLICY IF EXISTS "Admins can modify app_config" ON public.app_config;
CREATE POLICY "Admins can modify app_config"
  ON public.app_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- =============================================================================
-- 2. TIGHTEN OVERLY PERMISSIVE INSERT POLICIES (WARN-level fixes)
-- =============================================================================

-- FEEDBACK TABLE: Require user_id to match auth.uid() for inserts
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Authenticated users can submit feedback"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- KVK_SUBMISSIONS TABLE: Require submitter_id to match auth.uid()
DROP POLICY IF EXISTS "kvk_submissions_insert_authenticated" ON public.kvk_submissions;
CREATE POLICY "Users can submit their own KvK data"
  ON public.kvk_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (submitter_id = auth.uid()::text);

-- NOTIFICATIONS TABLE: Only allow service role or triggers to insert
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
  ON public.notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated users to insert their own notifications
CREATE POLICY "Users can create their own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 3. FIX FUNCTION SEARCH_PATH (WARN-level fixes - 22 functions)
-- =============================================================================
-- Setting search_path to empty string prevents search_path injection attacks

ALTER FUNCTION public.bayesian_adjusted_rate SET search_path = '';
ALTER FUNCTION public.calculate_atlas_score SET search_path = '';
ALTER FUNCTION public.calculate_atlas_score_v2 SET search_path = '';
ALTER FUNCTION public.create_kingdom_with_first_kvk SET search_path = '';
ALTER FUNCTION public.get_experience_factor SET search_path = '';
ALTER FUNCTION public.get_history_bonus SET search_path = '';
ALTER FUNCTION public.get_recent_form_multiplier SET search_path = '';
ALTER FUNCTION public.get_streak_multiplier SET search_path = '';
ALTER FUNCTION public.notify_admins_on_new_correction SET search_path = '';
ALTER FUNCTION public.notify_admins_on_new_data_correction SET search_path = '';
ALTER FUNCTION public.notify_admins_on_new_kvk_error SET search_path = '';
ALTER FUNCTION public.notify_admins_on_new_submission SET search_path = '';
ALTER FUNCTION public.notify_user_on_correction_review SET search_path = '';
ALTER FUNCTION public.notify_user_on_data_correction_review SET search_path = '';
ALTER FUNCTION public.notify_user_on_kvk_error_review SET search_path = '';
ALTER FUNCTION public.notify_user_on_submission_review SET search_path = '';
ALTER FUNCTION public.recalculate_all_kingdom_scores SET search_path = '';
ALTER FUNCTION public.recalculate_kingdom_stats SET search_path = '';
ALTER FUNCTION public.trigger_recalculate_kingdom SET search_path = '';
ALTER FUNCTION public.update_data_corrections_updated_at SET search_path = '';
ALTER FUNCTION public.update_kingdom_score_on_kvk_change SET search_path = '';
ALTER FUNCTION public.update_kvk_errors_updated_at SET search_path = '';

-- =============================================================================
-- 4. RELOAD SCHEMA
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 5. MANUAL ACTION REQUIRED (Cannot be done via SQL)
-- =============================================================================
-- Enable Leaked Password Protection in Supabase Dashboard:
-- 1. Go to: https://supabase.com/dashboard/project/qdczmafwcvnwfvixxbwg/auth/providers
-- 2. Click on Auth Settings → Password section
-- 3. Enable "Prevent use of leaked passwords"
-- This checks passwords against HaveIBeenPwned.org
