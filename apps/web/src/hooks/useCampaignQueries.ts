import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────
export interface Campaign {
  id: number;
  name: string;
  campaign_number: number;
  status: 'draft' | 'active' | 'drawing' | 'completed';
  start_date: string;
  end_date: string;
  draw_date: string | null;
  min_settlers: number;
  min_tc_level: number;
  rewards: { draw_order: number; amount: number }[];
  rules_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignWinner {
  id: number;
  campaign_id: number;
  draw_order: number;
  prize_amount: number;
  kingdom_number: number;
  tickets_at_draw: number;
  total_tickets_at_draw: number;
  drawn_at: string;
  is_upgrade: boolean;
  upgraded_from_draw: number | null;
  random_seed: string | null;
}

export interface KingdomSettlerStats {
  kingdom_number: number;
  tickets: number; // Discord-linked + TC20+ settlers
  atlas_users: number; // All linked users (including non-Discord)
  percentage: number; // tickets / total_tickets * 100
}

export interface SettlerDetail {
  linked_username: string;
  linked_tc_level: number;
  is_discord_linked: boolean;
  status: 'qualifying' | 'needs_discord' | 'tc_too_low';
}

// ─── Query Keys ───────────────────────────────────────────────
export const campaignKeys = {
  all: ['campaign'] as const,
  campaign: (id: number) => [...campaignKeys.all, 'detail', id] as const,
  activeCampaign: () => [...campaignKeys.all, 'active'] as const,
  leaderboard: (campaignId: number) => [...campaignKeys.all, 'leaderboard', campaignId] as const,
  kingdomSettlers: (kingdom: number) => [...campaignKeys.all, 'settlers', kingdom] as const,
  winners: (campaignId: number) => [...campaignKeys.all, 'winners', campaignId] as const,
};

// ─── Fetch Functions ──────────────────────────────────────────

async function fetchActiveCampaign(): Promise<Campaign | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .in('status', ['active', 'drawing', 'completed'])
    .order('campaign_number', { ascending: false })
    .limit(1)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // No rows
    logger.error('Failed to fetch active campaign', error);
    return null;
  }
  return data as Campaign;
}

async function fetchSettlerLeaderboard(minSettlers: number, minTcLevel: number): Promise<{
  qualifying: KingdomSettlerStats[];
  rising: KingdomSettlerStats[];
  totalTickets: number;
}> {
  if (!supabase) return { qualifying: [], rising: [], totalTickets: 0 };

  // Get all linked users grouped by kingdom
  const { data, error } = await supabase
    .from('profiles')
    .select('linked_kingdom, discord_username, linked_tc_level')
    .not('linked_player_id', 'is', null)
    .not('linked_kingdom', 'is', null);

  if (error || !data) {
    logger.error('Failed to fetch settler leaderboard', error);
    return { qualifying: [], rising: [], totalTickets: 0 };
  }

  // Aggregate per kingdom
  const kingdomMap = new Map<number, { tickets: number; atlas_users: number }>();
  for (const row of data) {
    const k = row.linked_kingdom as number;
    if (!kingdomMap.has(k)) kingdomMap.set(k, { tickets: 0, atlas_users: 0 });
    const entry = kingdomMap.get(k)!;
    entry.atlas_users++;
    if (row.discord_username && (row.linked_tc_level ?? 0) >= minTcLevel) {
      entry.tickets++;
    }
  }

  // Calculate totals and split into qualifying vs rising
  const allKingdoms: KingdomSettlerStats[] = [];
  let totalTickets = 0;

  for (const [kingdom_number, stats] of kingdomMap) {
    if (stats.tickets >= minSettlers) {
      totalTickets += stats.tickets;
    }
    allKingdoms.push({
      kingdom_number,
      tickets: stats.tickets,
      atlas_users: stats.atlas_users,
      percentage: 0, // calculated below
    });
  }

  // Calculate percentages and sort
  const qualifying: KingdomSettlerStats[] = [];
  const rising: KingdomSettlerStats[] = [];

  for (const k of allKingdoms) {
    k.percentage = totalTickets > 0 ? (k.tickets / totalTickets) * 100 : 0;
    if (k.tickets >= minSettlers) {
      qualifying.push(k);
    } else if (k.atlas_users > 0) {
      rising.push(k);
    }
  }

  qualifying.sort((a, b) => b.tickets - a.tickets);
  rising.sort((a, b) => b.tickets - a.tickets || b.atlas_users - a.atlas_users);

  return { qualifying, rising, totalTickets };
}

