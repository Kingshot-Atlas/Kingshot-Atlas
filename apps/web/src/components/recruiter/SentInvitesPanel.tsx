import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';
import type { EditorInfo } from './types';
import { getAnonAlias } from '../../utils/anonAlias';

interface SentInvite {
  id: string;
  kingdom_number: number;
  sender_user_id: string;
  recipient_profile_id: string;
  status: string;
  message: string | null;
  sent_at: string;
  responded_at: string | null;
  expires_at: string;
  recipient_username?: string;
  recipient_kingdom?: number;
}

// ─── Query Keys ─────────────────────────────────────────────
export const sentInviteKeys = {
  all: ['sentInvites'] as const,
  list: (kingdomNumber: number) => [...sentInviteKeys.all, 'list', kingdomNumber] as const,
};

async function fetchSentInvites(kingdomNumber: number): Promise<SentInvite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('transfer_invites')
    .select('id, kingdom_number, sender_user_id, recipient_profile_id, status, message, sent_at, responded_at, expires_at')
    .eq('kingdom_number', kingdomNumber)
    .order('sent_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const invites = (data || []) as SentInvite[];
  if (invites.length === 0) return [];

  // Enrich with recipient profile info
  const profileIds = [...new Set(invites.map(i => i.recipient_profile_id))];
  const { data: profiles } = await supabase
    .from('transfer_profiles')
    .select('id, username, current_kingdom, is_anonymous')
    .in('id', profileIds);

  const profileMap = new Map(
    (profiles || []).map((p: { id: string; username: string; current_kingdom: number; is_anonymous: boolean }) => [
      p.id,
      { username: p.is_anonymous ? getAnonAlias(p.id) : (p.username || 'Unknown'), kingdom: p.current_kingdom },
    ])
  );

  return invites.map(inv => ({
    ...inv,
    recipient_username: profileMap.get(inv.recipient_profile_id)?.username || 'Unknown',
    recipient_kingdom: profileMap.get(inv.recipient_profile_id)?.kingdom,
  }));
}

interface SentInvitesPanelProps {
  editorInfo: EditorInfo;
}

