import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

// ─── Types ───

export interface Alliance {
  id: string;
  owner_id: string;
  tag: string;
  name: string;
  kingdom_number: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AllianceMember {
  id: string;
  alliance_id: string;
  player_name: string;
  player_id: string | null;
  notes: string | null;
  added_by: string;
  created_at: string;
}

export interface AllianceManager {
  id: string;
  alliance_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
  // Joined from profiles
  username?: string;
}

export interface MemberSearchResult {
  id: string;
  username: string;
  linked_player_id: string | null;
  linked_username: string | null;
}

export interface PlayerProfileData {
  player_id: string;
  linked_username: string | null;
  linked_tc_level: number | null;
  linked_kingdom: number | null;
}

const MAX_MEMBERS = 100;
const MAX_MANAGERS = 5;

type MutResult = { success: boolean; error?: string };

// ─── Hook: Alliance Center ───

export interface UseAllianceCenterResult {
  // Alliance data
  alliance: Alliance | null;
  allianceLoading: boolean;
  members: AllianceMember[];
  membersLoading: boolean;
  memberCount: number;
  canAddMember: boolean;
  maxMembers: number;

  // Managers
  managers: AllianceManager[];
  managersLoading: boolean;
  canAddManager: boolean;
  maxManagers: number;
  addManager: (userId: string) => Promise<MutResult>;
  removeManager: (managerId: string) => Promise<MutResult>;
  searchAtlasUsers: (query: string) => Promise<MemberSearchResult[]>;

  // Alliance CRUD
  createAlliance: (data: { tag: string; name: string; kingdom_number: number; description?: string }) => Promise<MutResult>;
  updateAlliance: (data: { tag?: string; name?: string; description?: string }) => Promise<MutResult>;
  deleteAlliance: () => Promise<MutResult>;
  transferOwnership: (newOwnerId: string) => Promise<MutResult>;

  // Member CRUD
  addMember: (data: { player_name: string; player_id?: string; notes?: string }) => Promise<MutResult>;
  updateMember: (memberId: string, data: { player_name?: string; player_id?: string; notes?: string }) => Promise<MutResult>;
  removeMember: (memberId: string) => Promise<MutResult>;
  importByPlayerIds: (playerIds: string[]) => Promise<{ success: number; failed: number; errors: string[] }>;

  // Helpers
  sortedMembers: AllianceMember[];
  isOwner: boolean;
  isManager: boolean;
  canManage: boolean; // owner OR manager
  accessRole: 'owner' | 'manager' | 'delegate' | 'none';

  // Player profile data (resolved from player IDs)
  playerProfiles: Map<string, PlayerProfileData>;
  playerProfilesLoading: boolean;
}

/**
 * Fetches the alliance for the current user.
 * Access path: owner → manager → delegate
 */
export function useAllianceCenter(): UseAllianceCenterResult {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // ─── Fetch alliance (owner → manager → delegate path) ───
  const { data: allianceData = { alliance: null, accessRole: 'none' as const }, isLoading: queryLoading } = useQuery({
    queryKey: ['alliance-center', user?.id],
    queryFn: async (): Promise<{ alliance: Alliance | null; accessRole: 'owner' | 'manager' | 'delegate' | 'none' }> => {
      if (!isSupabaseConfigured || !supabase || !user) return { alliance: null, accessRole: 'none' };

      // CRITICAL: Always refresh the session before querying RLS-protected tables.
      // A stale JWT causes auth.uid() to return NULL in PostgREST, making rows invisible.
      // refreshSession() unconditionally exchanges the refresh token for a fresh access token.
      try {
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          logger.warn('refreshSession() failed before alliance fetch:', refreshErr.message);
        }
      } catch (e) {
        logger.error('Session refresh threw:', e);
      }

      // 1. Check if user owns an alliance
      const { data: ownAlliance, error: ownError } = await supabase
        .from('alliances')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (ownAlliance) return { alliance: ownAlliance as Alliance, accessRole: 'owner' };
      if (ownError && ownError.code !== 'PGRST116') {
        logger.error('Failed to fetch own alliance:', ownError);
      }

      // 2. Check if user is a manager
      const { data: mgrRow } = await supabase
        .from('alliance_managers')
        .select('alliance_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (mgrRow) {
        const { data: mgrAlliance } = await supabase
          .from('alliances')
          .select('*')
          .eq('id', mgrRow.alliance_id)
          .maybeSingle();
        if (mgrAlliance) return { alliance: mgrAlliance as Alliance, accessRole: 'manager' };
      }

      // 3. Check if user is a delegate
      const { data: delegateRow } = await supabase
        .from('tool_delegates')
        .select('owner_id')
        .eq('delegate_id', user.id)
        .maybeSingle();

      if (delegateRow) {
        const { data: ownerAlliance } = await supabase
          .from('alliances')
          .select('*')
          .eq('owner_id', delegateRow.owner_id)
          .maybeSingle();
        if (ownerAlliance) return { alliance: ownerAlliance as Alliance, accessRole: 'delegate' };
      }

      return { alliance: null, accessRole: 'none' };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // allianceLoading must be true while auth is resolving OR query is fetching.
  // Without this, a disabled query (user=null) returns isLoading=false in TanStack Query v5,
  // causing the create form to flash before auth finishes.
  const allianceLoading = authLoading || queryLoading;

  const alliance = allianceData.alliance;
  const accessRole = allianceData.accessRole;
  const isOwner = accessRole === 'owner';
  const isManager = accessRole === 'manager';
  const canManage = isOwner || isManager;

  // ─── Fetch members ───
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['alliance-members', alliance?.id],
    queryFn: async (): Promise<AllianceMember[]> => {
      if (!isSupabaseConfigured || !supabase || !alliance) return [];

      const { data, error } = await supabase
        .from('alliance_members')
        .select('*')
        .eq('alliance_id', alliance.id)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch alliance members:', error);
        return [];
      }
      return (data || []) as AllianceMember[];
    },
    enabled: !!alliance,
    staleTime: 60 * 1000,
  });

