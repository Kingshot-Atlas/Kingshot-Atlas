import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { TRANSFER_GROUPS, TRANSFER_GROUPS_UPDATED_AT } from '../config/transferGroups';
import type { KingdomData, KingdomFund, KingdomReviewSummary, KingdomReputationSummary } from '../components/KingdomListingCard';

// ─── Query Keys ───────────────────────────────────────────────
export const transferHubKeys = {
  all: ['transferHub'] as const,
  kingdoms: () => [...transferHubKeys.all, 'kingdoms'] as const,
  funds: () => [...transferHubKeys.all, 'funds'] as const,
  reviewSummaries: () => [...transferHubKeys.all, 'reviewSummaries'] as const,
  reputationSummaries: () => [...transferHubKeys.all, 'reputationSummaries'] as const,
  userProfile: (userId: string) => [...transferHubKeys.all, 'userProfile', userId] as const,
  activeAppCount: (userId: string) => [...transferHubKeys.all, 'activeAppCount', userId] as const,
  editorStatus: (userId: string) => [...transferHubKeys.all, 'editorStatus', userId] as const,
  atlasPlayerCount: () => [...transferHubKeys.all, 'atlasPlayerCount'] as const,
  transferGroups: () => [...transferHubKeys.all, 'transferGroups'] as const,
};

// ─── Transfer Groups (from Supabase view — single source of truth) ─
export interface TransferGroupRow {
  id: number;
  min_kingdom: number;
  max_kingdom: number;
  label: string;
  event_number: number;
  is_active: boolean;
  is_unofficial: boolean;
  updated_at: string;
}

async function fetchTransferGroupsFromDB(): Promise<TransferGroupRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('current_transfer_groups')
    .select('id, min_kingdom, max_kingdom, label, event_number, is_active, is_unofficial, updated_at')
    .order('min_kingdom', { ascending: true });
  if (error) {
    logger.error('Error fetching transfer groups from DB:', error);
    return [];
  }
  return data || [];
}

/**
 * Fetch active transfer groups from Supabase (source of truth).
 * Falls back to static config if DB is unavailable.
 * Returns groups as [min, max] tuples for compatibility with existing helpers.
 */
export function useTransferGroups(): {
  groups: Array<[number, number]>;
  rows: TransferGroupRow[];
  updatedAt: string | null;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: transferHubKeys.transferGroups(),
    queryFn: fetchTransferGroupsFromDB,
    staleTime: 10 * 60 * 1000, // 10 minutes — groups rarely change
    retry: 2,
  });

  const rows = query.data ?? [];
  const groups: Array<[number, number]> = rows.length > 0
    ? rows.map(r => [r.min_kingdom, r.max_kingdom] as [number, number])
    : TRANSFER_GROUPS; // fallback to static config

  const updatedAt = rows.length > 0
    ? (rows[0]?.updated_at ?? TRANSFER_GROUPS_UPDATED_AT)
    : TRANSFER_GROUPS_UPDATED_AT;

  return {
    groups,
    rows,
    updatedAt,
    isLoading: query.isLoading,
  };
}

// ─── Kingdoms (two-phase: funded first, then all) ────────────
const KINGDOM_COLUMNS = 'kingdom_number, atlas_score, current_rank, total_kvks, prep_wins, prep_losses, prep_win_rate, battle_wins, battle_losses, battle_win_rate, dominations, comebacks, reversals, invasions, most_recent_status';

