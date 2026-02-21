import { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useToast } from '../Toast';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

interface UseSendInviteOptions {
  kingdomNumber: number;
  source: string;
}

interface UseSendInviteReturn {
  sentInviteIds: Set<string>;
  sendingInviteId: string | null;
  sendInvite: (recipientProfileId: string) => Promise<boolean>;
  markSent: (id: string) => void;
}

export function useSendInvite({ kingdomNumber, source }: UseSendInviteOptions): UseSendInviteReturn {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();
  const [sentInviteIds, setSentInviteIds] = useState<Set<string>>(new Set());
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);

  const markSent = useCallback((id: string) => {
    setSentInviteIds(prev => new Set(prev).add(id));
  }, []);

  const sendInvite = useCallback(async (recipientProfileId: string): Promise<boolean> => {
    if (!supabase || !user || !kingdomNumber) return false;
    setSendingInviteId(recipientProfileId);
    // Optimistic: mark as sent immediately for instant UI feedback
    setSentInviteIds(prev => new Set(prev).add(recipientProfileId));
    try {
      const { data: existing } = await supabase
        .from('transfer_invites')
        .select('id')
        .eq('kingdom_number', kingdomNumber)
        .eq('recipient_profile_id', recipientProfileId)
        .eq('status', 'pending')
        .maybeSingle();
      if (existing) {
        showToast('An invite is already pending for this player.', 'error');
        return false;
      }

      const { error } = await supabase.from('transfer_invites').insert({
        kingdom_number: kingdomNumber,
        sender_user_id: user.id,
        recipient_profile_id: recipientProfileId,
      });
      if (error) {
        // Rollback optimistic update on failure
        setSentInviteIds(prev => { const next = new Set(prev); next.delete(recipientProfileId); return next; });
        showToast('Failed to send invite: ' + error.message, 'error');
        return false;
      }

      trackFeature(`${source} Invite Sent`, { kingdom: kingdomNumber });
      showToast('Invite sent!', 'success');

      // Notify the transferee
      const { data: profileRow } = await supabase
        .from('transfer_profiles')
        .select('user_id')
        .eq('id', recipientProfileId)
        .single();
      if (profileRow) {
        await supabase.from('notifications').insert({
          user_id: profileRow.user_id,
          type: 'transfer_invite',
          title: 'Kingdom Invite Received',
          message: `Kingdom ${kingdomNumber} has invited you to transfer!`,
          link: '/transfer-hub',
          metadata: { kingdom_number: kingdomNumber },
        });
      }
      return true;
    } catch (err) {
      // Rollback optimistic update on failure
      setSentInviteIds(prev => { const next = new Set(prev); next.delete(recipientProfileId); return next; });
      logger.error(`useSendInvite(${source}): sendInvite failed`, err);
      showToast('Failed to send invite.', 'error');
      return false;
    } finally {
      setSendingInviteId(null);
    }
  }, [user, kingdomNumber, source, showToast, trackFeature]);

  return { sentInviteIds, sendingInviteId, sendInvite, markSent };
}
