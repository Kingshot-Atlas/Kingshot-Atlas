-- Fix kvk_history trigger issue
-- The trigger calls recalculate_kingdom_stats() which doesn't exist
-- Solution: Drop the broken trigger to allow manual inserts

-- Drop the broken trigger
DROP TRIGGER IF EXISTS kvk_history_kingdom_update ON kvk_history;

-- Also drop the trigger function since it references the missing function
DROP FUNCTION IF EXISTS trigger_recalculate_kingdom();

-- Verify triggers are gone
SELECT tgname FROM pg_trigger WHERE tgrelid = 'kvk_history'::regclass;
