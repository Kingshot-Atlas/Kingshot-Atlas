import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePremium } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface ToolDelegate {
  id: string;
  owner_id: string;
  delegate_id: string;
  created_at: string;
  // Joined from profiles
  delegate_username?: string;
  delegate_avatar_url?: string;
  owner_username?: string;
  owner_avatar_url?: string;
}

interface ToolAccessResult {
  hasAccess: boolean;
  reason: 'admin' | 'supporter' | 'ambassador' | 'booster' | 'delegate' | 'none';
  grantedBy?: string; // username of the owner who granted delegate access
  loading: boolean;
}

export interface UserSearchResult {
  id: string;
  username: string;
  linked_username?: string;
  avatar_url?: string;
}

interface DelegateManagement {
  delegates: ToolDelegate[];
  delegatesLoading: boolean;
  canAddDelegate: boolean;
  maxDelegates: number;
  addDelegate: (username: string) => Promise<{ success: boolean; error?: string }>;
  removeDelegate: (delegateId: string) => Promise<{ success: boolean; error?: string }>;
  searchUsers: (query: string) => Promise<UserSearchResult[]>;
}

/**
 * Check if the current user has access to alliance management tools.
 * Access is granted to: Admins, Supporters, Ambassadors, or Delegates of any of these.
 */
export function useToolAccess(): ToolAccessResult {
  const { isAdmin, isSupporter } = usePremium();
  const { profile, user } = useAuth();
  const isAmbassador = profile?.referral_tier === 'ambassador';
  const isBooster = !!profile?.is_discord_booster;

  // Direct access check (no DB query needed)
  const hasDirectAccess = isAdmin || isSupporter || isAmbassador || isBooster;

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
        if (owner.subscription_tier === 'supporter' || owner.referral_tier === 'ambassador' || owner.is_discord_booster) {
          return { grantedBy: owner.username || 'Unknown' };
        }
      }
      return null;
    },
    enabled: !!user && !hasDirectAccess, // Only check delegates if no direct access
    staleTime: 5 * 60 * 1000,
  });

  if (hasDirectAccess) {
    const reason = isAdmin ? 'admin' : isSupporter ? 'supporter' : isAmbassador ? 'ambassador' : 'booster';
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
        .select('id, owner_id, delegate_id, created_at')
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
    mutationFn: async (username: string): Promise<{ success: boolean; error?: string }> => {
      if (!isSupabaseConfigured || !supabase || !user) {
        return { success: false, error: 'Not authenticated' };
      }
      if (delegates.length >= MAX_DELEGATES) {
        return { success: false, error: `Maximum ${MAX_DELEGATES} delegates allowed` };
      }

      // Get current user's kingdom for same-kingdom check
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('home_kingdom')
        .eq('id', user.id)
        .single();

      if (!myProfile?.home_kingdom) {
        return { success: false, error: 'noKingdom' };
      }

      // Look up the user by linked_username
      const { data: targetProfile, error: lookupError } = await supabase
        .from('profiles')
        .select('id, linked_username, home_kingdom')
        .ilike('linked_username', username)
        .single();

      if (lookupError || !targetProfile) {
        return { success: false, error: 'User not found' };
      }
      if (targetProfile.id === user.id) {
        return { success: false, error: 'Cannot add yourself as a delegate' };
      }
      // Same-kingdom constraint
      if (targetProfile.home_kingdom !== myProfile.home_kingdom) {
        return { success: false, error: 'notInKingdom' };
      }

      // Check if already a delegate
      const existing = delegates.find(d => d.delegate_id === targetProfile.id);
      if (existing) {
        return { success: false, error: 'This user is already your delegate' };
      }

      const { error: insertError } = await supabase
        .from('tool_delegates')
        .insert({ owner_id: user.id, delegate_id: targetProfile.id });

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
    mutationFn: async (delegateRowId: string): Promise<{ success: boolean; error?: string }> => {
      if (!isSupabaseConfigured || !supabase || !user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('tool_delegates')
        .delete()
        .eq('id', delegateRowId)
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

    // Get current user's kingdom
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('home_kingdom')
      .eq('id', user.id)
      .single();

    if (!myProfile?.home_kingdom) return [];

    const { data: results } = await supabase
      .from('profiles')
      .select('id, username, linked_username, avatar_url')
      .ilike('linked_username', `%${query}%`)
      .eq('home_kingdom', myProfile.home_kingdom)
      .neq('id', user.id)
      .not('linked_username', 'is', null)
      .limit(8);

    return (results || []).filter(r => r.linked_username).map(r => ({
      id: r.id,
      username: r.linked_username || r.username,
      linked_username: r.linked_username,
      avatar_url: r.avatar_url,
    })) as UserSearchResult[];
  };

  return {
    delegates,
    delegatesLoading,
    canAddDelegate: delegates.length < MAX_DELEGATES,
    maxDelegates: MAX_DELEGATES,
    addDelegate: addMutation.mutateAsync,
    removeDelegate: removeMutation.mutateAsync,
    searchUsers,
  };
}
