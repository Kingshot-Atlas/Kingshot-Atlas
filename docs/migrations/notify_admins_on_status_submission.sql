-- Migration: notify_admins_on_status_submission
-- Applied: 2026-02-04
-- Purpose: Create trigger to notify admins when new status submissions are created
-- This ensures admins are aware of pending submissions that need review

CREATE OR REPLACE FUNCTION notify_admins_on_status_submission()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Only notify on new pending submissions
  IF NEW.status = 'pending' THEN
    -- Insert notification for each admin user
    FOR admin_record IN 
      SELECT id FROM profiles WHERE is_admin = true
    LOOP
      INSERT INTO notifications (user_id, type, title, message, link, metadata, read)
      VALUES (
        admin_record.id,
        'admin_new_submission',
        'New Status Submission',
        'K' || NEW.kingdom_number || ' status update pending review: ' || NEW.old_status || ' → ' || NEW.new_status,
        '/admin?tab=status',
        jsonb_build_object(
          'kingdom_number', NEW.kingdom_number,
          'old_status', NEW.old_status,
          'new_status', NEW.new_status,
          'submission_id', NEW.id
        ),
        false
      );
    END LOOP;
    
    RAISE NOTICE 'Notified admins of new status submission for K%', NEW.kingdom_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS notify_admins_status_trigger ON status_submissions;

-- Create the trigger
CREATE TRIGGER notify_admins_status_trigger
  AFTER INSERT ON status_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_status_submission();
