-- Add notification triggers for kvk_corrections table
-- Run this in Supabase Dashboard → SQL Editor
-- Prerequisites: notifications table must exist (run create_notifications.sql first)

-- 1. Create function to notify admins when new correction is submitted
CREATE OR REPLACE FUNCTION notify_admins_on_new_correction()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Only trigger on new pending corrections
  IF NEW.status = 'pending' THEN
    -- Insert notification for each admin
    FOR admin_record IN 
      SELECT id FROM profiles WHERE is_admin = TRUE
    LOOP
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES (
        admin_record.id,
        'admin_new_correction',
        'New KvK Correction Request',
        'K' || NEW.kingdom_number || ' KvK#' || NEW.kvk_number || ' correction submitted by ' || COALESCE(NEW.submitted_by_name, 'Unknown'),
        '/admin?tab=corrections',
        jsonb_build_object(
          'correction_id', NEW.id,
          'kingdom_number', NEW.kingdom_number,
          'kvk_number', NEW.kvk_number,
          'submitted_by', NEW.submitted_by
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger for new corrections
DROP TRIGGER IF EXISTS trigger_notify_admins_new_correction ON kvk_corrections;
CREATE TRIGGER trigger_notify_admins_new_correction
  AFTER INSERT ON kvk_corrections
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_new_correction();

-- 3. Create function to notify user when their correction is reviewed
CREATE OR REPLACE FUNCTION notify_user_on_correction_review()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes from 'pending' to 'approved' or 'rejected'
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') AND NEW.submitted_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.submitted_by,
      CASE WHEN NEW.status = 'approved' THEN 'submission_approved' ELSE 'submission_rejected' END,
      CASE WHEN NEW.status = 'approved' THEN 'Correction Approved!' ELSE 'Correction Rejected' END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Your correction for K' || NEW.kingdom_number || ' KvK#' || NEW.kvk_number || ' has been approved and applied.'
        ELSE 'Your correction for K' || NEW.kingdom_number || ' KvK#' || NEW.kvk_number || ' was not approved. ' || COALESCE(NEW.review_notes, '')
      END,
      '/kingdom/' || NEW.kingdom_number,
      jsonb_build_object(
        'correction_id', NEW.id,
        'kingdom_number', NEW.kingdom_number,
        'kvk_number', NEW.kvk_number,
        'review_notes', NEW.review_notes
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger for correction reviews
DROP TRIGGER IF EXISTS trigger_notify_user_correction_review ON kvk_corrections;
CREATE TRIGGER trigger_notify_user_correction_review
  AFTER UPDATE ON kvk_corrections
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_on_correction_review();

-- 5. Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- 6. Verify triggers exist
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'kvk_corrections';
