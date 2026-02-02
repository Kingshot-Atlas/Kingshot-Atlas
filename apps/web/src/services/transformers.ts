/**
 * Data transformation utilities for Kingshot Atlas.
 * ADR-011: JSON data sources removed - Supabase is the single source of truth
 */
import { Kingdom, KingdomProfile, getPowerTier } from '../types';

/**
 * Enrich a kingdom object with computed fields.
 */
export function enrichKingdom(kingdom: Kingdom): Kingdom {
  return {
    ...kingdom,
    power_tier: kingdom.power_tier || getPowerTier(kingdom.overall_score)
  };
}

/**
 * Convert kingdom to profile format.
 */
export function toKingdomProfile(kingdom: Kingdom): KingdomProfile {
  return {
    ...kingdom,
    rank: kingdom.rank,
    recent_kvks: kingdom.recent_kvks || []
  };
}
