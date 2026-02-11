import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { supabase } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { moderateText } from '../utils/contentModeration';
import { useToast } from './Toast';
import { isReferralEligible } from '../utils/constants';

// =============================================
// CONSTANTS
// =============================================

// Helper function to format TC level for display
const formatTCLevel = (tcLevel: number): string => {
  if (tcLevel <= 0) return '—';
  if (tcLevel <= 30) return `TC${tcLevel}`;
  if (tcLevel <= 34) return 'TC30';
  const tgLevel = Math.floor((tcLevel - 35) / 5) + 1;
  return `TG${tgLevel}`;
};

const KINGDOM_VIBE_OPTIONS = [
  { value: 'competitive', label: 'Competitive', emoji: '🏆' },
  { value: 'casual', label: 'Casual', emoji: '🌴' },
  { value: 'kvk_focused', label: 'KvK-focused', emoji: '⚔️' },
  { value: 'community_focused', label: 'Community-focused', emoji: '👥' },
  { value: 'social', label: 'Social', emoji: '💬' },
  { value: 'drama_free', label: 'Drama-free', emoji: '☮️' },
  { value: 'organized', label: 'Organized', emoji: '📋' },
  { value: 'beginner_friendly', label: 'Beginner-friendly', emoji: '🌱' },
];

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
  applicant_note: string | null;
  // Joined from transfer_profiles + profiles
  profile?: {
    user_id: string;
    username: string;
    current_kingdom: number;
    tc_level: number;
    power_million: number | null;
    power_range: string;
    main_language: string;
    kvk_availability: string;
    saving_for_kvk: string;
    group_size: string;
    player_bio: string;
    contact_method: string;
    contact_discord: string;
    contact_coordinates: string;
    contact_info: string;
    looking_for: string[];
    is_anonymous: boolean;
    linked_player_id?: string;
  };
}

interface TransfereeProfile {
  id: string;
  username: string;
  current_kingdom: number;
  tc_level: number;
  power_million: number | null;
  power_range: string;
  main_language: string;
  kvk_availability: string;
  saving_for_kvk: string;
  group_size: string;
  player_bio: string;
  looking_for: string[];
  is_anonymous: boolean;
  is_active: boolean;
  visible_to_recruiters: boolean;
  last_active_at: string | null;
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
  min_power_million: number | null;
  main_language: string | null;
  secondary_languages: string[];
  event_times: Array<{ start: string; end: string }>;
  contact_link: string | null;
  recruitment_tags: string[];
  highlighted_stats: string[];
  kingdom_vibe: string[];
  nap_policy: boolean | null;
  sanctuary_distribution: boolean | null;
  castle_rotation: boolean | null;
  alliance_events: {
    alliances: string[];
    schedule: Record<string, string[][]>;
  } | null;
}

const LANGUAGE_OPTIONS = [
  'English', 'Mandarin Chinese', 'Hindi', 'Spanish', 'French', 'Arabic', 'Bengali',
  'Portuguese', 'Russian', 'Japanese', 'German', 'Korean', 'Turkish', 'Vietnamese',
  'Italian', 'Thai', 'Polish', 'Indonesian', 'Dutch', 'Tagalog', 'Other',
];