async function fetchKingdomSettlers(kingdomNumber: number, minTcLevel: number): Promise<SettlerDetail[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('linked_username, linked_tc_level, discord_username')
    .eq('linked_kingdom', kingdomNumber)
    .not('linked_player_id', 'is', null)
    .order('linked_tc_level', { ascending: false });

  if (error || !data) {
    logger.error('Failed to fetch kingdom settlers', error);
    return [];
  }

  return data.map((row) => {
    const isDiscordLinked = !!row.discord_username;
    const tcLevel = row.linked_tc_level ?? 0;
    let status: SettlerDetail['status'] = 'qualifying';
    if (!isDiscordLinked && tcLevel >= minTcLevel) status = 'needs_discord';
    else if (tcLevel < minTcLevel) status = 'tc_too_low';

    return {
      linked_username: row.linked_username || 'Unknown',
      linked_tc_level: tcLevel,
      is_discord_linked: isDiscordLinked,
      status,
    };
  });
}

async function fetchCampaignWinners(campaignId: number): Promise<CampaignWinner[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('campaign_winners')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('draw_order', { ascending: true });

  if (error) {
    logger.error('Failed to fetch campaign winners', error);
    return [];
  }
  return (data as CampaignWinner[]) || [];
}

// ─── Hooks ────────────────────────────────────────────────────

export function useActiveCampaign() {
  return useQuery({
    queryKey: campaignKeys.activeCampaign(),
    queryFn: fetchActiveCampaign,
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

export function useSettlerLeaderboard(campaign: Campaign | null | undefined) {
  return useQuery({
    queryKey: campaignKeys.leaderboard(campaign?.id ?? 0),
    queryFn: () => fetchSettlerLeaderboard(campaign?.min_settlers ?? 10, campaign?.min_tc_level ?? 20),
    enabled: !!campaign,
    staleTime: 60 * 1000, // 1 min during active campaign
    refetchInterval: campaign?.status === 'active' ? 60 * 1000 : false,
  });
}

export function useKingdomSettlers(kingdomNumber: number, minTcLevel: number = 20) {
  return useQuery({
    queryKey: campaignKeys.kingdomSettlers(kingdomNumber),
    queryFn: () => fetchKingdomSettlers(kingdomNumber, minTcLevel),
    enabled: kingdomNumber > 0,
    staleTime: 60 * 1000,
  });
}

export function useCampaignWinners(campaignId: number) {
  return useQuery({
    queryKey: campaignKeys.winners(campaignId),
    queryFn: () => fetchCampaignWinners(campaignId),
    enabled: campaignId > 0,
    staleTime: 30 * 1000,
  });
}

// ─── Mutations (Admin) ───────────────────────────────────────

export function useSaveWinner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (winner: Omit<CampaignWinner, 'id' | 'drawn_at'>) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('campaign_winners')
        .upsert(winner, { onConflict: 'campaign_id,draw_order' })
        .select()
        .single();
      if (error) throw error;
      return data as CampaignWinner;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.winners(data.campaign_id) });
    },
  });
}

export function useDeleteWinner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, drawOrder }: { campaignId: number; drawOrder: number }) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase
        .from('campaign_winners')
        .delete()
        .eq('campaign_id', campaignId)
        .eq('draw_order', drawOrder);
      if (error) throw error;
      return { campaignId, drawOrder };
    },
    onSuccess: ({ campaignId }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.winners(campaignId) });
    },
  });
}

export function useClearAllWinners() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: number) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase
        .from('campaign_winners')
        .delete()
        .eq('campaign_id', campaignId);
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.winners(campaignId) });
    },
  });
}

export function useUpdateCampaignStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, status }: { campaignId: number; status: Campaign['status'] }) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase
        .from('campaigns')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
  });
}
