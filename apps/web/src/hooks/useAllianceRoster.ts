import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface RosterMember {
  id: string;
  player_name: string;
  player_id: string | null;
}

type AllianceTool = 'event_coordinator' | 'bear_rally' | 'base_designer' | 'availability';

interface LightAllianceData {
  allianceId: string | null;
  ownerId: string | null;
  members: RosterMember[];
  sortedNames: string[];
  isLoading: boolean;
  accessRole: 'owner' | 'manager' | 'delegate' | 'member' | 'none';
  hasDelegateAccessTo: (tool: AllianceTool) => boolean;
}

/**
 * Lightweight hook that only fetches alliance identity + member names.
 * Use this instead of useAllianceCenter() when you only need roster names
 * (e.g., BaseDesigner autocomplete). Avoids the full 5-query waterfall.
 */
export function useAllianceRoster(): LightAllianceData {
  const { user, profile, loading: authLoading } = useAuth();
  const linkedPid = (profile as { linked_player_id?: string | null } | null)?.linked_player_id ?? null;

  // Single RPC to get alliance + access role (same as useAllianceCenter but we only need id/owner)
  const { data: accessData, isLoading: accessLoading } = useQuery({
    queryKey: ['alliance-center', user?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase || !user) return null;
      const { data, error } = await supabase.rpc('get_user_alliance_access', {
        p_user_id: user.id,
        p_linked_player_id: linkedPid,
      });
      if (error || !data) return null;
      // The RPC returns snake_case but useAllianceCenter (same query key) transforms to camelCase.
      // Handle both shapes since either queryFn may populate the cache first.
      const raw = data as Record<string, unknown>;
      return {
        alliance: (raw.alliance ?? null) as { id: string; owner_id: string } | null,
        accessRole: ((raw.accessRole ?? raw.access_role ?? 'none') as string),
        delegateTools: ((raw.delegateTools ?? raw.delegate_tools ?? null) as string[] | null),
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const allianceId = accessData?.alliance?.id ?? null;
  const ownerId = accessData?.alliance?.owner_id ?? null;
  const accessRole = (accessData?.accessRole ?? 'none') as LightAllianceData['accessRole'];
  const delegateTools = accessData?.delegateTools as ('all' | AllianceTool)[] | null | undefined;

  // Fetch only member names + IDs (lightweight)
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['alliance-members', allianceId],
    queryFn: async (): Promise<RosterMember[]> => {
      if (!isSupabaseConfigured || !supabase || !allianceId) return [];
      const { data, error } = await supabase
        .from('alliance_members')
        .select('id, player_name, player_id')
        .eq('alliance_id', allianceId)
        .order('created_at', { ascending: true });
      if (error) return [];
      return (data || []) as RosterMember[];
    },
    enabled: !!allianceId,
    staleTime: 60 * 1000,
  });

  const sortedNames = [...members].sort((a, b) => a.player_name.localeCompare(b.player_name)).map(m => m.player_name);

  return {
    allianceId,
    ownerId,
    members,
    sortedNames,
    isLoading: authLoading || accessLoading || membersLoading,
    accessRole,
    hasDelegateAccessTo: (tool: AllianceTool) => {
      if (accessRole !== 'delegate' || !delegateTools) return false;
      return delegateTools.includes('all') || delegateTools.includes(tool);
    },
  };
}
