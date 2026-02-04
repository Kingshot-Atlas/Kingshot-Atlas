-- Migration: sync_status_to_kingdoms
-- Applied: 2026-02-04
-- Purpose: Create trigger to sync approved status submissions to kingdoms table
-- This ensures kingdoms.most_recent_status is always up-to-date and eliminates
-- reliance on frontend overlay logic

-- Create trigger function
CREATE OR REPLACE FUNCTION sync_status_to_kingdom()
RETURNS TRIGGER AS $$
BEGIN
  -- When a status submission is approved, update the kingdom's status
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE kingdoms 
    SET most_recent_status = NEW.new_status,
        last_updated = NOW()
    WHERE kingdom_number = NEW.kingdom_number;
    
    RAISE NOTICE 'Updated kingdom % status to %', NEW.kingdom_number, NEW.new_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_status_trigger ON status_submissions;

-- Create the trigger
CREATE TRIGGER sync_status_trigger
  AFTER INSERT OR UPDATE ON status_submissions
  FOR EACH ROW
  EXECUTE FUNCTION sync_status_to_kingdom();

-- One-time sync of existing approved submissions that weren't synced
-- This updates kingdoms where an approved status submission exists but
-- the kingdom's most_recent_status doesn't match
UPDATE kingdoms k
SET most_recent_status = ss.new_status,
    last_updated = NOW()
FROM (
  SELECT DISTINCT ON (kingdom_number) kingdom_number, new_status
  FROM status_submissions
  WHERE status = 'approved'
  ORDER BY kingdom_number, reviewed_at DESC NULLS LAST
) ss
WHERE k.kingdom_number = ss.kingdom_number
  AND k.most_recent_status != ss.new_status;
