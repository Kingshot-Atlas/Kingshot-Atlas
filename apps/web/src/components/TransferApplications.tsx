import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { supabase } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';

// =============================================
// TYPES
// =============================================

interface TransferApplication {
  id: string;
  transfer_profile_id: string;
  applicant_user_id: string;
  kingdom_number: number;
  status: 'pending' | 'viewed' | 'interested' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  applied_at: string;
  viewed_at: string | null;
  responded_at: string | null;
  expires_at: string;
}

const DEFAULT_STATUS_STYLE = { bg: '#6b728010', border: '#6b728030', text: '#6b7280', label: 'Unknown' };

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  pending: { bg: '#eab30810', border: '#eab30830', text: '#eab308', label: 'Pending' },
  viewed: { bg: '#3b82f610', border: '#3b82f630', text: '#3b82f6', label: 'Viewed' },
  interested: { bg: '#a855f710', border: '#a855f730', text: '#a855f7', label: 'Interested' },
  accepted: { bg: '#22c55e10', border: '#22c55e30', text: '#22c55e', label: 'Accepted' },
  declined: { bg: '#ef444410', border: '#ef444430', text: '#ef4444', label: 'Declined' },
  withdrawn: { bg: '#6b728010', border: '#6b728030', text: '#6b7280', label: 'Withdrawn' },
  expired: { bg: '#4b556310', border: '#4b556330', text: '#4b5563', label: 'Expired' },
};

const MAX_ACTIVE_APPLICATIONS = 3;
const APPLICATION_COOLDOWN_MS = 60 * 1000; // 1 minute between applications
const COOLDOWN_KEY = 'atlas_app_cooldown';

// =============================================
// APPLY MODAL
// =============================================

