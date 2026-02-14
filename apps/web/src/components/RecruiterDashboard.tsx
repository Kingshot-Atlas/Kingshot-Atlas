import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { supabase } from '../lib/supabase';
import { FONT_DISPLAY, colors } from '../utils/styles';
import { useToast } from './Toast';
import {
  ApplicationCard,
  BrowseTransfereesTab,
  CoEditorsTab,
  FundTab,
  KingdomProfileTab,
} from './recruiter';
import type { EditorInfo, IncomingApplication, TeamMember, FundInfo } from './recruiter';

// =============================================
// RECRUITER DASHBOARD
// =============================================

const RecruiterDashboard: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();
  const [editorInfo, setEditorInfo] = useState<EditorInfo | null>(null);
  const [applications, setApplications] = useState<IncomingApplication[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [fund, setFund] = useState<FundInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'browse' | 'team' | 'invites' | 'fund' | 'profile'>('inbox');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [usedInvites, setUsedInvites] = useState<number>(0);
  const [pendingInvite, setPendingInvite] = useState<{ id: string; kingdom_number: number; assigned_by: string | null } | null>(null);
  const [listingViews, setListingViews] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('atlas_recruiter_onboarded');
  });

  useEffect(() => {
    loadDashboard();
  }, [user]);

  // Real-time subscription: detect new co-editor requests and team changes instantly
  useEffect(() => {
    if (!supabase || !editorInfo) return;
    const sb = supabase;
    const channel = sb
      .channel(`recruiter-team-${editorInfo.kingdom_number}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kingdom_editors',
        filter: `kingdom_number=eq.${editorInfo.kingdom_number}`,
      }, (payload) => {
        const row = payload.new as { role?: string; status?: string; user_id?: string };
        if (row.role === 'co-editor' && row.status === 'pending' && row.user_id !== user?.id) {
          showToast('New co-editor request received!', 'info');
        }
        loadDashboard(true);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kingdom_editors',
        filter: `kingdom_number=eq.${editorInfo.kingdom_number}`,
      }, () => {
        loadDashboard(true);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transfer_applications',
        filter: `kingdom_number=eq.${editorInfo.kingdom_number}`,
      }, () => {
        showToast('New transfer application received!', 'info');
        loadDashboard(true);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transfer_applications',
        filter: `kingdom_number=eq.${editorInfo.kingdom_number}`,
      }, () => {
        loadDashboard(true);
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [editorInfo?.kingdom_number]);

  const loadDashboard = async (silent = false) => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      // Get editor info
      const { data: editor } = await supabase
        .from('kingdom_editors')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!editor) {
        // Check for pending co-editor invitation or request
        const { data: pending } = await supabase
          .from('kingdom_editors')
          .select('id, kingdom_number, assigned_by')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();
        if (pending) {
          setPendingInvite(pending);
        }
        setLoading(false);
        return;
      }
      setPendingInvite(null);
      setEditorInfo(editor);

      // Get applications for this kingdom
      const { data: apps } = await supabase
        .from('transfer_applications')
        .select('*')
        .eq('kingdom_number', editor.kingdom_number)
        .order('applied_at', { ascending: false });

      if (apps) {
        // Fetch transfer profiles for each application
        const profileIds = [...new Set(apps.map((a: IncomingApplication) => a.transfer_profile_id))];
        const { data: profiles } = await supabase
          .from('transfer_profiles')
          .select('id, user_id, username, current_kingdom, tc_level, power_million, power_range, main_language, kvk_availability, saving_for_kvk, group_size, player_bio, contact_method, contact_discord, contact_coordinates, contact_info, looking_for, is_anonymous, last_active_at')
          .in('id', profileIds);

        // Fetch linked_player_id from profiles for all applicant users
        const applicantUserIds = [...new Set(apps.map((a: IncomingApplication) => a.applicant_user_id))];
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, linked_player_id')
          .in('id', applicantUserIds);
        const playerIdMap = new Map<string, string>(
          userProfiles?.map((p: { id: string; linked_player_id: string }) => [p.id, p.linked_player_id]) || []
        );

        const profileMap = new Map<string, IncomingApplication['profile']>(
          profiles?.map((p: Record<string, unknown>) => [p.id as string, { ...p, linked_player_id: playerIdMap.get(p.user_id as string) || undefined } as unknown as IncomingApplication['profile']]) || []
        );
        const enriched: IncomingApplication[] = apps.map((a: IncomingApplication) => ({
          ...a,
          profile: profileMap.get(a.transfer_profile_id) || undefined,
        }));
        setApplications(enriched);
      }

      // Get team members
      const { data: teamData } = await supabase
        .from('kingdom_editors')
        .select('id, user_id, role, status, last_active_at, assigned_by')
        .eq('kingdom_number', editor.kingdom_number);

      if (teamData) {
        // Fetch usernames
        const userIds = teamData.map((t: TeamMember) => t.user_id);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, linked_username')
          .in('id', userIds);

        const userMap = new Map(profileData?.map((p: { id: string; username: string; linked_username: string }) => [p.id, p]) || []);
        setTeam(teamData.map((t: TeamMember) => ({
          ...t,
          username: userMap.get(t.user_id)?.username,
          linked_username: userMap.get(t.user_id)?.linked_username,
        })));
      }

      // Get fund info
      const { data: fundData } = await supabase
        .from('kingdom_funds')
        .select('kingdom_number, balance, tier, is_recruiting, recruitment_pitch, what_we_offer, what_we_want, min_tc_level, min_power_range, min_power_million, main_language, secondary_languages, event_times, contact_link, recruitment_tags, highlighted_stats, kingdom_vibe, nap_policy, sanctuary_distribution, castle_rotation, alliance_events')
        .eq('kingdom_number', editor.kingdom_number)
        .maybeSingle();

      if (fundData) setFund(fundData);

      // Get used invites count
      const { data: usedData } = await supabase
        .rpc('get_used_invites', { p_kingdom_number: editor.kingdom_number });
      if (usedData != null) setUsedInvites(usedData);

      // Get listing views (last 30 days) for analytics
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: viewCount } = await supabase
        .from('transfer_profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('viewer_kingdom_number', editor.kingdom_number)
        .gte('viewed_at', thirtyDaysAgo);
      setListingViews(viewCount || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const getInviteBudget = () => {
    if (!editorInfo || !fund) return { total: 35, used: usedInvites, bonus: 0 };
    // Determine kingdom status from kingdoms data — approximate from editor context
    // Leading kingdoms = 20 base, Ordinary = 35 base
    // Gold tier bonus: +5
    const base = 35; // Default to ordinary — transfer status check would need kingdoms table
    const bonus = fund.tier === 'gold' ? 5 : 0;
    return { total: base + bonus, used: usedInvites, bonus };
  };

  const handleStatusChange = async (applicationId: string, newStatus: string) => {
    if (!supabase || !user) return;
    setUpdating(applicationId);
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        responded_by: user.id,
      };
      if (newStatus === 'viewed') {
        updateData.viewed_at = new Date().toISOString();
      } else {
        updateData.responded_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('transfer_applications')
        .update(updateData)
        .eq('id', applicationId);

      if (!error) {
        setApplications((prev) =>
          prev.map((a) => a.id === applicationId ? { ...a, status: newStatus as IncomingApplication['status'] } : a)
        );

        // Funnel tracking for accepted applications
        if (newStatus === 'accepted') {
          trackFeature('Transfer Funnel: Application Accepted', { kingdom: editorInfo?.kingdom_number || 0 });
        }

        // Send notification to the applicant for meaningful status changes
        const app = applications.find(a => a.id === applicationId);
        if (app && ['interested', 'accepted', 'declined'].includes(newStatus)) {
          const statusMessages: Record<string, { title: string; message: string }> = {
            interested: { title: 'Kingdom Interested', message: `Kingdom ${editorInfo?.kingdom_number} is interested in your transfer application!` },
            accepted: { title: 'Application Accepted', message: `Your transfer application to Kingdom ${editorInfo?.kingdom_number} has been accepted!` },
            declined: { title: 'Application Declined', message: `Your transfer application to Kingdom ${editorInfo?.kingdom_number} was declined.` },
          };
          const notif = statusMessages[newStatus];
          if (notif) {
            await supabase.from('notifications').insert({
              user_id: app.applicant_user_id,
              type: 'application_status',
              title: notif.title,
              message: notif.message,
              link: '/transfer-hub',
              metadata: { kingdom_number: editorInfo?.kingdom_number, application_id: applicationId, new_status: newStatus },
            });
          }
        }
      }
    } catch {
      // silent
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleRecruiting = async () => {
    if (!supabase || !fund || !editorInfo) return;
    const { error } = await supabase
      .from('kingdom_funds')
      .update({ is_recruiting: !fund.is_recruiting })
      .eq('kingdom_number', editorInfo.kingdom_number);

    if (!error) {
      setFund({ ...fund, is_recruiting: !fund.is_recruiting });
    }
  };

  if (!user) return null;

  const pendingCoEditorRequests = team.filter((t) => t.role === 'co-editor' && t.status === 'pending');
  const activeApps = applications.filter((a) => ['pending', 'viewed', 'interested'].includes(a.status));
  const approvedApps = applications.filter((a) => a.status === 'accepted');
  const closedApps = applications.filter((a) => ['declined', 'withdrawn', 'expired'].includes(a.status));
  const filteredApps = filterStatus === 'active' ? activeApps : filterStatus === 'approved' ? approvedApps : closedApps;
  const pendingCount = applications.filter((a) => a.status === 'pending').length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 1000,
        overflowY: 'auto',
      }}
    >
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: isMobile ? '1rem' : '2rem 1rem',
        minHeight: '100vh',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}>
          <div>
            <h2 style={{
              fontFamily: FONT_DISPLAY,
              fontSize: '1.2rem',
              color: colors.text,
              margin: 0,
            }}>
              Recruiter Dashboard
            </h2>
            {editorInfo && (
              <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
                Kingdom {editorInfo.kingdom_number} • {editorInfo.role === 'editor' ? 'Primary Editor' : 'Co-Editor'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.textSecondary,
              fontSize: '0.8rem',
              cursor: 'pointer',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Close
          </button>
        </div>

        {/* Onboarding Tour for First-Time Recruiters */}
        {showOnboarding && editorInfo && !loading && (
          <div style={{
            backgroundColor: '#22d3ee08',
            border: '1px solid #22d3ee20',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1rem',
            position: 'relative',
          }}>
            <button
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem('atlas_recruiter_onboarded', 'true');
              }}
              style={{
                position: 'absolute', top: '0.5rem', right: '0.5rem',
                background: 'none', border: 'none', color: colors.textMuted,
                cursor: 'pointer', fontSize: '1rem', padding: '0.25rem',
              }}
              aria-label="Dismiss onboarding"
            >
              ✕
            </button>
            <p style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: '700', margin: '0 0 0.6rem 0' }}>
              Getting Started as a Recruiter
            </p>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { step: '1', icon: '👑', title: 'Claim Kingdom', desc: 'You\'re the editor — manage your listing.', done: true },
                { step: '2', icon: '🎨', title: 'Set Vibe & Bio', desc: 'Add kingdom vibe and recruitment pitch.', done: !!(fund?.kingdom_vibe || fund?.recruitment_pitch), action: () => setActiveTab('profile') },
                { step: '3', icon: '💰', title: 'Fund Listing', desc: 'Boost visibility with a contribution.', done: (fund?.balance || 0) > 0, action: () => setActiveTab('fund') },
                { step: '4', icon: '👥', title: 'Invite Co-Editor', desc: 'Optional — add a co-editor to help.', done: team.some(t => t.role === 'co-editor' && (t.status === 'active' || t.status === 'pending')), action: () => setActiveTab('invites') },
                { step: '5', icon: '📩', title: 'Start Recruiting', desc: 'Toggle recruiting on, send invites.', done: fund?.is_recruiting || false },
              ].map((s) => (
                <div key={s.step} onClick={() => !s.done && s.action?.()}  style={{
                  flex: 1, minWidth: isMobile ? 'auto' : '110px',
                  padding: '0.6rem',
                  backgroundColor: s.done ? '#22c55e08' : '#0a0a0a',
                  border: `1px solid ${s.done ? '#22c55e25' : '#1a1a1a'}`,
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: !s.done && s.action ? 'pointer' : 'default',
                }}>
                  <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>
                    {s.done ? '✅' : s.icon}
                  </div>
                  <div style={{ color: s.done ? '#22c55e' : '#fff', fontSize: '0.75rem', fontWeight: '600' }}>
                    {s.title}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.6rem', marginTop: '0.15rem' }}>
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Skeleton stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ width: '40px', height: '1.1rem', backgroundColor: colors.surfaceHover, borderRadius: '4px', margin: '0 auto 0.3rem', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ width: '50px', height: '0.6rem', backgroundColor: colors.surfaceHover, borderRadius: '3px', margin: '0 auto', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
            {/* Skeleton recruiting toggle */}
            <div style={{ height: '50px', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
            {/* Skeleton tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: colors.surface, borderRadius: '10px', padding: '0.25rem' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ flex: 1, height: '32px', backgroundColor: colors.surfaceHover, borderRadius: '8px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
            {/* Skeleton application cards */}
            {[1,2,3].map(i => (
              <div key={i} style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colors.surfaceHover, animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                    <div>
                      <div style={{ width: '100px', height: '0.75rem', backgroundColor: colors.surfaceHover, borderRadius: '3px', marginBottom: '0.3rem', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                      <div style={{ width: '60px', height: '0.6rem', backgroundColor: colors.surfaceHover, borderRadius: '3px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                    </div>
                  </div>
                  <div style={{ width: '60px', height: '24px', backgroundColor: colors.surfaceHover, borderRadius: '6px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[1,2,3].map(j => (
                    <div key={j} style={{ width: '55px', height: '18px', backgroundColor: colors.surfaceHover, borderRadius: '4px', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              </div>
            ))}
            <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
          </div>
        ) : !editorInfo ? (
          <div style={{
            textAlign: 'center', padding: '3rem 1rem',
            backgroundColor: colors.surface, borderRadius: '12px',
            border: `1px solid ${colors.border}`,
          }}>
            {pendingInvite && pendingInvite.assigned_by ? (
              <>
                <p style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.5rem' }}>🎉 {t('recruiter.coEditorInvitation', 'Co-Editor Invitation')}</p>
                <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {t('recruiter.invitedCoEditor', "You've been invited to be a co-editor for Kingdom {{kingdom}}'s recruiter dashboard.", { kingdom: pendingInvite.kingdom_number })}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button
                    onClick={async () => {
                      if (!supabase) return;
                      const { error } = await supabase
                        .from('kingdom_editors')
                        .update({ status: 'active', activated_at: new Date().toISOString() })
                        .eq('id', pendingInvite.id);
                      if (error) {
                        showToast('Failed to accept invitation. Please try again.', 'error');
                        return;
                      }
                      showToast('Invitation accepted! Loading dashboard...', 'success');
                      setPendingInvite(null);
                      loadDashboard();
                    }}
                    style={{
                      padding: '0.5rem 1.25rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e40',
                      borderRadius: '8px', color: '#22c55e', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px',
                    }}
                  >
                    {t('recruiter.accept', 'Accept')}
                  </button>
                  <button
                    onClick={async () => {
                      if (!supabase) return;
                      await supabase
                        .from('kingdom_editors')
                        .update({ status: 'inactive' })
                        .eq('id', pendingInvite.id);
                      setPendingInvite(null);
                      showToast('Invitation declined.', 'success');
                    }}
                    style={{
                      padding: '0.5rem 1.25rem', backgroundColor: '#ef444415', border: '1px solid #ef444440',
                      borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px',
                    }}
                  >
                    {t('recruiter.decline', 'Decline')}
                  </button>
                </div>
              </>
            ) : pendingInvite ? (
              <>
                <p style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.5rem' }}>📨 {t('recruiter.coEditorRequestPending', 'Co-Editor Request Pending')}</p>
                <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
                  {t('recruiter.requestAwaitingApproval', 'Your request to co-edit Kingdom {{kingdom}} is pending editor approval. You\'ll be notified when it\'s reviewed.', { kingdom: pendingInvite.kingdom_number })}
                </p>
              </>
            ) : (
              <>
                <p style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.5rem' }}>{t('recruiter.noActiveRole', 'No Active Editor Role')}</p>
                <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
                  {t('recruiter.needEditorRole', 'You need to be an active editor for a kingdom to access the Recruiter Dashboard. Claim your kingdom first through the Editor Claiming process.')}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              {[
                { label: t('recruiter.pending', 'Pending'), value: pendingCount, color: '#eab308' },
                { label: t('recruiter.invites', 'Invites'), value: `${getInviteBudget().total - getInviteBudget().used}/${getInviteBudget().total}`, color: '#22d3ee' },
                { label: t('recruiter.team', 'Team'), value: team.filter((t) => t.status === 'active').length, color: '#a855f7' },
                { label: t('recruiter.fund', 'Fund'), value: fund ? `$${Number(fund.balance).toFixed(0)}` : '$0', color: '#22c55e' },
              ].map((stat) => (
                <div key={stat.label} style={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  padding: '0.6rem',
                  textAlign: 'center',
                }}>
                  <div style={{ color: stat.color, fontWeight: 'bold', fontSize: '1.1rem' }}>{stat.value}</div>
                  <div style={{ color: colors.textMuted, fontSize: '0.6rem', marginTop: '0.15rem' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Recruiting Toggle */}
            {fund && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: fund.is_recruiting ? '#22c55e08' : '#111111',
                border: `1px solid ${fund.is_recruiting ? '#22c55e25' : '#2a2a2a'}`,
                borderRadius: '10px',
                padding: '0.6rem 0.75rem',
                marginBottom: '1rem',
              }}>
                <div>
                  <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: '600' }}>
                    {fund.is_recruiting ? t('recruiter.activelyRecruiting', 'Actively Recruiting') : t('recruiter.notRecruiting', 'Not Recruiting')}
                  </span>
                  <p style={{ color: colors.textMuted, fontSize: '0.65rem', margin: '0.1rem 0 0 0' }}>
                    {fund.is_recruiting ? t('recruiter.appearsInSearches', 'Your kingdom appears in transfer searches') : t('recruiter.toggleToAppear', 'Toggle on to appear in transfer searches')}
                  </p>
                </div>
                <button
                  onClick={handleToggleRecruiting}
                  style={{
                    width: '44px', height: '24px',
                    borderRadius: '12px',
                    backgroundColor: fund.is_recruiting ? '#22c55e' : '#333',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    position: 'absolute',
                    top: '3px',
                    left: fund.is_recruiting ? '23px' : '3px',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            )}

            {/* Tab Navigation */}
            <div style={{
              display: 'flex', gap: '0.25rem',
              backgroundColor: colors.surface,
              borderRadius: '10px',
              padding: '0.25rem',
              marginBottom: '1rem',
            }}>
              {(['inbox', 'browse', 'profile', 'team', 'invites', 'fund'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    trackFeature('Recruiter Tab Switch', { tab });
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: activeTab === tab ? '#22d3ee15' : 'transparent',
                    border: activeTab === tab ? '1px solid #22d3ee30' : '1px solid transparent',
                    borderRadius: '8px',
                    color: activeTab === tab ? '#22d3ee' : '#6b7280',
                    fontSize: isMobile ? '0.65rem' : '0.75rem',
                    fontWeight: activeTab === tab ? '600' : '400',
                    cursor: 'pointer',
                    position: 'relative',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {tab === 'inbox' ? `${t('recruiter.inbox', 'Inbox')}${pendingCount > 0 ? ` (${pendingCount})` : ''}` :
                   tab === 'browse' ? t('recruiter.browse', 'Browse') :
                   tab === 'profile' ? t('recruiter.profile', 'Profile') :
                   tab === 'team' ? t('recruiter.team', 'Team') :
                   tab === 'invites' ? (<>{t('recruiter.coEditors', 'Co-Editors')}{pendingCoEditorRequests.length > 0 && <span style={{ marginLeft: '0.3rem', backgroundColor: '#eab308', color: '#000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 'bold' }}>{pendingCoEditorRequests.length}</span>}</>) : t('recruiter.fund', 'Fund')}
                </button>
              ))}
            </div>

            {/* TAB: Inbox */}
            {activeTab === 'inbox' && (
              <div>
                {/* Editor Analytics Stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                }}>
                  {[
                    { label: 'Profile Views', value: listingViews, sub: 'last 30 days', color: colors.pink, icon: '👁️' },
                  ].map((stat, i) => (
                    <div key={i} style={{
                      backgroundColor: colors.card,
                      borderRadius: '8px',
                      padding: '0.5rem 0.6rem',
                      border: '1px solid #1a1a1a',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.6rem', color: '#4b5563', marginBottom: '0.15rem' }}>{stat.icon} {stat.label}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: '0.55rem', color: '#374151' }}>{stat.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    onClick={() => setFilterStatus('active')}
                    style={{
                      padding: '0.3rem 0.6rem',
                      backgroundColor: filterStatus === 'active' ? '#22d3ee10' : 'transparent',
                      border: `1px solid ${filterStatus === 'active' ? '#22d3ee30' : '#2a2a2a'}`,
                      borderRadius: '6px',
                      color: filterStatus === 'active' ? '#22d3ee' : '#6b7280',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    {t('recruiter.active', 'Active')} ({activeApps.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('approved')}
                    style={{
                      padding: '0.3rem 0.6rem',
                      backgroundColor: filterStatus === 'approved' ? '#22c55e10' : 'transparent',
                      border: `1px solid ${filterStatus === 'approved' ? '#22c55e30' : '#2a2a2a'}`,
                      borderRadius: '6px',
                      color: filterStatus === 'approved' ? '#22c55e' : '#6b7280',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    {t('recruiter.approved', 'Approved')} ({approvedApps.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('closed')}
                    style={{
                      padding: '0.3rem 0.6rem',
                      backgroundColor: filterStatus === 'closed' ? '#22d3ee10' : 'transparent',
                      border: `1px solid ${filterStatus === 'closed' ? '#22d3ee30' : '#2a2a2a'}`,
                      borderRadius: '6px',
                      color: filterStatus === 'closed' ? '#22d3ee' : '#6b7280',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    {t('recruiter.past', 'Past')} ({closedApps.length})
                  </button>
                </div>

                {filteredApps.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '2rem 1rem',
                    backgroundColor: colors.surface, borderRadius: '10px',
                    border: `1px solid ${colors.border}`,
                  }}>
                    <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
                      {filterStatus === 'active' ? t('recruiter.noActiveApps', 'No active applications') : filterStatus === 'approved' ? t('recruiter.noApprovedApps', 'No approved applications') : t('recruiter.noPastApps', 'No past applications')}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredApps.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        application={app}
                        onStatusChange={handleStatusChange}
                        updating={updating}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: Browse Transferees */}
            {activeTab === 'browse' && (
              <BrowseTransfereesTab fund={fund} editorInfo={editorInfo} />
            )}

            {/* TAB: Profile - Kingdom Listing Editor */}
            {activeTab === 'profile' && (
              <KingdomProfileTab fund={fund} editorInfo={editorInfo} onFundUpdate={setFund} />
            )}

            {/* TAB: Team */}
            {activeTab === 'team' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {team.map((member) => (
                    <div key={member.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.75rem',
                      backgroundColor: colors.bg,
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Link
                          to={`/profile/${member.user_id}`}
                          style={{ color: colors.text, textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}
                        >
                          {member.linked_username || member.username || 'User'}
                        </Link>
                        <span style={{
                          padding: '0.1rem 0.4rem',
                          backgroundColor: member.role === 'editor' ? '#22d3ee15' : '#a855f715',
                          border: `1px solid ${member.role === 'editor' ? '#22d3ee30' : '#a855f730'}`,
                          borderRadius: '4px',
                          fontSize: '0.6rem',
                          color: member.role === 'editor' ? '#22d3ee' : '#a855f7',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                        }}>
                          {member.role === 'editor' ? t('recruiter.editor', 'Editor') : t('recruiter.coEditor', 'Co-Editor')}
                        </span>
                      </div>
                      <span style={{
                        color: member.status === 'active' ? '#22c55e' : '#6b7280',
                        fontSize: '0.7rem',
                        textTransform: 'capitalize',
                      }}>
                        {member.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: Co-Editors (Invites) */}
            {activeTab === 'invites' && (
              <CoEditorsTab editorInfo={editorInfo} team={team} onReloadDashboard={loadDashboard} />
            )}

            {/* TAB: Fund */}
            {activeTab === 'fund' && (
              <FundTab fund={fund} editorInfo={editorInfo} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecruiterDashboard;