async function fetchFundedKingdoms(): Promise<KingdomData[]> {
  if (!supabase) return [];
  // Get funded kingdom numbers first (small query)
  const { data: fundRows } = await supabase.from('kingdom_funds').select('kingdom_number');
  if (!fundRows?.length) return [];
  const nums = fundRows.map((f: { kingdom_number: number }) => f.kingdom_number);
  // Fetch only those kingdoms
  const { data, error } = await supabase
    .from('kingdoms')
    .select(KINGDOM_COLUMNS)
    .in('kingdom_number', nums)
    .order('current_rank', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchAllKingdoms(): Promise<KingdomData[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kingdoms')
    .select(KINGDOM_COLUMNS)
    .order('current_rank', { ascending: true });
  if (error) throw error;
  return data || [];
}

export function useTransferKingdoms() {
  // Phase 1: funded kingdoms only (fast initial load, ~100 rows)
  const funded = useQuery({
    queryKey: [...transferHubKeys.all, 'fundedKingdoms'] as const,
    queryFn: fetchFundedKingdoms,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Phase 2: all kingdoms (background load, ~1300 rows)
  const all = useQuery({
    queryKey: transferHubKeys.kingdoms(),
    queryFn: fetchAllKingdoms,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Return all kingdoms when available, otherwise funded-only for fast first paint
  return {
    data: all.data ?? funded.data ?? [],
    isLoading: funded.isLoading,
    isError: funded.isError && all.isError,
    error: funded.error || all.error,
  };
}

// ─── Kingdom Funds ────────────────────────────────────────────
async function fetchFunds(): Promise<KingdomFund[]> {
  if (!supabase) return [];
  const [fundsResult, inviteCountsResult] = await Promise.all([
    supabase.from('kingdom_funds').select('*'),
    supabase.rpc('get_all_kingdom_invite_counts'),
  ]);

  if (fundsResult.error) throw fundsResult.error;
  const funds: KingdomFund[] = fundsResult.data || [];

  // Merge invite counts into fund objects
  if (inviteCountsResult.data) {
    const countMap = new Map<number, { regular_used: number; special_used: number }>();
    for (const row of inviteCountsResult.data) {
      countMap.set(row.kingdom_number, { regular_used: row.regular_used, special_used: row.special_used });
    }
    for (const fund of funds) {
      const counts = countMap.get(fund.kingdom_number);
      fund.regular_invites_used = counts?.regular_used ?? 0;
      fund.special_invites_used = counts?.special_used ?? 0;
    }
  }

  return funds;
}

export function useTransferFunds() {
  return useQuery({
    queryKey: transferHubKeys.funds(),
    queryFn: fetchFunds,
    staleTime: 2 * 60 * 1000, // 2 minutes — funds can change with contributions
    retry: 2,
  });
}

// ─── Review Summaries (LEGACY - from old Supabase view) ──────
async function fetchReviewSummaries(): Promise<KingdomReviewSummary[]> {
  // Legacy: returns empty since old kingdom_review_summaries is deprecated
  return [];
}

export function useTransferReviewSummaries() {
  return useQuery({
    queryKey: transferHubKeys.reviewSummaries(),
    queryFn: fetchReviewSummaries,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Reputation Summaries (from new materialized view) ───────
async function fetchReputationSummaries(): Promise<KingdomReputationSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .rpc('get_kingdom_reputation_summaries', {
      p_review_type: 'citizen',
    });

  if (error) {
    logger.error('Error fetching reputation summaries:', error);
    return [];
  }
  return data || [];
}

export function useTransferReputationSummaries() {
  return useQuery({
    queryKey: transferHubKeys.reputationSummaries(),
    queryFn: fetchReputationSummaries,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── User Transfer Profile ────────────────────────────────────
interface UserTransferProfileData {
  id: string;
  hasProfile: boolean;
  profile: {
    power_million: number;
    tc_level: number;
    main_language: string;
    secondary_languages: string[];
    looking_for: string[];
    kvk_availability: string;
    saving_for_kvk: string;
    group_size: string;
    player_bio: string;
    play_schedule: unknown[];
    contact_method: string;
    visible_to_recruiters: boolean;
  } | null;
  profileViewCount: number;
}

async function fetchUserTransferProfile(userId: string): Promise<UserTransferProfileData> {
  if (!supabase) return { id: '', hasProfile: false, profile: null, profileViewCount: 0 };

  const { data } = await supabase
    .from('transfer_profiles')
    .select('id, power_million, tc_level, main_language, secondary_languages, looking_for, kvk_availability, saving_for_kvk, group_size, player_bio, play_schedule, contact_method, visible_to_recruiters')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) return { id: '', hasProfile: false, profile: null, profileViewCount: 0 };

  // Touch last_active_at silently (debounced — max once per hour)
  const lastTouch = localStorage.getItem('atlas_tp_last_active_touch');
  if (!lastTouch || Date.now() - parseInt(lastTouch, 10) > 3600000) {
    supabase.from('transfer_profiles').update({ last_active_at: new Date().toISOString() }).eq('id', data.id).then(() => {});
    localStorage.setItem('atlas_tp_last_active_touch', String(Date.now()));
  }

  // Fetch distinct kingdom view count
  const { data: viewRows } = await supabase
    .from('transfer_profile_views')
    .select('viewer_kingdom_number')
    .eq('transfer_profile_id', data.id);
  const uniqueKingdoms = new Set((viewRows || []).map((v: { viewer_kingdom_number: number }) => v.viewer_kingdom_number));

  return {
    id: data.id,
    hasProfile: true,
    profile: {
      power_million: data.power_million || 0,
      tc_level: data.tc_level || 0,
      main_language: data.main_language || 'English',
      secondary_languages: data.secondary_languages || [],
      looking_for: data.looking_for || [],
      kvk_availability: data.kvk_availability || '',
      saving_for_kvk: data.saving_for_kvk || '',
      group_size: data.group_size || '',
      player_bio: data.player_bio || '',
      play_schedule: data.play_schedule || [],
      contact_method: data.contact_method || '',
      visible_to_recruiters: !!data.visible_to_recruiters,
    },
    profileViewCount: uniqueKingdoms.size,
  };
}

export function useUserTransferProfile(userId: string | undefined) {
  return useQuery({
    queryKey: transferHubKeys.userProfile(userId || ''),
    queryFn: () => fetchUserTransferProfile(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });
}

// ─── Active Application Count ─────────────────────────────────
async function fetchActiveAppCount(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase
    .from('transfer_applications')
    .select('*', { count: 'exact', head: true })
    .eq('applicant_user_id', userId)
    .in('status', ['pending', 'viewed', 'interested']);
  return count || 0;
}

export function useActiveAppCount(userId: string | undefined) {
  return useQuery({
    queryKey: transferHubKeys.activeAppCount(userId || ''),
    queryFn: () => fetchActiveAppCount(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
    retry: 1,
  });
}

// ─── Editor Status ────────────────────────────────────────────
interface EditorStatusData {
  isEditor: boolean;
  editorKingdomNumber: number | null;
  newAppCount: number;
  pendingCoEditorCount: number;
}

async function fetchEditorStatus(userId: string): Promise<EditorStatusData> {
  if (!supabase) return { isEditor: false, editorKingdomNumber: null, newAppCount: 0, pendingCoEditorCount: 0 };

  const { data } = await supabase
    .from('kingdom_editors')
    .select('id, kingdom_number')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return { isEditor: false, editorKingdomNumber: null, newAppCount: 0, pendingCoEditorCount: 0 };

  // Fetch pending app + co-editor counts in parallel
  const [appCountResult, coEditorResult] = await Promise.all([
    supabase
      .from('transfer_applications')
      .select('*', { count: 'exact', head: true })
      .eq('kingdom_number', data.kingdom_number)
      .eq('status', 'pending'),
    supabase
      .from('kingdom_editors')
      .select('*', { count: 'exact', head: true })
      .eq('kingdom_number', data.kingdom_number)
      .eq('role', 'co-editor')
      .eq('status', 'pending'),
  ]);

  return {
    isEditor: true,
    editorKingdomNumber: data.kingdom_number,
    newAppCount: appCountResult.count || 0,
    pendingCoEditorCount: coEditorResult.count || 0,
  };
}

export function useEditorStatus(userId: string | undefined) {
  return useQuery({
    queryKey: transferHubKeys.editorStatus(userId || ''),
    queryFn: () => fetchEditorStatus(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
    retry: 1,
  });
}

// ─── Atlas Player Count ───────────────────────────────────────
async function fetchAtlasPlayerCount(): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('linked_player_id', 'is', null)
    .not('linked_kingdom', 'is', null)
    .gte('linked_tc_level', 20);
  return count || 0;
}

export function useAtlasPlayerCount() {
  return useQuery({
    queryKey: transferHubKeys.atlasPlayerCount(),
    queryFn: fetchAtlasPlayerCount,
    staleTime: 10 * 60 * 1000, // 10 minutes — doesn't change frequently
    retry: 1,
  });
}

// ─── Transfer Status History (per kingdom) ────────────────────
export interface TransferStatusHistoryRow {
  kingdom_number: number;
  event_number: number;
  group_number: number;
  status: string;
  is_unofficial: boolean;
}

async function fetchTransferStatusHistory(kingdomNumber: number): Promise<TransferStatusHistoryRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('transfer_status_history')
    .select('kingdom_number, event_number, group_number, status, is_unofficial')
    .eq('kingdom_number', kingdomNumber)
    .order('event_number', { ascending: true });
  if (error) {
    logger.error('Error fetching transfer status history:', error);
    return [];
  }
  return data || [];
}

export function useTransferStatusHistory(kingdomNumber: number | undefined) {
  return useQuery({
    queryKey: [...transferHubKeys.all, 'statusHistory', kingdomNumber] as const,
    queryFn: () => fetchTransferStatusHistory(kingdomNumber!),
    enabled: !!kingdomNumber,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

// ─── Transfer Events metadata ─────────────────────────────────
export interface TransferEventRow {
  event_number: number;
  event_date: string;
  total_groups: number;
  is_current: boolean;
}

async function fetchTransferEvents(): Promise<TransferEventRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('transfer_events')
    .select('event_number, event_date, total_groups, is_current')
    .order('event_number', { ascending: true });
  if (error) {
    logger.error('Error fetching transfer events:', error);
    return [];
  }
  return data || [];
}

export function useTransferEvents() {
  return useQuery({
    queryKey: [...transferHubKeys.all, 'events'] as const,
    queryFn: fetchTransferEvents,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}

// ─── Invalidation Helpers ─────────────────────────────────────
export function useInvalidateTransferHub() {
  const queryClient = useQueryClient();
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: transferHubKeys.all }),
    invalidateFunds: () => queryClient.invalidateQueries({ queryKey: transferHubKeys.funds() }),
    invalidateReviews: () => queryClient.invalidateQueries({ queryKey: transferHubKeys.reviewSummaries() }),
    invalidateReputation: () => queryClient.invalidateQueries({ queryKey: transferHubKeys.reputationSummaries() }),
    invalidateUserProfile: (userId: string) => queryClient.invalidateQueries({ queryKey: transferHubKeys.userProfile(userId) }),
    invalidateActiveApps: (userId: string) => queryClient.invalidateQueries({ queryKey: transferHubKeys.activeAppCount(userId) }),
    invalidateEditorStatus: (userId: string) => queryClient.invalidateQueries({ queryKey: transferHubKeys.editorStatus(userId) }),
  };
}
