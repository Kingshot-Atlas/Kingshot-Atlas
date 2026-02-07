import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { supabase } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { useToast } from './Toast';

// =============================================
// CONSTANTS
// =============================================

// Helper function to convert TC level to TG level
const getTGLevel = (tcLevel: number): string => {
  if (tcLevel < 35) return 'TG0';
  if (tcLevel < 40) return 'TG1';
  if (tcLevel < 45) return 'TG2';
  if (tcLevel < 50) return 'TG3';
  if (tcLevel < 55) return 'TG4';
  return 'TG5+';
};

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
  recruitment_pitch: string | null;
  what_we_offer: string | null;
  what_we_want: string | null;
  min_tc_level: number | null;
  min_power_range: string | null;
  main_language: string | null;
  secondary_languages: string[];
  event_times: Array<{ start: string; end: string }>;
  contact_link: string | null;
  recruitment_tags: string[];
  highlighted_stats: string[];
}

const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'Portuguese', 'Arabic', 'Turkish', 'French', 'German',
  'Russian', 'Chinese', 'Japanese', 'Korean', 'Indonesian', 'Thai', 'Vietnamese', 'Other',
];

const POWER_RANGE_OPTIONS = [
  'Any', '0 - 50M', '50 - 100M', '100 - 150M', '150 - 200M', '200 - 250M', '250 - 300M', '300 - 500M', '500 - 750M', '750 - 1,000M', '1,000M+',
];

const RECRUITMENT_TAG_OPTIONS = [
  'Active KvK', 'Casual Friendly', 'Competitive', 'English Speaking',
  'Spanish Speaking', 'Portuguese Speaking', 'Arabic Speaking', 'Turkish Speaking',
  'Looking for TC25+', 'Looking for TC20+', 'Growing Kingdom', 'Established Kingdom',
  'Active Alliances', 'Social Community', 'War Focused', 'Farm Friendly',
];

const TIER_INFO = [
  { tier: 'Standard', cost: '$0', color: '#4b5563', features: ['Basic listing with performance data', 'Community reviews'] },
  { tier: 'Bronze', cost: '$25+', color: '#cd7f32', features: ['Recruitment tags', 'Min requirements display', 'Contact link'] },
  { tier: 'Silver', cost: '$50+', color: '#9ca3af', features: ['Everything in Bronze', 'Recruitment pitch', 'Language info', 'Event times'] },
  { tier: 'Gold', cost: '$100+', color: '#fbbf24', features: ['Everything in Silver', '"What We Offer / Want" sections', 'Highlighted stats', 'Gold glow effect'] },
];

