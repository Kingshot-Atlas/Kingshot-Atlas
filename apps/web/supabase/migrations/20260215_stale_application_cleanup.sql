-- Automated stale application cleanup
-- Marks pending applications as 'expired' when they pass their expires_at date.
-- Should be run via pg_cron or Supabase scheduled function (daily).

-- 1. Create the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_stale_transfer_applications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.transfer_applications
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Log cleanup action
  RAISE NOTICE 'Cleaned up % stale transfer applications', updated_count;
  
  RETURN updated_count;
END;
$$;

-- 2. Schedule via pg_cron (requires pg_cron extension enabled in Supabase)
-- Run daily at 03:00 UTC
-- SELECT cron.schedule(
--   'cleanup-stale-transfer-apps',
--   '0 3 * * *',
--   $$SELECT public.cleanup_stale_transfer_applications()$$
-- );

-- To verify the cron job:
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-stale-transfer-apps';

-- To manually run:
-- SELECT public.cleanup_stale_transfer_applications();
