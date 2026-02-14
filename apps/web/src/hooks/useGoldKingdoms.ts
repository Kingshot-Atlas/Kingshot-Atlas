import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * Fetches the set of kingdom numbers that have Gold-tier Kingdom Fund status.
 * Used to determine "gilded" display tier for users from those kingdoms.
 * Cached globally so multiple components don't re-fetch.
 */

let cachedGoldKingdoms: Set<number> | null = null;
let fetchPromise: Promise<Set<number>> | null = null;

const fetchGoldKingdoms = async (): Promise<Set<number>> => {
  if (cachedGoldKingdoms) return cachedGoldKingdoms;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    if (!isSupabaseConfigured || !supabase) return new Set<number>();

    try {
      const { data, error } = await supabase
        .from('kingdom_funds')
        .select('kingdom_number')
        .eq('tier', 'gold');

      if (error) {
        logger.error('[useGoldKingdoms] Failed to fetch:', error);
        return new Set<number>();
      }

      const result = new Set((data || []).map(d => d.kingdom_number));
      cachedGoldKingdoms = result;
      return result;
    } catch (err) {
      logger.error('[useGoldKingdoms] Error:', err);
      return new Set<number>();
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
};

export const useGoldKingdoms = (): Set<number> => {
  const [goldKingdoms, setGoldKingdoms] = useState<Set<number>>(cachedGoldKingdoms || new Set());

  useEffect(() => {
    fetchGoldKingdoms().then(setGoldKingdoms);
  }, []);

  return goldKingdoms;
};

/**
 * Invalidate the cache (e.g. after a fund tier change).
 */
export const invalidateGoldKingdomsCache = () => {
  cachedGoldKingdoms = null;
};
