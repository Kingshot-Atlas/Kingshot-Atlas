import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import BackLink from '../shared/BackLink';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useToast } from '../Toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../shared';
import { FONT_DISPLAY } from '../../utils/styles';
import { logger } from '../../utils/logger';

const ACCENT = '#3b82f6';
const ACCENT_DIM = '#3b82f615';
const ACCENT_BORDER = '#3b82f630';

interface KingdomAlliance {
  id: string;
  tag: string;
  name: string;
  kingdom_number: number;
  description: string | null;
  member_count: number;
}

interface PendingApp {
  id: string;
  alliance_id: string;
  alliance_tag?: string;
  alliance_name?: string;
  status: string;
  message: string | null;
  created_at: string;
}

interface ResolvedApp {
  id: string;
  alliance_tag?: string;
  alliance_name?: string;
  status: 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface AllianceCenterOnboardingProps {
  hasAccess: boolean;
  reason: 'admin' | 'supporter' | 'referral' | 'booster' | 'delegate' | 'none';
  onShowCreate: () => void;
}

const AllianceCenterOnboarding: React.FC<AllianceCenterOnboardingProps> = ({ hasAccess, onShowCreate }) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const [pendingApp, setPendingApp] = useState<PendingApp | null>(null);
  const [recentResolvedApp, setRecentResolvedApp] = useState<ResolvedApp | null>(null);
  const [kingdomAlliances, setKingdomAlliances] = useState<KingdomAlliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [view, setView] = useState<'main' | 'apply'>('main');
  const [resolvedDismissed, setResolvedDismissed] = useState(false);

  const userKingdom = profile?.home_kingdom ?? (profile as { linked_kingdom?: number | null } | null)?.linked_kingdom ?? null;
  const linkedPlayerId = (profile as { linked_player_id?: string | null } | null)?.linked_player_id;
  const linkedUsername = (profile as { linked_username?: string | null } | null)?.linked_username;

