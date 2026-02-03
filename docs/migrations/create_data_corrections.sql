-- Create data_corrections table for kingdom stat corrections
-- Run this in Supabase Dashboard → SQL Editor
-- This is separate from kvk_corrections which is specifically for KvK history changes

-- 1. Create the data_corrections table
CREATE TABLE IF NOT EXISTS public.data_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kingdom_number INTEGER NOT NULL CHECK (kingdom_number >= 1 AND kingdom_number <= 9999),
  field TEXT NOT NULL, -- e.g., 'prep_wins', 'battle_losses', 'dominations', etc.
  current_value TEXT NOT NULL,
  suggested_value TEXT NOT NULL,
  reason TEXT,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_data_corrections_kingdom ON public.data_corrections(kingdom_number);
CREATE INDEX IF NOT EXISTS idx_data_corrections_status ON public.data_corrections(status);
CREATE INDEX IF NOT EXISTS idx_data_corrections_submitted_by ON public.data_corrections(submitted_by);
CREATE INDEX IF NOT EXISTS idx_data_corrections_created ON public.data_corrections(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.data_corrections ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Anyone can view approved corrections" ON public.data_corrections;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.data_corrections;
DROP POLICY IF EXISTS "Admins can view all corrections" ON public.data_corrections;
DROP POLICY IF EXISTS "Users can submit corrections" ON public.data_corrections;
DROP POLICY IF EXISTS "Admins can update corrections" ON public.data_corrections;

-- Anyone can read approved corrections
CREATE POLICY "Anyone can view approved corrections"
  ON public.data_corrections
  FOR SELECT
  USING (status = 'approved');

-- Authenticated users can view their own submissions
CREATE POLICY "Users can view their own submissions"
  ON public.data_corrections
  FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

-- Admins can view all corrections
CREATE POLICY "Admins can view all corrections"
  ON public.data_corrections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Authenticated users can insert corrections
CREATE POLICY "Users can submit corrections"
  ON public.data_corrections
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Admins can update corrections (for review)
CREATE POLICY "Admins can update corrections"
  ON public.data_corrections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- 5. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_data_corrections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_data_corrections_updated_at ON public.data_corrections;
CREATE TRIGGER trigger_data_corrections_updated_at
  BEFORE UPDATE ON public.data_corrections
  FOR EACH ROW
  EXECUTE FUNCTION update_data_corrections_updated_at();

-- 6. Create notification triggers (similar to kvk_corrections)

-- Notify admins on new correction
CREATE OR REPLACE FUNCTION notify_admins_on_new_data_correction()
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
        'admin_new_correction',
        'New Data Correction Request',
        'K' || NEW.kingdom_number || ' ' || NEW.field || ' correction submitted by ' || COALESCE(NEW.submitted_by_name, 'Unknown'),
        '/admin?tab=corrections',
        jsonb_build_object(
          'correction_id', NEW.id,
          'kingdom_number', NEW.kingdom_number,
          'field', NEW.field,
          'submitted_by', NEW.submitted_by
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_admins_new_data_correction ON public.data_corrections;
CREATE TRIGGER trigger_notify_admins_new_data_correction
  AFTER INSERT ON public.data_corrections
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_new_data_correction();

-- Notify user when their correction is reviewed
CREATE OR REPLACE FUNCTION notify_user_on_data_correction_review()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') AND NEW.submitted_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.submitted_by,
      CASE WHEN NEW.status = 'approved' THEN 'correction_approved' ELSE 'correction_rejected' END,
      CASE WHEN NEW.status = 'approved' THEN 'Correction Approved!' ELSE 'Correction Rejected' END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Your correction for K' || NEW.kingdom_number || ' (' || NEW.field || ') has been approved.'
        ELSE 'Your correction for K' || NEW.kingdom_number || ' (' || NEW.field || ') was not approved. ' || COALESCE(NEW.review_notes, '')
      END,
      '/kingdom/' || NEW.kingdom_number,
      jsonb_build_object(
        'correction_id', NEW.id,
        'kingdom_number', NEW.kingdom_number,
        'field', NEW.field,
        'review_notes', NEW.review_notes
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_user_data_correction_review ON public.data_corrections;
CREATE TRIGGER trigger_notify_user_data_correction_review
  AFTER UPDATE ON public.data_corrections
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_on_data_correction_review();

-- 7. Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- 8. Verify table created
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'data_corrections'
ORDER BY ordinal_position;
