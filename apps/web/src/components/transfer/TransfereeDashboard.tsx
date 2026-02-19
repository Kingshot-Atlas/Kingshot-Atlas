import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import RateKingdomModal from './RateKingdomModal';
import TransfereeAppCard from './TransfereeAppCard';

// ─── Types ────────────────────────────────────────────────────
interface TransferApplication {
  id: string;
  kingdom_number: number;
  status: string;
  applied_at: string;
  expires_at: string;
  applicant_note: string | null;
}

interface ReceivedInvite {
  id: string;
  kingdom_number: number;
  status: string;
  sent_at: string;
  expires_at: string;
}

interface ProfileStats {
  profileViewCount: number;
  profileCompleteness: number;
  missingFields: string[];
  isVisible: boolean;
}

type DashTab = 'overview' | 'applications' | 'invites';

// ─── Component ────────────────────────────────────────────────
const TransfereeDashboard: React.FC<{
  onEditProfile: (scrollToIncomplete: boolean) => void;
  onWithdraw: () => void;
}> = ({ onEditProfile, onWithdraw }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<DashTab>('overview');
  const [applications, setApplications] = useState<TransferApplication[]>([]);
  const [invites, setInvites] = useState<ReceivedInvite[]>([]);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    profileViewCount: 0,
    profileCompleteness: 0,
    missingFields: [],
    isVisible: false,
  });
  const [loading, setLoading] = useState(true);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [ratingApp, setRatingApp] = useState<{ id: string; kingdom: number } | null>(null);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [expiringItems, setExpiringItems] = useState<Array<{ record_type: string; record_id: string; kingdom_number: number; hours_remaining: number }>>([]);
  const [submittedOutcomes, setSubmittedOutcomes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAll = async () => {
    if (!supabase || !user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [appsRes, profileRes] = await Promise.all([
        supabase
          .from('transfer_applications')
          .select('id, kingdom_number, status, applied_at, expires_at, applicant_note')
          .eq('applicant_user_id', user.id)
          .order('applied_at', { ascending: false }),
        supabase
          .from('transfer_profiles')
          .select('id, power_million, tc_level, main_language, kvk_availability, saving_for_kvk, looking_for, group_size, player_bio, play_schedule, contact_method, visible_to_recruiters')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      if (appsRes.data) {
        setApplications(appsRes.data);
        // Count unread messages using persistent read tracking
        const activeAppIds = appsRes.data.filter(a => ['pending', 'viewed', 'accepted'].includes(a.status)).map(a => a.id);
        if (activeAppIds.length > 0) {
          const { data: readRows } = await supabase
            .from('message_read_status')
            .select('application_id, last_read_at')
            .eq('user_id', user.id)
            .in('application_id', activeAppIds);
          const readMap = new Map((readRows || []).map((r: { application_id: string; last_read_at: string }) => [r.application_id, r.last_read_at]));
          let total = 0;
          for (const appId of activeAppIds) {
            const lastRead = readMap.get(appId);
            let q = supabase
              .from('application_messages')
              .select('id', { count: 'exact', head: true })
              .eq('application_id', appId)
              .neq('sender_user_id', user.id);
            if (lastRead) q = q.gt('created_at', lastRead);
            const { count } = await q;
            total += count || 0;
          }
          setUnreadMsgCount(total);
        }
      }

      if (profileRes.data) {
        const tp = profileRes.data;
        // Calculate completeness
        const checks = [
          { label: 'Power', done: (tp.power_million || 0) > 0 },
          { label: 'Language', done: !!tp.main_language },
          { label: 'KvK Availability', done: !!tp.kvk_availability },
          { label: 'Saving For', done: !!tp.saving_for_kvk },
          { label: 'Looking For', done: (tp.looking_for || []).length > 0 },
          { label: 'Group Size', done: !!tp.group_size },
          { label: 'Bio', done: !!(tp.player_bio || '').trim() },
          { label: 'Play Schedule', done: (tp.play_schedule || []).length > 0 },
          { label: 'Contact Method', done: !!tp.contact_method },
          { label: 'Visible', done: !!tp.visible_to_recruiters },
        ];
        const pct = Math.round((checks.filter(c => c.done).length / checks.length) * 100);
        const missing = checks.filter(c => !c.done).map(c => c.label);

        // Fetch profile views
        const { data: viewRows } = await supabase
          .from('transfer_profile_views')
          .select('viewer_kingdom_number')
          .eq('transfer_profile_id', tp.id);
        const uniqueKingdoms = new Set((viewRows || []).map((v: { viewer_kingdom_number: number }) => v.viewer_kingdom_number));

        // Fetch invites
        const { data: invData } = await supabase
          .from('transfer_invites')
          .select('id, kingdom_number, status, sent_at, expires_at')
          .eq('recipient_profile_id', tp.id)
          .order('sent_at', { ascending: false });
        if (invData) setInvites(invData);

        setProfileStats({
          profileViewCount: uniqueKingdoms.size,
          profileCompleteness: pct,
          missingFields: missing,
          isVisible: !!tp.visible_to_recruiters,
        });
      }
      // Fetch expiring-soon items
      const { data: expiring } = await supabase.rpc('get_expiring_soon', { p_user_id: user.id });
      if (expiring) setExpiringItems(expiring);

      // Fetch existing outcomes to know which have been submitted
      const { data: outcomes } = await supabase
        .from('transfer_outcomes')
        .select('application_id')
        .eq('confirmed_by', user.id);
      if (outcomes) setSubmittedOutcomes(new Set(outcomes.map((o: { application_id: string }) => o.application_id)));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOutcome = async (applicationId: string, didTransfer: boolean, satisfaction?: number, _feedback?: string) => {
    if (!supabase || !user) return;
    try {
      await supabase.from('transfer_outcomes').upsert({
        application_id: applicationId,
        confirmed_by: user.id,
        confirmed_role: 'transferee',
        did_transfer: didTransfer,
        satisfaction_rating: satisfaction || null,
        feedback: _feedback || null,
      }, { onConflict: 'application_id,confirmed_by' });
      setSubmittedOutcomes(prev => new Set(prev).add(applicationId));
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
        setApplications(prev => prev.map(a => a.id === applicationId ? { ...a, status: 'withdrawn' } : a));
        onWithdraw();
      }
    } finally {
      setWithdrawingId(null);
    }
  };

  const now = Date.now();
  const appsWithExpiry = applications.map(a => {
    if (['pending', 'viewed', 'interested'].includes(a.status) && a.expires_at && new Date(a.expires_at).getTime() <= now) {
      return { ...a, status: 'expired' };
    }
    return a;
  });
  const activeApps = appsWithExpiry.filter(a => ['pending', 'viewed', 'interested', 'accepted'].includes(a.status));
  const pastApps = appsWithExpiry.filter(a => ['declined', 'withdrawn', 'expired'].includes(a.status));
  const pendingInvites = invites.filter(inv => inv.status === 'pending' && new Date(inv.expires_at).getTime() > now);
  const pastInvites = invites.filter(inv => inv.status !== 'pending' || new Date(inv.expires_at).getTime() <= now);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const getDaysLeft = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));

  const defaultSc = { bg: '#eab30815', border: '#eab30830', text: '#eab308', label: 'Pending' };
  const statusColor: Record<string, { bg: string; border: string; text: string; label: string }> = {
    pending: { bg: '#eab30815', border: '#eab30830', text: '#eab308', label: 'Pending' },
    viewed: { bg: '#3b82f615', border: '#3b82f630', text: '#3b82f6', label: 'Viewed' },
    interested: { bg: '#a855f715', border: '#a855f730', text: '#a855f7', label: 'Interested' },
    accepted: { bg: '#22c55e15', border: '#22c55e30', text: '#22c55e', label: 'Accepted' },
    declined: { bg: '#ef444415', border: '#ef444430', text: '#ef4444', label: 'Declined' },
    withdrawn: { bg: '#9ca3af15', border: '#9ca3af30', text: '#9ca3af', label: 'Withdrawn' },
    expired: { bg: '#6b728015', border: '#6b728030', text: '#6b7280', label: 'Expired' },
  };

  if (!user) return null;
  if (loading) return (
    <div style={{ color: colors.textSecondary, fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>
      {t('transfereeDash.loading', 'Loading your dashboard...')}
    </div>
  );

  const barColor = profileStats.profileCompleteness >= 80 ? '#22c55e' : profileStats.profileCompleteness >= 50 ? '#fbbf24' : '#22d3ee';

  const tabs: Array<{ key: DashTab; label: string; icon: string; count?: number; badge?: number }> = [
    { key: 'overview', label: t('transfereeDash.overview', 'Overview'), icon: '📊' },
    { key: 'applications', label: t('transfereeDash.applications', 'Applications'), icon: '📋', count: activeApps.length, badge: unreadMsgCount },
    { key: 'invites', label: t('transfereeDash.invites', 'Invites'), icon: '📩', count: pendingInvites.length },
  ];

  return (
    <div style={{
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: isMobile ? '0.75rem' : '1rem',
      marginBottom: '1rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1rem' }}>🚀</span>
        <h3 style={{ color: colors.text, fontSize: '0.95rem', fontWeight: '700', margin: 0 }}>
          {t('transfereeDash.title', 'My Transfer Dashboard')}
        </h3>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        backgroundColor: colors.bg,
        borderRadius: '8px',
        padding: '0.2rem',
        marginBottom: '0.75rem',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              padding: '0.4rem 0.5rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: activeTab === tab.key ? '600' : '400',
              backgroundColor: activeTab === tab.key ? `${colors.primary}15` : 'transparent',
              color: activeTab === tab.key ? colors.primary : colors.textSecondary,
              transition: 'all 0.15s',
              minHeight: '36px',
              position: 'relative',
            }}
          >
            <span>{tab.icon}</span>
            {!isMobile && tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                padding: '0 0.3rem',
                backgroundColor: activeTab === tab.key ? colors.primary : '#ef4444',
                color: activeTab === tab.key ? '#000' : '#fff',
                borderRadius: '8px',
                fontSize: '0.55rem',
                fontWeight: '700',
                minWidth: '14px',
                textAlign: 'center',
              }}>
                {tab.count}
              </span>
            )}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.5rem',
                fontWeight: 'bold',
                marginLeft: '0.15rem',
              }}>
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Overview Tab ─────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Expiry Warning Banner */}
          {expiringItems.length > 0 && (
            <div style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: '#f59e0b12',
              border: '1px solid #f59e0b30',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '1rem' }}>⏰</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: '600' }}>
                  {t('transfereeDash.expiringWarning', `${expiringItems.length} item${expiringItems.length > 1 ? 's' : ''} expiring within 24 hours`)}
                </div>
                <div style={{ color: colors.textMuted, fontSize: '0.6rem', marginTop: '0.15rem' }}>
                  {expiringItems.map(item => (
                    <span key={item.record_id} style={{ marginRight: '0.5rem' }}>
                      {item.record_type === 'application' ? '📋' : '📩'} K{item.kingdom_number} ({Math.round(item.hours_remaining)}h left)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: '0.5rem',
          }}>
            <StatCard icon="👀" label={t('transfereeDash.profileViews', 'Profile Views')} value={profileStats.profileViewCount} color="#a855f7" />
            <StatCard icon="📋" label={t('transfereeDash.activeApps', 'Active Apps')} value={activeApps.length} color="#22d3ee" />
            <StatCard icon="📩" label={t('transfereeDash.pendingInvites', 'Pending Invites')} value={pendingInvites.length} color="#f59e0b" />
            <StatCard icon="✅" label={t('transfereeDash.accepted', 'Accepted')} value={appsWithExpiry.filter(a => a.status === 'accepted').length} color="#22c55e" />
          </div>

          {/* Profile Completeness */}
          <div style={{
            padding: '0.6rem 0.75rem',
            backgroundColor: colors.bg,
            borderRadius: '8px',
            border: `1px solid ${barColor}20`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ color: colors.text, fontSize: '0.75rem', fontWeight: '600' }}>
                {t('transfereeDash.profileCompleteness', 'Profile Completeness')}
              </span>
              <span style={{ color: barColor, fontSize: '0.75rem', fontWeight: '700' }}>
                {profileStats.profileCompleteness}%
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', backgroundColor: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${profileStats.profileCompleteness}%`, height: '100%', backgroundColor: barColor, borderRadius: '2px', transition: 'width 0.3s' }} />
            </div>
            {profileStats.missingFields.length > 0 && (
              <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                {profileStats.missingFields.map(f => (
                  <span key={f} style={{
                    padding: '0.1rem 0.35rem',
                    backgroundColor: '#ffffff06',
                    border: '1px solid #ffffff12',
                    borderRadius: '4px',
                    fontSize: '0.55rem',
                    color: '#9ca3af',
                  }}>
                    {f}
                  </span>
                ))}
              </div>
            )}
            {profileStats.profileCompleteness < 100 && (
              <button
                onClick={() => onEditProfile(true)}
                style={{
                  marginTop: '0.4rem',
                  padding: '0.3rem 0.6rem',
                  backgroundColor: `${barColor}15`,
                  border: `1px solid ${barColor}30`,
                  borderRadius: '6px',
                  color: barColor,
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minHeight: '32px',
                }}
              >
                {t('transfereeDash.completeProfile', 'Complete Profile →')}
              </button>
            )}
          </div>

          {/* Visibility Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            backgroundColor: profileStats.isVisible ? '#22c55e08' : '#ef444408',
            border: `1px solid ${profileStats.isVisible ? '#22c55e20' : '#ef444420'}`,
            borderRadius: '8px',
          }}>
            <span style={{ fontSize: '0.7rem' }}>{profileStats.isVisible ? '🟢' : '🔴'}</span>
            <span style={{ color: profileStats.isVisible ? '#22c55e' : '#ef4444', fontSize: '0.72rem', fontWeight: '500' }}>
              {profileStats.isVisible
                ? t('transfereeDash.visibleToRecruiters', 'Visible to Recruiters')
                : t('transfereeDash.hiddenFromRecruiters', 'Hidden from Recruiters')}
            </span>
          </div>
        </div>
      )}

      {/* ─── Applications Tab ─────────────────────────────── */}
      {activeTab === 'applications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activeApps.length === 0 && pastApps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1rem', color: colors.textSecondary, fontSize: '0.8rem' }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem', opacity: 0.5 }}>📋</div>
              {t('transfereeDash.noApps', 'No applications yet. Browse kingdoms below and apply!')}
            </div>
          )}
          {activeApps.map(app => (
            <TransfereeAppCard
              key={app.id}
              app={app}
              statusColor={statusColor[app.status] || defaultSc}
              outcomeSubmitted={submittedOutcomes.has(app.id)}
              onSubmitOutcome={handleSubmitOutcome}
              onWithdraw={handleWithdraw}
              withdrawingId={withdrawingId}
              onRate={(id, kingdom) => setRatingApp({ id, kingdom })}
            />
          ))}
          {pastApps.length > 0 && (
            <details>
              <summary style={{ color: colors.textSecondary, fontSize: '0.72rem', cursor: 'pointer', padding: '0.3rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                {t('transfereeDash.pastApps', 'Past applications')} ({pastApps.length})
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
                {pastApps.slice(0, 10).map(app => {
                  const sc = statusColor[app.status] || defaultSc;
                  return (
                    <div key={app.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.6rem', backgroundColor: colors.bg, borderRadius: '6px', opacity: 0.6 }}>
                      <Link to={`/kingdom/${app.kingdom_number}`} style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.78rem' }}>Kingdom {app.kingdom_number}</Link>
                      <span style={{ padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.55rem', color: sc.text, fontWeight: 'bold', textTransform: 'uppercase' }}>{sc.label}</span>
                      <span style={{ color: '#4b5563', fontSize: '0.6rem', marginLeft: 'auto' }}>{formatDate(app.applied_at)}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ─── Invites Tab ──────────────────────────────────── */}
      {activeTab === 'invites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {invites.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1rem', color: colors.textSecondary, fontSize: '0.8rem' }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem', opacity: 0.5 }}>📩</div>
              {t('transfereeDash.noInvites', 'No invites yet. Make sure your profile is complete and visible!')}
            </div>
          )}
          {pendingInvites.map(inv => {
            const daysLeft = getDaysLeft(inv.expires_at);
            return (
              <div key={inv.id} style={{
                display: 'flex',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '0.5rem',
                padding: '0.6rem 0.75rem',
                backgroundColor: colors.bg,
                borderRadius: '8px',
                border: '1px solid #a855f725',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <Link to={`/kingdom/${inv.kingdom_number}`} style={{ color: '#a855f7', textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}>
                    Kingdom {inv.kingdom_number}
                  </Link>
                  <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>{formatDate(inv.sent_at)}</span>
                  {daysLeft <= 3 && daysLeft > 0 && (
                    <span style={{ color: '#f59e0b', fontSize: '0.6rem' }}>{daysLeft}d left</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    onClick={() => handleRespondInvite(inv.id, 'accepted')}
                    disabled={respondingInviteId === inv.id}
                    style={{ padding: '0.3rem 0.6rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '6px', color: '#22c55e', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', minHeight: '36px' }}
                  >
                    {t('transfereeDash.accept', 'Accept')}
                  </button>
                  <button
                    onClick={() => handleRespondInvite(inv.id, 'declined')}
                    disabled={respondingInviteId === inv.id}
                    style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: '1px solid #ef444430', borderRadius: '6px', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer', minHeight: '36px' }}
                  >
                    {t('transfereeDash.decline', 'Decline')}
                  </button>
                </div>
              </div>
            );
          })}
          {pastInvites.length > 0 && (
            <details>
              <summary style={{ color: colors.textSecondary, fontSize: '0.72rem', cursor: 'pointer', padding: '0.3rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                {t('transfereeDash.pastInvites', 'Past invites')} ({pastInvites.length})
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
                {pastInvites.slice(0, 10).map(inv => {
                  const invSc = inv.status === 'accepted' ? { text: '#22c55e', label: 'Accepted' }
                    : inv.status === 'declined' ? { text: '#ef4444', label: 'Declined' }
                    : { text: '#6b7280', label: 'Expired' };
                  return (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.6rem', backgroundColor: colors.bg, borderRadius: '6px', opacity: 0.6 }}>
                      <Link to={`/kingdom/${inv.kingdom_number}`} style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.78rem' }}>Kingdom {inv.kingdom_number}</Link>
                      <span style={{ fontSize: '0.55rem', color: invSc.text, fontWeight: 'bold', textTransform: 'uppercase' }}>{invSc.label}</span>
                      <span style={{ color: '#4b5563', fontSize: '0.6rem', marginLeft: 'auto' }}>{formatDate(inv.sent_at)}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
      {/* Rating Modal */}
      {ratingApp && (
        <RateKingdomModal
          kingdomNumber={ratingApp.kingdom}
          applicationId={ratingApp.id}
          onClose={() => setRatingApp(null)}
          onRated={() => setRatingApp(null)}
        />
      )}
    </div>
  );
};

// ─── Stat Card Helper ─────────────────────────────────────────
const StatCard: React.FC<{ icon: string; label: string; value: number; color: string }> = ({ icon, label, value, color }) => (
  <div style={{
    padding: '0.5rem 0.6rem',
    backgroundColor: `${color}08`,
    border: `1px solid ${color}20`,
    borderRadius: '8px',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: '0.85rem', marginBottom: '0.15rem' }}>{icon}</div>
    <div style={{ color, fontSize: '1.1rem', fontWeight: '800' }}>{value}</div>
    <div style={{ color: '#6b7280', fontSize: '0.6rem', fontWeight: '500' }}>{label}</div>
  </div>
);

export default TransfereeDashboard;
