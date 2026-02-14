import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import type { EditorInfo, IncomingApplication, TeamMember, FundInfo } from './types';

export interface RecruiterDashboardState {
  editorInfo: EditorInfo | null;
  applications: IncomingApplication[];
  team: TeamMember[];
  fund: FundInfo | null;
  loading: boolean;
  updating: string | null;
  activeTab: 'inbox' | 'browse' | 'team' | 'invites' | 'fund' | 'profile';
  filterStatus: string;
  usedInvites: number;
  pendingInvite: { id: string; kingdom_number: number; assigned_by: string | null } | null;
  listingViews: number;
  showOnboarding: boolean;
}

export interface RecruiterDashboardActions {
  setActiveTab: (tab: RecruiterDashboardState['activeTab']) => void;
  setFilterStatus: (status: string) => void;
  setShowOnboarding: (show: boolean) => void;
  handleStatusChange: (applicationId: string, newStatus: string) => Promise<void>;
  handleToggleRecruiting: () => Promise<void>;
  handleAcceptInvite: () => Promise<void>;
  handleDeclineInvite: () => Promise<void>;
  loadDashboard: (silent?: boolean) => Promise<void>;
  setFund: React.Dispatch<React.SetStateAction<FundInfo | null>>;
  getInviteBudget: () => { total: number; used: number; bonus: number };
}

export interface RecruiterDashboardDerived {
  pendingCoEditorRequests: TeamMember[];
  activeApps: IncomingApplication[];
  approvedApps: IncomingApplication[];
  closedApps: IncomingApplication[];
  filteredApps: IncomingApplication[];
  pendingCount: number;
}

export function useRecruiterDashboard(): RecruiterDashboardState & RecruiterDashboardActions & RecruiterDashboardDerived {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();
  const [editorInfo, setEditorInfo] = useState<EditorInfo | null>(null);
  const [applications, setApplications] = useState<IncomingApplication[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [fund, setFund] = useState<FundInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RecruiterDashboardState['activeTab']>('inbox');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [usedInvites, setUsedInvites] = useState<number>(0);
  const [pendingInvite, setPendingInvite] = useState<RecruiterDashboardState['pendingInvite']>(null);
  const [listingViews, setListingViews] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('atlas_recruiter_onboarded');
  });

  const loadDashboard = useCallback(async (silent = false) => {
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
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
  }, [editorInfo?.kingdom_number, user?.id, showToast, loadDashboard]);

  const getInviteBudget = useCallback(() => {
    if (!editorInfo || !fund) return { total: 35, used: usedInvites, bonus: 0 };
    const base = 35;
    return { total: base, used: usedInvites, bonus: 0 };
  }, [editorInfo, fund, usedInvites]);

  const handleStatusChange = useCallback(async (applicationId: string, newStatus: string) => {
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
  }, [user, editorInfo, applications, trackFeature]);

  const handleToggleRecruiting = useCallback(async () => {
    if (!supabase || !fund || !editorInfo) return;
    const { error } = await supabase
      .from('kingdom_funds')
      .update({ is_recruiting: !fund.is_recruiting })
      .eq('kingdom_number', editorInfo.kingdom_number);

    if (!error) {
      setFund(prev => prev ? { ...prev, is_recruiting: !prev.is_recruiting } : prev);
    }
  }, [fund, editorInfo]);

  const handleAcceptInvite = useCallback(async () => {
    if (!supabase || !pendingInvite) return;
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
  }, [pendingInvite, showToast, loadDashboard]);

  const handleDeclineInvite = useCallback(async () => {
    if (!supabase || !pendingInvite) return;
    await supabase
      .from('kingdom_editors')
      .update({ status: 'inactive' })
      .eq('id', pendingInvite.id);
    setPendingInvite(null);
    showToast('Invitation declined.', 'success');
  }, [pendingInvite, showToast]);

  // Derived data
  const pendingCoEditorRequests = team.filter((t) => t.role === 'co-editor' && t.status === 'pending');
  const activeApps = applications.filter((a) => ['pending', 'viewed', 'interested'].includes(a.status));
  const approvedApps = applications.filter((a) => a.status === 'accepted');
  const closedApps = applications.filter((a) => ['declined', 'withdrawn', 'expired'].includes(a.status));
  const filteredApps = filterStatus === 'active' ? activeApps : filterStatus === 'approved' ? approvedApps : closedApps;
  const pendingCount = applications.filter((a) => a.status === 'pending').length;

  return {
    // State
    editorInfo,
    applications,
    team,
    fund,
    loading,
    updating,
    activeTab,
    filterStatus,
    usedInvites,
    pendingInvite,
    listingViews,
    showOnboarding,
    // Actions
    setActiveTab,
    setFilterStatus,
    setShowOnboarding,
    handleStatusChange,
    handleToggleRecruiting,
    handleAcceptInvite,
    handleDeclineInvite,
    loadDashboard,
    setFund,
    getInviteBudget,
    // Derived
    pendingCoEditorRequests,
    activeApps,
    approvedApps,
    closedApps,
    filteredApps,
    pendingCount,
  };
}