const STATUS_ACTIONS: Record<string, { next: string[]; colors: Record<string, { bg: string; border: string; text: string }> }> = {
  pending: {
    next: ['viewed', 'interested', 'declined'],
    colors: {
      viewed: { bg: `${colors.blue}15`, border: `${colors.blue}40`, text: colors.blue },
      interested: { bg: `${colors.purple}15`, border: `${colors.purple}40`, text: colors.purple },
      declined: { bg: `${colors.error}15`, border: `${colors.error}40`, text: colors.error },
    },
  },
  viewed: {
    next: ['interested', 'accepted', 'declined'],
    colors: {
      interested: { bg: `${colors.purple}15`, border: `${colors.purple}40`, text: colors.purple },
      accepted: { bg: `${colors.success}15`, border: `${colors.success}40`, text: colors.success },
      declined: { bg: `${colors.error}15`, border: `${colors.error}40`, text: colors.error },
    },
  },
  interested: {
    next: ['accepted', 'declined'],
    colors: {
      accepted: { bg: `${colors.success}15`, border: `${colors.success}40`, text: colors.success },
      declined: { bg: `${colors.error}15`, border: `${colors.error}40`, text: colors.error },
    },
  },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: colors.warning },
  viewed: { label: 'Viewed', color: colors.blue },
  interested: { label: 'Interested', color: colors.purple },
  accepted: { label: 'Accepted', color: colors.success },
  declined: { label: 'Declined', color: colors.error },
  withdrawn: { label: 'Withdrawn', color: colors.textSecondary },
  expired: { label: 'Expired', color: colors.textMuted },
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
      backgroundColor: colors.bg,
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
          <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.85rem' }}>
            {profile?.username || 'Unknown Player'}
          </span>
          {profile && (
            <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
              K{profile.current_kingdom} • {getTGLevel(profile.tc_level)} • {profile.power_range}
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
                      minHeight: '44px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
// SHARED STYLES
// =============================================

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  backgroundColor: '#0a0a0a',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.8rem',
  outline: 'none',
  width: '100%',
  minHeight: '44px',
  boxSizing: 'border-box' as const,
};

const TIER_ORDER = ['standard', 'bronze', 'silver', 'gold'];

// =============================================
// PROFILE FIELD WRAPPER
// =============================================

const ProfileField: React.FC<{
  label: string;
  tierRequired: string;
  currentTier: string;
  children: React.ReactNode;
}> = ({ label, tierRequired, currentTier, children }) => {
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  const requiredIdx = TIER_ORDER.indexOf(tierRequired);
  const locked = currentIdx < requiredIdx;

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '10px',
      border: `1px solid ${locked ? '#1a1a1a' : '#2a2a2a'}`,
      padding: '0.75rem',
      opacity: locked ? 0.5 : 1,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600' }}>{label}</span>
        {locked && (
          <span style={{
            padding: '0.1rem 0.3rem',
            backgroundColor: '#f59e0b15',
            border: '1px solid #f59e0b30',
            borderRadius: '4px',
            fontSize: '0.55rem',
            color: '#f59e0b',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {tierRequired}+ Required
          </span>
        )}
      </div>
      {locked ? (
        <p style={{ color: '#4b5563', fontSize: '0.7rem', margin: 0 }}>
          Upgrade to {tierRequired} tier to unlock this feature.
        </p>
      ) : children}
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
  const { showToast } = useToast();
  const [editorInfo, setEditorInfo] = useState<EditorInfo | null>(null);
  const [applications, setApplications] = useState<IncomingApplication[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [fund, setFund] = useState<FundInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'team' | 'fund' | 'profile'>('inbox');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<FundInfo>>({});
  const [coEditorUserId, setCoEditorUserId] = useState('');
  const [invitingCoEditor, setInvitingCoEditor] = useState(false);
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
        .select('kingdom_number, balance, tier, is_recruiting, recruitment_pitch, what_we_offer, what_we_want, min_tc_level, min_power_range, main_language, secondary_languages, event_times, contact_link, recruitment_tags, highlighted_stats')
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

  const handleSaveProfile = async () => {
    if (!supabase || !fund || !editorInfo || Object.keys(profileDraft).length === 0) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('kingdom_funds')
        .update(profileDraft)
        .eq('kingdom_number', editorInfo.kingdom_number);

      if (error) {
        showToast('Failed to save profile: ' + error.message, 'error');
      } else {
        setFund({ ...fund, ...profileDraft } as FundInfo);
        setProfileDraft({});
        showToast('Kingdom profile updated!', 'success');
      }
    } catch {
      showToast('Failed to save profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleInviteCoEditor = async () => {
    if (!supabase || !editorInfo || !coEditorUserId.trim()) return;
    setInvitingCoEditor(true);
    try {
      // Check if user exists and is linked to this kingdom
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, linked_kingdom, linked_tc_level, username, linked_username')
        .eq('id', coEditorUserId.trim())
        .single();

      if (!profile) {
        showToast('User not found. Check the user ID.', 'error');
        return;
      }
      if (profile.linked_kingdom !== editorInfo.kingdom_number) {
        showToast(`User is linked to Kingdom ${profile.linked_kingdom || 'none'}, not Kingdom ${editorInfo.kingdom_number}.`, 'error');
        return;
      }
      if ((profile.linked_tc_level || 0) < 20) {
        showToast('User must be TC20+ to be a co-editor.', 'error');
        return;
      }

      // Check for existing editor entry
      const { data: existing } = await supabase
        .from('kingdom_editors')
        .select('id, status')
        .eq('user_id', coEditorUserId.trim())
        .eq('kingdom_number', editorInfo.kingdom_number)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') {
          showToast('This user is already a co-editor.', 'error');
          return;
        }
        // Reactivate
        await supabase
          .from('kingdom_editors')
          .update({ status: 'active', role: 'co-editor', assigned_by: user?.id, activated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        // Create new co-editor entry
        const { error } = await supabase
          .from('kingdom_editors')
          .insert({
            kingdom_number: editorInfo.kingdom_number,
            user_id: coEditorUserId.trim(),
            role: 'co-editor',
            status: 'active',
            endorsement_count: 0,
            required_endorsements: 0,
            assigned_by: user?.id,
            activated_at: new Date().toISOString(),
          });

        if (error) {
          showToast('Failed to add co-editor: ' + error.message, 'error');
          return;
        }
      }

      const displayName = profile.linked_username || profile.username || 'User';
      showToast(`${displayName} added as co-editor!`, 'success');
      setCoEditorUserId('');
      loadDashboard();
    } catch {
      showToast('Failed to invite co-editor.', 'error');
    } finally {
      setInvitingCoEditor(false);
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
              padding: '0.5rem 0.75rem',
              backgroundColor: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#9ca3af',
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
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
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
              {(['inbox', 'profile', 'team', 'fund'] as const).map((tab) => (
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
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {tab === 'inbox' ? `Inbox${pendingCount > 0 ? ` (${pendingCount})` : ''}` :
                   tab === 'profile' ? 'Profile' :
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
                      minHeight: '44px',
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
                      minHeight: '44px',
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

            {/* TAB: Profile - Kingdom Listing Editor */}
            {activeTab === 'profile' && (
              <div>
                {!fund ? (
                  <div style={{
                    textAlign: 'center', padding: '2rem 1rem',
                    backgroundColor: '#111111', borderRadius: '12px',
                    border: '1px solid #2a2a2a',
                  }}>
                    <p style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      Start a Kingdom Fund to edit your listing profile
                    </p>
                    <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      Contribute to your kingdom fund to unlock tier features and customize your listing.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Tier Info */}
                    <div style={{
                      backgroundColor: '#111111', borderRadius: '10px',
                      border: '1px solid #2a2a2a', padding: '0.75rem',
                    }}>
                      <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fund Tier Benefits</span>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {TIER_INFO.map((t) => {
                          const isCurrentTier = t.tier.toLowerCase() === fund.tier;
                          return (
                            <div key={t.tier} style={{
                              padding: '0.5rem 0.6rem',
                              borderRadius: '8px',
                              border: isCurrentTier ? `1px solid ${t.color}50` : '1px solid #1a1a1a',
                              backgroundColor: isCurrentTier ? `${t.color}08` : '#0a0a0a',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ color: t.color, fontWeight: 'bold', fontSize: '0.8rem' }}>{t.tier}</span>
                                <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t.cost}</span>
                              </div>
                              <div style={{ marginTop: '0.25rem' }}>
                                {t.features.map((f) => (
                                  <div key={f} style={{ color: '#9ca3af', fontSize: '0.65rem', lineHeight: 1.5 }}>• {f}</div>
                                ))}
                              </div>
                              {isCurrentTier && (
                                <span style={{ display: 'inline-block', marginTop: '0.3rem', padding: '0.1rem 0.3rem', backgroundColor: `${t.color}20`, borderRadius: '3px', fontSize: '0.55rem', color: t.color, fontWeight: 'bold' }}>CURRENT</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recruitment Tags (Bronze+) */}
                    <ProfileField label="Recruitment Tags" tierRequired="bronze" currentTier={fund.tier}>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {RECRUITMENT_TAG_OPTIONS.map((tag) => {
                          const selected = (profileDraft.recruitment_tags ?? fund.recruitment_tags ?? []).includes(tag);
                          return (
                            <button key={tag} onClick={() => {
                              const current = profileDraft.recruitment_tags ?? fund.recruitment_tags ?? [];
                              setProfileDraft(d => ({
                                ...d,
                                recruitment_tags: selected ? current.filter(t => t !== tag) : [...current, tag],
                              }));
                            }} style={{
                              padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer',
                              backgroundColor: selected ? '#22d3ee15' : '#0a0a0a',
                              border: `1px solid ${selected ? '#22d3ee40' : '#2a2a2a'}`,
                              color: selected ? '#22d3ee' : '#6b7280',
                              minHeight: '36px',
                            }}>
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </ProfileField>

                    {/* Contact Link (Bronze+) */}
                    <ProfileField label="Contact Link (Discord invite, etc.)" tierRequired="bronze" currentTier={fund.tier}>
                      <input
                        type="url"
                        value={profileDraft.contact_link ?? fund.contact_link ?? ''}
                        onChange={(e) => setProfileDraft(d => ({ ...d, contact_link: e.target.value || null }))}
                        placeholder="https://discord.gg/your-invite"
                        style={inputStyle}
                      />
                    </ProfileField>

                    {/* Min Requirements (Bronze+) */}
                    <ProfileField label="Minimum Requirements" tierRequired="bronze" currentTier={fund.tier}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Min TC Level</span>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={profileDraft.min_tc_level ?? fund.min_tc_level ?? ''}
                            onChange={(e) => setProfileDraft(d => ({ ...d, min_tc_level: e.target.value ? parseInt(e.target.value) : null }))}
                            placeholder="e.g. 35"
                            style={inputStyle}
                          />
                          {(profileDraft.min_tc_level || fund.min_tc_level) && (
                            <span style={{ color: colors.textSecondary, fontSize: '0.6rem', marginTop: '0.25rem', display: 'block' }}>
                              = {getTGLevel(profileDraft.min_tc_level || fund.min_tc_level || 0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Min Power Range</span>
                          <select
                            value={profileDraft.min_power_range ?? fund.min_power_range ?? 'Any'}
                            onChange={(e) => setProfileDraft(d => ({ ...d, min_power_range: e.target.value === 'Any' ? null : e.target.value }))}
                            style={inputStyle}
                          >
                            {POWER_RANGE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </ProfileField>

                    {/* Recruitment Pitch (Silver+) */}
                    <ProfileField label="Recruitment Pitch" tierRequired="silver" currentTier={fund.tier}>
                      <textarea
                        value={profileDraft.recruitment_pitch ?? fund.recruitment_pitch ?? ''}
                        onChange={(e) => setProfileDraft(d => ({ ...d, recruitment_pitch: e.target.value || null }))}
                        maxLength={250}
                        rows={3}
                        placeholder="Sell your kingdom in a few sentences..."
                        style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                      />
                      <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                        {(profileDraft.recruitment_pitch ?? fund.recruitment_pitch ?? '').length}/250
                      </span>
                    </ProfileField>

                    {/* Languages (Silver+) */}
                    <ProfileField label="Languages" tierRequired="silver" currentTier={fund.tier}>
                      <div style={{ marginBottom: '0.4rem' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Main Language</span>
                        <select
                          value={profileDraft.main_language ?? fund.main_language ?? ''}
                          onChange={(e) => setProfileDraft(d => ({ ...d, main_language: e.target.value || null }))}
                          style={inputStyle}
                        >
                          <option value="">Select language...</option>
                          {LANGUAGE_OPTIONS.map((lang) => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Other Languages</span>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          {LANGUAGE_OPTIONS.filter(l => l !== (profileDraft.main_language ?? fund.main_language)).map((lang) => {
                            const selected = (profileDraft.secondary_languages ?? fund.secondary_languages ?? []).includes(lang);
                            return (
                              <button key={lang} onClick={() => {
                                const current = profileDraft.secondary_languages ?? fund.secondary_languages ?? [];
                                setProfileDraft(d => ({
                                  ...d,
                                  secondary_languages: selected ? current.filter(l => l !== lang) : [...current, lang],
                                }));
                              }} style={{
                                padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer',
                                backgroundColor: selected ? '#a855f715' : '#0a0a0a',
                                border: `1px solid ${selected ? '#a855f740' : '#2a2a2a'}`,
                                color: selected ? '#a855f7' : '#6b7280',
                                minHeight: '32px',
                              }}>
                                {lang}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </ProfileField>

                    {/* Event Times (Silver+) */}
                    <ProfileField label="Event Times (UTC)" tierRequired="silver" currentTier={fund.tier}>
                      {(profileDraft.event_times ?? fund.event_times ?? []).map((slot, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <input
                            type="time"
                            value={slot.start}
                            onChange={(e) => {
                              const times = (profileDraft.event_times ?? fund.event_times ?? []).map((t, i) =>
                                i === idx ? { start: e.target.value, end: t.end } : t
                              );
                              setProfileDraft(d => ({ ...d, event_times: times }));
                            }}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>to</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={(e) => {
                              const times = (profileDraft.event_times ?? fund.event_times ?? []).map((t, i) =>
                                i === idx ? { start: t.start, end: e.target.value } : t
                              );
                              setProfileDraft(d => ({ ...d, event_times: times }));
                            }}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <button onClick={() => {
                            const times = (profileDraft.event_times ?? fund.event_times ?? []).filter((_, i) => i !== idx);
                            setProfileDraft(d => ({ ...d, event_times: times }));
                          }} style={{
                            padding: '0.3rem 0.5rem', backgroundColor: '#ef444415', border: '1px solid #ef444430',
                            borderRadius: '6px', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', minHeight: '36px',
                          }}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => {
                        const times = [...(profileDraft.event_times ?? fund.event_times ?? []), { start: '12:00', end: '14:00' }];
                        setProfileDraft(d => ({ ...d, event_times: times }));
                      }} style={{
                        padding: '0.3rem 0.6rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee25',
                        borderRadius: '6px', color: '#22d3ee', fontSize: '0.7rem', cursor: 'pointer', minHeight: '36px',
                      }}>
                        + Add Time Slot
                      </button>
                    </ProfileField>

                    {/* What We Offer (Gold) */}
                    <ProfileField label="What We Offer" tierRequired="gold" currentTier={fund.tier}>
                      <textarea
                        value={profileDraft.what_we_offer ?? fund.what_we_offer ?? ''}
                        onChange={(e) => setProfileDraft(d => ({ ...d, what_we_offer: e.target.value || null }))}
                        maxLength={250}
                        rows={3}
                        placeholder="What does your kingdom offer to new members?"
                        style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                      />
                      <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                        {(profileDraft.what_we_offer ?? fund.what_we_offer ?? '').length}/250
                      </span>
                    </ProfileField>

                    {/* What We Want (Gold) */}
                    <ProfileField label="What We're Looking For" tierRequired="gold" currentTier={fund.tier}>
                      <textarea
                        value={profileDraft.what_we_want ?? fund.what_we_want ?? ''}
                        onChange={(e) => setProfileDraft(d => ({ ...d, what_we_want: e.target.value || null }))}
                        maxLength={250}
                        rows={3}
                        placeholder="What kind of players are you recruiting?"
                        style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                      />
                      <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                        {(profileDraft.what_we_want ?? fund.what_we_want ?? '').length}/250
                      </span>
                    </ProfileField>

                    {/* Save Button */}
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile || Object.keys(profileDraft).length === 0}
                      style={{
                        padding: '0.6rem 1.5rem',
                        backgroundColor: Object.keys(profileDraft).length === 0 ? '#1a1a1a' : '#22c55e15',
                        border: `1px solid ${Object.keys(profileDraft).length === 0 ? '#2a2a2a' : '#22c55e40'}`,
                        borderRadius: '10px',
                        color: Object.keys(profileDraft).length === 0 ? '#4b5563' : '#22c55e',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        cursor: Object.keys(profileDraft).length === 0 ? 'default' : 'pointer',
                        minHeight: '44px',
                        width: '100%',
                        opacity: savingProfile ? 0.6 : 1,
                      }}
                    >
                      {savingProfile ? 'Saving...' : Object.keys(profileDraft).length === 0 ? 'No Changes' : 'Save Profile Changes'}
                    </button>
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
                {/* Co-Editor Invite */}
                {editorInfo.role === 'editor' && team.filter((t) => t.status === 'active').length < 3 && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#111111', borderRadius: '10px', border: '1px solid #2a2a2a' }}>
                    <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600' }}>Invite Co-Editor</span>
                    <p style={{ color: '#6b7280', fontSize: '0.65rem', margin: '0.25rem 0 0.5rem 0' }}>
                      Enter the user ID of a linked kingdom member (TC20+) to add as co-editor.
                    </p>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="text"
                        value={coEditorUserId}
                        onChange={(e) => setCoEditorUserId(e.target.value)}
                        placeholder="Supabase User ID"
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
                        {invitingCoEditor ? '...' : 'Invite'}
                      </button>
                    </div>
                  </div>
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
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/transfer-hub?fund=${editorInfo.kingdom_number}`;
                          navigator.clipboard.writeText(url).then(() => {
                            showToast('Contribution link copied! Share with your kingdom.', 'success');
                          });
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#22c55e15',
                          border: '1px solid #22c55e30',
                          borderRadius: '8px',
                          color: '#22c55e',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          minHeight: '44px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        📋 Copy Contribution Link
                      </button>
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
