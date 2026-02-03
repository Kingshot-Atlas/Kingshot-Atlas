-- Create notifications table for in-app notification system
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Create the notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- System can insert notifications for any user (via service role or triggers)
-- For now, allow authenticated users to insert (will be restricted by app logic)
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- 4. Create indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- 5. Create function to notify admins when new submissions arrive
-- This function gets admin user IDs from the profiles table
CREATE OR REPLACE FUNCTION notify_admins_on_new_submission()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
  notification_link TEXT;
BEGIN
  -- Determine notification content based on table
  IF TG_TABLE_NAME = 'status_submissions' THEN
    notification_type := 'admin_new_transfer';
    notification_title := 'New Transfer Status Submission';
    notification_message := 'Kingdom ' || NEW.kingdom_number || ' has a new status update pending review.';
    notification_link := '/admin?tab=transfer-status';
  END IF;

  -- Insert notification for each admin
  FOR admin_record IN 
    SELECT id FROM profiles WHERE is_admin = TRUE
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      admin_record.id,
      notification_type,
      notification_title,
      notification_message,
      notification_link,
      jsonb_build_object(
        'submission_id', NEW.id,
        'kingdom_number', NEW.kingdom_number,
        'submitted_by', NEW.submitted_by
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger for status_submissions
DROP TRIGGER IF EXISTS trigger_notify_admins_status_submission ON status_submissions;
CREATE TRIGGER trigger_notify_admins_status_submission
  AFTER INSERT ON status_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_new_submission();

-- 7. Create function to notify user when their submission is reviewed
CREATE OR REPLACE FUNCTION notify_user_on_submission_review()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes from 'pending' to 'approved' or 'rejected'
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.submitted_by,
      CASE WHEN NEW.status = 'approved' THEN 'submission_approved' ELSE 'submission_rejected' END,
      CASE WHEN NEW.status = 'approved' THEN 'Submission Approved!' ELSE 'Submission Rejected' END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Your status update for Kingdom ' || NEW.kingdom_number || ' has been approved.'
        ELSE 'Your status update for Kingdom ' || NEW.kingdom_number || ' was not approved. ' || COALESCE(NEW.review_notes, '')
      END,
      '/kingdom/' || NEW.kingdom_number,
      jsonb_build_object(
        'submission_id', NEW.id,
        'kingdom_number', NEW.kingdom_number,
        'new_status', NEW.new_status,
        'review_notes', NEW.review_notes
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger for status submission reviews
DROP TRIGGER IF EXISTS trigger_notify_user_status_review ON status_submissions;
CREATE TRIGGER trigger_notify_user_status_review
  AFTER UPDATE ON status_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_on_submission_review();

-- 9. Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- 10. Verify table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
ORDER BY ordinal_position;
