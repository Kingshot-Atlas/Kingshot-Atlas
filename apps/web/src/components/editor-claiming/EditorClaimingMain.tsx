import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';
import { registerChannel, unregisterChannel } from '../../lib/realtimeGuard';
import { useToast } from '../Toast';
import { useAnalytics } from '../../hooks/useAnalytics';
import NominateForm from './NominateForm';
import PendingClaimView from './PendingClaimView';
import { stepDownAsEditor } from '../../services/editorSuccessionService';
import type { EditorClaim } from './types';

const MAX_CO_EDITORS_PER_KINGDOM = 5;

const EditorClaiming: React.FC<{
  onEditorActivated?: () => void;
}> = ({ onEditorActivated }) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [myClaim, setMyClaim] = useState<EditorClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNominate, setShowNominate] = useState(false);
  const [hasActiveEditor, setHasActiveEditor] = useState(false);
  const [coEditorCount, setCoEditorCount] = useState(0);
  const [submittingCoEditor, setSubmittingCoEditor] = useState(false);
  const [coEditorError, setCoEditorError] = useState<string | null>(null);
  const [coEditorRequestSent, setCoEditorRequestSent] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [showStepDown, setShowStepDown] = useState(false);
  const [steppingDown, setSteppingDown] = useState(false);
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();

  // Detect kingdom mismatch: user is active editor but linked to a different kingdom
  const kingdomMismatch = myClaim?.status === 'active' && myClaim?.role === 'editor'
    && profile?.linked_kingdom && myClaim.kingdom_number !== profile.linked_kingdom;

  const handleStepDown = async () => {
    if (!myClaim || !user) return;
    setSteppingDown(true);
    try {
      const result = await stepDownAsEditor(myClaim.id, user.id, myClaim.kingdom_number);
      if (result.success) {
        if (result.action === 'auto_promoted') {
          showToast(t('editor.steppedDownPromoted', 'You stepped down. {{name}} has been promoted to editor.', { name: result.promotedName }), 'success');
        } else {
          showToast(t('editor.steppedDownUnmanaged', 'You stepped down. Kingdom {{kingdom}} is now open for new editor claims.', { kingdom: myClaim.kingdom_number }), 'info');
        }
        trackFeature('Editor Step Down', { kingdom: myClaim.kingdom_number, action: result.action });
        setShowStepDown(false);
        loadMyClaim();
        onEditorActivated?.();
      } else {
        showToast(result.error || 'Step down failed.', 'error');
      }
    } catch {
      showToast('Failed to step down.', 'error');
    } finally {
      setSteppingDown(false);
    }
  };

  const loadMyClaim = useCallback(async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('kingdom_editors')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setMyClaim(data || null);
    } catch {
      // No claim found
    }

    // Check if kingdom has an active editor & co-editor count
    const linkedKingdom = profile?.linked_kingdom;
    if (linkedKingdom) {
      try {
        const { data: activeEd } = await supabase
          .from('kingdom_editors')
          .select('id')
          .eq('kingdom_number', linkedKingdom)
          .eq('status', 'active')
          .eq('role', 'editor')
          .limit(1)
          .maybeSingle();
        setHasActiveEditor(!!activeEd);

        const { data: coEditors } = await supabase
          .from('kingdom_editors')
          .select('id')
          .eq('kingdom_number', linkedKingdom)
          .eq('role', 'co-editor')
          .in('status', ['active', 'pending']);
        setCoEditorCount(coEditors?.length || 0);
      } catch {
        // silent
      }
    }

    setLoading(false);
  }, [user, profile?.linked_kingdom]);

  useEffect(() => {
    loadMyClaim();
  }, [loadMyClaim]);

  // Fetch inviter username when pending invite exists
  useEffect(() => {
    if (!supabase || !myClaim?.assigned_by) { setInviterName(null); return; }
    const sb = supabase;
    const fetchInviter = async () => {
      const { data } = await sb
        .from('profiles')
        .select('linked_username, username')
        .eq('id', myClaim.assigned_by!)
        .maybeSingle();
      if (data) setInviterName(data.linked_username || data.username || null);
    };
    fetchInviter();
  }, [myClaim?.assigned_by]);

  // Real-time subscription: detect status changes on our pending claim
  // Covers: co-editor approval/decline AND editor nomination cancellation
  useEffect(() => {
    if (!supabase || !user || !myClaim || myClaim.status !== 'pending') return;
    const sb = supabase;
    const claimChName = `editor-claim-${myClaim.id}`;
    if (!registerChannel(claimChName)) return;
    const channel = sb
      .channel(claimChName)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kingdom_editors',
        filter: `id=eq.${myClaim.id}`,
      }, (payload) => {
        const updated = payload.new as EditorClaim & { status: string };
        if (updated.status === 'active') {
          if (myClaim.role === 'co-editor') {
            showToast('Your co-editor request has been approved!', 'success');
          } else {
            showToast('Your editor claim has been activated!', 'success');
          }
          loadMyClaim();
          onEditorActivated?.();
        } else if (updated.status === 'inactive') {
          showToast('Your co-editor request was declined.', 'info');
          loadMyClaim();
        } else if (updated.status === 'cancelled') {
          showToast('Your editor nomination was cancelled — another editor was endorsed. You can apply as Co-Editor.', 'info');
          loadMyClaim();
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); unregisterChannel(claimChName); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClaim?.id, myClaim?.status]);

  if (!user) return null;
  if (loading) return <div style={{ color: '#6b7280', fontSize: '0.8rem', padding: '0.5rem 0' }}>{t('editor.checkingStatus', 'Checking editor status...')}</div>;

  // Already an active editor
  if (myClaim?.status === 'active') {
    return (
      <div style={{
        backgroundColor: kingdomMismatch ? '#f9731608' : '#22c55e08',
        border: `1px solid ${kingdomMismatch ? '#f9731625' : '#22c55e25'}`,
        borderRadius: '10px',
        padding: '0.6rem 0.75rem',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Kingdom mismatch warning */}
        {kingdomMismatch && (
          <div style={{
            backgroundColor: '#f9731610',
            border: '1px solid #f9731630',
            borderRadius: '6px',
            padding: '0.4rem 0.6rem',
            marginBottom: '0.4rem',
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <p style={{ color: '#f97316', fontSize: '0.65rem', margin: 0, lineHeight: 1.3 }}>
              {t('editor.kingdomMismatch', "You're linked to Kingdom {{linked}} but still editor of Kingdom {{editor}}. Consider stepping down.", { linked: profile?.linked_kingdom, editor: myClaim.kingdom_number })}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ color: '#22c55e', fontWeight: '600', fontSize: '0.85rem' }}>
            Kingdom {myClaim.kingdom_number}
          </span>
          <span style={{
            padding: '0.1rem 0.4rem',
            backgroundColor: '#22c55e15',
            border: '1px solid #22c55e30',
            borderRadius: '4px',
            fontSize: '0.55rem',
            color: '#22c55e',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {myClaim.role}
          </span>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.65rem', margin: '0.15rem 0 0 0', lineHeight: 1.3, textAlign: 'center' }}>
          {t('editor.youManage', "You manage this kingdom's")} <br />{t('editor.transferHubListing', 'Transfer Hub listing.')}
        </p>
        {/* Step Down button */}
        {myClaim.role === 'editor' && (
          <div style={{ marginTop: '0.4rem', textAlign: 'center' }}>
            {showStepDown ? (
              <div style={{
                padding: '0.5rem',
                backgroundColor: '#ef444408',
                border: '1px solid #ef444420',
                borderRadius: '6px',
                marginTop: '0.2rem',
              }}>
                <p style={{ color: '#ef4444', fontSize: '0.65rem', margin: '0 0 0.3rem 0', lineHeight: 1.3 }}>
                  {t('editor.stepDownConfirm', 'Step down as editor? If there are co-editors, the most senior one will be promoted automatically. Otherwise the kingdom becomes open for new claims.')}
                </p>
                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                  <button
                    onClick={handleStepDown}
                    disabled={steppingDown}
                    style={{
                      padding: '0.3rem 0.75rem', backgroundColor: '#ef4444',
                      border: 'none', borderRadius: '5px',
                      color: '#fff', fontSize: '0.65rem', fontWeight: '600',
                      cursor: steppingDown ? 'default' : 'pointer', minHeight: '32px',
                      opacity: steppingDown ? 0.5 : 1,
                    }}
                  >
                    {steppingDown ? '...' : t('editor.confirmStepDown', 'Confirm Step Down')}
                  </button>
                  <button
                    onClick={() => setShowStepDown(false)}
                    style={{
                      padding: '0.3rem 0.75rem', backgroundColor: 'transparent',
                      border: '1px solid #333', borderRadius: '5px',
                      color: '#9ca3af', fontSize: '0.65rem', fontWeight: '600',
                      cursor: 'pointer', minHeight: '32px',
                    }}
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowStepDown(true)}
                style={{
                  padding: '0.2rem 0.5rem', backgroundColor: 'transparent',
                  border: '1px solid #33333380', borderRadius: '4px',
                  color: '#6b7280', fontSize: '0.55rem', fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                {t('editor.stepDown', 'Step Down')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Has a pending co-editor invite (editor invited this user — assigned_by is set)
  if (myClaim?.status === 'pending' && myClaim?.role === 'co-editor' && myClaim?.assigned_by) {
    const handleAcceptInvite = async () => {
      if (!supabase || !myClaim) return;
      setAcceptingInvite(true);
      try {
        const { error } = await supabase
          .from('kingdom_editors')
          .update({ status: 'active', activated_at: new Date().toISOString() })
          .eq('id', myClaim.id);
        if (error) {
          showToast('Failed to accept invitation. Please try again.', 'error');
          return;
        }
        showToast('Invitation accepted!', 'success');
        loadMyClaim();
        onEditorActivated?.();
      } catch {
        showToast('Failed to accept invitation.', 'error');
      } finally {
        setAcceptingInvite(false);
      }
    };
    const handleDeclineInvite = async () => {
      if (!supabase || !myClaim) return;
      setAcceptingInvite(true);
      try {
        await supabase
          .from('kingdom_editors')
          .update({ status: 'inactive' })
          .eq('id', myClaim.id);
        loadMyClaim();
      } catch {
        // silent
      } finally {
        setAcceptingInvite(false);
      }
    };
    return (
      <div style={{
        backgroundColor: '#22c55e08',
        border: '1px solid #22c55e25',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1rem' }}>🎉</span>
          <span style={{ color: '#22c55e', fontWeight: '600', fontSize: '0.85rem' }}>
            {t('editor.coEditorInvitation', 'Co-Editor Invitation')}
          </span>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.7rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
          {inviterName
            ? t('editor.coEditorInviteDescBy', "{{inviter}} invited you to co-edit Kingdom {{kingdom}}'s recruiter dashboard.", { inviter: inviterName, kingdom: myClaim.kingdom_number })
            : t('editor.coEditorInviteDesc', "You've been invited to co-edit Kingdom {{kingdom}}'s recruiter dashboard.", { kingdom: myClaim.kingdom_number })}
        </p>
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem' }}>
          <button
            onClick={handleAcceptInvite}
            disabled={acceptingInvite}
            style={{
              padding: '0.4rem 1rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e40',
              borderRadius: '6px', color: '#22c55e', fontSize: '0.75rem', fontWeight: '600',
              cursor: acceptingInvite ? 'default' : 'pointer', minHeight: '36px',
              opacity: acceptingInvite ? 0.5 : 1,
            }}
          >
            {acceptingInvite ? '...' : t('editor.acceptInvite', 'Accept')}
          </button>
          <button
            onClick={handleDeclineInvite}
            disabled={acceptingInvite}
            style={{
              padding: '0.4rem 1rem', backgroundColor: '#ef444415', border: '1px solid #ef444440',
              borderRadius: '6px', color: '#ef4444', fontSize: '0.75rem', fontWeight: '600',
              cursor: acceptingInvite ? 'default' : 'pointer', minHeight: '36px',
              opacity: acceptingInvite ? 0.5 : 1,
            }}
          >
            {t('editor.declineInvite', 'Decline')}
          </button>
        </div>
      </div>
    );
  }

  // Has a pending co-editor self-request (user applied — no assigned_by)
  if (myClaim?.status === 'pending' && myClaim?.role === 'co-editor') {
    return (
      <div style={{
        backgroundColor: '#eab30808',
        border: '1px solid #eab30825',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1rem' }}>📨</span>
          <span style={{ color: '#eab308', fontWeight: '600', fontSize: '0.85rem' }}>
            {t('editor.coEditorRequestSent', 'Co-Editor Request Sent')}
          </span>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.7rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
          {t('editor.coEditorRequestPending', 'Your request to co-edit Kingdom {{kingdom}} is pending editor approval. You\'ll be notified when it\'s reviewed.', { kingdom: myClaim.kingdom_number })}
        </p>
        {coEditorRequestSent && (
          <div style={{
            marginTop: '0.5rem',
            padding: '0.3rem 0.6rem',
            backgroundColor: '#22c55e10',
            border: '1px solid #22c55e25',
            borderRadius: '6px',
            color: '#22c55e',
            fontSize: '0.65rem',
            fontWeight: '500',
          }}>
            ✓ {t('editor.requestJustSent', 'Request just sent! The editor has been notified.')}
          </div>
        )}
      </div>
    );
  }

  // Has a pending editor claim
  if (myClaim?.status === 'pending') {
    return (
      <PendingClaimView
        claim={myClaim}
        onRefresh={() => {
          loadMyClaim();
          onEditorActivated?.();
        }}
      />
    );
  }

  // Co-editor self-nomination handler
  const handleBecomeCoEditor = async () => {
    if (!supabase || !user || !profile?.linked_kingdom) return;
    setSubmittingCoEditor(true);
    setCoEditorError(null);

    const linkedKingdom = profile.linked_kingdom;
    const meetsTcReq = (profile.linked_tc_level || 0) >= 20;

    if (!meetsTcReq) {
      setCoEditorError('TC Level 20+ required to become a co-editor.');
      setSubmittingCoEditor(false);
      return;
    }

    if (coEditorCount >= MAX_CO_EDITORS_PER_KINGDOM) {
      setCoEditorError(`Maximum of ${MAX_CO_EDITORS_PER_KINGDOM} co-editors per kingdom.`);
      setSubmittingCoEditor(false);
      return;
    }

    try {
      // Check for existing claim
      const { data: existing } = await supabase
        .from('kingdom_editors')
        .select('id, status, assigned_by')
        .eq('kingdom_number', linkedKingdom)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') {
          setCoEditorError('You are already an active editor for this kingdom.');
          setSubmittingCoEditor(false);
          return;
        }
        if (existing.status === 'pending' && existing.assigned_by) {
          // Editor already invited this user — auto-accept the invite
          await supabase
            .from('kingdom_editors')
            .update({ status: 'active', activated_at: new Date().toISOString() })
            .eq('id', existing.id);
          showToast('Invite auto-accepted! You are now a co-editor.', 'success');
          loadMyClaim();
          onEditorActivated?.();
          setSubmittingCoEditor(false);
          return;
        }
        if (existing.status === 'pending' && !existing.assigned_by) {
          setCoEditorError('You already have a pending co-editor request for this kingdom.');
          setSubmittingCoEditor(false);
          return;
        }
        // Inactive — reuse the row
        await supabase
          .from('kingdom_editors')
          .update({ status: 'pending', role: 'co-editor', assigned_by: null })
          .eq('id', existing.id);
        setCoEditorRequestSent(true);
        showToast(t('editor.coEditorRequestToast', 'Co-Editor request sent! The editor will be notified.'), 'success');
        trackFeature('Co-Editor Request Submitted', { kingdom: linkedKingdom, source: 'reactivation' });
        loadMyClaim();

        // Notify active editor(s)
        const { data: activeEditors } = await supabase
          .from('kingdom_editors')
          .select('user_id')
          .eq('kingdom_number', linkedKingdom)
          .eq('status', 'active')
          .eq('role', 'editor');

        if (activeEditors?.length) {
          const displayName = profile.linked_username || profile.username || 'A user';
          const notifications = activeEditors.map(e => ({
            user_id: e.user_id,
            type: 'co_editor_request',
            title: 'Co-Editor Request',
            message: `${displayName} wants to become a co-editor for Kingdom ${linkedKingdom}.`,
            link: '/transfer-hub',
            metadata: { kingdom_number: linkedKingdom, requester_id: user.id },
          }));
          await supabase.from('notifications').insert(notifications);
        }
        setSubmittingCoEditor(false);
        return;
      }

      // Insert co-editor claim — skip endorsements, goes straight to pending for editor approval
      const { error: insertError } = await supabase
        .from('kingdom_editors')
        .insert({
          kingdom_number: linkedKingdom,
          user_id: user.id,
          role: 'co-editor',
          status: 'pending',
          endorsement_count: 0,
          required_endorsements: 0,
        });

      if (insertError) {
        setCoEditorError(insertError.message);
        return;
      }

      // Notify the active editor(s) about the request
      const { data: activeEditors } = await supabase
        .from('kingdom_editors')
        .select('user_id')
        .eq('kingdom_number', linkedKingdom)
        .eq('status', 'active')
        .eq('role', 'editor');

      if (activeEditors?.length) {
        const displayName = profile.linked_username || profile.username || 'A user';
        const notifications = activeEditors.map(e => ({
          user_id: e.user_id,
          type: 'co_editor_request',
          title: 'Co-Editor Request',
          message: `${displayName} wants to become a co-editor for Kingdom ${linkedKingdom}.`,
          link: '/transfer-hub',
          metadata: { kingdom_number: linkedKingdom, requester_id: user.id },
        }));
        await supabase.from('notifications').insert(notifications);
      }

      setCoEditorRequestSent(true);
      showToast(t('editor.coEditorRequestToast', 'Co-Editor request sent! The editor will be notified.'), 'success');
      trackFeature('Co-Editor Request Submitted', { kingdom: linkedKingdom, source: 'self_nomination' });
      loadMyClaim();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit co-editor request';
      setCoEditorError(message);
    } finally {
      setSubmittingCoEditor(false);
    }
  };

  // No claim — show CTA or nominate form
  if (showNominate) {
    return (
      <NominateForm
        onNominated={() => {
          setShowNominate(false);
          loadMyClaim();
        }}
        onCancel={() => setShowNominate(false)}
      />
    );
  }

  // CTA to claim kingdom
  const linkedKingdom = profile?.linked_kingdom;
  const isLinked = !!profile?.linked_player_id;
  const meetsTcReq = (profile?.linked_tc_level || 0) >= 20;
  const canBeCoEditor = isLinked && meetsTcReq && linkedKingdom && hasActiveEditor && coEditorCount < MAX_CO_EDITORS_PER_KINGDOM;

  // Editor nomination was cancelled (another editor won the endorsement race)
  // Only show if cancelled claim is for user's current kingdom (skip if they transferred)
  if (myClaim?.status === 'cancelled' && myClaim?.role === 'editor' && myClaim.kingdom_number === linkedKingdom) {
    return (
      <div style={{
        backgroundColor: '#ef444408',
        border: '1px solid #ef444425',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1rem' }}>🚫</span>
          <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.85rem' }}>
            {t('editor.nominationCancelled', 'Nomination Cancelled')}
          </span>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0.2rem 0 0.5rem 0', lineHeight: 1.4 }}>
          {t('editor.anotherEditorEndorsed', 'Another user was endorsed as editor for Kingdom {{kingdom}}. You can still contribute by becoming a Co-Editor.', { kingdom: myClaim.kingdom_number })}
        </p>
        {hasActiveEditor && canBeCoEditor && (
          <button
            onClick={handleBecomeCoEditor}
            disabled={submittingCoEditor}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: submittingCoEditor ? '#a855f730' : '#a855f7',
              border: 'none',
              borderRadius: '8px',
              color: submittingCoEditor ? '#6b7280' : '#fff',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: submittingCoEditor ? 'not-allowed' : 'pointer',
              minHeight: '44px',
            }}
          >
            {submittingCoEditor ? t('editor.requesting', 'Requesting...') : t('editor.applyAsCoEditor', 'Apply as Co-Editor')}
          </button>
        )}
        {coEditorError && (
          <div style={{ marginTop: '0.4rem', color: '#ef4444', fontSize: '0.7rem' }}>{coEditorError}</div>
        )}
      </div>
    );
  }

  // Editor claim was deactivated — allow re-nomination
  if (myClaim?.status === 'inactive' && myClaim?.role === 'editor' && myClaim.kingdom_number === linkedKingdom) {
    return (
      <div style={{
        backgroundColor: '#f59e0b08',
        border: '1px solid #f59e0b25',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <span style={{ color: '#f59e0b', fontWeight: '600', fontSize: '0.85rem' }}>
            {t('editor.editorDeactivated', 'Editor Access Deactivated')}
          </span>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0.2rem 0 0.5rem 0', lineHeight: 1.4 }}>
          {t('editor.editorDeactivatedDesc', 'Your editor role for Kingdom {{kingdom}} was deactivated. You can re-nominate yourself to start a new endorsement round.', { kingdom: myClaim.kingdom_number })}
        </p>
        {!hasActiveEditor && (
          <button
            onClick={() => setShowNominate(true)}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#a855f7',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            {t('editor.reNominate', 'Re-Nominate Myself')}
          </button>
        )}
        {hasActiveEditor && canBeCoEditor && (
          <button
            onClick={handleBecomeCoEditor}
            disabled={submittingCoEditor}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: submittingCoEditor ? '#a855f730' : '#a855f7',
              border: 'none',
              borderRadius: '8px',
              color: submittingCoEditor ? '#6b7280' : '#fff',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: submittingCoEditor ? 'not-allowed' : 'pointer',
              minHeight: '44px',
            }}
          >
            {submittingCoEditor ? t('editor.requesting', 'Requesting...') : t('editor.applyAsCoEditor', 'Apply as Co-Editor')}
          </button>
        )}
        {coEditorError && (
          <div style={{ marginTop: '0.4rem', color: '#ef4444', fontSize: '0.7rem' }}>{coEditorError}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Primary CTA: Become Editor */}
      {!hasActiveEditor && (
        <div style={{
          backgroundColor: '#a855f708',
          border: '1px solid #a855f725',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          <div>
            <span style={{ color: '#a855f7', fontWeight: '600', fontSize: '0.85rem' }}>
              {t('editor.becomeEditor', 'Become a Kingdom Editor')}
            </span>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
              {linkedKingdom
                ? t('editor.claimKingdomDesc', 'Claim Kingdom {{kingdom}} to manage its recruitment listing.', { kingdom: linkedKingdom })
                : t('editor.linkFirst', 'Link your Kingshot account first, then claim your kingdom.')}
            </p>
          </div>
          <button
            onClick={() => setShowNominate(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#a855f7',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '44px',
            }}
          >
            {t('editor.claimKingdom', 'Claim Kingdom')}
          </button>
        </div>
      )}

      {/* Co-Editor CTA: When kingdom already has an active editor */}
      {hasActiveEditor && linkedKingdom && (
        <div style={{
          backgroundColor: '#a855f708',
          border: '1px solid #a855f725',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: '0.75rem', flexDirection: isMobile ? 'column' : 'row' }}>
            <div>
              <span style={{ color: '#a855f7', fontWeight: '600', fontSize: '0.85rem' }}>
                {t('editor.becomeCoEditor', 'Become a Co-Editor')}
              </span>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
                {t('editor.becomeCoEditorDesc', 'Kingdom {{kingdom}} already has an editor. Join as a co-editor to help manage the Transfer Hub listing.', { kingdom: linkedKingdom })}
                {coEditorCount > 0 && (
                  <span style={{ color: '#a855f7' }}> {t('editor.coEditorSlotsUsed', '({{count}}/{{max}} co-editor slots used)', { count: coEditorCount, max: MAX_CO_EDITORS_PER_KINGDOM })}</span>
                )}
              </p>
              <p style={{ color: '#4b5563', fontSize: '0.65rem', margin: '0.2rem 0 0 0' }}>
                {t('editor.noEndorsementsRequired', 'No endorsements required. The editor will be notified of your request.')}
              </p>
            </div>
            <button
              onClick={handleBecomeCoEditor}
              disabled={!canBeCoEditor || submittingCoEditor}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: canBeCoEditor && !submittingCoEditor ? '#a855f7' : '#a855f730',
                border: 'none',
                borderRadius: '8px',
                color: canBeCoEditor && !submittingCoEditor ? '#fff' : '#6b7280',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: canBeCoEditor && !submittingCoEditor ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                minHeight: '44px',
                flexShrink: 0,
                width: isMobile ? '100%' : 'auto',
              }}
            >
              {submittingCoEditor ? t('editor.requesting', 'Requesting...') : t('editor.requestCoEditor', 'Request Co-Editor')}
            </button>
          </div>

          {coEditorError && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.4rem 0.6rem',
              backgroundColor: '#ef444415',
              border: '1px solid #ef444440',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '0.75rem',
            }}>
              {coEditorError}
            </div>
          )}

          {!isLinked && (
            <p style={{ color: '#f59e0b', fontSize: '0.7rem', margin: '0.4rem 0 0 0' }}>
              {t('editor.linkAccountCoEditor', 'Link your Kingshot account first to become a co-editor.')}
            </p>
          )}
          {isLinked && !meetsTcReq && (
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.4rem 0 0 0' }}>
              {t('editor.tcRequiredCoEditor', 'TC Level 20+ required to become a co-editor.')}
            </p>
          )}
          {coEditorCount >= MAX_CO_EDITORS_PER_KINGDOM && (
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.4rem 0 0 0' }}>
              {t('editor.maxCoEditors', 'This kingdom has reached the maximum of {{max}} co-editors.', { max: MAX_CO_EDITORS_PER_KINGDOM })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorClaiming;