  // Fetch all onboarding data in a single RPC call
  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !user) return;
    setLoading(true);

    const { data, error } = await supabase.rpc('get_onboarding_data', {
      p_user_id: user.id,
      p_kingdom_number: userKingdom,
    });

    if (error || !data) {
      logger.error('Failed to fetch onboarding data:', error);
      setLoading(false);
      return;
    }

    const result = data as {
      pending_app: PendingApp | null;
      resolved_app: ResolvedApp | null;
      kingdom_alliances: KingdomAlliance[];
    };

    if (result.pending_app) {
      setPendingApp(result.pending_app);
      setRecentResolvedApp(null);
    } else {
      setPendingApp(null);
      setRecentResolvedApp(result.resolved_app ?? null);
    }

    setKingdomAlliances(result.kingdom_alliances || []);
    setLoading(false);
  }, [user, userKingdom]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Submit application
  const handleApply = async (allianceId: string) => {
    if (!isSupabaseConfigured || !supabase || !user || !linkedPlayerId || !linkedUsername) return;
    setSubmitting(true);

    const { error } = await supabase
      .from('alliance_applications')
      .insert({
        alliance_id: allianceId,
        applicant_user_id: user.id,
        applicant_player_id: linkedPlayerId,
        applicant_username: linkedUsername,
        message: message.trim() || null,
        status: 'pending',
      });

    if (error) {
      if (error.message.includes('already') || error.code === '23505') {
        showToast(t('allianceCenter.onboarding.alreadyApplied', 'You already have a pending application'), 'error');
      } else {
        logger.error('Failed to submit application:', error);
        showToast(t('allianceCenter.onboarding.applyFailed', 'Failed to submit application'), 'error');
      }
      setSubmitting(false);
      return;
    }

    // Send notifications to alliance owner + managers
    const targetAlliance = kingdomAlliances.find(a => a.id === allianceId);
    if (targetAlliance) {
      try {
        // Get owner
        const { data: allianceRow } = await supabase
          .from('alliances')
          .select('owner_id')
          .eq('id', allianceId)
          .single();

        // Get managers
        const { data: mgrRows } = await supabase
          .from('alliance_managers')
          .select('user_id')
          .eq('alliance_id', allianceId);

        const notifyUserIds = new Set<string>();
        if (allianceRow?.owner_id) notifyUserIds.add(allianceRow.owner_id);
        (mgrRows || []).forEach((m: { user_id: string }) => notifyUserIds.add(m.user_id));

        const notifications = [...notifyUserIds].map(uid => ({
          user_id: uid,
          type: 'alliance_application',
          title: t('allianceCenter.onboarding.notifTitle', 'New Alliance Application'),
          message: t('allianceCenter.onboarding.notifMessage', '{{username}} wants to join [{{tag}}] {{name}}', {
            username: linkedUsername,
            tag: targetAlliance.tag,
            name: targetAlliance.name,
          }),
          link: '/tools/alliance-center',
          metadata: { applicant_username: linkedUsername, alliance_id: allianceId },
        }));

        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications);
        }
      } catch (e) {
        logger.error('Failed to send application notifications:', e);
      }
    }

    showToast(t('allianceCenter.onboarding.applySuccess', 'Application submitted!'), 'success');
    setSubmitting(false);
    setApplyingTo(null);
    setMessage('');
    setView('main');
    fetchData();
  };

  // Withdraw application
  const handleWithdraw = async () => {
    if (!isSupabaseConfigured || !supabase || !pendingApp) return;
    setWithdrawing(true);

    const { error } = await supabase
      .from('alliance_applications')
      .delete()
      .eq('id', pendingApp.id)
      .eq('applicant_user_id', user!.id);

    if (error) {
      logger.error('Failed to withdraw application:', error);
      showToast(t('allianceCenter.onboarding.withdrawFailed', 'Failed to withdraw application'), 'error');
    } else {
      showToast(t('allianceCenter.onboarding.withdrawSuccess', 'Application withdrawn'), 'info');
    }

    setWithdrawing(false);
    fetchData();
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  // ─── Pending Application ───
  if (pendingApp) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1.5rem' : '2rem' }}>
        <div style={{
          width: '100%', maxWidth: '480px', backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #a855f730', padding: isMobile ? '1.5rem' : '2rem', textAlign: 'center',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#a855f715',
            border: '2px solid #a855f730', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 4h12v3c0 3-3 5-6 7 3 2 6 4 6 7v3H8v-3c0-3 3-5 6-7-3-2-6-4-6-7V4z" stroke="#a855f7" strokeWidth="1.5" fill="none" />
              <rect x="7" y="3" width="14" height="2" rx="1" fill="#a855f7" opacity="0.5" />
              <rect x="7" y="23" width="14" height="2" rx="1" fill="#a855f7" opacity="0.5" />
              <circle cx="14" cy="14" r="1.5" fill="#a855f7" opacity="0.6" />
            </svg>
          </div>
          <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: '1.15rem', marginBottom: '0.4rem' }}>
            {t('allianceCenter.onboarding.pendingTitle', 'Application Pending')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '1rem' }}>
            {t('allianceCenter.onboarding.pendingDesc', 'Your application to join {{alliance}} is being reviewed.', {
              alliance: pendingApp.alliance_name ? `[${pendingApp.alliance_tag}] ${pendingApp.alliance_name}` : 'an alliance',
            })}
          </p>

          {/* Application details */}
          <div style={{
            backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24',
            padding: '0.75rem', marginBottom: '1rem', textAlign: 'left',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 600 }}>
                {t('allianceCenter.onboarding.appliedTo', 'Applied to')}
              </span>
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px',
                backgroundColor: '#f59e0b20', color: '#f59e0b',
              }}>
                {t('allianceCenter.onboarding.statusPending', 'Pending')}
              </span>
            </div>
            <div style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 600 }}>
              {pendingApp.alliance_tag && <span style={{ color: ACCENT, fontFamily: 'monospace', marginRight: '0.3rem' }}>[{pendingApp.alliance_tag}]</span>}
              {pendingApp.alliance_name || 'Alliance'}
            </div>
            {pendingApp.message && (
              <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.35rem', fontStyle: 'italic' }}>
                "{pendingApp.message}"
              </div>
            )}
            <div style={{ color: '#4b5563', fontSize: '0.65rem', marginTop: '0.3rem' }}>
              {t('allianceCenter.onboarding.appliedOn', 'Applied on {{date}}', {
                date: new Date(pendingApp.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={handleWithdraw} loading={withdrawing}
              style={{ color: '#ef4444', borderColor: '#ef444430' }}>
              {t('allianceCenter.onboarding.withdraw', 'Withdraw Application')}
            </Button>
            <BackLink to="/tools" label={t('common.allTools', 'All Tools')} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Apply to specific alliance (detail view) ───
  if (view === 'apply' && applyingTo) {
    const target = kingdomAlliances.find(a => a.id === applyingTo);
    if (!target) { setView('main'); setApplyingTo(null); return null; }

    const canApply = !!linkedPlayerId && !!linkedUsername;

    return (
      <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1.5rem' : '2rem' }}>
        <div style={{
          width: '100%', maxWidth: '480px', backgroundColor: '#111111', borderRadius: '16px',
          border: `1px solid ${ACCENT_BORDER}`, padding: isMobile ? '1.5rem' : '2rem',
        }}>
          <button onClick={() => { setView('main'); setApplyingTo(null); setMessage(''); }}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer', marginBottom: '0.75rem', padding: 0 }}>
            ← {t('common.back', 'Back')}
          </button>

          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', backgroundColor: ACCENT_DIM,
              border: `2px solid ${ACCENT_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="6" width="20" height="14" rx="3" stroke="#a855f7" strokeWidth="1.5" fill="none" />
                <path d="M3 9l10 6 10-6" stroke="#a855f7" strokeWidth="1.5" fill="none" />
                <circle cx="20" cy="7" r="3" fill="#22c55e" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: '1.1rem', marginBottom: '0.3rem' }}>
              {t('allianceCenter.onboarding.applyTitle', 'Apply to Join')}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <span style={{
                padding: '0.15rem 0.4rem', backgroundColor: ACCENT + '20', border: `1px solid ${ACCENT}40`,
                borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, color: ACCENT, fontFamily: 'monospace',
              }}>[{target.tag}]</span>
              <span style={{ color: '#e5e7eb', fontSize: '0.9rem', fontWeight: 600 }}>{target.name}</span>
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>
              K{target.kingdom_number} • {target.member_count}/100 {t('allianceCenter.onboarding.members', 'members')}
            </div>
          </div>

          {!canApply ? (
            <div style={{
              padding: '0.75rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b30',
              borderRadius: '8px', fontSize: '0.8rem', color: '#f59e0b', textAlign: 'center', marginBottom: '1rem',
            }}>
              {t('allianceCenter.onboarding.linkFirst', 'Link your game account in your profile before applying. We need your Player ID and username.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Applicant info */}
              <div style={{
                backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #1e1e24',
                padding: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.65rem', fontWeight: 600 }}>
                    {t('allianceCenter.onboarding.applyingAs', 'Applying as')}
                  </div>
                  <div style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 600 }}>{linkedUsername}</div>
                </div>
                <span style={{ color: '#4b5563', fontSize: '0.65rem', fontFamily: 'monospace' }}>ID: {linkedPlayerId}</span>
              </div>

              {/* Message */}
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  {t('allianceCenter.onboarding.messageLabel', 'Message (optional)')}
                </label>
                <textarea
                  value={message} onChange={e => setMessage(e.target.value.slice(0, 200))}
                  placeholder={t('allianceCenter.onboarding.messagePlaceholder', 'Tell the alliance leaders a bit about yourself...')}
                  maxLength={200} rows={3}
                  style={{
                    width: '100%', padding: '0.5rem 0.6rem', backgroundColor: '#0d1117',
                    border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff',
                    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', minHeight: '60px',
                  }}
                />
                <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>{message.length}/200</span>
              </div>

              <Button variant="primary" onClick={() => handleApply(target.id)}
                disabled={submitting} loading={submitting} style={{ width: '100%' }}>
                {t('allianceCenter.onboarding.submitApplication', 'Submit Application')}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Onboarding View ───
  const hasKingdomAlliances = kingdomAlliances.length > 0;

  return (
    <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1.5rem' : '2rem' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', backgroundColor: ACCENT_DIM,
            border: `2px solid ${ACCENT_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="14" width="6" height="14" rx="1" stroke="#a855f7" strokeWidth="1.5" fill="none" />
              <rect x="13" y="8" width="6" height="20" rx="1" stroke="#a855f7" strokeWidth="1.5" fill="none" />
              <rect x="20" y="14" width="6" height="14" rx="1" stroke="#a855f7" strokeWidth="1.5" fill="none" />
              <rect x="14.5" y="4" width="3" height="4" rx="0.5" fill="#a855f7" opacity="0.6" />
              <path d="M16 2l2 2h-4l2-2z" fill="#a855f7" opacity="0.8" />
              <line x1="4" y1="28" x2="28" y2="28" stroke="#a855f7" strokeWidth="1.5" opacity="0.4" />
            </svg>
          </div>
          <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: isMobile ? '1.15rem' : '1.35rem', marginBottom: '0.4rem' }}>
            {t('allianceCenter.onboarding.title', 'Alliance Center')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.5, maxWidth: '420px', margin: '0 auto' }}>
            {t('allianceCenter.onboarding.subtitle', 'Manage your alliance roster, coordinate events, and track troop compositions — all in one place.')}
          </p>
        </div>

        {/* Recently resolved application banner */}
        {recentResolvedApp && !resolvedDismissed && (
          <div style={{
            marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '10px',
            backgroundColor: recentResolvedApp.status === 'approved' ? '#22c55e10' : '#ef444410',
            border: `1px solid ${recentResolvedApp.status === 'approved' ? '#22c55e25' : '#ef444425'}`,
            display: 'flex', alignItems: 'center', gap: '0.6rem',
          }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>
              {recentResolvedApp.status === 'approved' ? '✅' : '❌'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ color: recentResolvedApp.status === 'approved' ? '#22c55e' : '#ef4444', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.15rem' }}>
                {recentResolvedApp.status === 'approved'
                  ? t('allianceCenter.onboarding.appApproved', 'Application Approved!')
                  : t('allianceCenter.onboarding.appRejected', 'Application Declined')}
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.7rem', lineHeight: 1.4 }}>
                {recentResolvedApp.status === 'approved'
                  ? t('allianceCenter.onboarding.appApprovedDesc', 'Your application to {{alliance}} was approved. You should now have access as a member.', {
                      alliance: recentResolvedApp.alliance_name ? `[${recentResolvedApp.alliance_tag}] ${recentResolvedApp.alliance_name}` : 'the alliance',
                    })
                  : t('allianceCenter.onboarding.appRejectedDesc', 'Your application to {{alliance}} was declined. You can apply to another alliance below.', {
                      alliance: recentResolvedApp.alliance_name ? `[${recentResolvedApp.alliance_tag}] ${recentResolvedApp.alliance_name}` : 'the alliance',
                    })}
              </div>
              <div style={{ color: '#4b5563', fontSize: '0.6rem', marginTop: '0.2rem' }}>
                {new Date(recentResolvedApp.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <button onClick={() => setResolvedDismissed(true)}
              style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: '0.8rem', cursor: 'pointer', padding: '0.2rem', flexShrink: 0 }}
              aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        {/* Option Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Create Alliance Center (supporters only) */}
          {hasAccess && (
            <button onClick={onShowCreate} style={{
              width: '100%', backgroundColor: '#111111', borderRadius: '12px', border: `1px solid ${ACCENT_BORDER}`,
              padding: '1.25rem', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s, background-color 0.2s',
              background: `linear-gradient(135deg, #111111 0%, ${ACCENT_DIM} 100%)`,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ACCENT + '60'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ACCENT_BORDER; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', backgroundColor: ACCENT + '15',
                  border: `1px solid ${ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', flexShrink: 0,
                }}>✨</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    {t('allianceCenter.onboarding.createOption', 'Create an Alliance Center')}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem', lineHeight: 1.4 }}>
                    {t('allianceCenter.onboarding.createOptionDesc', 'Start a new Alliance Center for your alliance. You\'ll be the owner and can invite members.')}
                  </div>
                </div>
                <span style={{ color: '#4b5563', fontSize: '0.8rem', flexShrink: 0 }}>→</span>
              </div>
            </button>
          )}

          {/* Apply to existing alliance */}
          {hasKingdomAlliances && (
            <div style={{
              backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #22c55e25',
              padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1rem' }}>📋</span>
                <h3 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
                  {t('allianceCenter.onboarding.joinExisting', 'Join an Existing Alliance Center')}
                </h3>
                {userKingdom && (
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px',
                    backgroundColor: '#22d3ee20', color: '#22d3ee', fontFamily: 'monospace',
                  }}>K{userKingdom}</span>
                )}
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                {t('allianceCenter.onboarding.joinExistingDesc', 'These Alliance Centers are active in your kingdom. Apply to join one!')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {kingdomAlliances.map(alliance => {
                  const isFull = alliance.member_count >= 100;
                  return (
                    <div key={alliance.id} style={{
                      display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                      flexDirection: isMobile ? 'column' : 'row',
                      justifyContent: 'space-between', gap: isMobile ? '0.5rem' : '0.75rem',
                      padding: '0.65rem 0.75rem', backgroundColor: '#0d1117', borderRadius: '8px',
                      border: '1px solid #1e1e24', transition: 'border-color 0.15s',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '0.1rem 0.35rem', backgroundColor: ACCENT + '15', border: `1px solid ${ACCENT}30`,
                            borderRadius: '3px', fontSize: '0.6rem', fontWeight: 800, color: ACCENT, fontFamily: 'monospace',
                          }}>[{alliance.tag}]</span>
                          <span style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 600 }}>{alliance.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
                            {alliance.member_count}/100 {t('allianceCenter.onboarding.members', 'members')}
                          </span>
                          {alliance.description && (
                            <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>• {alliance.description.slice(0, 60)}{alliance.description.length > 60 ? '...' : ''}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        onClick={() => { setApplyingTo(alliance.id); setView('apply'); }}
                        disabled={isFull || !linkedPlayerId}
                        style={{
                          fontSize: '0.7rem', padding: '0.35rem 0.75rem', flexShrink: 0,
                          minHeight: isMobile ? '44px' : 'auto',
                          opacity: isFull ? 0.5 : 1,
                        }}
                      >
                        {isFull
                          ? t('allianceCenter.onboarding.full', 'Full')
                          : t('allianceCenter.onboarding.apply', 'Apply')}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {!linkedPlayerId && (
                <div style={{
                  marginTop: '0.5rem', padding: '0.5rem 0.6rem', backgroundColor: '#f59e0b10',
                  border: '1px solid #f59e0b20', borderRadius: '6px', fontSize: '0.7rem', color: '#f59e0b',
                }}>
                  💡 {t('allianceCenter.onboarding.linkRequired', 'Link your game account in your profile to apply.')}
                </div>
              )}
            </div>
          )}

          {/* No alliances in kingdom */}
          {!hasKingdomAlliances && userKingdom && (
            <div style={{
              backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #f59e0b20',
              padding: '1.25rem', textAlign: 'center',
            }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.6 }}>
                <circle cx="18" cy="18" r="8" stroke="#f59e0b" strokeWidth="2" fill="none" />
                <line x1="24" y1="24" x2="32" y2="32" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                <path d="M15 18h6M18 15v6" stroke="#f59e0b" strokeWidth="1.5" opacity="0.5" />
              </svg>
              <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                {t('allianceCenter.onboarding.noCentersTitle', 'No Alliance Centers in K{{kingdom}} Yet', { kingdom: userKingdom })}
              </h3>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                {hasAccess
                  ? t('allianceCenter.onboarding.noCentersHasAccess', 'Be the first! Create an Alliance Center for your alliance using the option above.')
                  : t('allianceCenter.onboarding.noCentersNoAccess', 'Ask your alliance leaders to create one, or become a Supporter to create your own.')}
              </p>
              {!hasAccess && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link to="/support" style={{ textDecoration: 'none' }}>
                    <Button variant="primary" style={{ fontSize: '0.75rem' }}>
                      {t('allianceCenter.onboarding.becomeSupporter', 'Become a Supporter')}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* No kingdom set */}
          {!userKingdom && (
            <div style={{
              backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #f59e0b20',
              padding: '1.25rem', textAlign: 'center',
            }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.6 }}>
                <rect x="4" y="8" width="32" height="24" rx="3" stroke="#f59e0b" strokeWidth="2" fill="none" />
                <path d="M4 16l10-4 12 6 10-4" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
                <circle cx="20" cy="20" r="4" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
                <circle cx="20" cy="20" r="1.5" fill="#f59e0b" opacity="0.6" />
              </svg>
              <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                {t('allianceCenter.onboarding.setKingdomTitle', 'Set Your Kingdom First')}
              </h3>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                {t('allianceCenter.onboarding.setKingdomDesc', 'Set your home kingdom in your profile so we can show you Alliance Centers in your area.')}
              </p>
              <Link to="/profile" style={{ textDecoration: 'none' }}>
                <Button variant="primary" style={{ fontSize: '0.75rem' }}>
                  {t('allianceCenter.onboarding.goToProfile', 'Go to Profile')}
                </Button>
              </Link>
            </div>
          )}

          {/* Upgrade prompt for non-supporters */}
          {!hasAccess && (
            <div style={{
              backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #a855f720',
              padding: '1rem', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e5e7eb', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {t('allianceCenter.onboarding.wantToCreate', 'Want to create your own Alliance Center?')}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.7rem', lineHeight: 1.4 }}>
                  {t('allianceCenter.onboarding.upgradeDesc', 'Supporters, Consuls, and Discord Boosters can create and manage Alliance Centers.')}
                </div>
              </div>
              <Link to="/support" style={{ textDecoration: 'none', flexShrink: 0 }}>
                <Button variant="ghost" style={{ fontSize: '0.7rem', color: '#a855f7', borderColor: '#a855f730' }}>
                  {t('allianceCenter.onboarding.learnMore', 'Learn More')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Back to tools */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <BackLink to="/tools" label={t('common.allTools', 'All Tools')} />
        </div>
      </div>
    </div>
  );
};

export default AllianceCenterOnboarding;
