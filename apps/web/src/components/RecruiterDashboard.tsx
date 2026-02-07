import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { supabase } from '../lib/supabase';
import { FONT_DISPLAY, neonGlow } from '../utils/styles';

// =============================================
// TYPES
// =============================================

interface EditorInfo {
  id: string;
  kingdom_number: number;
  user_id: string;
  role: 'editor' | 'co-editor';
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  endorsement_count: number;
  required_endorsements: number;
  activated_at: string | null;
  last_active_at: string | null;
}

interface IncomingApplication {
  id: string;
  transfer_profile_id: string;
  applicant_user_id: string;
  kingdom_number: number;
  status: 'pending' | 'viewed' | 'interested' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  applied_at: string;
  viewed_at: string | null;
  responded_at: string | null;
  expires_at: string;
  // Joined from transfer_profiles
  profile?: {
    username: string;
    current_kingdom: number;
    tc_level: number;
    power_range: string;
    main_language: string;
    kvk_participation: string;
    group_size: string;
    player_bio: string;
    contact_method: string;
    contact_info: string;
    looking_for: string[];
  };
}

interface TeamMember {
  id: string;
  user_id: string;
  role: 'editor' | 'co-editor';
  status: string;
  username?: string;
  linked_username?: string;
}

interface FundInfo {
  kingdom_number: number;
  balance: number;
  tier: string;
  is_recruiting: boolean;
}

const STATUS_ACTIONS: Record<string, { next: string[]; colors: Record<string, { bg: string; border: string; text: string }> }> = {
  pending: {
    next: ['viewed', 'interested', 'declined'],
    colors: {
      viewed: { bg: '#3b82f615', border: '#3b82f640', text: '#3b82f6' },
      interested: { bg: '#a855f715', border: '#a855f740', text: '#a855f7' },
      declined: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
    },
  },
  viewed: {
    next: ['interested', 'accepted', 'declined'],
    colors: {
      interested: { bg: '#a855f715', border: '#a855f740', text: '#a855f7' },
      accepted: { bg: '#22c55e15', border: '#22c55e40', text: '#22c55e' },
      declined: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
    },
  },
  interested: {
    next: ['accepted', 'declined'],
    colors: {
      accepted: { bg: '#22c55e15', border: '#22c55e40', text: '#22c55e' },
      declined: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
    },
  },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#eab308' },
  viewed: { label: 'Viewed', color: '#3b82f6' },
  interested: { label: 'Interested', color: '#a855f7' },
  accepted: { label: 'Accepted', color: '#22c55e' },
  declined: { label: 'Declined', color: '#ef4444' },
  withdrawn: { label: 'Withdrawn', color: '#6b7280' },
  expired: { label: 'Expired', color: '#4b5563' },
};

// =============================================
// APPLICATION CARD
// =============================================

