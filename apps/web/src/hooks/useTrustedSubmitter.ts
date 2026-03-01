import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to check if the current user is a trusted submitter.
 * Trusted submitters can submit data without screenshots and get auto-approval.
 */
export function useTrustedSubmitter(): { isTrusted: boolean; loading: boolean } {
  const { user } = useAuth();
  const [isTrusted, setIsTrusted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !supabase) {
      setIsTrusted(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('trusted_submitters')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!cancelled) {
          setIsTrusted(!error && !!data);
        }
      } catch {
        if (!cancelled) setIsTrusted(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return { isTrusted, loading };
}
