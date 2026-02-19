import { supabase } from '../../lib/supabase';
import type { TransfereeProfile } from './types';

const BROWSE_PAGE_SIZE = 25;

export interface BrowseFilters {
  minTc: string;
  minPower: string;
  language: string;
  sortBy: string;
}

export const EMPTY_FILTERS: BrowseFilters = { minTc: '', minPower: '', language: '', sortBy: 'newest' };

// ─── Query Keys ─────────────────────────────────────────────
export const browseKeys = {
  all: ['browseTransferees'] as const,
  transferees: (kingdomNumber: number, groupRange: [number, number] | null, filters: BrowseFilters) =>
    [...browseKeys.all, 'list', kingdomNumber, groupRange, filters] as const,
  watchlistIds: (userId: string, kingdomNumber: number) =>
    [...browseKeys.all, 'watchlistIds', userId, kingdomNumber] as const,
  invitedIds: (kingdomNumber: number) =>
    [...browseKeys.all, 'invitedIds', kingdomNumber] as const,
};

// ─── Fetch Functions ────────────────────────────────────────
export async function fetchTransfereePage(
  kingdomNumber: number,
  transferGroup: [number, number] | null,
  filters: BrowseFilters,
  pageParam: number,
): Promise<TransfereeProfile[]> {
  if (!supabase) return [];
  let query = supabase
    .from('transfer_profiles')
    .select('id, username, current_kingdom, tc_level, power_million, power_range, main_language, kvk_availability, saving_for_kvk, group_size, player_bio, looking_for, is_anonymous, is_active, visible_to_recruiters, last_active_at')
    .eq('is_active', true)
    .eq('visible_to_recruiters', true)
    .neq('current_kingdom', kingdomNumber);

  if (transferGroup) {
    query = query.gte('current_kingdom', transferGroup[0]).lte('current_kingdom', transferGroup[1]);
  }

  // Server-side filters
  if (filters.minTc) {
    query = query.gte('tc_level', parseInt(filters.minTc, 10));
  }
  if (filters.minPower) {
    query = query.gte('power_million', parseInt(filters.minPower, 10));
  }
  if (filters.language) {
    query = query.eq('main_language', filters.language);
  }

  // Server-side sorting
  if (filters.sortBy === 'power_desc') {
    query = query.order('power_million', { ascending: false, nullsFirst: false });
  } else if (filters.sortBy === 'tc_desc') {
    query = query.order('tc_level', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query
    .range(pageParam, pageParam + BROWSE_PAGE_SIZE - 1);
  if (error) throw error;
  return (data as TransfereeProfile[]) || [];
}

export async function fetchWatchlistIds(userId: string, kingdomNumber: number): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data } = await supabase
    .from('recruiter_watchlist')
    .select('transfer_profile_id')
    .eq('recruiter_user_id', userId)
    .eq('kingdom_number', kingdomNumber)
    .not('transfer_profile_id', 'is', null);
  return new Set((data || []).map((d: { transfer_profile_id: string }) => d.transfer_profile_id).filter(Boolean));
}

export async function fetchInvitedProfileIds(kingdomNumber: number): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data } = await supabase
    .from('transfer_invites')
    .select('recipient_profile_id, status')
    .eq('kingdom_number', kingdomNumber)
    .in('status', ['pending', 'accepted']);
  return new Set((data || []).map((d: { recipient_profile_id: string }) => d.recipient_profile_id));
}

export { BROWSE_PAGE_SIZE };