const ApplicationCard: React.FC<{
  application: IncomingApplication;
  onStatusChange: (id: string, newStatus: string) => void;
  updating: string | null;
}> = ({ application, onStatusChange, updating }) => {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const profile = application.profile;
  const statusInfo = STATUS_LABELS[application.status] || { label: application.status, color: '#6b7280' };
  const actions = STATUS_ACTIONS[application.status];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDaysRemaining = () => {
    const diff = new Date(application.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = getDaysRemaining();

  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      border: `1px solid ${statusInfo.color}25`,
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Header Row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: isMobile ? '0.75rem' : '0.75rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.85rem' }}>
            {profile?.username || 'Unknown Player'}
          </span>
          {profile && (
            <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
              K{profile.current_kingdom} • TC{profile.tc_level} • {profile.power_range}
            </span>
          )}
          <span style={{
            padding: '0.1rem 0.4rem',
            backgroundColor: `${statusInfo.color}15`,
            border: `1px solid ${statusInfo.color}30`,
            borderRadius: '4px',
            fontSize: '0.6rem',
            color: statusInfo.color,
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {statusInfo.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
            {formatDate(application.applied_at)}
          </span>
          {daysLeft <= 3 && daysLeft > 0 && application.status !== 'accepted' && application.status !== 'declined' && (
            <span style={{ color: '#f59e0b', fontSize: '0.6rem', fontWeight: '600' }}>
              {daysLeft}d left
            </span>
          )}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Expanded Profile Details */}
      {expanded && profile && (
        <div style={{
          padding: isMobile ? '0 0.75rem 0.75rem' : '0 1rem 1rem',
          borderTop: '1px solid #1a1a1a',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '0.5rem',
            marginTop: '0.75rem',
          }}>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Language</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem' }}>{profile.main_language}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>KvK Participation</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem', textTransform: 'capitalize' }}>{profile.kvk_participation}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Group Size</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem' }}>{profile.group_size}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Contact</span>
              <div style={{ color: '#22d3ee', fontSize: '0.8rem' }}>
                {profile.contact_method === 'discord' ? '💬 ' : '🎮 '}
                {profile.contact_info}
              </div>
            </div>
          </div>

          {profile.looking_for.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Looking For</span>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {profile.looking_for.map((tag) => (
                  <span key={tag} style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: '#22d3ee10',
                    border: '1px solid #22d3ee20',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: '#22d3ee',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.player_bio && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Bio</span>
              <p style={{ color: '#d1d5db', fontSize: '0.8rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                {profile.player_bio}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {actions && (
            <div style={{
              display: 'flex', gap: '0.5rem', marginTop: '0.75rem',
              flexWrap: 'wrap',
            }}>
              {actions.next.map((nextStatus) => {
                const actionColor = actions.colors[nextStatus];
                if (!actionColor) return null;
                return (
                  <button
                    key={nextStatus}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(application.id, nextStatus);
                    }}
                    disabled={updating === application.id}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: actionColor.bg,
                      border: `1px solid ${actionColor.border}`,
                      borderRadius: '6px',
                      color: actionColor.text,
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: updating === application.id ? 'not-allowed' : 'pointer',
                      opacity: updating === application.id ? 0.5 : 1,
                      textTransform: 'capitalize',
                      minHeight: '36px',
                    }}
                  >
                    {updating === application.id ? '...' : nextStatus === 'viewed' ? 'Mark Viewed' : nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================
// RECRUITER DASHBOARD
// =============================================

const RecruiterDashboard: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [editorInfo, setEditorInfo] = useState<EditorInfo | null>(null);
  const [applications, setApplications] = useState<IncomingApplication[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [fund, setFund] = useState<FundInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'team' | 'fund'>('inbox');
  const [filterStatus, setFilterStatus] = useState<string>('active');

  useEffect(() => {
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Get editor info
      const { data: editor } = await supabase
        .from('kingdom_editors')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!editor) {
        setLoading(false);
        return;
      }
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
          .select('id, username, current_kingdom, tc_level, power_range, main_language, kvk_participation, group_size, player_bio, contact_method, contact_info, looking_for')
          .in('id', profileIds);

        const profileMap = new Map<string, IncomingApplication['profile']>(
          profiles?.map((p: Record<string, unknown>) => [p.id as string, p as unknown as IncomingApplication['profile']]) || []
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
        .select('id, user_id, role, status')
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
        .select('kingdom_number, balance, tier, is_recruiting')
        .eq('kingdom_number', editor.kingdom_number)
        .single();

      if (fundData) setFund(fundData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
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

  const activeApps = applications.filter((a) => ['pending', 'viewed', 'interested'].includes(a.status));
  const closedApps = applications.filter((a) => ['accepted', 'declined', 'withdrawn', 'expired'].includes(a.status));
  const filteredApps = filterStatus === 'active' ? activeApps : closedApps;
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
              color: '#fff',
              margin: 0,
            }}>
              Recruiter Dashboard
            </h2>
            {editorInfo && (
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                Kingdom {editorInfo.kingdom_number} • {editorInfo.role === 'editor' ? 'Primary Editor' : 'Co-Editor'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#9ca3af',
              fontSize: '0.8rem',
              cursor: 'pointer',
              minHeight: '36px',
            }}
          >
            Close
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#6b7280' }}>Loading dashboard...</div>
        ) : !editorInfo ? (
          <div style={{
            textAlign: 'center', padding: '3rem 1rem',
            backgroundColor: '#111111', borderRadius: '12px',
            border: '1px solid #2a2a2a',
          }}>
            <p style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem' }}>No Active Editor Role</p>
            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              You need to be an active editor for a kingdom to access the Recruiter Dashboard.
              Claim your kingdom first through the Editor Claiming process.
            </p>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              {[
                { label: 'Pending', value: pendingCount, color: '#eab308' },
                { label: 'Active Apps', value: activeApps.length, color: '#22d3ee' },
                { label: 'Team', value: team.filter((t) => t.status === 'active').length, color: '#a855f7' },
                { label: 'Fund', value: fund ? `$${Number(fund.balance).toFixed(0)}` : '$0', color: '#22c55e' },
              ].map((stat) => (
                <div key={stat.label} style={{
                  backgroundColor: '#111111',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  textAlign: 'center',
                }}>
                  <div style={{ color: stat.color, fontWeight: 'bold', fontSize: '1.1rem' }}>{stat.value}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.6rem', marginTop: '0.15rem' }}>{stat.label}</div>
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
                  <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '600' }}>
                    {fund.is_recruiting ? 'Actively Recruiting' : 'Not Recruiting'}
                  </span>
                  <p style={{ color: '#6b7280', fontSize: '0.65rem', margin: '0.1rem 0 0 0' }}>
                    {fund.is_recruiting ? 'Your kingdom appears in transfer searches' : 'Toggle on to appear in transfer searches'}
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
              backgroundColor: '#111111',
              borderRadius: '10px',
              padding: '0.25rem',
              marginBottom: '1rem',
            }}>
              {(['inbox', 'team', 'fund'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: activeTab === tab ? '#22d3ee15' : 'transparent',
                    border: activeTab === tab ? '1px solid #22d3ee30' : '1px solid transparent',
                    borderRadius: '8px',
                    color: activeTab === tab ? '#22d3ee' : '#6b7280',
                    fontSize: '0.8rem',
                    fontWeight: activeTab === tab ? '600' : '400',
                    cursor: 'pointer',
                    position: 'relative',
                    minHeight: '36px',
                  }}
                >
                  {tab === 'inbox' ? `Inbox${pendingCount > 0 ? ` (${pendingCount})` : ''}` :
                   tab === 'team' ? 'Team' : 'Fund'}
                </button>
              ))}
            </div>

            {/* TAB: Inbox */}
            {activeTab === 'inbox' && (
              <div>
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
                      minHeight: '32px',
                    }}
                  >
                    Active ({activeApps.length})
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
                      minHeight: '32px',
                    }}
                  >
                    Past ({closedApps.length})
                  </button>
                </div>

                {filteredApps.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '2rem 1rem',
                    backgroundColor: '#111111', borderRadius: '10px',
                    border: '1px solid #2a2a2a',
                  }}>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                      {filterStatus === 'active' ? 'No active applications' : 'No past applications'}
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

            {/* TAB: Team */}
            {activeTab === 'team' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {team.map((member) => (
                    <div key={member.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '8px',
                      border: '1px solid #2a2a2a',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Link
                          to={`/profile/${member.user_id}`}
                          style={{ color: '#fff', textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}
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
                          {member.role === 'editor' ? 'Editor' : 'Co-Editor'}
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
                {editorInfo.role === 'editor' && team.filter((t) => t.status === 'active').length < 3 && (
                  <p style={{
                    color: '#6b7280', fontSize: '0.75rem',
                    marginTop: '0.75rem', textAlign: 'center',
                  }}>
                    You can have up to 2 co-editors. Co-editor invites coming soon.
                  </p>
                )}
              </div>
            )}

            {/* TAB: Fund */}
            {activeTab === 'fund' && (
              <div>
                {fund ? (
                  <div style={{
                    backgroundColor: '#111111',
                    border: '1px solid #2a2a2a',
                    borderRadius: '12px',
                    padding: '1rem',
                  }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: '1rem', marginBottom: '1rem',
                    }}>
                      <div>
                        <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Balance</span>
                        <div style={{
                          fontWeight: 'bold', fontSize: '1.2rem',
                          ...neonGlow('#22c55e'),
                        }}>
                          ${Number(fund.balance).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Tier</span>
                        <div style={{
                          color: fund.tier === 'gold' ? '#fbbf24' : fund.tier === 'silver' ? '#9ca3af' : fund.tier === 'bronze' ? '#cd7f32' : '#4b5563',
                          fontWeight: 'bold', fontSize: '1.2rem',
                          textTransform: 'capitalize',
                        }}>
                          {fund.tier}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '8px',
                    }}>
                      <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
                        Fund depletes ~$5/week. Current balance sustains the <strong style={{ color: '#fff' }}>{fund.tier}</strong> tier
                        for approximately <strong style={{ color: '#fff' }}>{Math.max(1, Math.floor(Number(fund.balance) / 5))}</strong> more weeks.
                        Share the kingdom link to encourage contributions.
                      </p>
                    </div>
                    <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                        Kingdom Fund contribution page coming soon
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center', padding: '2rem 1rem',
                    backgroundColor: '#111111', borderRadius: '12px',
                    border: '1px solid #2a2a2a',
                  }}>
                    <p style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      No Kingdom Fund Yet
                    </p>
                    <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      Start a Kingdom Fund to unlock tier benefits and boost your listing visibility.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecruiterDashboard;
