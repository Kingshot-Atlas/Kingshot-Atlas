import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { useToast } from '../Toast';
import type { EditorInfo, IncomingApplication, TeamMember, FundInfo } from './types';

export interface RecruiterDashboardState {
  editorInfo: EditorInfo | null;
  applications: IncomingApplication[];
  team: TeamMember[];
  fund: FundInfo | null;
  loading: boolean;
  updating: string | null;
  activeTab: 'inbox' | 'browse' | 'team' | 'fund' | 'profile' | 'analytics';
  filterStatus: string;
  usedInvites: number;
  pendingInvite: { id: string; kingdom_number: number; assigned_by: string | null } | null;
  listingViews: number;
  showOnboarding: boolean;
  unreadMessageCount: number;
  perAppUnreadCounts: Record<string, number>;
  perAppLastMessages: Record<string, { message: string; created_at: string }>;
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
  setFund: (fundOrUpdater: FundInfo | null | ((prev: FundInfo | null) => FundInfo | null)) => void;
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

// ─── Query Keys ───────────────────────────────────────────────
export const recruiterDashboardKeys = {
  all: ['recruiterDashboard'] as const,
  data: (userId: string) => [...recruiterDashboardKeys.all, 'data', userId] as const,
};

// ─── Data shape returned by the query ─────────────────────────
interface RecruiterDashboardData {
  editorInfo: EditorInfo | null;
  applications: IncomingApplication[];
  team: TeamMember[];
  fund: FundInfo | null;
  usedInvites: number;
  pendingInvite: { id: string; kingdom_number: number; assigned_by: string | null } | null;
  listingViews: number;
  unreadMessageCount: number;
  perAppUnreadCounts: Record<string, number>;
  perAppLastMessages: Record<string, { message: string; created_at: string }>;
}

const EMPTY_DASHBOARD: RecruiterDashboardData = {
  editorInfo: null,
  applications: [],
  team: [],
  fund: null,
  usedInvites: 0,
  pendingInvite: null,
  listingViews: 0,
  unreadMessageCount: 0,
  perAppUnreadCounts: {},
  perAppLastMessages: {},
};

async function fetchRecruiterDashboard(userId: string): Promise<RecruiterDashboardData> {
  if (!supabase) return EMPTY_DASHBOARD;

  // Get editor info
  const { data: editor } = await supabase
    .from('kingdom_editors')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!editor) {
    // Check for pending co-editor invitation or request
    const { data: pending } = await supabase
      .from('kingdom_editors')
      .select('id, kingdom_number, assigned_by')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();
    return { ...EMPTY_DASHBOARD, pendingInvite: pending || null };
  }

  // Get applications for this kingdom
  const { data: apps } = await supabase
    .from('transfer_applications')
    .select('*')
    .eq('kingdom_number', editor.kingdom_number)
    .order('applied_at', { ascending: false });

  let enrichedApps: IncomingApplication[] = [];
  if (apps) {
    const profileIds = [...new Set(apps.map((a: IncomingApplication) => a.transfer_profile_id))];
    const { data: profiles } = await supabase
      .from('transfer_profiles')
      .select('id, user_id, username, current_kingdom, tc_level, power_million, power_range, main_language, kvk_availability, saving_for_kvk, group_size, player_bio, contact_method, contact_discord, contact_coordinates, contact_info, looking_for, is_anonymous, last_active_at')
      .in('id', profileIds);

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
    enrichedApps = apps.map((a: IncomingApplication) => ({
      ...a,
      profile: profileMap.get(a.transfer_profile_id) || undefined,
    }));
  }

  // Get team members
  const { data: teamData } = await supabase
    .from('kingdom_editors')
    .select('id, user_id, role, status, last_active_at, assigned_by')
    .eq('kingdom_number', editor.kingdom_number);

  let enrichedTeam: TeamMember[] = [];
  if (teamData) {
    const userIds = teamData.map((t: TeamMember) => t.user_id);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, linked_username')
      .in('id', userIds);

    const userMap = new Map(profileData?.map((p: { id: string; username: string; linked_username: string }) => [p.id, p]) || []);
    enrichedTeam = teamData.map((t: TeamMember) => ({
      ...t,
      username: userMap.get(t.user_id)?.username,
      linked_username: userMap.get(t.user_id)?.linked_username,
    }));
  }

