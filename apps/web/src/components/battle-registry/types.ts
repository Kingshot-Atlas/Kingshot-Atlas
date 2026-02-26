// ─── KvK Battle Registry — Types & Constants ───────────────────────────

export interface BattleRegistry {
  id: string;
  kingdom_number: number;
  created_by: string;
  kvk_number: number | null;
  status: 'active' | 'closed' | 'archived';
  notes: string | null;
  created_at: string;
}

export interface BattleRegistryEntry {
  id: string;
  registry_id: string;
  user_id: string | null;
  added_by: string | null;
  username: string;
  alliance_tag: string;
  time_slot: string;
  time_slot_to: string | null;
  infantry_tier: number | null;
  infantry_tg: number | null;
  cavalry_tier: number | null;
  cavalry_tg: number | null;
  archers_tier: number | null;
  archers_tg: number | null;
  created_at: string;
  updated_at: string;
}

export interface BattleRegistryManager {
  id: string;
  registry_id: string;
  user_id: string;
  assigned_by: string;
  created_at: string;
}

export interface ManagerEntry {
  id: string;
  user_id: string;
  username: string;
}

export interface ManagerSearchResult {
  id: string;
  linked_username: string;
  username: string;
  linked_player_id: string | null;
}

export type RegistryView = 'landing' | 'form' | 'manage' | 'gate';

// Time slots: 12:00 UTC to 18:00 UTC in 30-minute increments
export const TIME_SLOTS: string[] = [
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
  '18:00',
];

// Troop types
export const TROOP_TYPES = ['infantry', 'cavalry', 'archers'] as const;
export type TroopType = typeof TROOP_TYPES[number];

export const TROOP_LABELS: Record<TroopType, string> = {
  infantry: '🛡️ Infantry',
  cavalry: '🐴 Cavalry',
  archers: '🏹 Archers',
};

export const TROOP_COLORS: Record<TroopType, string> = {
  infantry: '#3b82f6',
  cavalry: '#f97316',
  archers: '#ef4444',
};

// Tier/TG value ranges
export const MIN_TIER = 8;
export const MAX_TIER = 11;
export const MIN_TG = 0;
export const MAX_TG = 8;