  // Sort members alphabetically by name
  const sortedMembers = [...members].sort((a, b) =>
    a.player_name.localeCompare(b.player_name)
  );

  // ─── Fetch player profile data from player IDs (for TC level, etc.) ───
  const playerIds = members.map(m => m.player_id).filter((id): id is string => !!id);
  const { data: playerProfiles = new Map<string, PlayerProfileData>(), isLoading: playerProfilesLoading } = useQuery({
    queryKey: ['alliance-player-profiles', alliance?.id, playerIds.join(',')],
    queryFn: async (): Promise<Map<string, PlayerProfileData>> => {
      if (!isSupabaseConfigured || !supabase || playerIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from('profiles')
        .select('linked_player_id, linked_username, linked_tc_level, linked_kingdom')
        .in('linked_player_id', playerIds);

      if (error) {
        logger.error('Failed to fetch player profiles:', error);
        return new Map();
      }

      const map = new Map<string, PlayerProfileData>();
      (data || []).forEach((p: { linked_player_id: string | null; linked_username: string | null; linked_tc_level: number | null; linked_kingdom: number | null }) => {
        if (p.linked_player_id) {
          map.set(p.linked_player_id, {
            player_id: p.linked_player_id,
            linked_username: p.linked_username,
            linked_tc_level: p.linked_tc_level,
            linked_kingdom: p.linked_kingdom,
          });
        }
      });
      return map;
    },
    enabled: !!alliance && playerIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Fetch managers ───
  const { data: managers = [], isLoading: managersLoading } = useQuery({
    queryKey: ['alliance-managers', alliance?.id],
    queryFn: async (): Promise<AllianceManager[]> => {
      if (!isSupabaseConfigured || !supabase || !alliance) return [];

      const { data, error } = await supabase
        .from('alliance_managers')
        .select('id, alliance_id, user_id, added_by, created_at')
        .eq('alliance_id', alliance.id);

      if (error) {
        logger.error('Failed to fetch alliance managers:', error);
        return [];
      }

      // Fetch usernames for each manager
      const mgrs = (data || []) as AllianceManager[];
      if (mgrs.length === 0) return [];

      const userIds = mgrs.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', userIds);

      const profileMap = new Map<string, string>();
      (profiles || []).forEach((p: { id: string; username: string | null; display_name: string | null }) => {
        profileMap.set(p.id, p.display_name || p.username || 'Unknown');
      });

      return mgrs.map(m => ({ ...m, username: profileMap.get(m.user_id) || 'Unknown' }));
    },
    enabled: !!alliance,
    staleTime: 2 * 60 * 1000,
  });

  // ─── Search Atlas users (for adding managers) ───
  const searchAtlasUsers = async (query: string): Promise<MemberSearchResult[]> => {
    if (!isSupabaseConfigured || !supabase || query.length < 2) return [];

    const { data } = await supabase
      .from('profiles')
      .select('id, username, linked_player_id, linked_username')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,linked_username.ilike.%${query}%`)
      .limit(10);

    return (data || []).map((p: { id: string; username: string | null; linked_player_id: string | null; linked_username: string | null }) => ({
      id: p.id,
      username: p.username || 'Unknown',
      linked_player_id: p.linked_player_id,
      linked_username: p.linked_username,
    }));
  };

  // ─── Create alliance ───
  const createMutation = useMutation({
    mutationFn: async (data: { tag: string; name: string; kingdom_number: number; description?: string }): Promise<MutResult> => {
      if (!isSupabaseConfigured || !supabase || !user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('alliances')
        .insert({
          owner_id: user.id,
          tag: data.tag.toUpperCase(),
          name: data.name.trim(),
          kingdom_number: data.kingdom_number,
          description: data.description?.trim() || null,
        });

      if (error) {
        if (error.message.includes('alliances_owner_id_unique') || error.code === '23505') {
          // Alliance already exists. The 409 proves the JWT IS valid (INSERT auth passed).
          // Force-refresh session then directly fetch and inject into cache.
          try {
            await supabase.auth.refreshSession();
            const { data: existing } = await supabase
              .from('alliances')
              .select('*')
              .eq('owner_id', user.id)
              .maybeSingle();

            if (existing) {
              // Inject directly into React Query cache — dashboard renders immediately
              queryClient.setQueryData(['alliance-center', user.id], {
                alliance: existing as Alliance,
                accessRole: 'owner' as const,
              });
              return { success: true };
            }
          } catch (fetchErr) {
            logger.error('Failed to recover alliance after 409:', fetchErr);
          }

          // Nuclear fallback: if we STILL can't fetch it, hard-reload the page.
          // A full reload re-initializes the Supabase client from scratch.
          logger.warn('409 recovery failed — forcing page reload');
          window.location.reload();
          return { success: false, error: 'Refreshing...' };
        }
        if (error.message.includes('alliances_tag_format')) {
          return { success: false, error: 'Tag must be 2-6 alphanumeric characters' };
        }
        logger.error('Failed to create alliance:', error);
        return { success: false, error: 'Failed to create alliance' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alliance-center', user?.id] });
      }
    },
  });

  // ─── Update alliance ───
  const updateMutation = useMutation({
    mutationFn: async (data: { tag?: string; name?: string; description?: string }): Promise<MutResult> => {
      if (!isSupabaseConfigured || !supabase || !user || !alliance) {
        return { success: false, error: 'No alliance found' };
      }
      if (!canManage) {
        return { success: false, error: 'Only the owner or managers can edit the alliance' };
      }

      const updates: Record<string, unknown> = {};
      if (data.tag !== undefined) updates.tag = data.tag.toUpperCase();
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.description !== undefined) updates.description = data.description.trim() || null;

      const { error } = await supabase
        .from('alliances')
        .update(updates)
        .eq('id', alliance.id);

      if (error) {
        if (error.message.includes('alliances_tag_format')) {
          return { success: false, error: 'Tag must be 2-6 alphanumeric characters' };
        }
        logger.error('Failed to update alliance:', error);
        return { success: false, error: 'Failed to update alliance' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alliance-center', user?.id] });
      }
    },
  });

  // ─── Delete alliance (owner only) ───
  const deleteMutation = useMutation({
    mutationFn: async (): Promise<MutResult> => {
      if (!isSupabaseConfigured || !supabase || !user || !alliance) {
        return { success: false, error: 'No alliance found' };
      }
      if (!isOwner) {
        return { success: false, error: 'Only the owner can delete the alliance' };
      }

      const { error } = await supabase
        .from('alliances')
        .delete()
        .eq('id', alliance.id);

      if (error) {
        logger.error('Failed to delete alliance:', error);
        return { success: false, error: 'Failed to delete alliance' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alliance-center'] });
        queryClient.invalidateQueries({ queryKey: ['alliance-members'] });
        queryClient.invalidateQueries({ queryKey: ['alliance-managers'] });
      }
    },
  });

  // ─── Transfer ownership (owner only) ───
  const transferMutation = useMutation({
    mutationFn: async (newOwnerId: string): Promise<MutResult> => {
      if (!isSupabaseConfigured || !supabase || !user || !alliance) {
        return { success: false, error: 'No alliance found' };
      }
      if (!isOwner) {
        return { success: false, error: 'Only the owner can transfer ownership' };
      }
      if (newOwnerId === user.id) {
        return { success: false, error: 'You are already the owner' };
      }

      // Check the target doesn't already own an alliance
      const { data: existing } = await supabase
        .from('alliances')
        .select('id')
        .eq('owner_id', newOwnerId)
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'That user already owns an alliance center' };
      }

      // If new owner is currently a manager, remove them from managers first
      const { data: mgrRow } = await supabase
        .from('alliance_managers')
        .select('id')
        .eq('alliance_id', alliance.id)
        .eq('user_id', newOwnerId)
        .maybeSingle();

      if (mgrRow) {
        await supabase.from('alliance_managers').delete().eq('id', mgrRow.id);
      }

      // Transfer ownership
      const { error } = await supabase
        .from('alliances')
        .update({ owner_id: newOwnerId })
        .eq('id', alliance.id);

      if (error) {
        logger.error('Failed to transfer ownership:', error);
        return { success: false, error: 'Failed to transfer ownership' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alliance-center'] });
        queryClient.invalidateQueries({ queryKey: ['alliance-managers'] });
      }
    },
  });

  // ─── Add manager (owner only) ───
  const addManagerMutation = useMutation({
    mutationFn: async (userId: string): Promise<MutResult> => {
      if (!isSupabaseConfigured || !supabase || !user || !alliance) {
        return { success: false, error: 'No alliance found' };
      }
      if (!isOwner) {
        return { success: false, error: 'Only the owner can add managers' };
      }
      if (managers.length >= MAX_MANAGERS) {
        return { success: false, error: `Maximum ${MAX_MANAGERS} managers per alliance` };
      }
      if (userId === alliance.owner_id) {
        return { success: false, error: 'The owner cannot be added as a manager' };
      }

      const { error } = await supabase
        .from('alliance_managers')
        .insert({
          alliance_id: alliance.id,
          user_id: userId,
          added_by: user.id,
        });

      if (error) {
        if (error.message.includes('alliance_managers_user_unique')) {
          return { success: false, error: 'This user already manages an alliance' };
        }
        if (error.message.includes('Maximum 5 managers')) {
          return { success: false, error: 'Maximum 5 managers per alliance' };
        }
        logger.error('Failed to add manager:', error);
        return { success: false, error: 'Failed to add manager' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alliance-managers', alliance?.id] });
      }
    },
  });

  // ─── Remove manager (owner only) ───
  const removeManagerMutation = useMutation({
    mutationFn: async (managerId: string): Promise<MutResult> => {
      if (!isSupabaseConfigured || !supabase || !user || !alliance) {
        return { success: false, error: 'No alliance found' };
      }
      if (!isOwner) {
        return { success: false, error: 'Only the owner can remove managers' };
      }

      const { error } = await supabase
        .from('alliance_managers')
        .delete()
        .eq('id', managerId)
        .eq('alliance_id', alliance.id);

      if (error) {
        logger.error('Failed to remove manager:', error);
        return { success: false, error: 'Failed to remove manager' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alliance-managers', alliance?.id] });
      }
    },
  });

  // ─── Add member ───
  const addMemberMutation = useMutation({
    mutationFn: async (data: { player_name: string; player_id?: string; notes?: string }): Promise<MutResult> => {
      if (!isSupabaseConfigured || !supabase || !user || !alliance) {
        return { success: false, error: 'No alliance found' };
      }
      if (members.length >= MAX_MEMBERS) {
        return { success: false, error: `Maximum ${MAX_MEMBERS} members per alliance` };
      }

      const { error } = await supabase
        .from('alliance_members')
        .insert({
          alliance_id: alliance.id,
          player_name: data.player_name.trim(),
          player_id: data.player_id?.trim() || null,
          notes: data.notes?.trim() || null,
          added_by: user.id,
        });

      if (error) {
        if (error.message.includes('alliance_members_unique_player')) {
          return { success: false, error: 'This player is already in the roster' };
        }
        if (error.message.includes('alliance_members_unique_player_id')) {
          return { success: false, error: 'This player ID is already in the roster' };
        }
        if (error.message.includes('Maximum 100 members')) {
          return { success: false, error: 'Maximum 100 members per alliance' };
        }
        logger.error('Failed to add member:', error);
        return { success: false, error: 'Failed to add member' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alliance-members', alliance?.id] });
      }
    },
  });

  // ─── Update member ───
  const updateMemberMutation = useMutation({
    mutationFn: async ({ memberId, data }: { memberId: string; data: { player_name?: string; player_id?: string; notes?: string } }): Promise<MutResult> => {
      if (!isSupabaseConfigured || !supabase || !user || !alliance) {
        return { success: false, error: 'No alliance found' };
      }

      const updates: Record<string, unknown> = {};
      if (data.player_name !== undefined) updates.player_name = data.player_name.trim();
      if (data.player_id !== undefined) updates.player_id = data.player_id.trim() || null;
      if (data.notes !== undefined) updates.notes = data.notes.trim() || null;

      const { error } = await supabase
        .from('alliance_members')
        .update(updates)
        .eq('id', memberId)
        .eq('alliance_id', alliance.id);

      if (error) {
        if (error.message.includes('alliance_members_unique_player')) {
          return { success: false, error: 'A member with this name already exists' };
        }
        logger.error('Failed to update member:', error);
        return { success: false, error: 'Failed to update member' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alliance-members', alliance?.id] });
      }
    },
  });

  // ─── Remove member ───
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string): Promise<MutResult> => {
      if (!isSupabaseConfigured || !supabase || !user || !alliance) {
        return { success: false, error: 'No alliance found' };
      }

      const { error } = await supabase
        .from('alliance_members')
        .delete()
        .eq('id', memberId)
        .eq('alliance_id', alliance.id);

      if (error) {
        logger.error('Failed to remove member:', error);
        return { success: false, error: 'Failed to remove member' };
      }

      return { success: true };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alliance-members', alliance?.id] });
      }
    },
  });

  // ─── Import members by player IDs ───
  const importByPlayerIds = async (playerIds: string[]): Promise<{ success: number; failed: number; errors: string[] }> => {
    if (!isSupabaseConfigured || !supabase || !user || !alliance) {
      return { success: 0, failed: playerIds.length, errors: ['No alliance found'] };
    }

    const unique = [...new Set(playerIds.map(id => id.trim()).filter(Boolean))];
    const remaining = MAX_MEMBERS - members.length;
    const toAdd = unique.slice(0, remaining);
    const errors: string[] = [];
    let successCount = 0;

    if (unique.length > remaining) {
      errors.push(`Only ${remaining} slots available, ${unique.length - remaining} IDs skipped`);
    }

    // Try to resolve player names from Atlas profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('linked_player_id, linked_username, username')
      .in('linked_player_id', toAdd);

    const profileMap = new Map<string, string>();
    (profiles || []).forEach((p: { linked_player_id: string | null; linked_username: string | null; username: string | null }) => {
      if (p.linked_player_id) {
        profileMap.set(p.linked_player_id, p.linked_username || p.username || `Player ${p.linked_player_id}`);
      }
    });

    // Build rows — use resolved name or fallback to "Player <ID>"
    const rows = toAdd.map(pid => ({
      alliance_id: alliance.id,
      player_name: profileMap.get(pid) || `Player ${pid}`,
      player_id: pid,
      added_by: user.id,
    }));

    const { error, data } = await supabase
      .from('alliance_members')
      .insert(rows)
      .select('id');

    if (error) {
      logger.error('Import by player IDs failed:', error);
      errors.push(error.message);
    } else {
      successCount = data?.length || 0;
    }

    queryClient.invalidateQueries({ queryKey: ['alliance-members', alliance.id] });

    return {
      success: successCount,
      failed: toAdd.length - successCount,
      errors,
    };
  };

  return {
    alliance,
    allianceLoading,
    members,
    membersLoading,
    memberCount: members.length,
    canAddMember: members.length < MAX_MEMBERS,
    maxMembers: MAX_MEMBERS,

    managers,
    managersLoading,
    canAddManager: managers.length < MAX_MANAGERS,
    maxManagers: MAX_MANAGERS,
    addManager: addManagerMutation.mutateAsync,
    removeManager: removeManagerMutation.mutateAsync,
    searchAtlasUsers,

    createAlliance: createMutation.mutateAsync,
    updateAlliance: updateMutation.mutateAsync,
    deleteAlliance: deleteMutation.mutateAsync,
    transferOwnership: transferMutation.mutateAsync,

    addMember: addMemberMutation.mutateAsync,
    updateMember: (memberId: string, data: { player_name?: string; player_id?: string; notes?: string }) =>
      updateMemberMutation.mutateAsync({ memberId, data }),
    removeMember: removeMemberMutation.mutateAsync,
    importByPlayerIds,

    sortedMembers,
    isOwner,
    isManager,
    canManage,
    accessRole,

    playerProfiles,
    playerProfilesLoading,
  };
}