  // Get fund info
  const { data: fundData } = await supabase
    .from('kingdom_funds')
    .select('kingdom_number, balance, tier, is_recruiting, recruitment_pitch, what_we_offer, what_we_want, min_tc_level, min_power_range, min_power_million, main_language, secondary_languages, event_times, contact_link, recruitment_tags, highlighted_stats, kingdom_vibe, nap_policy, sanctuary_distribution, castle_rotation, alliance_events, alliance_details, updated_at')
    .eq('kingdom_number', editor.kingdom_number)
    .maybeSingle();

  // Get used invites count
  const { data: usedData } = await supabase
    .rpc('get_used_invites', { p_kingdom_number: editor.kingdom_number });

  // Get listing views (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: viewCount } = await supabase
    .from('kingdom_listing_views')
    .select('id', { count: 'exact', head: true })
    .eq('kingdom_number', editor.kingdom_number)
    .gte('viewed_at', thirtyDaysAgo);

  // Get unread message count using persistent read tracking
  let unreadMsgCount = 0;
  const perAppUnread: Record<string, number> = {};
  const appIds = enrichedApps.filter(a => ['pending', 'viewed', 'accepted'].includes(a.status)).map(a => a.id);
  if (appIds.length > 0) {
    // Fetch last_read_at per application for this user
    const { data: readRows } = await supabase
      .from('message_read_status')
      .select('application_id, last_read_at')
      .eq('user_id', userId)
      .in('application_id', appIds);
    const readMap = new Map((readRows || []).map((r: { application_id: string; last_read_at: string }) => [r.application_id, r.last_read_at]));

    // Count messages from others that are newer than last_read_at (or all if never read)
    for (const appId of appIds) {
      const lastRead = readMap.get(appId);
      let query = supabase
        .from('application_messages')
        .select('id', { count: 'exact', head: true })
        .eq('application_id', appId)
        .neq('sender_user_id', userId);
      if (lastRead) query = query.gt('created_at', lastRead);
      const { count } = await query;
      const c = count || 0;
      perAppUnread[appId] = c;
      unreadMsgCount += c;
    }
  }

  // Fetch last message per app for preview
  const perAppLastMessages: Record<string, { message: string; created_at: string }> = {};
  if (appIds.length > 0) {
    const { data: lastMsgs } = await supabase
      .from('application_messages')
      .select('application_id, message, created_at')
      .in('application_id', appIds)
      .order('created_at', { ascending: false });
    (lastMsgs || []).forEach(m => {
      if (!perAppLastMessages[m.application_id]) {
        perAppLastMessages[m.application_id] = { message: m.message, created_at: m.created_at };
      }
    });
  }

  return {
    editorInfo: editor,
    applications: enrichedApps,
    team: enrichedTeam,
    fund: fundData || null,
    usedInvites: usedData ?? 0,
    pendingInvite: null,
    listingViews: viewCount || 0,
    unreadMessageCount: unreadMsgCount,
    perAppUnreadCounts: perAppUnread,
    perAppLastMessages,
  };
}

