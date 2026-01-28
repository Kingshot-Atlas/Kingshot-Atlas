/**
 * Data transformation utilities for Kingshot Atlas.
 */
import { Kingdom, KingdomProfile, KVKRecord, getPowerTier } from '../types';
import kingdomData from '../data/kingdoms.json';

/**
 * Load and transform kingdom data from JSON.
 */
export function loadKingdomData(): Kingdom[] {
  const kvksByKingdom: Record<number, KVKRecord[]> = {};
  
  // Group KvK records by kingdom
  for (const kvk of kingdomData.kvk_records) {
    const kNum = kvk.kingdom_number;
    if (!kvksByKingdom[kNum]) kvksByKingdom[kNum] = [];
    kvksByKingdom[kNum]!.push({
      id: kNum * 100 + kvk.kvk_number,
      kingdom_number: kNum,
      kvk_number: kvk.kvk_number,
      opponent_kingdom: kvk.opponent_kingdom || 0,
      prep_result: kvk.prep_result === 'W' ? 'Win' : 'Loss',
      battle_result: kvk.battle_result === 'W' ? 'Win' : 'Loss',
      overall_result: kvk.overall_result,
      date_or_order_index: kvk.date_or_order_index,
      created_at: kvk.date_or_order_index
    });
  }
  
  // Sort each kingdom's KvKs by kvk_number descending (most recent first)
  for (const kNum in kvksByKingdom) {
    kvksByKingdom[kNum]?.sort((a, b) => b.kvk_number - a.kvk_number);
  }
  
  // Build kingdom objects
  const kingdoms = kingdomData.kingdoms.map((k: any) => {
    const recentKvks = kvksByKingdom[k.kingdom_number] || [];
    
    // Calculate High Kings and Invader Kings from recent KvKs
    const highKings = recentKvks.filter(r => r.overall_result === 'Win').length;
    const invaderKings = recentKvks.filter(r => r.overall_result === 'Loss').length;
    
    return {
      kingdom_number: k.kingdom_number,
      total_kvks: k.total_kvks,
      prep_wins: k.prep_wins,
      prep_losses: k.prep_losses,
      prep_win_rate: k.prep_win_rate,
      prep_streak: k.prep_streak,
      battle_wins: k.battle_wins,
      battle_losses: k.battle_losses,
      battle_win_rate: k.battle_win_rate,
      battle_streak: k.battle_streak,
      most_recent_status: 'Unannounced',
      overall_score: k.overall_score,
      power_tier: getPowerTier(k.overall_score),
      high_kings: highKings,
      invader_kings: invaderKings,
      last_updated: new Date().toISOString(),
      recent_kvks: recentKvks
    } as Kingdom;
  });
  
  // Sort by overall_score descending to calculate ranks
  const sorted = [...kingdoms].sort((a, b) => b.overall_score - a.overall_score);
  
  // Assign ranks based on sorted position
  sorted.forEach((k, index) => {
    k.rank = index + 1;
  });
  
  return kingdoms;
}

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