const SentInvitesPanel: React.FC<SentInvitesPanelProps> = ({ editorInfo }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const queryKey = sentInviteKeys.list(editorInfo.kingdom_number);

  const { data: invites = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSentInvites(editorInfo.kingdom_number),
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const pendingInvites = invites.filter(i => i.status === 'pending');
  const expiredInvites = invites.filter(i => i.status === 'expired');
  const respondedInvites = invites.filter(i => ['accepted', 'declined'].includes(i.status));
  const cancelledInvites = invites.filter(i => i.status === 'cancelled');

  const handleCancel = async (inviteId: string) => {
    if (!supabase) return;
    setCancellingId(inviteId);
    const prev = queryClient.getQueryData<SentInvite[]>(queryKey);
    queryClient.setQueryData<SentInvite[]>(queryKey, (old) =>
      (old || []).map(i => i.id === inviteId ? { ...i, status: 'cancelled' } : i)
    );
    try {
      const { error } = await supabase
        .from('transfer_invites')
        .update({ status: 'cancelled', responded_at: new Date().toISOString() })
        .eq('id', inviteId);
      if (error) {
        if (prev) queryClient.setQueryData(queryKey, prev);
        showToast('Failed to cancel invite.', 'error');
      } else {
        showToast('Invite cancelled.', 'success');
      }
    } catch (err) {
      if (prev) queryClient.setQueryData(queryKey, prev);
      logger.error('SentInvitesPanel: cancel failed', err);
      showToast('Failed to cancel invite.', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const handleResend = async (invite: SentInvite) => {
    if (!supabase || !user) return;
    setResendingId(invite.id);
    try {
      // Insert a new invite (the old expired/cancelled one remains for history)
      const { error } = await supabase.from('transfer_invites').insert({
        kingdom_number: invite.kingdom_number,
        sender_user_id: user.id,
        recipient_profile_id: invite.recipient_profile_id,
      });
      if (error) {
        if (error.code === '23505') {
          showToast('A pending invite already exists for this player.', 'error');
        } else {
          showToast('Failed to re-send invite.', 'error');
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey });
      showToast('Invite re-sent!', 'success');

      // Notify the recipient
      const { data: profileRow } = await supabase
        .from('transfer_profiles')
        .select('user_id')
        .eq('id', invite.recipient_profile_id)
        .single();
      if (profileRow) {
        await supabase.from('notifications').insert({
          user_id: profileRow.user_id,
          type: 'transfer_invite',
          title: 'Kingdom Invite Received',
          message: `Kingdom ${invite.kingdom_number} has invited you to transfer!`,
          link: '/transfer-hub',
          metadata: { kingdom_number: invite.kingdom_number },
        });
      }
    } catch (err) {
      logger.error('SentInvitesPanel: resend failed', err);
      showToast('Failed to re-send invite.', 'error');
    } finally {
      setResendingId(null);
    }
  };

  const getDaysRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    accepted: '#22c55e',
    declined: '#ef4444',
    expired: '#6b7280',
    cancelled: '#6b7280',
  };

  if (isLoading || invites.length === 0) return null;

  return (
    <div style={{
      marginBottom: '0.75rem',
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '0.5rem 0.75rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: '600' }}>
            📩 Sent Invites
          </span>
          {pendingInvites.length > 0 && (
            <span style={{
              padding: '0.05rem 0.35rem',
              backgroundColor: '#f59e0b15',
              border: '1px solid #f59e0b30',
              borderRadius: '4px',
              fontSize: '0.6rem',
              color: '#f59e0b',
              fontWeight: 'bold',
            }}>
              {pendingInvites.length} pending
            </span>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {expanded && (
        <div style={{ padding: '0 0.75rem 0.75rem', borderTop: `1px solid ${colors.border}` }}>
          {/* Summary */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            {[
              { label: 'Pending', count: pendingInvites.length, color: '#f59e0b' },
              { label: 'Accepted', count: respondedInvites.filter(i => i.status === 'accepted').length, color: '#22c55e' },
              { label: 'Declined', count: respondedInvites.filter(i => i.status === 'declined').length, color: '#ef4444' },
              { label: 'Expired', count: expiredInvites.length, color: '#6b7280' },
              { label: 'Cancelled', count: cancelledInvites.length, color: '#6b7280' },
            ].filter(s => s.count > 0).map(s => (
              <span key={s.label} style={{
                padding: '0.1rem 0.4rem',
                backgroundColor: `${s.color}10`,
                border: `1px solid ${s.color}25`,
                borderRadius: '4px',
                fontSize: '0.6rem',
                color: s.color,
              }}>
                {s.count} {s.label}
              </span>
            ))}
          </div>

          {/* Invite list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {invites.slice(0, 20).map(inv => (
              <div key={inv.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.4rem 0.5rem',
                backgroundColor: colors.bg,
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                gap: '0.4rem',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <span style={{ color: colors.text, fontSize: '0.75rem', fontWeight: '600' }}>
                      {inv.recipient_username}
                    </span>
                    {inv.recipient_kingdom && (
                      <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>K{inv.recipient_kingdom}</span>
                    )}
                    <span style={{
                      padding: '0.02rem 0.3rem',
                      backgroundColor: `${statusColors[inv.status] || '#6b7280'}15`,
                      border: `1px solid ${statusColors[inv.status] || '#6b7280'}30`,
                      borderRadius: '3px',
                      fontSize: '0.55rem',
                      color: statusColors[inv.status] || '#6b7280',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                    }}>
                      {inv.status}
                    </span>
                    {inv.status === 'pending' && (
                      <span style={{ color: getDaysRemaining(inv.expires_at) <= 1 ? '#ef4444' : '#6b7280', fontSize: '0.55rem' }}>
                        {getDaysRemaining(inv.expires_at)}d left
                      </span>
                    )}
                  </div>
                  <span style={{ color: colors.textMuted, fontSize: '0.55rem' }}>
                    Sent {new Date(inv.sent_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {inv.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(inv.id)}
                      disabled={cancellingId === inv.id}
                      style={{
                        padding: '0.2rem 0.45rem',
                        backgroundColor: '#ef444410',
                        border: '1px solid #ef444425',
                        borderRadius: '4px',
                        color: '#ef4444',
                        fontSize: '0.6rem',
                        fontWeight: '600',
                        cursor: cancellingId === inv.id ? 'default' : 'pointer',
                        opacity: cancellingId === inv.id ? 0.5 : 1,
                      }}
                    >
                      {cancellingId === inv.id ? '...' : 'Cancel'}
                    </button>
                  )}
                  {(inv.status === 'expired' || inv.status === 'cancelled' || inv.status === 'declined') && (
                    <button
                      onClick={() => handleResend(inv)}
                      disabled={resendingId === inv.id}
                      style={{
                        padding: '0.2rem 0.45rem',
                        backgroundColor: '#a855f710',
                        border: '1px solid #a855f725',
                        borderRadius: '4px',
                        color: '#a855f7',
                        fontSize: '0.6rem',
                        fontWeight: '600',
                        cursor: resendingId === inv.id ? 'default' : 'pointer',
                        opacity: resendingId === inv.id ? 0.5 : 1,
                      }}
                    >
                      {resendingId === inv.id ? '...' : 'Re-send'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SentInvitesPanel;
