import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { KingdomData, KingdomFund, KingdomReviewSummary } from '../components/KingdomListingCard';

// ─── Query Keys ───────────────────────────────────────────────
export const transferHubKeys = {
  all: ['transferHub'] as const,
  kingdoms: () => [...transferHubKeys.all, 'kingdoms'] as const,
  funds: () => [...transferHubKeys.all, 'funds'] as const,
  reviewSummaries: () => [...transferHubKeys.all, 'reviewSummaries'] as const,
  userProfile: (userId: string) => [...transferHubKeys.all, 'userProfile', userId] as const,
  activeAppCount: (userId: string) => [...transferHubKeys.all, 'activeAppCount', userId] as const,
  editorStatus: (userId: string) => [...transferHubKeys.all, 'editorStatus', userId] as const,
  atlasPlayerCount: () => [...transferHubKeys.all, 'atlasPlayerCount'] as const,
};

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
  const { data, error } = await supabase
    .from('kingdom_funds')
    .select('*');

  if (error) throw error;
  return data || [];
}

export function useTransferFunds() {
  return useQuery({
    queryKey: transferHubKeys.funds(),
    queryFn: fetchFunds,
    staleTime: 2 * 60 * 1000, // 2 minutes — funds can change with contributions
    retry: 2,
  });
}

// ─── Review Summaries (from Supabase view) ────────────────────
async function fetchReviewSummaries(): Promise<KingdomReviewSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kingdom_review_summaries')
    .select('kingdom_number, avg_rating, review_count, top_review_comment, top_review_author');

  if (error) {
    // Fallback: if view doesn't exist yet, return empty
    logger.error('Error fetching review summaries:', error);
    return [];
  }
  return data || [];
}

export function useTransferReviewSummaries() {
  return useQuery({
    queryKey: transferHubKeys.reviewSummaries(),
    queryFn: fetchReviewSummaries,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    .select('*', { count: 'exact', head: true });
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

// ─── Invalidation Helpers ─────────────────────────────────────
export function useInvalidateTransferHub() {
  const queryClient = useQueryClient();
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: transferHubKeys.all }),
    invalidateFunds: () => queryClient.invalidateQueries({ queryKey: transferHubKeys.funds() }),
    invalidateReviews: () => queryClient.invalidateQueries({ queryKey: transferHubKeys.reviewSummaries() }),
    invalidateUserProfile: (userId: string) => queryClient.invalidateQueries({ queryKey: transferHubKeys.userProfile(userId) }),
    invalidateActiveApps: (userId: string) => queryClient.invalidateQueries({ queryKey: transferHubKeys.activeAppCount(userId) }),
    invalidateEditorStatus: (userId: string) => queryClient.invalidateQueries({ queryKey: transferHubKeys.editorStatus(userId) }),
  };
}
