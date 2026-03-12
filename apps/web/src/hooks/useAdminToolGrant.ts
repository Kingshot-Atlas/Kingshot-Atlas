import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AdminToolGrantResult {
  hasGrant: boolean;
  isTrial: boolean;
  expiresAt: string | null;
  loading: boolean;
}

/**
 * Check if the current user has an admin-granted tool_access row for the given tool.
 * Handles both permanent grants (expires_at IS NULL) and trial grants (expires_at in future).
 * Expired trials return hasGrant = false.
 */
export function useAdminToolGrant(toolId: string): AdminToolGrantResult {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tool-grant', user?.id, toolId],
    queryFn: async (): Promise<{ hasGrant: boolean; isTrial: boolean; expiresAt: string | null }> => {
      if (!isSupabaseConfigured || !supabase || !user) {
        return { hasGrant: false, isTrial: false, expiresAt: null };
      }

      const { data: row, error } = await supabase
        .from('tool_access')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .eq('tool', toolId)
        .maybeSingle();

      if (error || !row) {
        return { hasGrant: false, isTrial: false, expiresAt: null };
      }

      // Permanent grant
      if (!row.expires_at) {
        return { hasGrant: true, isTrial: false, expiresAt: null };
      }

      // Trial grant — check if still valid
      const expiresAt = new Date(row.expires_at);
      if (expiresAt > new Date()) {
        return { hasGrant: true, isTrial: true, expiresAt: row.expires_at };
      }

      // Expired trial
      return { hasGrant: false, isTrial: false, expiresAt: row.expires_at };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 min cache
  });

  return {
    hasGrant: data?.hasGrant ?? false,
    isTrial: data?.isTrial ?? false,
    expiresAt: data?.expiresAt ?? null,
    loading: isLoading,
  };
}
