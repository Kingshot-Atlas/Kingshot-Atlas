import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePremium } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

export type AllianceTool = 'base_designer' | 'bear_rally' | 'rally_coordinator';
export const ALLIANCE_TOOLS: { id: AllianceTool; label: string }[] = [
  { id: 'base_designer', label: 'Base Designer' },
  { id: 'bear_rally', label: 'Bear Rally' },
  { id: 'rally_coordinator', label: 'Rally Coordinator' },
];

export interface ToolDelegate {
  id: string;
  owner_id: string;
  delegate_id: string;
  tool: 'all' | AllianceTool;
  created_at: string;
  // Joined from profiles
  delegate_username?: string;
  delegate_avatar_url?: string;
  owner_username?: string;
  owner_avatar_url?: string;
}

interface ToolAccessResult {
  hasAccess: boolean;
  reason: 'admin' | 'supporter' | 'referral' | 'booster' | 'delegate' | 'none';
  grantedBy?: string; // username of the owner who granted delegate access
  loading: boolean;
}

export interface UserSearchResult {
  id: string;
  username: string;
  linked_username?: string;
  avatar_url?: string;
}

/** A delegate grouped by person, with the list of tools they have access to */
export interface GroupedDelegate {
  delegate_id: string;
  delegate_username?: string;
  delegate_avatar_url?: string;
  tools: ('all' | AllianceTool)[];
  rows: ToolDelegate[];
}

interface DelegateManagement {
  delegates: ToolDelegate[];
  groupedDelegates: GroupedDelegate[];
  delegatesLoading: boolean;
  canAddDelegate: boolean;
  maxDelegates: number;
  addDelegate: (username: string, tools?: AllianceTool[]) => Promise<{ success: boolean; error?: string }>;
  removeDelegate: (delegateUserId: string) => Promise<{ success: boolean; error?: string }>;
  updateDelegateTools: (delegateUserId: string, tools: AllianceTool[]) => Promise<{ success: boolean; error?: string }>;
  searchUsers: (query: string) => Promise<UserSearchResult[]>;
}

/**
 * Check if the current user has access to alliance management tools.
 * Access is granted to: Admins, Supporters, Consul+ referrers, Discord Boosters, or Delegates of any of these.
 */
export function useToolAccess(): ToolAccessResult {
  const { isAdmin, isSupporter } = usePremium();
  const { profile, user } = useAuth();
  const hasReferralAccess = profile?.referral_tier === 'ambassador' || profile?.referral_tier === 'consul';
  const isBooster = !!profile?.is_discord_booster;

  // Direct access check (no DB query needed)
  const hasDirectAccess = isAdmin || isSupporter || hasReferralAccess || isBooster;

  // Check if user is a delegate of someone with access
  const { data: delegateGrant, isLoading } = useQuery({
    queryKey: ['tool-delegate-access', user?.id],
    queryFn: async (): Promise<{ grantedBy: string } | null> => {
      if (!isSupabaseConfigured || !supabase || !user) return null;

      // Check if this user is listed as a delegate
      const { data: delegateRows, error } = await supabase
        .from('tool_delegates')
        .select('id, owner_id')
        .eq('delegate_id', user.id);

      if (error || !delegateRows?.length) return null;

      // Fetch owner profiles to verify they still have access
      const ownerIds = delegateRows.map(r => r.owner_id);
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, username, subscription_tier, referral_tier, is_discord_booster')
        .in('id', ownerIds);

      if (!owners?.length) return null;

      for (const owner of owners) {
        if (owner.subscription_tier === 'supporter' || owner.referral_tier === 'ambassador' || owner.referral_tier === 'consul' || owner.is_discord_booster) {
          return { grantedBy: owner.username || 'Unknown' };
        }
      }
      return null;
    },
    enabled: !!user && !hasDirectAccess, // Only check delegates if no direct access
    staleTime: 5 * 60 * 1000,
  });

  if (hasDirectAccess) {
    const reason = isAdmin ? 'admin' : isSupporter ? 'supporter' : hasReferralAccess ? 'referral' : 'booster';
    return { hasAccess: true, reason, loading: false };
  }

  if (delegateGrant) {
    return { hasAccess: true, reason: 'delegate', grantedBy: delegateGrant.grantedBy, loading: false };
  }

  return { hasAccess: false, reason: 'none', loading: isLoading };
}

const MAX_DELEGATES = 2;