export function useRecruiterDashboard(): RecruiterDashboardState & RecruiterDashboardActions & RecruiterDashboardDerived {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();
  const queryClient = useQueryClient();

  // React Query for all dashboard data
  const { data: dashboardData, isLoading, refetch } = useQuery({
    queryKey: recruiterDashboardKeys.data(user?.id || ''),
    queryFn: () => fetchRecruiterDashboard(user!.id),
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  // Derived from query
  const editorInfo = dashboardData?.editorInfo ?? null;
  const applications = useMemo(() => dashboardData?.applications ?? [], [dashboardData?.applications]);
  const team = dashboardData?.team ?? [];
  const fund = dashboardData?.fund ?? null;
  const usedInvites = dashboardData?.usedInvites ?? 0;
  const pendingInvite = dashboardData?.pendingInvite ?? null;
  const listingViews = dashboardData?.listingViews ?? 0;
  const unreadMessageCount = dashboardData?.unreadMessageCount ?? 0;
  const perAppUnreadCounts = dashboardData?.perAppUnreadCounts ?? {};
  const perAppLastMessages = dashboardData?.perAppLastMessages ?? {};
  const loading = isLoading;

  // UI-only state
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RecruiterDashboardState['activeTab']>('inbox');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('atlas_recruiter_onboarded');
  });

  // Helper to patch dashboard cache
  const patchCache = useCallback((updater: (prev: RecruiterDashboardData) => RecruiterDashboardData) => {
    if (!user) return;
    queryClient.setQueryData<RecruiterDashboardData>(recruiterDashboardKeys.data(user.id), (prev) =>
      prev ? updater(prev) : prev
    );
  }, [user, queryClient]);

  const loadDashboard = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
        refetch();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kingdom_editors',
        filter: `kingdom_number=eq.${editorInfo.kingdom_number}`,
      }, () => {
        refetch();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transfer_applications',
        filter: `kingdom_number=eq.${editorInfo.kingdom_number}`,
      }, () => {
        showToast('New transfer application received!', 'info');
        refetch();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transfer_applications',
        filter: `kingdom_number=eq.${editorInfo.kingdom_number}`,
      }, () => {
        refetch();
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorInfo?.kingdom_number, user?.id, showToast, refetch]);

  const getInviteBudget = useCallback(() => {
    if (!editorInfo || !fund) return { total: 35, used: usedInvites, bonus: 0 };
    const base = 35;
    return { total: base, used: usedInvites, bonus: 0 };
  }, [editorInfo, fund, usedInvites]);

  const handleStatusChange = useCallback(async (applicationId: string, newStatus: string) => {
    if (!supabase || !user) return;
    setUpdating(applicationId);

    // Snapshot previous state for rollback
    const previousData = queryClient.getQueryData<RecruiterDashboardData>(recruiterDashboardKeys.data(user.id));

    // Optimistic update — immediately reflect the new status in the UI
    patchCache((prev) => ({
      ...prev,
      applications: prev.applications.map((a) => a.id === applicationId ? { ...a, status: newStatus as IncomingApplication['status'] } : a),
    }));

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

      if (error) {
        // Roll back optimistic update on server error
        if (previousData) {
          queryClient.setQueryData(recruiterDashboardKeys.data(user.id), previousData);
        }
        showToast('Failed to update application status.', 'error');
        logger.error('RecruiterDashboard: handleStatusChange server error', error);
      } else {
        // Funnel tracking for accepted applications
        if (newStatus === 'accepted') {
          trackFeature('Transfer Funnel: Application Accepted', { kingdom: editorInfo?.kingdom_number || 0 });
        }

        // Send notification to the applicant for meaningful status changes
        const app = (previousData?.applications ?? applications).find(a => a.id === applicationId);
        if (app && ['viewed', 'interested', 'accepted', 'declined'].includes(newStatus)) {
          const statusMessages: Record<string, { title: string; message: string }> = {
            viewed: { title: 'Application Viewed', message: `Kingdom ${editorInfo?.kingdom_number} has viewed your transfer application.` },
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
    } catch (err) {
      // Roll back optimistic update on network error
      if (previousData) {
        queryClient.setQueryData(recruiterDashboardKeys.data(user.id), previousData);
      }
      showToast('Failed to update application status.', 'error');
      logger.error('RecruiterDashboard: handleStatusChange failed', err);
    } finally {
      setUpdating(null);
    }
  }, [user, editorInfo, applications, trackFeature, patchCache, queryClient, showToast]);

  const handleToggleRecruiting = useCallback(async () => {
    if (!supabase || !fund || !editorInfo) return;
    const { error } = await supabase
      .from('kingdom_funds')
      .update({ is_recruiting: !fund.is_recruiting })
      .eq('kingdom_number', editorInfo.kingdom_number);

    if (!error) {
      patchCache((prev) => ({
        ...prev,
        fund: prev.fund ? { ...prev.fund, is_recruiting: !prev.fund.is_recruiting } : prev.fund,
      }));
    }
  }, [fund, editorInfo, patchCache]);

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
    patchCache((prev) => ({ ...prev, pendingInvite: null }));
    refetch();
  }, [pendingInvite, showToast, refetch, patchCache]);

  const handleDeclineInvite = useCallback(async () => {
    if (!supabase || !pendingInvite) return;
    await supabase
      .from('kingdom_editors')
      .update({ status: 'inactive' })
      .eq('id', pendingInvite.id);
    patchCache((prev) => ({ ...prev, pendingInvite: null }));
    showToast('Invitation declined.', 'success');
  }, [pendingInvite, showToast, patchCache]);

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
    unreadMessageCount,
    perAppUnreadCounts,
    perAppLastMessages,
    // Actions
    setActiveTab,
    setFilterStatus,
    setShowOnboarding,
    handleStatusChange,
    handleToggleRecruiting,
    handleAcceptInvite,
    handleDeclineInvite,
    loadDashboard,
    setFund: (fundOrUpdater: FundInfo | null | ((prev: FundInfo | null) => FundInfo | null)) => {
      patchCache((prev) => {
        const newFund = typeof fundOrUpdater === 'function' ? fundOrUpdater(prev.fund) : fundOrUpdater;
        return { ...prev, fund: newFund };
      });
    },
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
