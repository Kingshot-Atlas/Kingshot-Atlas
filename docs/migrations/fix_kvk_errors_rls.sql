-- Fix KvK Errors RLS Policies
-- Run this in Supabase Dashboard → SQL Editor
-- This ensures the kvk_errors table has correct RLS policies for submissions

-- 1. Verify table exists (create if not)
CREATE TABLE IF NOT EXISTS public.kvk_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kingdom_number INTEGER NOT NULL CHECK (kingdom_number >= 1 AND kingdom_number <= 9999),
  kvk_number INTEGER,
  error_type TEXT NOT NULL CHECK (error_type IN ('wrong_opponent', 'wrong_prep_result', 'wrong_battle_result', 'missing_kvk', 'duplicate_kvk', 'other')),
  error_type_label TEXT NOT NULL,
  current_data JSONB,
  description TEXT NOT NULL,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_by_name TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_kvk_errors_kingdom ON public.kvk_errors(kingdom_number);
CREATE INDEX IF NOT EXISTS idx_kvk_errors_status ON public.kvk_errors(status);
CREATE INDEX IF NOT EXISTS idx_kvk_errors_submitted_by ON public.kvk_errors(submitted_by);
CREATE INDEX IF NOT EXISTS idx_kvk_errors_created ON public.kvk_errors(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.kvk_errors ENABLE ROW LEVEL SECURITY;

-- 4. Drop and recreate all policies to ensure they're correct
DROP POLICY IF EXISTS "Anyone can view approved errors" ON public.kvk_errors;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.kvk_errors;
DROP POLICY IF EXISTS "Admins can view all errors" ON public.kvk_errors;
DROP POLICY IF EXISTS "Users can submit errors" ON public.kvk_errors;
DROP POLICY IF EXISTS "Admins can update errors" ON public.kvk_errors;

-- Anyone can read approved errors (for transparency)
CREATE POLICY "Anyone can view approved errors"
  ON public.kvk_errors
  FOR SELECT
  USING (status = 'approved');

-- Authenticated users can view their own submissions (any status)
CREATE POLICY "Users can view their own submissions"
  ON public.kvk_errors
  FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

-- Admins can view all errors
CREATE POLICY "Admins can view all errors"
  ON public.kvk_errors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Authenticated users can insert errors (submitted_by must match their auth.uid())
CREATE POLICY "Users can submit errors"
  ON public.kvk_errors
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Admins can update errors (for review)
CREATE POLICY "Admins can update errors"
  ON public.kvk_errors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- 5. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_kvk_errors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kvk_errors_updated_at ON public.kvk_errors;
CREATE TRIGGER trigger_kvk_errors_updated_at
  BEFORE UPDATE ON public.kvk_errors
  FOR EACH ROW
  EXECUTE FUNCTION update_kvk_errors_updated_at();

-- 6. Create admin notification trigger (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION notify_admins_on_new_kvk_error()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
BEGIN
  IF NEW.status = 'pending' THEN
    FOR admin_record IN 
      SELECT id FROM profiles WHERE is_admin = TRUE
    LOOP
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES (
        admin_record.id,
        'admin_new_kvk_error',
        'New KvK Error Report',
        'K' || NEW.kingdom_number || ' KvK#' || COALESCE(NEW.kvk_number::text, 'N/A') || ' - ' || NEW.error_type_label || ' reported by ' || COALESCE(NEW.submitted_by_name, 'Unknown'),
        '/admin?tab=kvk-errors',
        jsonb_build_object(
          'error_id', NEW.id,
          'kingdom_number', NEW.kingdom_number,
          'kvk_number', NEW.kvk_number,
          'error_type', NEW.error_type,
          'submitted_by', NEW.submitted_by
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_admins_new_kvk_error ON public.kvk_errors;
CREATE TRIGGER trigger_notify_admins_new_kvk_error
  AFTER INSERT ON public.kvk_errors
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_new_kvk_error();

-- 7. Create user notification trigger for reviews
CREATE OR REPLACE FUNCTION notify_user_on_kvk_error_review()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') AND NEW.submitted_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.submitted_by,
      CASE WHEN NEW.status = 'approved' THEN 'submission_approved' ELSE 'submission_rejected' END,
      CASE WHEN NEW.status = 'approved' THEN 'KvK Error Report Approved!' ELSE 'KvK Error Report Rejected' END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Your error report for K' || NEW.kingdom_number || ' (KvK#' || COALESCE(NEW.kvk_number::text, 'N/A') || ') has been approved. Thank you for improving our data!'
        ELSE 'Your error report for K' || NEW.kingdom_number || ' (KvK#' || COALESCE(NEW.kvk_number::text, 'N/A') || ') was not approved. ' || COALESCE(NEW.review_notes, '')
      END,
      '/kingdom/' || NEW.kingdom_number,
      jsonb_build_object(
        'error_id', NEW.id,
        'kingdom_number', NEW.kingdom_number,
        'kvk_number', NEW.kvk_number,
        'review_notes', NEW.review_notes
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_user_kvk_error_review ON public.kvk_errors;
CREATE TRIGGER trigger_notify_user_kvk_error_review
  AFTER UPDATE ON public.kvk_errors
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_on_kvk_error_review();

-- 8. Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- 9. Verify setup
SELECT 'kvk_errors table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'kvk_errors'
ORDER BY ordinal_position;

SELECT 'RLS policies on kvk_errors:' as info;
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'kvk_errors';