const TIER_INFO = [
  { tier: 'Standard', cost: '$0', color: '#4b5563', features: ['Basic listing with Atlas Score & stats', 'Community reviews from players'] },
  { tier: 'Bronze', cost: '$25+', color: '#cd7f32', features: ['Min TC & Power requirements shown', 'Browse transferee profiles', 'Kingdom Policies & Vibe tags'] },
  { tier: 'Silver', cost: '$50+', color: '#9ca3af', features: ['Everything in Bronze', 'Send invites to transferees', 'Kingdom Bio & Language display', 'Alliance Event Times schedule'] },
  { tier: 'Gold', cost: '$100+', color: '#fbbf24', features: ['Everything in Silver', '5 bonus invites per cycle', 'Gold glow on your listing', 'Priority placement in searches'] },
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
  accepted: {
    next: ['declined'],
    colors: {
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
  const isAnon = profile?.is_anonymous && application.status !== 'accepted';
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
            {isAnon ? '🔒 Anonymous Applicant' : (profile?.username || 'Unknown Player')}
          </span>
          {profile && (
            <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
              Kingdom {profile.current_kingdom} • {formatTCLevel(profile.tc_level)} • {profile.power_million ? `${profile.power_million}M` : profile.power_range}
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
          {application.status === 'accepted' && profile?.linked_player_id && (
            <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>
              ID: <span style={{ color: '#22d3ee', fontWeight: '600' }}>{profile.linked_player_id}</span>
            </span>
          )}
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
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>KvK Availability</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem', textTransform: 'capitalize' }}>{profile.kvk_availability || '—'}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Saving for KvK</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem', textTransform: 'capitalize' }}>{(profile.saving_for_kvk || '—').replace(/_/g, ' ')}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Group Size</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem' }}>{profile.group_size}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Contact</span>
              {isAnon ? (
                <div style={{ color: '#6b7280', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  🔒 Revealed after acceptance
                </div>
              ) : (
                <div style={{ color: '#22d3ee', fontSize: '0.8rem' }}>
                  {(profile.contact_method === 'discord' || profile.contact_method === 'both') && profile.contact_discord && (
                    <span>💬 {profile.contact_discord}</span>
                  )}
                  {profile.contact_method === 'both' && ' · '}
                  {(profile.contact_method === 'in_game' || profile.contact_method === 'both') && profile.contact_coordinates && (
                    <span>🎮 {(() => {
                      const m = profile.contact_coordinates.match(/^K:(\d+) X:(\d+) Y:(\d+)$/);
                      return m ? `K${m[1]} · X:${m[2]} Y:${m[3]}` : profile.contact_coordinates;
                    })()}</span>
                  )}
                  {!profile.contact_discord && !profile.contact_coordinates && profile.contact_info && (
                    <span>{profile.contact_method === 'discord' ? '💬 ' : '🎮 '}{profile.contact_info}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {profile.looking_for.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Looking For</span>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {profile.looking_for.slice(0, 3).map((tag) => (
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

          {application.applicant_note && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#22d3ee08',
              border: '1px solid #22d3ee15',
              borderRadius: '8px',
            }}>
              <span style={{ color: '#22d3ee', fontSize: '0.65rem', fontWeight: '600' }}>📝 Applicant Note</span>
              <p style={{ color: '#d1d5db', fontSize: '0.78rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                {application.applicant_note}
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
                    {updating === application.id ? '...' : nextStatus === 'viewed' ? 'Mark Viewed' : (nextStatus === 'declined' && application.status === 'accepted') ? 'Cancel Approval' : nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
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
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();
  const [editorInfo, setEditorInfo] = useState<EditorInfo | null>(null);
  const [applications, setApplications] = useState<IncomingApplication[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [fund, setFund] = useState<FundInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'browse' | 'team' | 'invites' | 'fund' | 'profile'>('inbox');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<FundInfo>>({});
  const [coEditorUserId, setCoEditorUserId] = useState('');
  const [invitingCoEditor, setInvitingCoEditor] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [usedInvites, setUsedInvites] = useState<number>(0);
  const [transferees, setTransferees] = useState<TransfereeProfile[]>([]);
  const [loadingTransferees, setLoadingTransferees] = useState(false);
  const [hasMoreTransferees, setHasMoreTransferees] = useState(true);
  const [pendingInvite, setPendingInvite] = useState<{ id: string; kingdom_number: number } | null>(null);
  const [sentInviteIds, setSentInviteIds] = useState<Set<string>>(new Set());
  const [browseFilters, setBrowseFilters] = useState<{ minTc: string; minPower: string; language: string; sortBy: string }>({ minTc: '', minPower: '', language: '', sortBy: 'newest' });
  const [compareList, setCompareList] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [contributions, setContributions] = useState<Array<{ id: string; amount: number; created_at: string }>>([]);
  const [loadingContributions, setLoadingContributions] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('atlas_recruiter_onboarded');
  });

  useEffect(() => {
    loadDashboard();
  }, [user]);

  // Auto-load transferees when Browse tab is selected
  useEffect(() => {
    if (activeTab === 'browse' && editorInfo && fund && transferees.length === 0) {
      loadTransferees();
    }
  }, [activeTab, editorInfo, fund]);

  // Auto-load contributions when Fund tab is selected
  useEffect(() => {
    if (activeTab === 'fund' && editorInfo && contributions.length === 0) {
      loadContributions();
    }
  }, [activeTab, editorInfo]);

  // Real-time subscription for new transferee profiles on Browse tab
  useEffect(() => {
    if (!supabase || activeTab !== 'browse') return;
    const sb = supabase;
    const channel = sb
      .channel('browse-transferees')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transfer_profiles',
      }, (payload) => {
        const newProfile = payload.new as TransfereeProfile;
        if (newProfile.is_active && newProfile.visible_to_recruiters && newProfile.current_kingdom !== editorInfo?.kingdom_number) {
          setTransferees(prev => [newProfile, ...prev]);
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [activeTab]);

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
        // Check for pending co-editor invitation
        const { data: pending } = await supabase
          .from('kingdom_editors')
          .select('id, kingdom_number')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .single();
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
        .select('kingdom_number, balance, tier, is_recruiting, recruitment_pitch, what_we_offer, what_we_want, min_tc_level, min_power_range, min_power_million, main_language, secondary_languages, event_times, contact_link, recruitment_tags, highlighted_stats, kingdom_vibe, nap_policy, sanctuary_distribution, castle_rotation, alliance_events')
        .eq('kingdom_number', editor.kingdom_number)
        .single();

      if (fundData) setFund(fundData);

      // Get used invites count
      const { data: usedData } = await supabase
        .rpc('get_used_invites', { p_kingdom_number: editor.kingdom_number });
      if (usedData != null) setUsedInvites(usedData);
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

  const BROWSE_PAGE_SIZE = 25;

  const loadTransferees = async (loadMore = false) => {
    if (!supabase || !editorInfo || !fund) return;
    setLoadingTransferees(true);
    try {
      const offset = loadMore ? transferees.length : 0;
      const { data } = await supabase
        .from('transfer_profiles')
        .select('id, username, current_kingdom, tc_level, power_million, power_range, main_language, kvk_availability, saving_for_kvk, group_size, player_bio, looking_for, is_anonymous, is_active, visible_to_recruiters, last_active_at')
        .eq('is_active', true)
        .eq('visible_to_recruiters', true)
        .neq('current_kingdom', editorInfo.kingdom_number)
        .order('created_at', { ascending: false })
        .range(offset, offset + BROWSE_PAGE_SIZE - 1);
      const results = (data as TransfereeProfile[]) || [];
      if (loadMore) {
        setTransferees(prev => [...prev, ...results]);
      } else {
        setTransferees(results);
      }
      setHasMoreTransferees(results.length === BROWSE_PAGE_SIZE);

      // Record profile views (fire-and-forget, one per profile per day)
      if (results.length > 0 && user) {
        const views = results.map(tp => ({
          transfer_profile_id: tp.id,
          viewer_user_id: user.id,
          viewer_kingdom_number: editorInfo.kingdom_number,
        }));
        supabase.from('transfer_profile_views').upsert(views, {
          onConflict: 'transfer_profile_id,viewer_user_id,view_date',
          ignoreDuplicates: true,
        }).then(() => {});
      }
    } catch {
      // silent
    } finally {
      setLoadingTransferees(false);
    }
  };

  const loadContributions = async () => {
    if (!supabase || !editorInfo) return;
    setLoadingContributions(true);
    try {
      const { data } = await supabase
        .from('kingdom_fund_contributions')
        .select('id, amount, created_at')
        .eq('kingdom_number', editorInfo.kingdom_number)
        .order('created_at', { ascending: false })
        .limit(20);
      setContributions(data || []);
    } catch {
      // silent
    } finally {
      setLoadingContributions(false);
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

  const handleSaveProfile = async () => {
    if (!supabase || !fund || !editorInfo || Object.keys(profileDraft).length === 0) return;

    // Content moderation check on text fields
    const textFields: (keyof FundInfo)[] = ['recruitment_pitch', 'what_we_offer', 'what_we_want'];
    for (const field of textFields) {
      const value = profileDraft[field];
      if (typeof value === 'string' && value.trim()) {
        const result = moderateText(value);
        if (!result.isClean) {
          showToast(result.reason || 'Content contains inappropriate language.', 'error');
          return;
        }
      }
    }

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
        .single();

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
        .select('id, status')
        .eq('user_id', profile.id)
        .eq('kingdom_number', editorInfo.kingdom_number)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') {
          showToast('This player is already a co-editor.', 'error');
          return;
        }
        if (existing.status === 'pending') {
          showToast('An invitation is already pending for this player.', 'error');
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
      loadDashboard();
    } catch {
      showToast('Failed to invite co-editor.', 'error');
    } finally {
      setInvitingCoEditor(false);
    }
  };

  if (!user) return null;

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
                background: 'none', border: 'none', color: '#6b7280',
                cursor: 'pointer', fontSize: '1rem', padding: '0.25rem',
              }}
              aria-label="Dismiss onboarding"
            >
              ✕
            </button>
            <p style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: '700', margin: '0 0 0.6rem 0' }}>
              Getting Started as a Recruiter
            </p>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.5rem' }}>
              {[
                { step: '1', icon: '👑', title: 'Claim Kingdom', desc: 'You\'re the editor — manage your kingdom\'s listing.', done: true },
                { step: '2', icon: '💰', title: 'Fund Listing', desc: 'Boost visibility with a kingdom fund contribution.', done: (fund?.balance || 0) > 0 },
                { step: '3', icon: '📩', title: 'Start Recruiting', desc: 'Toggle recruiting on, browse transferees, send invites.', done: fund?.is_recruiting || false },
              ].map((s) => (
                <div key={s.step} style={{
                  flex: 1,
                  padding: '0.6rem',
                  backgroundColor: s.done ? '#22c55e08' : '#0a0a0a',
                  border: `1px solid ${s.done ? '#22c55e25' : '#1a1a1a'}`,
                  borderRadius: '8px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>
                    {s.done ? '✅' : s.icon}
                  </div>
                  <div style={{ color: s.done ? '#22c55e' : '#fff', fontSize: '0.75rem', fontWeight: '600' }}>
                    {s.title}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.6rem', marginTop: '0.15rem' }}>
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#6b7280' }}>Loading dashboard...</div>
        ) : !editorInfo ? (
          <div style={{
            textAlign: 'center', padding: '3rem 1rem',
            backgroundColor: '#111111', borderRadius: '12px',
            border: '1px solid #2a2a2a',
          }}>
            {pendingInvite ? (
              <>
                <p style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem' }}>🎉 Co-Editor Invitation</p>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  You&apos;ve been invited to be a co-editor for Kingdom {pendingInvite.kingdom_number}&apos;s recruiter dashboard.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button
                    onClick={async () => {
                      if (!supabase) return;
                      await supabase
                        .from('kingdom_editors')
                        .update({ status: 'active', activated_at: new Date().toISOString() })
                        .eq('id', pendingInvite.id);
                      showToast('Invitation accepted! Loading dashboard...', 'success');
                      loadDashboard();
                    }}
                    style={{
                      padding: '0.5rem 1.25rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e40',
                      borderRadius: '8px', color: '#22c55e', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px',
                    }}
                  >
                    Accept
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
                    Decline
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem' }}>No Active Editor Role</p>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                  You need to be an active editor for a kingdom to access the Recruiter Dashboard.
                  Claim your kingdom first through the Editor Claiming process.
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
                { label: 'Pending', value: pendingCount, color: '#eab308' },
                { label: 'Invites', value: `${getInviteBudget().total - getInviteBudget().used}/${getInviteBudget().total}`, color: '#22d3ee' },
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
              {(['inbox', 'browse', 'profile', 'team', 'invites', 'fund'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    trackFeature('Recruiter Tab Switch', { tab });
                    if (tab === 'browse' && transferees.length === 0) loadTransferees();
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
                  {tab === 'inbox' ? `Inbox${pendingCount > 0 ? ` (${pendingCount})` : ''}` :
                   tab === 'browse' ? 'Browse' :
                   tab === 'profile' ? 'Profile' :
                   tab === 'team' ? 'Team' :
                   tab === 'invites' ? 'Co-Editors' : 'Fund'}
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
                    Approved ({approvedApps.length})
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
                      {filterStatus === 'active' ? 'No active applications' : filterStatus === 'approved' ? 'No approved applications' : 'No past applications'}
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
              <div>
                {/* Budget Banner */}
                {fund && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#111111',
                    borderRadius: '8px',
                    border: '1px solid #2a2a2a',
                    marginBottom: '0.75rem',
                  }}>
                    <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                      Invite Budget: <strong style={{ color: colors.text }}>{getInviteBudget().total - getInviteBudget().used}</strong> remaining
                      {getInviteBudget().bonus > 0 && <span style={{ color: colors.gold, fontSize: '0.6rem' }}> (+{getInviteBudget().bonus} Gold bonus)</span>}
                    </span>
                    <button onClick={() => loadTransferees()} style={{
                      padding: '0.25rem 0.5rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee25',
                      borderRadius: '6px', color: '#22d3ee', fontSize: '0.65rem', cursor: 'pointer', minHeight: '32px',
                    }}>
                      ↻ Refresh
                    </button>
                  </div>
                )}

                {/* Browse Filters */}
                <div style={{
                  display: 'flex', gap: '0.4rem', marginBottom: '0.75rem',
                  flexWrap: 'wrap', alignItems: 'flex-end',
                }}>
                  <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>Min TC</span>
                    <select
                      value={browseFilters.minTc}
                      onChange={(e) => setBrowseFilters(f => ({ ...f, minTc: e.target.value }))}
                      style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
                    >
                      <option value="">Any</option>
                      {[15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(lvl => (
                        <option key={lvl} value={lvl}>{formatTCLevel(lvl)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>Min Power</span>
                    <input
                      type="number"
                      placeholder="e.g. 100"
                      value={browseFilters.minPower}
                      onChange={(e) => setBrowseFilters(f => ({ ...f, minPower: e.target.value }))}
                      style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 120px', minWidth: '90px' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>Language</span>
                    <select
                      value={browseFilters.language}
                      onChange={(e) => setBrowseFilters(f => ({ ...f, language: e.target.value }))}
                      style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
                    >
                      <option value="">Any</option>
                      {LANGUAGE_OPTIONS.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>Sort By</span>
                    <select
                      value={browseFilters.sortBy}
                      onChange={(e) => setBrowseFilters(f => ({ ...f, sortBy: e.target.value }))}
                      style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
                    >
                      <option value="newest">Newest First</option>
                      <option value="power_desc">Power (High → Low)</option>
                      <option value="tc_desc">TC Level (High → Low)</option>
                    </select>
                  </div>
                  {(browseFilters.minTc || browseFilters.minPower || browseFilters.language) && (
                    <button
                      onClick={() => setBrowseFilters({ minTc: '', minPower: '', language: '', sortBy: browseFilters.sortBy })}
                      style={{
                        padding: '0.35rem 0.5rem', backgroundColor: '#ef444410', border: '1px solid #ef444425',
                        borderRadius: '6px', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer', minHeight: '36px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Compare Bar */}
                {compareList.size > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.4rem 0.75rem',
                    backgroundColor: '#a855f708',
                    border: '1px solid #a855f720',
                    borderRadius: '8px',
                    marginBottom: '0.75rem',
                  }}>
                    <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: '600' }}>
                      {compareList.size} selected for comparison
                    </span>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        onClick={() => setShowCompare(true)}
                        disabled={compareList.size < 2}
                        style={{
                          padding: '0.3rem 0.6rem', backgroundColor: compareList.size >= 2 ? '#a855f715' : '#1a1a1a',
                          border: `1px solid ${compareList.size >= 2 ? '#a855f730' : '#2a2a2a'}`,
                          borderRadius: '6px', color: compareList.size >= 2 ? '#a855f7' : '#4b5563',
                          fontSize: '0.65rem', fontWeight: '600', cursor: compareList.size >= 2 ? 'pointer' : 'not-allowed', minHeight: '32px',
                        }}
                      >
                        Compare
                      </button>
                      <button
                        onClick={() => setCompareList(new Set())}
                        style={{
                          padding: '0.3rem 0.5rem', backgroundColor: 'transparent', border: '1px solid #2a2a2a',
                          borderRadius: '6px', color: '#6b7280', fontSize: '0.6rem', cursor: 'pointer', minHeight: '32px',
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {(() => {
                  // Apply browse filters
                  const filtered = transferees.filter(tp => {
                    if (browseFilters.minTc) {
                      const min = parseInt(browseFilters.minTc);
                      if ((tp.tc_level || 0) < min) return false;
                    }
                    if (browseFilters.minPower) {
                      const min = parseInt(browseFilters.minPower);
                      if ((tp.power_million || 0) < min) return false;
                    }
                    if (browseFilters.language) {
                      if (tp.main_language !== browseFilters.language) return false;
                    }
                    return true;
                  });
                  // Apply sorting
                  if (browseFilters.sortBy === 'power_desc') {
                    filtered.sort((a, b) => (b.power_million || 0) - (a.power_million || 0));
                  } else if (browseFilters.sortBy === 'tc_desc') {
                    filtered.sort((a, b) => (b.tc_level || 0) - (a.tc_level || 0));
                  }
                  // 'newest' is default order from Supabase (created_at desc)

                  if (loadingTransferees) return (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280' }}>Loading transferees...</div>
                  );
                  if (filtered.length === 0) return (
                    <div style={{
                      textAlign: 'center', padding: '2.5rem 1rem',
                      backgroundColor: '#111111', borderRadius: '12px',
                      border: '1px solid #2a2a2a',
                    }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>
                        {transferees.length > 0 ? '🔍' : '📭'}
                      </div>
                      <p style={{ color: '#d1d5db', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                        {transferees.length > 0 ? 'No transferees match your filters' : 'No active transfer profiles yet'}
                      </p>
                      <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: transferees.length > 0 ? '0.75rem' : 0 }}>
                        {transferees.length > 0
                          ? 'Try adjusting your filters to broaden results.'
                          : 'Players who are looking to transfer will appear here once they create a profile.'}
                      </p>
                      {transferees.length > 0 && (
                        <button
                          onClick={() => setBrowseFilters({ minTc: '', minPower: '', language: '', sortBy: browseFilters.sortBy })}
                          style={{
                            padding: '0.4rem 1rem', backgroundColor: '#a855f710',
                            border: '1px solid #a855f725', borderRadius: '6px',
                            color: '#a855f7', fontSize: '0.7rem', fontWeight: '600',
                            cursor: 'pointer', minHeight: '36px',
                          }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  );

                  // Compute match scores for "Recommended for you"
                  const withScores = fund ? filtered.map(tp => {
                    let matched = 0, total = 0;
                    const minPwr = fund.min_power_million || 0;
                    if (minPwr > 0) { total++; if ((tp.power_million || 0) >= minPwr) matched++; }
                    if (fund.min_tc_level && fund.min_tc_level > 0) { total++; if ((tp.tc_level || 0) >= fund.min_tc_level) matched++; }
                    if (fund.main_language) { total++; if (tp.main_language === fund.main_language) matched++; }
                    const score = total > 0 ? Math.round((matched / total) * 100) : 0;
                    return { ...tp, _matchScore: score };
                  }) : [];
                  const recommended = withScores
                    .filter(tp => tp._matchScore >= 60)
                    .sort((a, b) => b._matchScore - a._matchScore)
                    .slice(0, 5);

                  return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Recommended for you section */}
                    {recommended.length > 0 && !browseFilters.minTc && !browseFilters.minPower && !browseFilters.language && (
                      <div style={{
                        backgroundColor: '#a855f708', border: '1px solid #a855f720',
                        borderRadius: '10px', padding: '0.6rem 0.75rem', marginBottom: '0.25rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.85rem' }}>⭐</span>
                          <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: '700' }}>Recommended for You</span>
                          <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>Based on your kingdom requirements</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {recommended.map(tp => (
                            <div key={`rec-${tp.id}`} style={{
                              padding: '0.3rem 0.5rem', backgroundColor: '#1a1a20',
                              border: '1px solid #a855f725', borderRadius: '8px',
                              display: 'flex', alignItems: 'center', gap: '0.35rem',
                              fontSize: '0.65rem', minWidth: '120px',
                            }}>
                              <span style={{ color: '#d1d5db', fontWeight: '600' }}>
                                {(tp as { is_anonymous?: boolean }).is_anonymous ? '🔒 Anon' : ((tp as { username?: string }).username || 'Unknown')}
                              </span>
                              <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{tp._matchScore}%</span>
                              <span style={{ color: '#6b7280' }}>{formatTCLevel(tp.tc_level)} · {tp.power_million ? `${tp.power_million}M` : '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>{filtered.length} transferee{filtered.length !== 1 ? 's' : ''}{browseFilters.minTc || browseFilters.minPower || browseFilters.language ? ' (filtered)' : ''}</span>
                    {filtered.map((tp) => {
                      const isAnon = tp.is_anonymous as boolean;
                      const canSeeDetails = fund && ['bronze', 'silver', 'gold'].includes(fund.tier);
                      const canSendInvite = fund && ['silver', 'gold'].includes(fund.tier);
                      const budgetLeft = getInviteBudget().total - getInviteBudget().used;
                      return (
                        <div key={tp.id} style={{
                          backgroundColor: colors.bg,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '10px',
                          padding: '0.75rem',
                        }}>
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.85rem' }}>
                                {isAnon ? '🔒 Anonymous' : (tp.username || 'Unknown')}
                              </span>
                              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>K{tp.current_kingdom}</span>
                              {tp.last_active_at && (() => {
                                const diff = Date.now() - new Date(tp.last_active_at).getTime();
                                const mins = Math.floor(diff / 60000);
                                const hrs = Math.floor(diff / 3600000);
                                const days = Math.floor(diff / 86400000);
                                const label = mins < 60 ? `${mins}m ago` : hrs < 24 ? `${hrs}h ago` : `${days}d ago`;
                                const fresh = days < 3;
                                return (
                                  <span style={{ color: fresh ? '#22c55e' : '#6b7280', fontSize: '0.55rem' }}>
                                    {fresh ? '🟢' : '⚪'} {label}
                                  </span>
                                );
                              })()}
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <span style={{
                                padding: '0.1rem 0.35rem',
                                backgroundColor: '#eab30808',
                                border: '1px solid #eab30820',
                                borderRadius: '4px',
                                fontSize: '0.6rem',
                                color: '#eab308',
                              }}>
                                {formatTCLevel(tp.tc_level)}
                              </span>
                              <span style={{
                                padding: '0.1rem 0.35rem',
                                backgroundColor: '#f9731608',
                                border: '1px solid #f9731620',
                                borderRadius: '4px',
                                fontSize: '0.6rem',
                                color: '#f97316',
                              }}>
                                {tp.power_million ? `${tp.power_million}M` : (tp.power_range || '—')}
                              </span>
                            </div>
                          </div>

                          {/* Quick Stats */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                            <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>🌐 {tp.main_language}</span>
                            {tp.kvk_availability && (
                              <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>⚔️ {tp.kvk_availability}</span>
                            )}
                            <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>👥 {tp.group_size}</span>
                          </div>

                          {/* Looking For Tags */}
                          {tp.looking_for?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginBottom: '0.4rem' }}>
                              {tp.looking_for.map((tag) => (
                                <span key={tag} style={{
                                  padding: '0.08rem 0.35rem',
                                  backgroundColor: '#22d3ee08',
                                  border: '1px solid #22d3ee18',
                                  borderRadius: '4px',
                                  fontSize: '0.55rem',
                                  color: '#22d3ee',
                                }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Bio (if can see details) */}
                          {canSeeDetails && tp.player_bio && (
                            <p style={{ color: colors.textSecondary, fontSize: '0.7rem', margin: '0 0 0.4rem 0', lineHeight: 1.4, fontStyle: 'italic' }}>
                              &ldquo;{tp.player_bio}&rdquo;
                            </p>
                          )}

                          {/* Tier Gate Message */}
                          {!canSeeDetails && (
                            <p style={{ color: colors.textMuted, fontSize: '0.65rem', margin: '0.25rem 0', fontStyle: 'italic' }}>
                              🔒 Upgrade to Bronze+ to view full profile details
                            </p>
                          )}

                          {/* Compare + Send Invite Row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.65rem', color: compareList.has(tp.id) ? '#a855f7' : '#6b7280' }}>
                              <input
                                type="checkbox"
                                checked={compareList.has(tp.id)}
                                onChange={() => {
                                  setCompareList(prev => {
                                    const next = new Set(prev);
                                    if (next.has(tp.id)) next.delete(tp.id);
                                    else if (next.size < 4) next.add(tp.id);
                                    return next;
                                  });
                                }}
                                style={{ accentColor: '#a855f7' }}
                              />
                              Compare
                            </label>
                          {canSendInvite ? (
                            <button
                              disabled={budgetLeft <= 0 || sentInviteIds.has(tp.id)}
                              onClick={async () => {
                                if (!supabase || !user || !editorInfo) return;
                                try {
                                  // Check for existing pending invite
                                  const { data: existing } = await supabase
                                    .from('transfer_invites')
                                    .select('id')
                                    .eq('kingdom_number', editorInfo.kingdom_number)
                                    .eq('recipient_profile_id', tp.id)
                                    .eq('status', 'pending')
                                    .maybeSingle();
                                  if (existing) {
                                    showToast('An invite is already pending for this player.', 'error');
                                    setSentInviteIds(prev => new Set(prev).add(tp.id));
                                    return;
                                  }

                                  const { error } = await supabase.from('transfer_invites').insert({
                                    kingdom_number: editorInfo.kingdom_number,
                                    sender_user_id: user.id,
                                    recipient_profile_id: tp.id,
                                  });
                                  if (error) {
                                    showToast('Failed to send invite: ' + error.message, 'error');
                                  } else {
                                    setUsedInvites(prev => prev + 1);
                                    setSentInviteIds(prev => new Set(prev).add(tp.id));
                                    trackFeature('Invite Sent', { kingdom: editorInfo.kingdom_number });
                                    showToast('Invite sent!', 'success');
                                    // Notify the transferee
                                    const { data: profileRow } = await supabase
                                      .from('transfer_profiles')
                                      .select('user_id')
                                      .eq('id', tp.id)
                                      .single();
                                    if (profileRow) {
                                      await supabase.from('notifications').insert({
                                        user_id: profileRow.user_id,
                                        type: 'transfer_invite',
                                        title: 'Kingdom Invite Received',
                                        message: `Kingdom ${editorInfo.kingdom_number} has invited you to transfer!`,
                                        link: '/transfer-hub',
                                        metadata: { kingdom_number: editorInfo.kingdom_number },
                                      });
                                    }
                                  }
                                } catch {
                                  showToast('Failed to send invite.', 'error');
                                }
                              }}
                              style={{
                                padding: '0.35rem 0.75rem',
                                backgroundColor: sentInviteIds.has(tp.id) ? '#22c55e10' : budgetLeft > 0 ? '#a855f715' : '#1a1a1a',
                                border: `1px solid ${sentInviteIds.has(tp.id) ? '#22c55e30' : budgetLeft > 0 ? '#a855f730' : '#2a2a2a'}`,
                                borderRadius: '6px',
                                color: sentInviteIds.has(tp.id) ? '#22c55e' : budgetLeft > 0 ? '#a855f7' : '#4b5563',
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                cursor: budgetLeft > 0 && !sentInviteIds.has(tp.id) ? 'pointer' : 'not-allowed',
                                minHeight: '36px',
                              }}
                            >
                              {sentInviteIds.has(tp.id) ? '✓ Invited' : budgetLeft > 0 ? '📩 Send Invite' : 'No invites remaining'}
                            </button>
                          ) : (
                            <p style={{ color: colors.textMuted, fontSize: '0.6rem', margin: '0.25rem 0', fontStyle: 'italic' }}>
                              🔒 Upgrade to Silver+ to send invites
                            </p>
                          )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}

                {/* Load More Button */}
                {hasMoreTransferees && !loadingTransferees && transferees.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <button
                      onClick={() => loadTransferees(true)}
                      style={{
                        padding: '0.5rem 1.5rem',
                        backgroundColor: '#22d3ee10',
                        border: '1px solid #22d3ee30',
                        borderRadius: '8px',
                        color: '#22d3ee',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        minHeight: '40px',
                      }}
                    >
                      Load More ({transferees.length} loaded)
                    </button>
                  </div>
                )}
                {loadingTransferees && transferees.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem 0', color: '#6b7280', fontSize: '0.8rem' }}>
                    Loading more...
                  </div>
                )}

                {/* Comparison Modal */}
                {showCompare && compareList.size >= 2 && (() => {
                  const selected = transferees.filter(tp => compareList.has(tp.id));
                  if (selected.length < 2) return null;
                  const fields: { key: string; label: string; render: (tp: TransfereeProfile) => string }[] = [
                    { key: 'tc', label: 'TC Level', render: (tp) => formatTCLevel(tp.tc_level) },
                    { key: 'power', label: 'Power', render: (tp) => tp.power_million ? `${tp.power_million}M` : (tp.power_range || '—') },
                    { key: 'lang', label: 'Language', render: (tp) => tp.main_language || '—' },
                    { key: 'kvk', label: 'KvK Avail.', render: (tp) => (tp.kvk_availability || '—').replace(/_/g, ' ') },
                    { key: 'saving', label: 'Saving For', render: (tp) => (tp.saving_for_kvk || '—').replace(/_/g, ' ') },
                    { key: 'group', label: 'Group Size', render: (tp) => String(tp.group_size || '—') },
                    { key: 'looking', label: 'Looking For', render: (tp) => tp.looking_for?.join(', ') || '—' },
                  ];
                  return (
                    <div style={{
                      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1100,
                      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
                      padding: isMobile ? 0 : '1rem',
                    }} onClick={() => setShowCompare(false)}>
                      <div style={{
                        backgroundColor: '#111111', border: '1px solid #2a2a2a',
                        borderRadius: isMobile ? '16px 16px 0 0' : '16px',
                        padding: isMobile ? '1rem' : '1.5rem',
                        maxWidth: '700px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
                        paddingBottom: isMobile ? 'max(1rem, env(safe-area-inset-bottom))' : '1.5rem',
                      }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', margin: 0, fontFamily: FONT_DISPLAY }}>
                            Profile Comparison
                          </h3>
                          <button onClick={() => setShowCompare(false)} style={{
                            background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem',
                          }}>✕</button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: '#6b7280', borderBottom: '1px solid #2a2a2a', fontSize: '0.65rem' }}>Field</th>
                                {selected.map(tp => (
                                  <th key={tp.id} style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: '#22d3ee', borderBottom: '1px solid #2a2a2a', fontSize: '0.7rem', fontWeight: '600' }}>
                                    {tp.is_anonymous ? '🔒 Anonymous' : (tp.username || 'Unknown')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {fields.map(field => (
                                <tr key={field.key}>
                                  <td style={{ padding: '0.4rem 0.5rem', color: '#9ca3af', borderBottom: '1px solid #1a1a1a', fontWeight: '500', whiteSpace: 'nowrap' }}>{field.label}</td>
                                  {selected.map(tp => (
                                    <td key={tp.id} style={{ padding: '0.4rem 0.5rem', color: '#d1d5db', borderBottom: '1px solid #1a1a1a', textAlign: 'center', textTransform: 'capitalize' }}>
                                      {field.render(tp)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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

                    {/* Kingdom Vibe (Bronze+) — pick up to 3 */}
                    <ProfileField label="Kingdom Vibe (pick up to 3)" tierRequired="bronze" currentTier={fund.tier}>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {KINGDOM_VIBE_OPTIONS.map((opt) => {
                          const currentVibe = profileDraft.kingdom_vibe ?? fund.kingdom_vibe ?? [];
                          const selected = currentVibe.includes(opt.value);
                          return (
                            <button key={opt.value} onClick={() => {
                              if (selected) {
                                setProfileDraft(d => ({ ...d, kingdom_vibe: currentVibe.filter(v => v !== opt.value) }));
                              } else if (currentVibe.length < 3) {
                                setProfileDraft(d => ({ ...d, kingdom_vibe: [...currentVibe, opt.value] }));
                              }
                            }} style={{
                              padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', cursor: currentVibe.length >= 3 && !selected ? 'not-allowed' : 'pointer',
                              backgroundColor: selected ? '#22d3ee15' : '#0a0a0a',
                              border: `1px solid ${selected ? '#22d3ee40' : '#2a2a2a'}`,
                              color: selected ? '#22d3ee' : '#6b7280',
                              opacity: currentVibe.length >= 3 && !selected ? 0.4 : 1,
                              minHeight: '36px',
                            }}>
                              {opt.emoji} {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </ProfileField>

                    {/* NAP / Sanctuary / Castle (Bronze+) */}
                    <ProfileField label="Kingdom Policies" tierRequired="bronze" currentTier={fund.tier}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {([
                          { key: 'nap_policy' as const, label: 'NAP (Non-Aggression Pact)', desc: 'Kingdom enforces NAP agreements' },
                          { key: 'sanctuary_distribution' as const, label: 'Sanctuary Distribution', desc: 'Sanctuaries are distributed fairly' },
                          { key: 'castle_rotation' as const, label: 'Castle Rotation', desc: 'King role is rotated between more than 1 alliance' },
                        ]).map(({ key, label, desc }) => {
                          const val = profileDraft[key] ?? fund[key];
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <div>
                                <div style={{ color: '#d1d5db', fontSize: '0.75rem', fontWeight: '500' }}>{label}</div>
                                <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>{desc}</div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                {[
                                  { v: true, label: '✓', color: '#22c55e' },
                                  { v: false, label: '✗', color: '#ef4444' },
                                  { v: null, label: '—', color: '#6b7280' },
                                ].map((opt) => (
                                  <button key={String(opt.v)} onClick={() => setProfileDraft(d => ({ ...d, [key]: opt.v }))} style={{
                                    width: '32px', height: '32px', borderRadius: '6px',
                                    backgroundColor: val === opt.v ? `${opt.color}15` : '#0a0a0a',
                                    border: `1px solid ${val === opt.v ? `${opt.color}40` : '#2a2a2a'}`,
                                    color: opt.color, fontSize: '0.8rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ProfileField>

                    {/* Min Requirements (Bronze+) */}
                    <ProfileField label="Minimum Requirements" tierRequired="bronze" currentTier={fund.tier}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Min TC Level</span>
                          <select
                            value={profileDraft.min_tc_level ?? fund.min_tc_level ?? ''}
                            onChange={(e) => setProfileDraft(d => ({ ...d, min_tc_level: e.target.value ? parseInt(e.target.value) : null }))}
                            style={inputStyle}
                          >
                            <option value="">None</option>
                            {Array.from({ length: 30 }, (_, i) => i + 1).map((lvl) => (
                              <option key={lvl} value={lvl}>TC {lvl}</option>
                            ))}
                            {[
                              { label: 'TG1 (TC 35)', value: 35 },
                              { label: 'TG2 (TC 40)', value: 40 },
                              { label: 'TG3 (TC 45)', value: 45 },
                              { label: 'TG4 (TC 50)', value: 50 },
                              { label: 'TG5 (TC 55)', value: 55 },
                              { label: 'TG6 (TC 60)', value: 60 },
                              { label: 'TG7 (TC 65)', value: 65 },
                              { label: 'TG8 (TC 70)', value: 70 },
                            ].map((tg) => (
                              <option key={tg.value} value={tg.value}>{tg.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Min Power (in Millions)</span>
                          <input
                            type="number"
                            min={0}
                            max={99999}
                            step={1}
                            value={profileDraft.min_power_million ?? fund.min_power_million ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setProfileDraft(d => ({ ...d, min_power_million: null }));
                              } else {
                                const num = Math.floor(Math.abs(parseInt(val) || 0));
                                if (num <= 99999) {
                                  setProfileDraft(d => ({ ...d, min_power_million: num }));
                                }
                              }
                            }}
                            placeholder="e.g. 100 = 100M"
                            style={inputStyle}
                          />
                          {(profileDraft.min_power_million ?? fund.min_power_million) != null && (
                            <span style={{ color: colors.textSecondary, fontSize: '0.6rem', marginTop: '0.25rem', display: 'block' }}>
                              = {profileDraft.min_power_million ?? fund.min_power_million}M power
                            </span>
                          )}
                        </div>
                      </div>
                    </ProfileField>

                    {/* Kingdom Bio (Silver+) */}
                    <ProfileField label="Kingdom Bio" tierRequired="silver" currentTier={fund.tier}>
                      <textarea
                        value={profileDraft.recruitment_pitch ?? fund.recruitment_pitch ?? ''}
                        onChange={(e) => setProfileDraft(d => ({ ...d, recruitment_pitch: e.target.value.slice(0, 150) || null }))}
                        maxLength={150}
                        rows={3}
                        placeholder="Sell your kingdom in a sentence or two..."
                        style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                      />
                      <span style={{ color: (profileDraft.recruitment_pitch ?? fund.recruitment_pitch ?? '').length > 140 ? '#ef4444' : '#4b5563', fontSize: '0.6rem' }}>
                        {(profileDraft.recruitment_pitch ?? fund.recruitment_pitch ?? '').length}/150
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
                        <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Secondary Language</span>
                        <select
                          value={(profileDraft.secondary_languages ?? fund.secondary_languages ?? [])[0] || ''}
                          onChange={(e) => setProfileDraft(d => ({ ...d, secondary_languages: e.target.value ? [e.target.value] : [] }))}
                          style={inputStyle}
                        >
                          <option value="">None</option>
                          {LANGUAGE_OPTIONS.filter(l => l !== (profileDraft.main_language ?? fund.main_language)).map((lang) => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                      </div>
                    </ProfileField>

                    {/* Alliance Event Times (Silver+) — table format */}
                    <ProfileField label="Alliance Event Times (UTC)" tierRequired="silver" currentTier={fund.tier}>
                      {(() => {
                        const EVENT_TYPES = [
                          { key: 'bear_hunt', label: 'Bear Hunt', slots: 2 },
                          { key: 'viking_vengeance', label: 'Viking Vengeance', slots: 1 },
                          { key: 'swordland_showdown', label: 'Swordland Showdown', slots: 2 },
                          { key: 'tri_alliance_clash', label: 'Tri-Alliance Clash', slots: 2 },
                        ];
                        const UTC_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
                          const h = Math.floor(i / 2).toString().padStart(2, '0');
                          const m = i % 2 === 0 ? '00' : '30';
                          return `${h}:${m}`;
                        });
                        const defaultData = { alliances: [] as string[], schedule: {} as Record<string, string[][]> };
                        const current = profileDraft.alliance_events ?? fund.alliance_events ?? defaultData;
                        const alliances = current.alliances || [];
                        const schedule = current.schedule || {};

                        const updateData = (newAlliances: string[], newSchedule: Record<string, string[][]>) => {
                          setProfileDraft(d => ({ ...d, alliance_events: { alliances: newAlliances, schedule: newSchedule } }));
                        };

                        const addAlliance = () => {
                          if (alliances.length >= 3) return;
                          const newAlliances = [...alliances, ''];
                          const newSchedule = { ...schedule };
                          EVENT_TYPES.forEach(et => {
                            const existing = newSchedule[et.key] || [];
                            newSchedule[et.key] = [...existing, Array(et.slots).fill('')];
                          });
                          updateData(newAlliances, newSchedule);
                        };

                        const removeAlliance = (idx: number) => {
                          const newAlliances = alliances.filter((_, i) => i !== idx);
                          const newSchedule = { ...schedule };
                          EVENT_TYPES.forEach(et => {
                            const existing = newSchedule[et.key] || [];
                            newSchedule[et.key] = existing.filter((_, i) => i !== idx);
                          });
                          updateData(newAlliances, newSchedule);
                        };

                        const updateAllianceTag = (idx: number, val: string) => {
                          const newAlliances = alliances.map((a, i) => i === idx ? val.toUpperCase() : a);
                          updateData(newAlliances, schedule);
                        };

                        const updateTimeSlot = (eventKey: string, allianceIdx: number, slotIdx: number, val: string) => {
                          const newSchedule = { ...schedule };
                          const eventSlots = [...(newSchedule[eventKey] || [])];
                          const allianceSlots = [...(eventSlots[allianceIdx] || [])];
                          allianceSlots[slotIdx] = val;
                          eventSlots[allianceIdx] = allianceSlots;
                          newSchedule[eventKey] = eventSlots;
                          updateData(alliances, newSchedule);
                        };

                        return (
                          <div>
                            {/* Alliance tag inputs */}
                            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem', alignItems: 'flex-end' }}>
                              {alliances.map((tag, idx) => (
                                <div key={idx} style={{ flex: 1 }}>
                                  <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>Alliance {idx + 1}</span>
                                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                                    <input
                                      type="text"
                                      value={tag}
                                      maxLength={6}
                                      onChange={(e) => updateAllianceTag(idx, e.target.value)}
                                      placeholder={`Tag ${idx + 1}`}
                                      style={{ ...inputStyle, flex: 1 }}
                                    />
                                    <button onClick={() => removeAlliance(idx)} style={{
                                      padding: '0.2rem 0.4rem', backgroundColor: '#ef444410', border: '1px solid #ef444425',
                                      borderRadius: '4px', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer', minHeight: '32px',
                                    }}>✕</button>
                                  </div>
                                </div>
                              ))}
                              {alliances.length < 3 && (
                                <button onClick={addAlliance} style={{
                                  padding: '0.3rem 0.5rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee25',
                                  borderRadius: '6px', color: '#22d3ee', fontSize: '0.65rem', cursor: 'pointer', minHeight: '36px', whiteSpace: 'nowrap',
                                }}>+ Alliance</button>
                              )}
                            </div>

                            {/* Time slots table */}
                            {alliances.length > 0 && (
                              <div style={{ border: '1px solid #2a2a2a', borderRadius: '6px', overflow: 'hidden' }}>
                                {/* Header */}
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: `120px ${alliances.map(() => '1fr').join(' ')}`,
                                  backgroundColor: '#0f0f0f',
                                  borderBottom: '1px solid #2a2a2a',
                                }}>
                                  <div style={{ padding: '0.3rem 0.4rem', fontSize: '0.6rem', color: '#6b7280', fontWeight: '600' }}>Event</div>
                                  {alliances.map((tag, i) => (
                                    <div key={i} style={{
                                      padding: '0.3rem 0.3rem', fontSize: '0.6rem', color: '#22d3ee', fontWeight: '700', textAlign: 'center',
                                      borderLeft: '1px solid #2a2a2a',
                                    }}>{tag || `Alliance ${i + 1}`}</div>
                                  ))}
                                </div>
                                {/* Rows */}
                                {EVENT_TYPES.map((et, rowIdx) => (
                                  <div key={et.key} style={{
                                    display: 'grid',
                                    gridTemplateColumns: `120px ${alliances.map(() => '1fr').join(' ')}`,
                                    borderBottom: rowIdx < EVENT_TYPES.length - 1 ? '1px solid #2a2a2a' : 'none',
                                  }}>
                                    <div style={{
                                      padding: '0.35rem 0.4rem', fontSize: '0.6rem', color: '#9ca3af', fontWeight: '500',
                                      display: 'flex', alignItems: 'center',
                                    }}>
                                      {et.label}
                                      <span style={{ color: '#4b5563', fontSize: '0.5rem', marginLeft: '0.2rem' }}>({et.slots === 1 ? '1 slot' : '2 slots'})</span>
                                    </div>
                                    {alliances.map((_, aIdx) => {
                                      const slots = schedule[et.key]?.[aIdx] || Array(et.slots).fill('');
                                      return (
                                        <div key={aIdx} style={{
                                          padding: '0.2rem 0.25rem',
                                          borderLeft: '1px solid #2a2a2a',
                                          display: 'flex', flexDirection: 'column', gap: '0.15rem',
                                        }}>
                                          {Array.from({ length: et.slots }).map((_, sIdx) => (
                                            <select
                                              key={sIdx}
                                              value={slots[sIdx] || ''}
                                              onChange={(e) => updateTimeSlot(et.key, aIdx, sIdx, e.target.value)}
                                              style={{ ...inputStyle, fontSize: '0.65rem', padding: '0.2rem 0.3rem' }}
                                            >
                                              <option value="">--:--</option>
                                              {UTC_TIME_OPTIONS.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                              ))}
                                            </select>
                                          ))}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            )}

                            {alliances.length === 0 && (
                              <div style={{ color: '#6b7280', fontSize: '0.7rem', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem' }}>
                                Add an alliance to set event times
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
              </div>
            )}

            {/* TAB: Co-Editors (Invites) */}
            {activeTab === 'invites' && (
              <div>
                {/* Current Co-Editors */}
                {(() => {
                  const coEditors = team.filter((t) => t.role === 'co-editor');
                  return coEditors.length > 0 ? (
                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Current Co-Editors
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                        {coEditors.map((member) => (
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
                            </div>
                            <span style={{
                              color: member.status === 'active' ? '#22c55e' : member.status === 'pending' ? '#eab308' : '#6b7280',
                              fontSize: '0.7rem',
                              textTransform: 'capitalize',
                            }}>
                              {member.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      textAlign: 'center', padding: '1.5rem 1rem',
                      backgroundColor: '#111111', borderRadius: '10px',
                      border: '1px solid #2a2a2a',
                      marginBottom: '1rem',
                    }}>
                      <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
                        No co-editors yet. Invite up to 2 co-editors to help manage your kingdom.
                      </p>
                    </div>
                  );
                })()}

                {/* Invite Form */}
                {editorInfo.role === 'editor' && team.filter((t) => t.role === 'co-editor' && (t.status === 'active' || t.status === 'pending')).length < 2 && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#111111', borderRadius: '10px', border: '1px solid #a855f720' }}>
                    <span style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: '600' }}>Invite Co-Editor</span>
                    <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.25rem 0 0.5rem 0' }}>
                      Enter the player ID of a linked kingdom member (TC20+) to add as co-editor.
                      Co-editors can manage applications, browse transferees, and update the kingdom profile.
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
                        {invitingCoEditor ? '...' : 'Invite'}
                      </button>
                    </div>
                  </div>
                )}
                {editorInfo.role === 'co-editor' && (
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#111111',
                    borderRadius: '10px',
                    border: '1px solid #2a2a2a',
                  }}>
                    <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>
                      Only the primary editor can invite co-editors.
                    </p>
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
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          const refParam = profile && isReferralEligible(profile) && profile.linked_username ? `&ref=${profile.linked_username}&src=transfer` : '';
                          const url = `${window.location.origin}/transfer-hub?kingdom=${editorInfo.kingdom_number}${refParam}`;
                          navigator.clipboard.writeText(url).then(() => {
                            trackFeature('Listing Link Copied', { kingdom: editorInfo.kingdom_number, hasReferral: !!refParam });
                            showToast('Listing link copied! Share to recruit transferees.', 'success');
                          });
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#22d3ee15',
                          border: '1px solid #22d3ee30',
                          borderRadius: '8px',
                          color: '#22d3ee',
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
                        🔗 Copy Listing Link
                      </button>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/transfer-hub?fund=${editorInfo.kingdom_number}`;
                          navigator.clipboard.writeText(url).then(() => {
                            trackFeature('Contribution Link Copied', { kingdom: editorInfo.kingdom_number });
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
                        💰 Copy Contribution Link
                      </button>
                    </div>

                    {/* Contribution History */}
                    <div style={{ marginTop: '1rem' }}>
                      <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Contribution History
                      </span>
                      {loadingContributions ? (
                        <div style={{ padding: '1rem 0', color: '#6b7280', fontSize: '0.8rem', textAlign: 'center' }}>Loading...</div>
                      ) : contributions.length === 0 ? (
                        <div style={{
                          marginTop: '0.5rem', padding: '0.75rem',
                          backgroundColor: '#0a0a0a', borderRadius: '8px',
                          textAlign: 'center',
                        }}>
                          <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>
                            No contributions yet. Share the contribution link with your kingdom members!
                          </p>
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {contributions.map((c) => (
                            <div key={c.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.5rem 0.6rem',
                              backgroundColor: '#0a0a0a', borderRadius: '6px',
                              border: '1px solid #1a1a1a',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.9rem' }}>💰</span>
                                <span style={{ color: '#22c55e', fontWeight: '600', fontSize: '0.85rem' }}>
                                  ${Number(c.amount).toFixed(2)}
                                </span>
                              </div>
                              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                                {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          ))}
                          {contributions.length > 0 && (
                            <div style={{
                              textAlign: 'center', padding: '0.4rem 0',
                              borderTop: '1px solid #1a1a1a', marginTop: '0.2rem',
                            }}>
                              <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: '600' }}>
                                Total: ${contributions.reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2)}
                              </span>
                              <span style={{ color: '#6b7280', fontSize: '0.65rem', marginLeft: '0.5rem' }}>
                                ({contributions.length} contribution{contributions.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                          )}
                        </div>
                      )}
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
