import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/**
 * Lightweight hook to get pending alliance application count for alliances
 * the current user manages (owner or manager). Shows badge in nav.
 */
export function usePendingApplications(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user || !supabase) return;

    // Find alliances user owns
    const { data: owned } = await supabase
      .from('alliances')
      .select('id')
      .eq('owner_id', user.id);

    // Find alliances user manages
    const { data: managed } = await supabase
      .from('alliance_managers')
      .select('alliance_id')
      .eq('user_id', user.id);

    const allianceIds = [
      ...(owned || []).map((a: { id: string }) => a.id),
      ...(managed || []).map((m: { alliance_id: string }) => m.alliance_id),
    ];
    const uniqueIds = [...new Set(allianceIds)];

    if (uniqueIds.length === 0) {
      setCount(0);
      return;
    }

    const { count: pending } = await supabase
      .from('alliance_applications')
      .select('id', { count: 'exact', head: true })
      .in('alliance_id', uniqueIds)
      .eq('status', 'pending');

    setCount(pending || 0);
  }, [user]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Real-time: new applications
  useEffect(() => {
    if (!user || !supabase) return;
    const sb = supabase;
    const channel = sb
      .channel('nav-pending-apps')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'alliance_applications',
      }, () => {
        fetchCount();
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [user, fetchCount]);

  return count;
}
