import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { statusService } from '../services/statusService';
import { reviewService } from '../services/reviewService';

// Query keys
export const kingdomProfileKeys = {
  fund: (kingdomNumber: number) => ['kingdom-fund', kingdomNumber] as const,
  pendingSubmissions: (kingdomNumber: number) => ['kingdom-pending-submissions', kingdomNumber] as const,
  editor: (kingdomNumber: number) => ['kingdom-editor', kingdomNumber] as const,
  aggregateRating: (kingdomNumber: number) => ['kingdom-aggregate-rating', kingdomNumber] as const,
};

/**
 * Fetch kingdom fund data (balance + tier) for the contribute modal
 */
export function useKingdomFund(kingdomNumber: number | undefined) {
  return useQuery({
    queryKey: kingdomProfileKeys.fund(kingdomNumber!),
    queryFn: async () => {
      if (!supabase) return null;
      const { data } = await supabase
        .from('kingdom_funds')
        .select('balance, tier')
        .eq('kingdom_number', kingdomNumber!)
        .maybeSingle();
      if (data) {
        return { balance: Number(data.balance) || 0, tier: data.tier || 'standard' };
      }
      return null;
    },
    enabled: !!kingdomNumber,
    staleTime: 60 * 1000,
  });
}

/**
 * Check if a kingdom has pending status submissions
 */
export function useKingdomPendingSubmissions(kingdomNumber: number | undefined) {
  return useQuery({
    queryKey: kingdomProfileKeys.pendingSubmissions(kingdomNumber!),
    queryFn: async () => {
      const pending = await statusService.getKingdomPendingSubmissions(kingdomNumber!);
      return pending.length > 0;
    },
    enabled: !!kingdomNumber,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch the active editor and check if current user is an editor for this kingdom
 */
export function useKingdomEditor(kingdomNumber: number | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: kingdomProfileKeys.editor(kingdomNumber!),
    queryFn: async () => {
      if (!supabase) return { managedBy: null, isEditor: false };

      // Fetch active editor
      let managedBy: { username: string; userId: string } | null = null;
      const { data: editor } = await supabase
        .from('kingdom_editors')
        .select('user_id')
        .eq('kingdom_number', kingdomNumber!)
        .eq('role', 'editor')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (editor) {
        const { data: editorProfile } = await supabase
          .from('profiles')
          .select('linked_username, username')
          .eq('id', editor.user_id)
          .single();
        if (editorProfile) {
          managedBy = {
            username: editorProfile.linked_username || editorProfile.username || 'Editor',
            userId: editor.user_id,
          };
        }
      }

      // Check if current user is an active editor/co-editor
      let isEditor = false;
      if (userId) {
        const { data: myEditorRole } = await supabase
          .from('kingdom_editors')
          .select('id')
          .eq('kingdom_number', kingdomNumber!)
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        isEditor = !!myEditorRole;
      }

      return { managedBy, isEditor };
    },
    enabled: !!kingdomNumber,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch aggregate rating for structured data (SEO) - requires 5+ reviews
 */
export function useKingdomAggregateRating(kingdomNumber: number | undefined) {
  return useQuery({
    queryKey: kingdomProfileKeys.aggregateRating(kingdomNumber!),
    queryFn: () => reviewService.getAggregateRatingForStructuredData(kingdomNumber!),
    enabled: !!kingdomNumber,
    staleTime: 10 * 60 * 1000,
  });
}