const ApplyModal: React.FC<{
  kingdomNumber: number;
  onClose: () => void;
  onApplied: () => void;
  activeCount: number;
  hasProfile: boolean;
}> = ({ kingdomNumber, onClose, onApplied, activeCount, hasProfile }) => {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { trackFeature } = useAnalytics();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicantNote, setApplicantNote] = useState('');

  const isOwnKingdom = profile?.linked_kingdom === kingdomNumber;
  const slotsRemaining = MAX_ACTIVE_APPLICATIONS - activeCount;
  const canApply = slotsRemaining > 0 && hasProfile && !isOwnKingdom;

  const handleApply = async () => {
    if (!supabase || !user || !canApply) return;

    // Client-side rate limiting
    const lastApplied = localStorage.getItem(COOLDOWN_KEY);
    if (lastApplied) {
      const elapsed = Date.now() - parseInt(lastApplied, 10);
      if (elapsed < APPLICATION_COOLDOWN_MS) {
        const remaining = Math.ceil((APPLICATION_COOLDOWN_MS - elapsed) / 1000);
        setError(`Please wait ${remaining}s before submitting another application.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      // Get transfer profile ID
      const { data: profile, error: profileError } = await supabase
        .from('transfer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (profileError || !profile) {
        setError('You need a transfer profile before applying. Create one first.');
        return;
      }

      // Check per-kingdom cooldown (24h after withdraw)
      const { data: recentWithdraw } = await supabase
        .from('transfer_applications')
        .select('id')
        .eq('applicant_user_id', user.id)
        .eq('kingdom_number', kingdomNumber)
        .eq('status', 'withdrawn')
        .gte('applied_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentWithdraw && recentWithdraw.length > 0) {
        setError('You recently withdrew an application to this kingdom. Please wait 24 hours before re-applying.');
        return;
      }

      // Submit application (DB trigger enforces 3-slot limit)
      const { error: insertError } = await supabase
        .from('transfer_applications')
        .insert({
          transfer_profile_id: profile.id,
          applicant_user_id: user.id,
          kingdom_number: kingdomNumber,
          applicant_note: applicantNote.trim() || null,
        });

      if (insertError) {
        if (insertError.message.includes('Maximum of 3')) {
          setError('You already have 3 active applications. Withdraw one before applying to a new kingdom.');
        } else {
          setError(insertError.message);
        }
        return;
      }

      // Notify kingdom editors about the new application
      const { data: editors } = await supabase
        .from('kingdom_editors')
        .select('user_id')
        .eq('kingdom_number', kingdomNumber)
        .eq('status', 'active');
      if (editors && editors.length > 0) {
        await supabase.from('notifications').insert(
          editors.map((e: { user_id: string }) => ({
            user_id: e.user_id,
            type: 'new_application',
            title: 'New Transfer Application',
            message: `A player has applied to join Kingdom ${kingdomNumber}.`,
            link: '/transfer-hub',
            metadata: { kingdom_number: kingdomNumber },
          }))
        );
      }

      // Record cooldown timestamp
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      trackFeature('Transfer Funnel: Application Sent', { kingdom: kingdomNumber });

      onApplied();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit application';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: isMobile ? '1.25rem 1rem' : '1.5rem',
          paddingBottom: isMobile ? 'max(1.25rem, env(safe-area-inset-bottom))' : '1.5rem',
          maxWidth: isMobile ? '100%' : '450px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{
          fontFamily: FONT_DISPLAY,
          fontSize: '1.1rem',
          color: colors.text,
          margin: '0 0 0.75rem 0',
        }}>
          {t('applications.applyTo', 'Apply to')} <span style={{ ...neonGlow(colors.primary) }}>{t('editor.kingdom', 'Kingdom')} {kingdomNumber}</span>
        </h3>

        {!hasProfile ? (
          <div style={{
            padding: '1rem',
            backgroundColor: `${colors.warning}10`,
            border: `1px solid ${colors.warning}30`,
            borderRadius: '10px',
            marginBottom: '1rem',
          }}>
            <p style={{ color: colors.warning, fontSize: '0.85rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
              {t('applications.profileRequired', 'Transfer Profile Required')}
            </p>
            <p style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: 0 }}>
              {t('applications.needProfile', 'You need to create a transfer profile before you can apply to kingdoms. Your profile tells recruiters about you.')}
            </p>
          </div>
        ) : (
          <>
            <div style={{
              padding: '0.75rem',
              backgroundColor: colors.bg,
              borderRadius: '10px',
              marginBottom: '1rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: colors.textSecondary, fontSize: '0.8rem' }}>{t('applications.slots', 'Application Slots')}</span>
                <span style={{
                  color: slotsRemaining > 0 ? colors.success : colors.error,
                  fontSize: '0.85rem',
                  fontWeight: '600',
                }}>
                  {slotsRemaining}/{MAX_ACTIVE_APPLICATIONS} {t('applications.remaining', 'remaining')}
                </span>
              </div>
              <div style={{
                display: 'flex', gap: '0.35rem', marginTop: '0.5rem',
              }}>
                {Array.from({ length: MAX_ACTIVE_APPLICATIONS }, (_, idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: idx < activeCount ? colors.primary : colors.border,
                    }}
                  />
                ))}
              </div>
            </div>

            {isOwnKingdom && (
              <div style={{
                padding: '0.75rem',
                backgroundColor: `${colors.error}10`,
                border: `1px solid ${colors.error}30`,
                borderRadius: '8px',
                marginBottom: '1rem',
              }}>
                <p style={{ color: colors.error, fontSize: '0.8rem', margin: 0 }}>
                  {t('applications.cantApplyOwn', "You can't apply to your own kingdom. Browse other kingdoms to find a new home.")}
                </p>
              </div>
            )}

            {!isOwnKingdom && slotsRemaining <= 0 && (
              <div style={{
                padding: '0.75rem',
                backgroundColor: `${colors.error}10`,
                border: `1px solid ${colors.error}30`,
                borderRadius: '8px',
                marginBottom: '1rem',
              }}>
                <p style={{ color: colors.error, fontSize: '0.8rem', margin: 0 }}>
                  {t('applications.allSlotsUsed', "You've used all 3 application slots. Withdraw an existing application to apply here.")}
                </p>
              </div>
            )}

            <p style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: '0 0 0.75rem 0' }}>
              {t('applications.profileShared', "Your transfer profile will be shared with Kingdom {{kingdom}}'s recruiters. Applications expire after 72 hours if not responded to.", { kingdom: kingdomNumber })}
            </p>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: '0.75rem', marginBottom: '0.3rem', fontWeight: '500' }}>
                {t('applications.addNote', 'Add a note to the recruiter')} <span style={{ color: '#6b7280', fontWeight: '400' }}>({t('applications.optional', 'optional')}, 300 {t('applications.chars', 'chars')})</span>
              </label>
              <textarea
                value={applicantNote}
                onChange={(e) => setApplicantNote(e.target.value.slice(0, 300))}
                placeholder="Why are you interested in this kingdom? What do you bring?"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.text,
                  fontSize: '0.8rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.6rem', color: applicantNote.length > 280 ? '#f59e0b' : '#4b5563', marginTop: '0.15rem' }}>
                {applicantNote.length}/300
              </div>
            </div>
          </>
        )}

        {error && (
          <div style={{
            padding: '0.6rem 0.75rem',
            backgroundColor: `${colors.error}15`,
            border: `1px solid ${colors.error}40`,
            borderRadius: '8px',
            color: colors.error,
            fontSize: '0.8rem',
            marginBottom: '0.75rem',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.textSecondary,
              fontSize: '0.8rem',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            {t('editor.cancel', 'Cancel')}
          </button>
          {canApply && (
            <button
              onClick={handleApply}
              disabled={submitting}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: submitting ? `${colors.primary}50` : colors.primary,
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
                minHeight: '44px',
              }}
            >
              {submitting ? t('applications.applying', 'Applying...') : t('applications.confirmApplication', 'Confirm Application')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================
// MY APPLICATIONS TRACKER
// =============================================

interface ReceivedInvite {
  id: string;
  kingdom_number: number;
  status: string;
  sent_at: string;
  expires_at: string;
}

const MyApplicationsTracker: React.FC<{
  onWithdraw: () => void;
}> = ({ onWithdraw }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [applications, setApplications] = useState<TransferApplication[]>([]);
  const [invites, setInvites] = useState<ReceivedInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  const [recruiterContacts, setRecruiterContacts] = useState<Map<number, string[]>>(new Map());

  useEffect(() => {
    loadApplications();
    loadInvites();
  }, [user]);

  // Fetch recruiter contacts for accepted applications
  useEffect(() => {
    const fetchRecruiterContacts = async () => {
      if (!supabase) return;
      const acceptedKingdoms = applications.filter(a => a.status === 'accepted').map(a => a.kingdom_number);
      if (acceptedKingdoms.length === 0) return;
      const uniqueKingdoms = [...new Set(acceptedKingdoms)];
      const { data: editors } = await supabase
        .from('kingdom_editors')
        .select('kingdom_number, user_id')
        .in('kingdom_number', uniqueKingdoms)
        .eq('status', 'active');
      if (!editors || editors.length === 0) return;
      const editorUserIds = [...new Set(editors.map((e: { user_id: string }) => e.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, discord_username, display_name, username')
        .in('id', editorUserIds);
      if (!profiles) return;
      const profileMap = new Map(profiles.map((p: { id: string; discord_username: string | null; display_name: string | null; username: string | null }) => [p.id, p.discord_username || p.display_name || p.username || 'Unknown']));
      const contactMap = new Map<number, string[]>();
      editors.forEach((e: { kingdom_number: number; user_id: string }) => {
        const name = profileMap.get(e.user_id);
        if (!name) return;
        const existing = contactMap.get(e.kingdom_number) || [];
        if (!existing.includes(name)) existing.push(name);
        contactMap.set(e.kingdom_number, existing);
      });
      setRecruiterContacts(contactMap);
    };
    fetchRecruiterContacts();
  }, [applications]);

  const loadApplications = async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('transfer_applications')
        .select('*')
        .eq('applicant_user_id', user.id)
        .order('applied_at', { ascending: false });

      if (!error) setApplications(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const loadInvites = async () => {
    if (!supabase || !user) return;
    try {
      // Get user's transfer profile ID
      const { data: tp } = await supabase
        .from('transfer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!tp) return;

      const { data } = await supabase
        .from('transfer_invites')
        .select('id, kingdom_number, status, sent_at, expires_at')
        .eq('recipient_profile_id', tp.id)
        .order('sent_at', { ascending: false });
      setInvites(data || []);
    } catch {
      // silent
    }
  };

  const handleRespondInvite = async (inviteId: string, response: 'accepted' | 'declined') => {
    if (!supabase) return;
    setRespondingInviteId(inviteId);
    try {
      const { error } = await supabase
        .from('transfer_invites')
        .update({ status: response, responded_at: new Date().toISOString() })
        .eq('id', inviteId);
      if (!error) {
        setInvites(prev => prev.map(inv => inv.id === inviteId ? { ...inv, status: response } : inv));
      }
    } catch {
      // silent
    } finally {
      setRespondingInviteId(null);
    }
  };

  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);

  const handleWithdraw = async (applicationId: string) => {
    if (!supabase) return;
    setConfirmWithdrawId(null);
    setWithdrawingId(applicationId);
    try {
      const { error } = await supabase
        .from('transfer_applications')
        .update({ status: 'withdrawn' })
        .eq('id', applicationId);

      if (!error) {
        setApplications((prev) =>
          prev.map((a) => a.id === applicationId ? { ...a, status: 'withdrawn' } : a)
        );
        onWithdraw();
      }
    } catch {
      // silent
    } finally {
      setWithdrawingId(null);
    }
  };

  const now = Date.now();

  // Client-side expiry: treat apps past expires_at as expired immediately
  const appsWithClientExpiry = applications.map((a) => {
    if (['pending', 'viewed', 'interested'].includes(a.status) && a.expires_at && new Date(a.expires_at).getTime() <= now) {
      return { ...a, status: 'expired' as typeof a.status };
    }
    return a;
  });
  const activeApplications = appsWithClientExpiry.filter((a) =>
    ['pending', 'viewed', 'interested', 'accepted'].includes(a.status)
  );
  const pastApplications = appsWithClientExpiry.filter((a) =>
    ['declined', 'withdrawn', 'expired'].includes(a.status)
  );
  const pendingInvites = invites.filter(inv => inv.status === 'pending' && new Date(inv.expires_at).getTime() > now);
  const pastInvites = invites.filter(inv => inv.status !== 'pending' || new Date(inv.expires_at).getTime() <= now);

  if (!user) return null;
  if (loading) return <div style={{ color: '#6b7280', fontSize: '0.8rem', padding: '0.5rem 0' }}>{t('applications.loadingApps', 'Loading applications...')}</div>;
  if (applications.length === 0 && invites.length === 0) return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #2a2a2a',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem', opacity: 0.5 }}>📋</div>
      <p style={{ color: '#9ca3af', fontSize: '0.82rem', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
        {t('applications.noAppsYet', 'No applications yet')}
      </p>
      <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>
        {t('applications.browseKingdoms', 'Browse kingdoms below and hit Apply when you find the right fit.')}
      </p>
    </div>
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDaysRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #2a2a2a',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1rem',
    }}>
      {/* My Invites Section */}
      {invites.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '0.5rem',
          }}>
            <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>
              📩 {t('applications.myInvites', 'My Invites')}
            </h3>
            {pendingInvites.length > 0 && (
              <span style={{
                padding: '0.15rem 0.5rem',
                backgroundColor: '#a855f715',
                border: '1px solid #a855f730',
                borderRadius: '6px',
                fontSize: '0.7rem',
                color: '#a855f7',
                fontWeight: 'bold',
              }}>
                {pendingInvites.length} {t('applications.pendingLabel', 'pending')}
              </span>
            )}
          </div>

          {pendingInvites.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {pendingInvites.map((inv) => {
                const daysLeft = getDaysRemaining(inv.expires_at);
                return (
                  <div key={inv.id} style={{
                    display: 'flex',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    justifyContent: 'space-between',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    backgroundColor: '#0a0a0a',
                    borderRadius: '8px',
                    border: '1px solid #a855f725',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                      <Link
                        to={`/kingdom/${inv.kingdom_number}`}
                        style={{ color: '#a855f7', textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}
                      >
                        {t('editor.kingdom', 'Kingdom')} {inv.kingdom_number}
                      </Link>
                      <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
                        {formatDate(inv.sent_at)}
                      </span>
                      {daysLeft <= 3 && daysLeft > 0 && (
                        <span style={{ color: '#f59e0b', fontSize: '0.6rem' }}>{daysLeft}{t('applications.dLeft', 'd left')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => handleRespondInvite(inv.id, 'accepted')}
                        disabled={respondingInviteId === inv.id}
                        style={{
                          padding: '0.3rem 0.6rem',
                          backgroundColor: '#22c55e15',
                          border: '1px solid #22c55e30',
                          borderRadius: '6px',
                          color: '#22c55e',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          cursor: respondingInviteId === inv.id ? 'not-allowed' : 'pointer',
                          minHeight: '36px',
                        }}
                      >
                        {t('recruiter.accept', 'Accept')}
                      </button>
                      <button
                        onClick={() => handleRespondInvite(inv.id, 'declined')}
                        disabled={respondingInviteId === inv.id}
                        style={{
                          padding: '0.3rem 0.6rem',
                          backgroundColor: 'transparent',
                          border: '1px solid #ef444430',
                          borderRadius: '6px',
                          color: '#ef4444',
                          fontSize: '0.7rem',
                          cursor: respondingInviteId === inv.id ? 'not-allowed' : 'pointer',
                          minHeight: '36px',
                        }}
                      >
                        {t('recruiter.decline', 'Decline')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pastInvites.length > 0 && (
            <details style={{ marginBottom: applications.length > 0 ? '0.75rem' : 0 }}>
              <summary style={{
                color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer',
                padding: '0.35rem 0', listStyle: 'none',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
                {t('applications.pastInvites', 'Past invites')} ({pastInvites.length})
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                {pastInvites.slice(0, 10).map((inv) => {
                  const invStatus = inv.status === 'accepted' ? { text: '#22c55e', label: 'Accepted' }
                    : inv.status === 'declined' ? { text: '#ef4444', label: 'Declined' }
                    : inv.status === 'expired' ? { text: '#4b5563', label: 'Expired' }
                    : { text: '#6b7280', label: inv.status };
                  return (
                    <div key={inv.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4rem 0.75rem', backgroundColor: '#0a0a0a',
                      borderRadius: '6px', opacity: 0.6,
                    }}>
                      <Link to={`/kingdom/${inv.kingdom_number}`}
                        style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}>
                        {t('editor.kingdom', 'Kingdom')} {inv.kingdom_number}
                      </Link>
                      <span style={{
                        padding: '0.1rem 0.35rem', borderRadius: '4px',
                        fontSize: '0.55rem', color: invStatus.text, fontWeight: 'bold',
                        textTransform: 'uppercase',
                      }}>
                        {invStatus.label}
                      </span>
                      <span style={{ color: '#4b5563', fontSize: '0.6rem', marginLeft: 'auto' }}>
                        {formatDate(inv.sent_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {applications.length > 0 && (
            <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '0.5rem 0' }} />
          )}
        </>
      )}

      {/* My Applications Section */}
      {applications.length > 0 && (
        <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.75rem',
      }}>
        <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>
          {t('applications.myApplications', 'My Applications')}
        </h3>
        <span style={{
          padding: '0.15rem 0.5rem',
          backgroundColor: '#22d3ee15',
          border: '1px solid #22d3ee30',
          borderRadius: '6px',
          fontSize: '0.7rem',
          color: '#22d3ee',
          fontWeight: 'bold',
        }}>
          {activeApplications.length}/{MAX_ACTIVE_APPLICATIONS} {t('applications.slotsUsed', 'slots used')}
        </span>
      </div>

      {/* Active Applications */}
      {activeApplications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: pastApplications.length > 0 ? '0.75rem' : 0 }}>
          {activeApplications.map((app) => {
            const statusStyle = STATUS_COLORS[app.status] || DEFAULT_STATUS_STYLE;
            const daysLeft = getDaysRemaining(app.expires_at);
            return (
              <div key={app.id} style={{
                display: 'flex',
                alignItems: (isMobile || app.status === 'accepted') ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                flexDirection: (isMobile || app.status === 'accepted') ? 'column' : 'row',
                gap: '0.5rem',
                padding: '0.6rem 0.75rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '8px',
                border: `1px solid ${statusStyle.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                  <Link
                    to={`/kingdom/${app.kingdom_number}`}
                    style={{
                      color: '#fff',
                      textDecoration: 'none',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('editor.kingdom', 'Kingdom')} {app.kingdom_number}
                  </Link>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: statusStyle.bg,
                    border: `1px solid ${statusStyle.border}`,
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: statusStyle.text,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  }}>
                    {statusStyle.label}
                  </span>
                  <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
                    {formatDate(app.applied_at)}
                  </span>
                  {daysLeft <= 3 && daysLeft > 0 && (
                    <span style={{ color: '#f59e0b', fontSize: '0.6rem' }}>
                      {daysLeft}{t('applications.dLeft', 'd left')}
                    </span>
                  )}
                </div>
                {app.status !== 'accepted' && (
                  confirmWithdrawId === app.id ? (
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <span style={{ color: '#ef4444', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{t('applications.areYouSure', 'Are you sure?')}</span>
                      <button
                        onClick={() => handleWithdraw(app.id)}
                        disabled={withdrawingId === app.id}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#ef444415',
                          border: '1px solid #ef444440',
                          borderRadius: '6px',
                          color: '#ef4444',
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          minHeight: '36px',
                          fontWeight: '600',
                        }}
                      >
                        {withdrawingId === app.id ? '...' : t('applications.yes', 'Yes')}
                      </button>
                      <button
                        onClick={() => setConfirmWithdrawId(null)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: 'transparent',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#6b7280',
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          minHeight: '36px',
                        }}
                      >
                        {t('applications.no', 'No')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmWithdrawId(app.id)}
                      disabled={withdrawingId === app.id}
                      style={{
                        padding: '0.3rem 0.6rem',
                        backgroundColor: 'transparent',
                        border: '1px solid #ef444430',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '0.7rem',
                        cursor: withdrawingId === app.id ? 'not-allowed' : 'pointer',
                        minHeight: '44px',
                        opacity: withdrawingId === app.id ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {t('applications.withdraw', 'Withdraw')}
                    </button>
                  )
                )}
                {app.status === 'accepted' && (
                  <div style={{
                    width: '100%',
                    marginTop: '0.4rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#22c55e08',
                    border: '1px solid #22c55e20',
                    borderRadius: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.75rem' }}>🎉</span>
                      <span style={{ color: '#22c55e', fontSize: '0.72rem', fontWeight: '600' }}>{t('applications.nextSteps', 'Next Steps')}</span>
                    </div>
                    {recruiterContacts.has(app.kingdom_number) ? (
                      <p style={{ color: '#d1d5db', fontSize: '0.72rem', margin: 0, lineHeight: 1.5 }}>
                        Reach out to the recruiter{recruiterContacts.get(app.kingdom_number)!.length > 1 ? 's' : ''}:{' '}
                        {recruiterContacts.get(app.kingdom_number)!.map((name, i) => (
                          <span key={i}>
                            {i > 0 && ', '}
                            <strong style={{ color: '#22d3ee' }}>{name}</strong>
                          </span>
                        ))}
                        {' '}{t('applications.toCoordinate', 'to coordinate your transfer.')}
                      </p>
                    ) : (
                      <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0, lineHeight: 1.5 }}>
                        {t('applications.visitThe', 'Visit the')}{' '}
                        <Link to={`/kingdom/${app.kingdom_number}`} style={{ color: '#22d3ee', textDecoration: 'none' }}>
                          {t('applications.kingdomPage', 'kingdom page')}
                        </Link>
                        {' '}{t('applications.toFindContact', 'to find recruiter contact info and coordinate your transfer.')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Past Applications (collapsed by default) */}
      {pastApplications.length > 0 && (
        <details style={{ marginTop: activeApplications.length > 0 ? '0.5rem' : 0 }}>
          <summary style={{
            color: '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer',
            padding: '0.35rem 0',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
            {t('applications.pastApplications', 'Past applications')} ({pastApplications.length})
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
            {pastApplications.slice(0, 10).map((app) => {
              const statusStyle = STATUS_COLORS[app.status] || DEFAULT_STATUS_STYLE;
              return (
                <div key={app.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.75rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '6px',
                  opacity: 0.6,
                }}>
                  <Link
                    to={`/kingdom/${app.kingdom_number}`}
                    style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}
                  >
                    {t('editor.kingdom', 'Kingdom')} {app.kingdom_number}
                  </Link>
                  <span style={{
                    padding: '0.1rem 0.35rem',
                    backgroundColor: statusStyle.bg,
                    borderRadius: '4px',
                    fontSize: '0.55rem',
                    color: statusStyle.text,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  }}>
                    {statusStyle.label}
                  </span>
                  <span style={{ color: '#4b5563', fontSize: '0.6rem', marginLeft: 'auto' }}>
                    {formatDate(app.applied_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
        </>
      )}
    </div>
  );
};

export { ApplyModal, MyApplicationsTracker, MAX_ACTIVE_APPLICATIONS };
export type { TransferApplication };
