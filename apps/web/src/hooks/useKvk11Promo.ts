import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * KvK #11 Silver Tier Promotion
 * 
 * From now until KvK #11 ends (Saturday Feb 28, 2026 at 22:00 UTC),
 * Silver Tier kingdoms get access to:
 *   - KvK Prep Scheduler (normally Silver+)
 *   - KvK Battle Planner (normally Gold-only)
 *   - KvK Battle Registry (normally Gold-only)
 * 
 * After the deadline, access reverts to tier-specific gating.
 */

// KvK #11 Battle Phase ends Saturday Feb 28, 2026 at 22:00 UTC
export const KVK11_PROMO_END = new Date('2026-02-28T22:00:00Z').getTime();

export const isKvk11PromoActive = (): boolean => Date.now() < KVK11_PROMO_END;

// ─── Silver kingdom cache (same pattern as useGoldKingdoms) ─────────

let cachedSilverKingdoms: Set<number> | null = null;
let silverFetchPromise: Promise<Set<number>> | null = null;

const fetchSilverKingdoms = async (): Promise<Set<number>> => {
  if (cachedSilverKingdoms) return cachedSilverKingdoms;
  if (silverFetchPromise) return silverFetchPromise;

  silverFetchPromise = (async () => {
    if (!isSupabaseConfigured || !supabase) return new Set<number>();

    try {
      const { data, error } = await supabase
        .from('kingdom_funds')
        .select('kingdom_number')
        .eq('tier', 'silver');

      if (error) {
        logger.error('[useKvk11Promo] Failed to fetch silver kingdoms:', error);
        return new Set<number>();
      }

      const result = new Set((data || []).map(d => d.kingdom_number));
      cachedSilverKingdoms = result;
      return result;
    } catch (err) {
      logger.error('[useKvk11Promo] Error:', err);
      return new Set<number>();
    } finally {
      silverFetchPromise = null;
    }
  })();

  return silverFetchPromise;
};

export const invalidateSilverKingdomsCache = () => {
  cachedSilverKingdoms = null;
};

// ─── Hook ───────────────────────────────────────────────────────────

interface Kvk11PromoState {
  /** Whether the KvK #11 Silver promo is currently active */
  isPromoActive: boolean;
  /** Set of Silver-tier kingdom numbers (empty if promo inactive) */
  silverKingdoms: Set<number>;
  /** Check if a specific kingdom qualifies via the promo */
  hasPromoAccess: (kingdomNumber: number) => boolean;
  /** Milliseconds remaining until promo ends (0 if expired) */
  msRemaining: number;
}

export const useKvk11Promo = (): Kvk11PromoState => {
  const [silverKingdoms, setSilverKingdoms] = useState<Set<number>>(cachedSilverKingdoms || new Set());
  const [now, setNow] = useState(Date.now());

  const promoActive = now < KVK11_PROMO_END;

  // Fetch silver kingdoms only if promo is active
  useEffect(() => {
    if (!promoActive) return;
    fetchSilverKingdoms().then(setSilverKingdoms);
  }, [promoActive]);

  // Update countdown every minute
  useEffect(() => {
    if (!promoActive) return;
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [promoActive]);

  return {
    isPromoActive: promoActive,
    silverKingdoms: promoActive ? silverKingdoms : new Set(),
    hasPromoAccess: (kn: number) => promoActive && silverKingdoms.has(kn),
    msRemaining: promoActive ? KVK11_PROMO_END - now : 0,
  };
};