/**
 * Manage delegates for the current user (Supporters/Ambassadors only).
 * Allows adding/removing up to 2 delegates who can access alliance tools.
 */
export function useDelegateManagement(): DelegateManagement {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: delegates = [], isLoading: delegatesLoading } = useQuery({
    queryKey: ['tool-delegates', user?.id],
    queryFn: async (): Promise<ToolDelegate[]> => {
      if (!isSupabaseConfigured || !supabase || !user) return [];

      // Fetch delegate rows
      const { data: rows, error } = await supabase
        .from('tool_delegates')
        .select('id, owner_id, delegate_id, tool, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch delegates:', error);
        return [];
      }
      if (!rows?.length) return [];

      // Fetch delegate profiles
      const delegateIds = rows.map(r => r.delegate_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, linked_username, avatar_url')
        .in('id', delegateIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return rows.map(row => {
        const p = profileMap.get(row.delegate_id);
        return {
          id: row.id,
          owner_id: row.owner_id,
          delegate_id: row.delegate_id,
          tool: (row as { tool?: string }).tool as ToolDelegate['tool'] || 'all',
          created_at: row.created_at,
          delegate_username: p?.linked_username || p?.username,
          delegate_avatar_url: p?.avatar_url,
        };
      });
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: async ({ username, tools }: { username: string; tools?: AllianceTool[] }): Promise<{ success: boolean; error?: string }> => {
      if (!isSupabaseConfigured || !supabase || !user) {
        return { success: false, error: 'Not authenticated' };
      }
      // Count unique delegates (not rows)
      const uniqueDelegateIds = new Set(delegates.map(d => d.delegate_id));
      if (uniqueDelegateIds.size >= MAX_DELEGATES) {
        return { success: false, error: `Maximum ${MAX_DELEGATES} delegates allowed` };
      }

      // Get current user's kingdom for same-kingdom check (fall back to linked_kingdom)
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('home_kingdom, linked_kingdom')
        .eq('id', user.id)
        .single();

      const myKingdom = myProfile?.home_kingdom ?? myProfile?.linked_kingdom;
      if (!myKingdom) {
        return { success: false, error: 'noKingdom' };
      }

      // Look up the user by linked_username
      const { data: targetProfile, error: lookupError } = await supabase
        .from('profiles')
        .select('id, linked_username, home_kingdom, linked_kingdom')
        .ilike('linked_username', username)
        .single();

      if (lookupError || !targetProfile) {
        return { success: false, error: 'User not found' };
      }
      if (targetProfile.id === user.id) {
        return { success: false, error: 'Cannot add yourself as a delegate' };
      }
      // Same-kingdom constraint (fall back to linked_kingdom)
      const targetKingdom = targetProfile.home_kingdom ?? targetProfile.linked_kingdom;
      if (targetKingdom !== myKingdom) {
        return { success: false, error: 'notInKingdom' };
      }

      // Build rows to insert — one per tool (or 'all' if no specific tools)
      const toolsToInsert: ('all' | AllianceTool)[] = tools && tools.length > 0 ? tools : ['all'];
      const existingTools = new Set(delegates.filter(d => d.delegate_id === targetProfile.id).map(d => d.tool));
      const newTools = toolsToInsert.filter(t => !existingTools.has(t));

      if (newTools.length === 0) {
        return { success: false, error: 'This user already has those tool delegations' };
      }

      const rows = newTools.map(tool => ({ owner_id: user.id, delegate_id: targetProfile.id, tool }));
      const { error: insertError } = await supabase
        .from('tool_delegates')
        .insert(rows);

      if (insertError) {
        if (insertError.message.includes('Maximum 2 delegates')) {
          return { success: false, error: 'Maximum 2 delegates allowed' };
        }
        logger.error('Failed to add delegate:', insertError);
        return { success: false, error: 'Failed to add delegate' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['tool-delegates', user?.id] });
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (delegateUserId: string): Promise<{ success: boolean; error?: string }> => {
      if (!isSupabaseConfigured || !supabase || !user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Remove ALL rows for this delegate (all tools)
      const { error } = await supabase
        .from('tool_delegates')
        .delete()
        .eq('delegate_id', delegateUserId)
        .eq('owner_id', user.id);

      if (error) {
        logger.error('Failed to remove delegate:', error);
        return { success: false, error: 'Failed to remove delegate' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['tool-delegates', user?.id] });
      }
    },
  });

  // Search linked users in same kingdom for autocomplete
  const searchUsers = async (query: string): Promise<UserSearchResult[]> => {
    if (!isSupabaseConfigured || !supabase || !user || query.length < 2) return [];

    // Get current user's kingdom (fall back to linked_kingdom)
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('home_kingdom, linked_kingdom')
      .eq('id', user.id)
      .single();

    const myKingdom = myProfile?.home_kingdom ?? myProfile?.linked_kingdom;
    if (!myKingdom) return [];

    // Search users in same kingdom using OR filter for home_kingdom/linked_kingdom
    const { data: results } = await supabase
      .from('profiles')
      .select('id, username, linked_username, avatar_url, home_kingdom, linked_kingdom')
      .ilike('linked_username', `%${query}%`)
      .neq('id', user.id)
      .not('linked_username', 'is', null)
      .or(`home_kingdom.eq.${myKingdom},linked_kingdom.eq.${myKingdom}`)
      .limit(8);

    return (results || []).filter(r => r.linked_username).map(r => ({
      id: r.id,
      username: r.linked_username || r.username,
      linked_username: r.linked_username,
      avatar_url: r.avatar_url,
    })) as UserSearchResult[];
  };

  // Update tools for an existing delegate (replace all their rows)
  const updateDelegateTools = async (delegateUserId: string, tools: AllianceTool[]): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase || !user) {
      return { success: false, error: 'Not authenticated' };
    }
    if (tools.length === 0) {
      // No tools selected = remove delegate entirely
      return removeMutation.mutateAsync(delegateUserId);
    }

    // Get current rows for this delegate
    const currentTools = delegates.filter(d => d.delegate_id === delegateUserId).map(d => d.tool);
    const toAdd = tools.filter(t => !currentTools.includes(t));
    const toRemove = currentTools.filter(t => t !== 'all' && !tools.includes(t as AllianceTool));
    // If they had 'all', remove the 'all' row and add specific tool rows
    const hadAll = currentTools.includes('all');

    if (hadAll) {
      // Delete the 'all' row
      await supabase.from('tool_delegates').delete().eq('owner_id', user.id).eq('delegate_id', delegateUserId).eq('tool', 'all');
      // Insert all specific tool rows
      const rows = tools.map(tool => ({ owner_id: user.id, delegate_id: delegateUserId, tool }));
      const { error } = await supabase.from('tool_delegates').insert(rows);
      if (error) { logger.error('Failed to update delegate tools:', error); return { success: false, error: 'Failed to update' }; }
    } else {
      // Remove deselected tools
      if (toRemove.length > 0) {
        await supabase.from('tool_delegates').delete().eq('owner_id', user.id).eq('delegate_id', delegateUserId).in('tool', toRemove);
      }
      // Add newly selected tools
      if (toAdd.length > 0) {
        const rows = toAdd.map(tool => ({ owner_id: user.id, delegate_id: delegateUserId, tool }));
        const { error } = await supabase.from('tool_delegates').insert(rows);
        if (error) { logger.error('Failed to add delegate tools:', error); return { success: false, error: 'Failed to update' }; }
      }
    }

    queryClient.invalidateQueries({ queryKey: ['tool-delegates', user?.id] });
    return { success: true };
  };

  // Group delegates by person
  const groupedDelegates: GroupedDelegate[] = (() => {
    const map = new Map<string, GroupedDelegate>();
    for (const d of delegates) {
      const existing = map.get(d.delegate_id);
      if (existing) {
        existing.tools.push(d.tool);
        existing.rows.push(d);
      } else {
        map.set(d.delegate_id, {
          delegate_id: d.delegate_id,
          delegate_username: d.delegate_username,
          delegate_avatar_url: d.delegate_avatar_url,
          tools: [d.tool],
          rows: [d],
        });
      }
    }
    return Array.from(map.values());
  })();

  const uniqueDelegateCount = groupedDelegates.length;

  return {
    delegates,
    groupedDelegates,
    delegatesLoading,
    canAddDelegate: uniqueDelegateCount < MAX_DELEGATES,
    maxDelegates: MAX_DELEGATES,
    addDelegate: (username: string, tools?: AllianceTool[]) => addMutation.mutateAsync({ username, tools }),
    removeDelegate: removeMutation.mutateAsync,
    updateDelegateTools,
    searchUsers,
  };
}
