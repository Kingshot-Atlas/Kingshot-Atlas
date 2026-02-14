import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useToast } from '../Toast';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import type { EditorInfo, TeamMember } from './types';
import { inputStyle } from './types';

interface CoEditorsTabProps {
  editorInfo: EditorInfo;
  team: TeamMember[];
  onReloadDashboard: () => void;
}

const CoEditorsTab: React.FC<CoEditorsTabProps> = ({ editorInfo, team, onReloadDashboard }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { trackFeature } = useAnalytics();
  const { showToast } = useToast();
  const [coEditorUserId, setCoEditorUserId] = useState('');
  const [invitingCoEditor, setInvitingCoEditor] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [removingCoEditor, setRemovingCoEditor] = useState<{ id: string; name: string } | null>(null);

  const handleInviteCoEditor = async () => {
    if (!supabase || !editorInfo || !coEditorUserId.trim()) return;
    setInvitingCoEditor(true);
    try {
      // Enforce max 2 co-editors (active + pending)
      const coEditorCount = team.filter(t => t.role === 'co-editor' && (t.status === 'active' || t.status === 'pending')).length;
      if (coEditorCount >= 2) {
        showToast('Maximum of 2 co-editors allowed per kingdom.', 'error');
        return;
      }

      // Look up user by linked_player_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, linked_kingdom, linked_tc_level, username, linked_username')
        .eq('linked_player_id', coEditorUserId.trim())
        .maybeSingle();

      if (!profile) {
        showToast('No player found with that ID. Make sure they have linked their account.', 'error');
        return;
      }
      if (profile.linked_kingdom !== editorInfo.kingdom_number) {
        showToast(`Player is linked to Kingdom ${profile.linked_kingdom || 'none'}, not Kingdom ${editorInfo.kingdom_number}.`, 'error');
        return;
      }
      if ((profile.linked_tc_level || 0) < 20) {
        showToast('Player must be TC20+ to be a co-editor.', 'error');
        return;
      }

      // Check for existing editor entry
      const { data: existing } = await supabase
        .from('kingdom_editors')
        .select('id, status, assigned_by')
        .eq('user_id', profile.id)
        .eq('kingdom_number', editorInfo.kingdom_number)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') {
          showToast('This player is already a co-editor.', 'error');
          return;
        }
        if (existing.status === 'pending' && existing.assigned_by) {
          showToast('An invitation is already pending for this player.', 'error');
          return;
        }
        if (existing.status === 'pending' && !existing.assigned_by) {
          // User already self-requested — editor approving means auto-activate
          await supabase
            .from('kingdom_editors')
            .update({ status: 'active', assigned_by: user?.id, activated_at: new Date().toISOString() })
            .eq('id', existing.id);

          await supabase.from('notifications').insert({
            user_id: profile.id,
            type: 'co_editor_invite',
            title: 'Co-Editor Request Approved',
            message: `Your co-editor request for Kingdom ${editorInfo.kingdom_number} has been approved! You now have access to the Recruiter Dashboard.`,
            link: '/transfer-hub',
            metadata: { kingdom_number: editorInfo.kingdom_number, action: 'approved' },
          });

          const displayName = profile.linked_username || profile.username || 'User';
          showToast(`${displayName} had a pending request — approved and activated!`, 'success');
          setCoEditorUserId('');
          onReloadDashboard();
          return;
        }
        // Reactivate with pending status for acceptance
        await supabase
          .from('kingdom_editors')
          .update({ status: 'pending', role: 'co-editor', assigned_by: user?.id })
          .eq('id', existing.id);
      } else {
        // Create new co-editor entry with pending status
        const { error } = await supabase
          .from('kingdom_editors')
          .insert({
            kingdom_number: editorInfo.kingdom_number,
            user_id: profile.id,
            role: 'co-editor',
            status: 'pending',
            endorsement_count: 0,
            required_endorsements: 0,
            assigned_by: user?.id,
          });

        if (error) {
          showToast('Failed to invite co-editor: ' + error.message, 'error');
          return;
        }
      }

      // Send notification to the invited user
      await supabase
        .from('notifications')
        .insert({
          user_id: profile.id,
          type: 'co_editor_invite',
          title: 'Co-Editor Invitation',
          message: `You've been invited to be a co-editor for Kingdom ${editorInfo.kingdom_number}'s recruiter dashboard.`,
          link: '/transfer-hub',
          metadata: { kingdom_number: editorInfo.kingdom_number, invited_by: user?.id },
        });

      const displayName = profile.linked_username || profile.username || 'User';
      showToast(`Invitation sent to ${displayName}! They need to accept it.`, 'success');
      setCoEditorUserId('');
      onReloadDashboard();
    } catch {
      showToast('Failed to invite co-editor.', 'error');
    } finally {
      setInvitingCoEditor(false);
    }
  };

  const handleCoEditorRequest = async (memberId: string, memberUserId: string, approve: boolean) => {
    if (!supabase || !editorInfo) return;
    setProcessingRequest(memberId);
    try {
      if (approve) {
        await supabase
          .from('kingdom_editors')
          .update({ status: 'active', activated_at: new Date().toISOString() })
          .eq('id', memberId);
        await supabase.from('notifications').insert({
          user_id: memberUserId,
          type: 'co_editor_invite',
          title: 'Co-Editor Request Approved',
          message: `Your co-editor request for Kingdom ${editorInfo.kingdom_number} has been approved! You now have access to the Recruiter Dashboard.`,
          link: '/transfer-hub',
          metadata: { kingdom_number: editorInfo.kingdom_number, action: 'approved' },
        });
        await supabase.from('editor_audit_log').insert({
          editor_id: memberId,
          kingdom_number: editorInfo.kingdom_number,
          action: 'approve',
          performed_by: user?.id,
          target_user_id: memberUserId,
          details: { source: 'recruiter_dashboard' },
        });
        showToast('Co-editor request approved!', 'success');
      } else {
        await supabase
          .from('kingdom_editors')
          .update({ status: 'inactive' })
          .eq('id', memberId);
        await supabase.from('notifications').insert({
          user_id: memberUserId,
          type: 'co_editor_invite',
          title: 'Co-Editor Request Declined',
          message: `Your co-editor request for Kingdom ${editorInfo.kingdom_number} has been declined by the editor.`,
          link: '/transfer-hub',
          metadata: { kingdom_number: editorInfo.kingdom_number, action: 'rejected' },
        });
        await supabase.from('editor_audit_log').insert({
          editor_id: memberId,
          kingdom_number: editorInfo.kingdom_number,
          action: 'reject',
          performed_by: user?.id,
          target_user_id: memberUserId,
          details: { source: 'recruiter_dashboard' },
        });
        showToast('Co-editor request declined.', 'success');
      }
      trackFeature('Co-Editor Request Response', { action: approve ? 'approve' : 'reject', kingdom: editorInfo.kingdom_number });
      onReloadDashboard();
    } catch {
      showToast('Failed to process co-editor request.', 'error');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRemoveCoEditor = async (memberId: string, memberUserId: string) => {
    if (!supabase || !user || !editorInfo) return;
    try {
      await supabase
        .from('kingdom_editors')
        .update({ status: 'inactive' })
        .eq('id', memberId);
      await supabase.from('notifications').insert({
        user_id: memberUserId,
        type: 'co_editor_invite',
        title: 'Co-Editor Access Removed',
        message: `Your co-editor access for Kingdom ${editorInfo.kingdom_number} has been removed by the editor.`,
        link: '/transfer-hub',
        metadata: { kingdom_number: editorInfo.kingdom_number, action: 'removed' },
      });
      await supabase.from('editor_audit_log').insert({
        editor_id: memberId,
        kingdom_number: editorInfo.kingdom_number,
        action: 'remove',
        performed_by: user.id,
        target_user_id: memberUserId,
        details: { source: 'recruiter_dashboard' },
      });
      trackFeature('Co-Editor Removed', { kingdom: editorInfo.kingdom_number });
      showToast('Co-editor removed.', 'success');
      setRemovingCoEditor(null);
      onReloadDashboard();
    } catch {
      showToast('Failed to remove co-editor.', 'error');
    }
  };

  const coEditors = team.filter((t) => t.role === 'co-editor');

  return (
    <div>
      {/* Current Co-Editors */}
      {coEditors.length > 0 ? (
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('recruiter.currentCoEditors', 'Current Co-Editors')}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            {coEditors.map((member) => (
              <div key={member.id} style={{
                padding: '0.75rem',
                backgroundColor: member.status === 'pending' ? '#eab30808' : '#0a0a0a',
                borderRadius: '8px',
                border: `1px solid ${member.status === 'pending' ? '#eab30820' : '#2a2a2a'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Link
                      to={`/profile/${member.user_id}`}
                      style={{ color: colors.text, textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}
                    >
                      {member.linked_username || member.username || 'User'}
                    </Link>
                    <span style={{
                      padding: '0.1rem 0.4rem',
                      backgroundColor: '#a855f715',
                      border: '1px solid #a855f730',
                      borderRadius: '4px',
                      fontSize: '0.6rem',
                      color: '#a855f7',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                    }}>
                      Co-Editor
                    </span>
                    {member.status === 'pending' && (
                      <span style={{ fontSize: '0.6rem', color: colors.textMuted }}>
                        {member.assigned_by ? '(invited)' : '(self-requested)'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      color: member.status === 'active' ? '#22c55e' : member.status === 'pending' ? '#eab308' : '#6b7280',
                      fontSize: '0.7rem',
                      textTransform: 'capitalize',
                    }}>
                      {member.status}
                    </span>
                  </div>
                </div>
                {/* Last active indicator for active co-editors */}
                {member.status === 'active' && member.last_active_at && (
                  <div style={{ marginTop: '0.3rem', fontSize: '0.6rem', color: colors.textMuted }}>
                    {(() => {
                      const diff = Date.now() - new Date(member.last_active_at).getTime();
                      const mins = Math.floor(diff / 60000);
                      const hrs = Math.floor(diff / 3600000);
                      const days = Math.floor(diff / 86400000);
                      if (mins < 5) return '🟢 Active now';
                      if (mins < 60) return `🟡 ${mins}m ago`;
                      if (hrs < 24) return `🟡 ${hrs}h ago`;
                      if (days < 7) return `⚪ ${days}d ago`;
                      return `⚪ ${days}d ago`;
                    })()}
                  </div>
                )}
                {/* Removal confirmation dialog */}
                {removingCoEditor?.id === member.id ? (
                  <div style={{
                    marginTop: '0.5rem', padding: '0.5rem',
                    backgroundColor: '#ef444408', border: '1px solid #ef444420',
                    borderRadius: '6px',
                  }}>
                    <p style={{ color: '#ef4444', fontSize: '0.7rem', margin: '0 0 0.4rem 0' }}>
                      Remove {member.linked_username || member.username || 'this co-editor'}? They will lose dashboard access.
                    </p>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => handleRemoveCoEditor(member.id, member.user_id)}
                        style={{
                          flex: 1, padding: '0.4rem', backgroundColor: '#ef4444',
                          border: 'none', borderRadius: '6px',
                          color: colors.text, fontSize: '0.7rem', fontWeight: '600',
                          cursor: 'pointer', minHeight: '36px',
                        }}
                      >
                        Confirm Remove
                      </button>
                      <button
                        onClick={() => setRemovingCoEditor(null)}
                        style={{
                          flex: 1, padding: '0.4rem', backgroundColor: 'transparent',
                          border: `1px solid ${colors.border}`, borderRadius: '6px',
                          color: colors.textSecondary, fontSize: '0.7rem', fontWeight: '600',
                          cursor: 'pointer', minHeight: '36px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : member.status === 'active' && editorInfo.role === 'editor' ? (
                  <div style={{ marginTop: '0.4rem' }}>
                    <button
                      onClick={() => setRemovingCoEditor({ id: member.id, name: member.linked_username || member.username || 'User' })}
                      style={{
                        padding: '0.3rem 0.6rem', backgroundColor: 'transparent',
                        border: '1px solid #ef444430', borderRadius: '5px',
                        color: '#ef4444', fontSize: '0.65rem', fontWeight: '500',
                        cursor: 'pointer', opacity: 0.7,
                      }}
                    >
                      Remove Co-Editor
                    </button>
                  </div>
                ) : null}
                {member.status === 'pending' && editorInfo.role === 'editor' && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => handleCoEditorRequest(member.id, member.user_id, true)}
                      disabled={processingRequest === member.id}
                      style={{
                        flex: 1, padding: '0.4rem', backgroundColor: '#22c55e15',
                        border: '1px solid #22c55e40', borderRadius: '6px',
                        color: '#22c55e', fontSize: '0.75rem', fontWeight: '600',
                        cursor: processingRequest === member.id ? 'default' : 'pointer',
                        minHeight: '36px', opacity: processingRequest === member.id ? 0.5 : 1,
                      }}
                    >
                      {processingRequest === member.id ? '...' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => handleCoEditorRequest(member.id, member.user_id, false)}
                      disabled={processingRequest === member.id}
                      style={{
                        flex: 1, padding: '0.4rem', backgroundColor: '#ef444415',
                        border: '1px solid #ef444440', borderRadius: '6px',
                        color: '#ef4444', fontSize: '0.75rem', fontWeight: '600',
                        cursor: processingRequest === member.id ? 'default' : 'pointer',
                        minHeight: '36px', opacity: processingRequest === member.id ? 0.5 : 1,
                      }}
                    >
                      {processingRequest === member.id ? '...' : '✕ Decline'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '1.5rem 1rem',
          backgroundColor: colors.surface, borderRadius: '10px',
          border: `1px solid ${colors.border}`,
          marginBottom: '1rem',
        }}>
          <p style={{ color: colors.textMuted, fontSize: '0.8rem', margin: 0 }}>
            {t('recruiter.noCoEditors', 'No co-editors yet. Invite up to 2 co-editors to help manage your kingdom.')}
          </p>
        </div>
      )}

      {/* Invite Form */}
      {editorInfo.role === 'editor' && team.filter((t) => t.role === 'co-editor' && (t.status === 'active' || t.status === 'pending')).length < 2 && (
        <div style={{ padding: '0.75rem', backgroundColor: colors.surface, borderRadius: '10px', border: '1px solid #a855f720' }}>
          <span style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: '600' }}>{t('recruiter.inviteCoEditor', 'Invite Co-Editor')}</span>
          <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0.25rem 0 0.5rem 0' }}>
            {t('recruiter.inviteCoEditorDesc', 'Enter the player ID of a linked kingdom member (TC20+) to add as co-editor. Co-editors can manage applications, browse transferees, and update the kingdom profile.')}
          </p>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="text"
              value={coEditorUserId}
              onChange={(e) => setCoEditorUserId(e.target.value)}
              placeholder="Player ID"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleInviteCoEditor}
              disabled={invitingCoEditor || !coEditorUserId.trim()}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: '#a855f715',
                border: '1px solid #a855f730',
                borderRadius: '8px',
                color: '#a855f7',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: !coEditorUserId.trim() ? 'default' : 'pointer',
                minHeight: '44px',
                opacity: invitingCoEditor || !coEditorUserId.trim() ? 0.5 : 1,
              }}
            >
              {invitingCoEditor ? '...' : t('recruiter.invite', 'Invite')}
            </button>
          </div>
        </div>
      )}
      {editorInfo.role === 'co-editor' && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: colors.surface,
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
        }}>
          <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>
            {t('recruiter.onlyPrimaryCanInvite', 'Only the primary editor can invite co-editors.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default CoEditorsTab;
