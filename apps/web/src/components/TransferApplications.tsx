import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        .single();

      if (profileError || !profile) {
        setError('You need a transfer profile before applying. Create one first.');
        return;
      }

      // Submit application (DB trigger enforces 3-slot limit)
      const { error: insertError } = await supabase
        .from('transfer_applications')
        .insert({
          transfer_profile_id: profile.id,
          applicant_user_id: user.id,
          kingdom_number: kingdomNumber,
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
          Apply to <span style={{ ...neonGlow(colors.primary) }}>Kingdom {kingdomNumber}</span>
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
              Transfer Profile Required
            </p>
            <p style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: 0 }}>
              You need to create a transfer profile before you can apply to kingdoms. Your profile tells recruiters about you.
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
                <span style={{ color: colors.textSecondary, fontSize: '0.8rem' }}>Application Slots</span>
                <span style={{
                  color: slotsRemaining > 0 ? colors.success : colors.error,
                  fontSize: '0.85rem',
                  fontWeight: '600',
                }}>
                  {slotsRemaining}/{MAX_ACTIVE_APPLICATIONS} remaining
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
                  You can't apply to your own kingdom. Browse other kingdoms to find a new home.
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
                  You've used all 3 application slots. Withdraw an existing application to apply here.
                </p>
              </div>
            )}

            <p style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: '0 0 0.75rem 0' }}>
              Your transfer profile will be shared with Kingdom {kingdomNumber}'s recruiters. Applications expire after 14 days if not responded to.
            </p>
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
            Cancel
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
              {submitting ? 'Applying...' : 'Confirm Application'}
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
  const [applications, setApplications] = useState<TransferApplication[]>([]);
  const [invites, setInvites] = useState<ReceivedInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
    loadInvites();
  }, [user]);

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

  const handleWithdraw = async (applicationId: string) => {
    if (!supabase) return;
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

  const activeApplications = applications.filter((a) =>
    ['pending', 'viewed', 'interested'].includes(a.status)
  );
  const pastApplications = applications.filter((a) =>
    ['accepted', 'declined', 'withdrawn', 'expired'].includes(a.status)
  );

  const now = Date.now();
  const pendingInvites = invites.filter(inv => inv.status === 'pending' && new Date(inv.expires_at).getTime() > now);
  const pastInvites = invites.filter(inv => inv.status !== 'pending' || new Date(inv.expires_at).getTime() <= now);

  if (!user) return null;
  if (loading) return <div style={{ color: '#6b7280', fontSize: '0.8rem', padding: '0.5rem 0' }}>Loading applications...</div>;
  if (applications.length === 0 && invites.length === 0) return null;

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
              📩 My Invites
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
                {pendingInvites.length} pending
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
                        Kingdom {inv.kingdom_number}
                      </Link>
                      <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
                        {formatDate(inv.sent_at)}
                      </span>
                      {daysLeft <= 3 && daysLeft > 0 && (
                        <span style={{ color: '#f59e0b', fontSize: '0.6rem' }}>{daysLeft}d left</span>
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
                        Accept
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
                        Decline
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
                Past invites ({pastInvites.length})
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
                        Kingdom {inv.kingdom_number}
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
          My Applications
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
          {activeApplications.length}/{MAX_ACTIVE_APPLICATIONS} slots used
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
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                flexDirection: isMobile ? 'column' : 'row',
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
                    Kingdom {app.kingdom_number}
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
                      {daysLeft}d left
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleWithdraw(app.id)}
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
                  {withdrawingId === app.id ? 'Withdrawing...' : 'Withdraw'}
                </button>
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
            Past applications ({pastApplications.length})
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
                    Kingdom {app.kingdom_number}
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
