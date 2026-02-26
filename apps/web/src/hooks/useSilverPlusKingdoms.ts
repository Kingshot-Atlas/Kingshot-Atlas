import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * Fetches the set of kingdom numbers that have Silver+ (Silver or Gold) Kingdom Fund status.
 * Used for features gated at Silver tier: Prep Scheduler, Alliance Info & Schedules, Invites.
 * Cached globally so multiple components don't re-fetch.
 */

let cachedSilverPlusKingdoms: Set<number> | null = null;
let fetchPromise: Promise<Set<number>> | null = null;

const fetchSilverPlusKingdoms = async (): Promise<Set<number>> => {
  if (cachedSilverPlusKingdoms) return cachedSilverPlusKingdoms;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    if (!isSupabaseConfigured || !supabase) return new Set<number>();

    try {
      const { data, error } = await supabase
        .from('kingdom_funds')
        .select('kingdom_number')
        .in('tier', ['gold', 'silver']);

      if (error) {
        logger.error('[useSilverPlusKingdoms] Failed to fetch:', error);
        return new Set<number>();
      }

      const result = new Set((data || []).map(d => d.kingdom_number));
      cachedSilverPlusKingdoms = result;
      return result;
    } catch (err) {
      logger.error('[useSilverPlusKingdoms] Error:', err);
      return new Set<number>();
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
};

export const useSilverPlusKingdoms = (): Set<number> => {
  const [silverPlusKingdoms, setSilverPlusKingdoms] = useState<Set<number>>(cachedSilverPlusKingdoms || new Set());

  useEffect(() => {
    fetchSilverPlusKingdoms().then(setSilverPlusKingdoms);
  }, []);

  return silverPlusKingdoms;
};

/**
 * Invalidate the cache (e.g. after a fund tier change).
 */
export const invalidateSilverPlusKingdomsCache = () => {
  cachedSilverPlusKingdoms = null;
};
