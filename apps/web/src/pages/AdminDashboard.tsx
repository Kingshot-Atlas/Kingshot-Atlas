import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminPendingCounts, useUnreadEmailCount, useAdminFeedback, useAdminFeedbackCounts, useInvalidateAdmin } from '../hooks/useAdminQueries';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { kingdomKeys } from '../hooks/useKingdoms';
import { analyticsService } from '../services/analyticsService';
import { statusService, type StatusSubmission } from '../services/statusService';
import { apiService } from '../services/api';
import { correctionService } from '../services/correctionService';
import { kvkCorrectionService } from '../services/kvkCorrectionService';
import { kvkHistoryService } from '../services/kvkHistoryService';
// Lazy load heavy dashboard components for code splitting
// AnalyticsDashboard removed — revenue data moved to Finance tab
const EngagementDashboard = lazy(() => import('../components/EngagementDashboard').then(m => ({ default: m.EngagementDashboard })));
const WebhookMonitor = lazy(() => import('../components/WebhookMonitor').then(m => ({ default: m.WebhookMonitor })));
const DataSourceStats = lazy(() => import('../components/DataSourceStats').then(m => ({ default: m.DataSourceStats })));
const BotDashboard = lazy(() => import('../components/BotDashboard').then(m => ({ default: m.BotDashboard })));
const DiscordRolesDashboard = lazy(() => import('../components/DiscordRolesDashboard').then(m => ({ default: m.DiscordRolesDashboard })));
const ReferralIntelligence = lazy(() => import('../components/ReferralIntelligence'));
const UserHeatmap = lazy(() => import('../components/admin/UserHeatmap').then(m => ({ default: m.UserHeatmap })));
import { ADMIN_USERNAMES } from '../utils/constants';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { getAuthHeaders } from '../services/authHeaders';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { getCurrentKvK, incrementKvK } from '../services/configService';
import { CURRENT_KVK } from '../constants';
import {
  AdminHeader,
  AdminTabNav,
  SkeletonGrid,
  type AdminTab,
  type ApiHealth,
  type Submission,
  type DataCorrection,
  type KvKError,
  type AnalyticsData
} from '../components/admin';
// Lazy-load all tab components for chunk splitting
const AnalyticsOverview = lazy(() => import('../components/admin/AnalyticsOverview').then(m => ({ default: m.AnalyticsOverview })));
const FinanceTab = lazy(() => import('../components/admin/FinanceTab'));
const SubmissionsTab = lazy(() => import('../components/admin/SubmissionsTab').then(m => ({ default: m.SubmissionsTab })));
const KvKMatchupConflictsTab = lazy(() => import('../components/admin/KvKMatchupConflictsTab').then(m => ({ default: m.KvKMatchupConflictsTab })));
const AdminActivityFeed = lazy(() => import('../components/admin/AdminActivityFeed').then(m => ({ default: m.AdminActivityFeed })));
const TransferApplicationsTab = lazy(() => import('../components/admin/TransferApplicationsTab').then(m => ({ default: m.TransferApplicationsTab })));
const TransferHubAdminTab = lazy(() => import('../components/admin/TransferHubAdminTab').then(m => ({ default: m.TransferHubAdminTab })));
const EmailTab = lazy(() => import('../components/admin/EmailTab').then(m => ({ default: m.EmailTab })));
const FeedbackTab = lazy(() => import('../components/admin/FeedbackTab').then(m => ({ default: m.FeedbackTab })));
const CorrectionsTab = lazy(() => import('../components/admin/CorrectionsTab').then(m => ({ default: m.CorrectionsTab })));
const KvKErrorsTab = lazy(() => import('../components/admin/KvKErrorsTab').then(m => ({ default: m.KvKErrorsTab })));
const ReviewReportsTab = lazy(() => import('../components/admin/ReviewReportsTab').then(m => ({ default: m.ReviewReportsTab })));
const TransferStatusTab = lazy(() => import('../components/admin/TransferStatusTab').then(m => ({ default: m.TransferStatusTab })));
const BotTelemetryTab = lazy(() => import('../components/admin/BotTelemetryTab').then(m => ({ default: m.BotTelemetryTab })));
const ToolAccessTab = lazy(() => import('../components/admin/ToolAccessTab').then(m => ({ default: m.ToolAccessTab })));
const SpotlightTab = lazy(() => import('../components/admin/SpotlightTab').then(m => ({ default: m.SpotlightTab })));
const ImportTab = lazy(() => import('../components/admin/ImportTab'));
const RejectModal = lazy(() => import('../components/admin/RejectModal'));
const KvKBulkMatchupTab = lazy(() => import('../components/admin/KvKBulkMatchupTab'));
const TransferOutcomesTab = lazy(() => import('../components/admin/TransferOutcomesTab'));
const BotDashboardTransferGroups = lazy(() => import('./BotDashboardTransferGroups'));
const GiftCodeAnalyticsTab = lazy(() => import('../components/admin/GiftCodeAnalyticsTab'));

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const ADMIN_LOG_KEY = 'kingshot_admin_log';

const AdminDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Check if user is admin (must be declared before React Query hooks that depend on it)
  const isAdmin = profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase());

  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [transferSubmissions, setTransferSubmissions] = useState<StatusSubmission[]>([]);
  const [corrections, setCorrections] = useState<DataCorrection[]>([]);
  const [kvkErrors, setKvkErrors] = useState<KvKError[]>([]);
  const [rejectModalOpen, setRejectModalOpen] = useState<{ type: string; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewAsUser, setViewAsUser] = useState(false); // A4: View as user mode
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  // React Query hooks for polling data (ADR-022 migration)
  const { data: pendingCounts = { submissions: 0, claims: 0, corrections: 0, transfers: 0, kvkErrors: 0, feedback: 0, reviewReports: 0 } } = useAdminPendingCounts(!!isAdmin);
  const { data: unreadEmailCount = 0 } = useUnreadEmailCount(!!isAdmin);
  const { data: feedbackItems = [] } = useAdminFeedback(filter, !!isAdmin && activeTab === 'feedback');
  const { data: feedbackCounts = { new: 0, reviewed: 0, in_progress: 0, resolved: 0, closed: 0 } } = useAdminFeedbackCounts(!!isAdmin);
  const { invalidateFeedback, invalidatePendingCounts } = useInvalidateAdmin();
  const [syncingSubscriptions, setSyncingSubscriptions] = useState(false);
  const [currentKvK, setCurrentKvK] = useState<number>(CURRENT_KVK);
  const [incrementingKvK, setIncrementingKvK] = useState(false);
  const [apiHealth, setApiHealth] = useState<ApiHealth>({ api: 'loading', supabase: 'loading', stripe: 'loading' });
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [dashboardSearch, setDashboardSearch] = useState('');

  // Pending counts now managed by useAdminPendingCounts React Query hook

  // Fetch current KvK from API on mount
  useEffect(() => {
    if (isAdmin) {
      getCurrentKvK().then(kvk => setCurrentKvK(kvk));
    }
  }, [isAdmin]);

  // P5: Auto-refresh analytics every 60 seconds when on analytics tab
  useEffect(() => {
    if (!isAdmin || activeTab !== 'analytics') return;
    const interval = setInterval(() => {
      fetchAnalytics();
      invalidatePendingCounts();
    }, 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab]);

  // Unread email count now managed by useUnreadEmailCount React Query hook (30s polling)

  // Keyboard shortcuts
  useEffect(() => {
    if (!isAdmin) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case 'r': fetchAnalytics(); break;
        case '1': setActiveTab('analytics'); break;
        case '2': setActiveTab('submissions'); break;
        case '3': setActiveTab('transfer-hub'); break;
        case '4': setActiveTab('finance'); break;
        case '5': setActiveTab('email'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    
    if (activeTab === 'analytics') {
      fetchAnalytics();
    } else if (activeTab === 'submissions') {
      fetchSubmissions();
    } else if (activeTab === 'corrections') {
      fetchCorrections();
    } else if (activeTab === 'transfer-status') {
      fetchTransferSubmissions();
    } else if (activeTab === 'kvk-errors') {
      fetchKvkErrors();
    // feedback tab is now handled by useAdminFeedback/useAdminFeedbackCounts React Query hooks
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filter, isAdmin]);

  // invalidatePendingCounts, fetchFeedback, fetchFeedbackCounts now handled by React Query hooks

  const updateFeedbackStatus = async (id: string, status: string, adminNotes?: string) => {
    if (!supabase) return;
    try {
      const updateData: { status: string; admin_notes?: string } = { status };
      if (adminNotes !== undefined) {
        updateData.admin_notes = adminNotes;
      }
      
      const { error } = await supabase
        .from('feedback')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      showToast('Feedback updated', 'success');
      invalidateFeedback(); // React Query invalidation replaces manual refetch
    } catch (error) {
      logger.error('Failed to update feedback:', error);
      showToast('Failed to update feedback', 'error');
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Get real analytics from local tracking service
      const realAnalytics = analyticsService.getAnalyticsSummary();
      
      const realData: AnalyticsData = {
        // Real visit data from local tracking
        totalVisits: realAnalytics.totalEvents,
        uniqueVisitors: realAnalytics.uniqueSessions,
        pageViews: realAnalytics.pageViews,
        bounceRate: 0,
        visitDuration: 0,
        topSources: [],
        topCountries: [],
        userStats: { total: 0, free: 0, pro: 0, recruiter: 0, kingshot_linked: 0 },
        submissions: { pending: 0, approved: 0, rejected: 0 },
        revenue: { monthly: 0, total: 0, subscriptions: [] },
        featureUsage: realAnalytics.featureUsage,
        buttonClicks: realAnalytics.buttonClicks,
        eventsByDay: realAnalytics.eventsByDay,
      };
      
      // Fetch real stats from admin API (Supabase + Stripe)
      const health: ApiHealth = { api: 'loading', supabase: 'loading', stripe: 'loading' };
      try {
        const adminAuthHeaders = await getAuthHeaders({ requireAuth: false });
        const adminRes = await fetchWithRetry(`${API_URL}/api/v1/admin/stats/overview`, {
          headers: adminAuthHeaders
        });
        if (adminRes.ok) {
          health.api = 'ok';
          const adminData = await adminRes.json();
          realData.userStats = {
            total: adminData.users?.total || 0,
            free: adminData.users?.free || 0,
            pro: adminData.users?.pro || 0,
            recruiter: adminData.users?.recruiter || 0,
            kingshot_linked: adminData.users?.kingshot_linked || 0,
          };
          // Supabase health: if we got user data, Supabase is working
          health.supabase = adminData.users?.total !== undefined ? 'ok' : 'error';
          realData.revenue = {
            monthly: adminData.revenue?.mrr || 0,
            total: adminData.revenue?.total || 0,
            subscriptions: adminData.subscriptions || [],
            activeSubscriptions: adminData.revenue?.active_subscriptions || 0,
            recentPayments: adminData.recent_payments || [],
          };
          // Stripe health: if we got revenue data without error
          health.stripe = adminData.revenue?.mrr !== undefined ? 'ok' : 'error';
          realData.recentSubscribers = adminData.recent_subscribers || [];
        } else {
          health.api = 'error';
          health.supabase = 'error';
          health.stripe = 'error';
          showToast(`Admin API: ${adminRes.status} ${adminRes.statusText}`, 'error');
        }
      } catch (e) {
        health.api = 'error';
        health.supabase = 'error';
        health.stripe = 'error';
        logger.log('Could not fetch admin stats from API');
      }
      setApiHealth(health);
      
      // Fetch real submission counts from API (single batch call)
      try {
        const authHeaders = await getAuthHeaders({ requireAuth: false });
        const countsRes = await fetch(`${API_URL}/api/v1/submissions/counts`, { headers: authHeaders });
        if (countsRes.ok) {
          const counts = await countsRes.json();
          realData.submissions = {
            pending: counts.pending || 0,
            approved: counts.approved || 0,
            rejected: counts.rejected || 0,
          };
        }
      } catch (e) {
        logger.log('Could not fetch submission counts from API');
      }
      
      // Fetch real Plausible analytics (replaces local-only browser sessions)
      try {
        const authHeaders = await getAuthHeaders({ requireAuth: false });
        const plausibleRes = await fetch(`${API_URL}/api/v1/admin/stats/plausible`, { headers: authHeaders });
        if (plausibleRes.ok) {
          const pData = await plausibleRes.json();
          if (pData.source === 'plausible') {
            realData.uniqueVisitors = pData.visitors || realData.uniqueVisitors;
            realData.totalPageViews = pData.pageviews || 0;
            realData.bounceRate = pData.bounce_rate || 0;
            realData.visitDuration = pData.visit_duration || 0;
          }
        }
      } catch (e) {
        logger.log('Could not fetch Plausible analytics');
      }
      
      setAnalytics(realData);
      setLastRefreshed(new Date());
    } catch (error) {
      logger.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIncrementKvK = async () => {
    setIncrementingKvK(true);
    try {
      const result = await incrementKvK();
      if (result.success && result.new_kvk) {
        setCurrentKvK(result.new_kvk);
        showToast(`KvK incremented to #${result.new_kvk}!`, 'success');
      } else {
        showToast(result.error || 'Failed to increment KvK', 'error');
      }
    } catch (error) {
      logger.error('Failed to increment KvK:', error);
      showToast('Failed to increment KvK', 'error');
    } finally {
      setIncrementingKvK(false);
    }
  };

  const syncSubscriptions = async () => {
    setSyncingSubscriptions(true);
    try {
      const syncAuthHeaders = await getAuthHeaders({ requireAuth: false });
      const res = await fetch(`${API_URL}/api/v1/admin/subscriptions/sync-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...syncAuthHeaders }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.synced > 0) {
          showToast(`Synced ${data.synced} subscription(s)`, 'success');
          fetchAnalytics(); // Refresh the analytics
        } else if (data.error) {
          showToast(`Sync failed: ${data.error}`, 'error');
        } else {
          showToast('All subscriptions already in sync', 'success');
        }
      } else {
        showToast('Failed to sync subscriptions', 'error');
      }
    } catch (error) {
      logger.error('Failed to sync subscriptions:', error);
      showToast('Failed to sync subscriptions', 'error');
    } finally {
      setSyncingSubscriptions(false);
    }
  };

  const handleGrantSubscription = async (email: string, tier: string, source: string, reason: string): Promise<{ success: boolean; message: string }> => {
    try {
      const grantAuthHeaders = await getAuthHeaders({ requireAuth: false });
      const res = await fetch(`${API_URL}/api/v1/admin/subscriptions/grant-by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...grantAuthHeaders },
        body: JSON.stringify({ email, tier, source, reason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message, 'success');
        fetchAnalytics();
        return { success: true, message: data.message };
      } else {
        const errorMsg = data.detail || data.message || 'Failed to update subscription';
        showToast(errorMsg, 'error');
        return { success: false, message: errorMsg };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      showToast(`Grant failed: ${msg}`, 'error');
      return { success: false, message: msg };
    }
  };

  const fetchCorrections = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        setCorrections([]);
        return;
      }
      
      let query = supabase
        .from('data_corrections')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logger.error('Failed to fetch corrections:', error);
        setCorrections([]);
      } else {
        setCorrections((data || []).map(c => ({
          id: c.id,
          kingdom_number: c.kingdom_number,
          field: c.field,
          current_value: c.current_value,
          suggested_value: c.suggested_value,
          reason: c.reason || '',
          submitter_id: c.submitted_by,
          submitter_name: c.submitted_by_name || 'Anonymous',
          status: c.status,
          created_at: c.created_at,
          reviewed_by: c.reviewed_by_name,
          reviewed_at: c.reviewed_at,
          review_notes: c.review_notes
        })));
      }
    } catch (error) {
      logger.error('Failed to fetch corrections:', error);
      setCorrections([]);
    } finally {
      setLoading(false);
    }
  };

  const reviewCorrection = async (id: string, status: 'approved' | 'rejected', notes?: string) => {
    if (!supabase) {
      showToast('Database unavailable', 'error');
      return;
    }

    // Get the correction first for notification
    const { data: correction } = await supabase
      .from('data_corrections')
      .select('*')
      .eq('id', id)
      .single();

    // Update the correction in Supabase
    const { error } = await supabase
      .from('data_corrections')
      .update({
        status,
        reviewed_by: user?.id,
        reviewed_by_name: profile?.username || 'admin',
        reviewed_at: new Date().toISOString(),
        review_notes: notes || ''
      })
      .eq('id', id);

    if (error) {
      showToast(`Failed to ${status} correction: ${error.message}`, 'error');
      return;
    }

    logAdminAction('correction', id, status, notes);
    
    // Note: Notification is now sent automatically via database trigger
    // The trigger notify_user_on_data_correction_review handles this
    
    showToast(`Correction ${status}`, 'success');
    
    // Apply corrections to kingdom data immediately if approved
    if (status === 'approved' && correction) {
      correctionService.applyCorrectionsAndReload();
    }
    
    fetchCorrections();
    invalidatePendingCounts();
    setRejectModalOpen(null);
    setRejectReason('');
  };

  const fetchKvkErrors = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        setKvkErrors([]);
        return;
      }
      
      let query = supabase
        .from('kvk_errors')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logger.error('Failed to fetch KvK errors:', error);
        setKvkErrors([]);
      } else {
        setKvkErrors((data || []).map(e => ({
          id: e.id,
          kingdom_number: e.kingdom_number,
          kvk_number: e.kvk_number,
          error_type: e.error_type,
          error_type_label: e.error_type_label,
          current_data: e.current_data,
          description: e.description,
          submitted_by: e.submitted_by,
          submitted_by_name: e.submitted_by_name || 'Anonymous',
          submitted_at: e.submitted_at || e.created_at,
          status: e.status,
          reviewed_by: e.reviewed_by_name,
          reviewed_at: e.reviewed_at,
          review_notes: e.review_notes
        })));
      }
    } catch (error) {
      logger.error('Failed to fetch KvK errors:', error);
      setKvkErrors([]);
    } finally {
      setLoading(false);
    }
  };

  const reviewKvkError = async (id: string, status: 'approved' | 'rejected', notes?: string) => {
    if (!supabase) {
      showToast('Database unavailable', 'error');
      return;
    }

    // Get the error first for processing
    const { data: kvkError } = await supabase
      .from('kvk_errors')
      .select('*')
      .eq('id', id)
      .single();

    // Update the error in Supabase
    const { error } = await supabase
      .from('kvk_errors')
      .update({
        status,
        reviewed_by: user?.id,
        reviewed_by_name: profile?.username || 'admin',
        reviewed_at: new Date().toISOString(),
        review_notes: notes || ''
      })
      .eq('id', id);

    if (error) {
      showToast(`Failed to ${status} error: ${error.message}`, 'error');
      return;
    }

    logAdminAction('kvk-error', id, status, notes);
    
    // Note: Notification is now sent automatically via database trigger
    // The trigger notify_user_on_kvk_error_review handles this
    
    // Apply KvK correction to data if approved (writes to Supabase kvk_history)
    if (status === 'approved' && kvkError && (kvkError.current_data || kvkError.corrected_data)) {
      const success = await kvkCorrectionService.applyCorrectionAsync(kvkError, profile?.username || 'admin');
      if (success) {
        // Invalidate all caches to ensure fresh data everywhere
        kvkHistoryService.invalidateCache();
        apiService.reloadData();
        // Invalidate React Query cache for this kingdom
        queryClient.invalidateQueries({ queryKey: kingdomKeys.detail(kvkError.kingdom_number) });
        queryClient.invalidateQueries({ queryKey: kingdomKeys.lists() });
      }
    }
    
    const oppLabel = kvkError?.corrected_data?.opponent ?? kvkError?.current_data?.opponent;
    const toastMsg = status === 'approved' 
      ? `✅ KvK #${kvkError?.kvk_number} correction applied! Data updated for K${kvkError?.kingdom_number}${oppLabel ? ` and K${oppLabel}` : ''}`
      : `KvK error report rejected`;
    showToast(toastMsg, 'success');
    fetchKvkErrors();
    invalidatePendingCounts();
    setRejectModalOpen(null);
    setRejectReason('');
  };

  const logAdminAction = (type: string, id: string, action: string, notes?: string) => {
    try {
      const stored = localStorage.getItem(ADMIN_LOG_KEY);
      const log = stored ? JSON.parse(stored) : [];
      log.unshift({
        id: `log_${Date.now()}`,
        type,
        item_id: id,
        action,
        notes: notes || '',
        admin: profile?.username || 'unknown',
        timestamp: new Date().toISOString()
      });
      // Keep only last 100 entries
      localStorage.setItem(ADMIN_LOG_KEY, JSON.stringify(log.slice(0, 100)));
    } catch { /* ignore logging errors */ }
  };

  // A2: Bulk selection helpers
  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllPending = (type: 'corrections' | 'kvk-errors' | 'transfers') => {
    if (type === 'corrections') {
      const pendingIds = corrections.filter(c => c.status === 'pending').map(c => c.id);
      setSelectedItems(new Set(pendingIds));
    } else if (type === 'kvk-errors') {
      const pendingIds = kvkErrors.filter(e => e.status === 'pending').map(e => e.id);
      setSelectedItems(new Set(pendingIds));
    } else if (type === 'transfers') {
      const pendingIds = transferSubmissions.filter(t => t.status === 'pending').map(t => t.id);
      setSelectedItems(new Set(pendingIds));
    }
  };

  const clearSelection = () => setSelectedItems(new Set());

  const bulkReviewCorrections = async (status: 'approved' | 'rejected') => {
    if (selectedItems.size === 0 || !supabase) return;
    
    const ids = Array.from(selectedItems);
    const { error } = await supabase
      .from('data_corrections')
      .update({
        status,
        reviewed_by: user?.id,
        reviewed_by_name: profile?.username || 'admin',
        reviewed_at: new Date().toISOString()
      })
      .in('id', ids);

    if (error) {
      showToast(`Failed to bulk ${status} corrections: ${error.message}`, 'error');
      return;
    }

    ids.forEach(id => logAdminAction('correction', id, status, 'Bulk action'));
    showToast(`${selectedItems.size} corrections ${status}`, 'success');
    setSelectedItems(new Set());
    fetchCorrections();
    invalidatePendingCounts();
  };

  const bulkReviewKvkErrors = async (status: 'approved' | 'rejected') => {
    if (selectedItems.size === 0 || !supabase) return;
    
    const ids = Array.from(selectedItems);
    const { error } = await supabase
      .from('kvk_errors')
      .update({
        status,
        reviewed_by: user?.id,
        reviewed_by_name: profile?.username || 'admin',
        reviewed_at: new Date().toISOString()
      })
      .in('id', ids);

    if (error) {
      showToast(`Failed to bulk ${status} KvK errors: ${error.message}`, 'error');
      return;
    }

    ids.forEach(id => logAdminAction('kvk-error', id, status, 'Bulk action'));
    showToast(`${selectedItems.size} KvK errors ${status}`, 'success');
    setSelectedItems(new Set());
    fetchKvkErrors();
    invalidatePendingCounts();
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const response = await fetch(`${API_URL}/api/v1/submissions?status=${filter}`, {
        headers: authHeaders
      });
      if (response.ok) {
        setSubmissions(await response.json());
      }
    } catch (error) {
      logger.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const reviewSubmission = async (id: number, status: 'approved' | 'rejected') => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v1/submissions/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        const data = await response.json();
        if (status === 'approved' && data.kingdom_number) {
          showToast(`✅ Approved! KvK data added to Kingdom ${data.kingdom_number}`, 'success');
          // Reload Supabase data to sync Atlas Scores across all pages
          await apiService.reloadWithSupabaseData();
          // Invalidate React Query cache so all components refetch
          queryClient.invalidateQueries({ queryKey: kingdomKeys.all });
        } else {
          showToast(`Submission ${status}`, 'success');
        }
        fetchSubmissions();
        invalidatePendingCounts();
      } else {
        showToast('Failed to review submission', 'error');
      }
    } catch (error) {
      showToast('Error reviewing submission', 'error');
    }
  };

  // Transfer Status Submissions - fetch from Supabase
  const fetchTransferSubmissions = async () => {
    setLoading(true);
    try {
      // Use statusService to fetch from Supabase (source of truth)
      const statusFilter = filter === 'all' ? 'all' : filter as 'pending' | 'approved' | 'rejected';
      const submissions = await statusService.fetchAllSubmissions(statusFilter);
      setTransferSubmissions(submissions);
    } catch (error) {
      logger.error('Failed to fetch transfer submissions:', error);
      showToast('Failed to load transfer submissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const reviewTransferSubmission = async (id: string, status: 'approved' | 'rejected') => {
    try {
      if (status === 'approved') {
        await statusService.approveSubmission(id, user?.id || '', 'Approved by admin');
      } else {
        await statusService.rejectSubmission(id, user?.id || '', 'Rejected by admin');
      }
      // Reload kingdom data to apply the new status
      apiService.reloadData();
      showToast(`Transfer status ${status}`, 'success');
      fetchTransferSubmissions();
      invalidatePendingCounts();
    } catch (error) {
      showToast('Error reviewing transfer submission', 'error');
    }
  };

  // Not logged in
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
        <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Admin Access Required</h2>
        <p>Please sign in with an authorized account to access the admin dashboard.</p>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>🚫 Access Denied</h2>
        <p>You don&apos;t have permission to access the admin dashboard.</p>
        <p style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
          Logged in as: {profile?.username || 'Unknown'}
        </p>
      </div>
    );
  }

  // Determine active category based on current tab
  const getActiveCategory = () => {
    if (['analytics', 'engagement', 'user-heatmap'].includes(activeTab)) return 'overview';
    if (['submissions', 'corrections', 'kvk-errors', 'matchup-conflicts', 'kvk-bulk', 'review-reports'].includes(activeTab)) return 'review';
    if (['transfer-hub', 'transfer-status', 'transfer-apps', 'transfer-outcomes'].includes(activeTab)) return 'transfer';
    if (['finance'].includes(activeTab)) return 'finance';
    return 'operations';
  };
  const activeCategory = getActiveCategory();
  const totalPending = pendingCounts.submissions + pendingCounts.corrections + pendingCounts.transfers + pendingCounts.kvkErrors + pendingCounts.feedback + (pendingCounts.reviewReports || 0);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
      <AdminHeader
        totalPending={totalPending}
        unreadEmailCount={unreadEmailCount}
        viewAsUser={viewAsUser}
        onToggleViewAsUser={() => setViewAsUser(!viewAsUser)}
        onNavigateToEmail={() => setActiveTab('email')}
        apiHealth={apiHealth}
        username={profile?.username || ''}
        dashboardSearch={dashboardSearch}
        onSearchChange={setDashboardSearch}
      />

      <AdminTabNav
        activeTab={activeTab}
        activeCategory={activeCategory}
        pendingCounts={pendingCounts}
        unreadEmailCount={unreadEmailCount}
        onTabChange={setActiveTab}
      />

      {/* Filter (not for analytics) */}
      {(['submissions', 'corrections', 'kvk-errors', 'transfer-status', 'feedback'] as const).includes(activeTab as never) && (
        <div style={{ marginBottom: '1rem' }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#111116',
              color: '#ffffff',
              border: '1px solid #2a2a2a',
              borderRadius: '6px'
            }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
      )}

      <Suspense fallback={<SkeletonGrid cards={4} cardHeight="100px" />}>
      {loading && activeTab !== 'import' ? (
        <SkeletonGrid cards={4} cardHeight="100px" />
      ) : activeTab === 'analytics' ? (
        <>
          {/* Last Refreshed + Refresh Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {lastRefreshed && (
              <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <button onClick={fetchAnalytics} disabled={loading} style={{
              background: 'none', border: '1px solid #2a2a2a', borderRadius: '4px',
              color: '#6b7280', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.7rem'
            }}>
              {loading ? '...' : 'Refresh'}
            </button>
          </div>
          <AnalyticsOverview 
            analytics={analytics} 
            syncingSubscriptions={syncingSubscriptions}
            onSyncSubscriptions={syncSubscriptions}
            currentKvK={currentKvK}
            incrementingKvK={incrementingKvK}
            onIncrementKvK={handleIncrementKvK}
          />
          {/* Admin Activity Feed */}
          <div style={{ marginTop: '1.5rem' }}>
            <AdminActivityFeed />
          </div>
        </>
      ) : activeTab === 'finance' ? (
        <FinanceTab
          syncingSubscriptions={syncingSubscriptions}
          onSyncSubscriptions={syncSubscriptions}
          onGrantSubscription={handleGrantSubscription}
        />
      ) : activeTab === 'engagement' ? (
        <EngagementDashboard />
      ) : activeTab === 'user-heatmap' ? (
        <UserHeatmap />
      ) : activeTab === 'webhooks' ? (
        <WebhookMonitor />
      ) : activeTab === 'data-sources' ? (
        <DataSourceStats />
      ) : activeTab === 'discord-bot' ? (
        <BotDashboard />
      ) : activeTab === 'discord-roles' ? (
        <DiscordRolesDashboard />
      ) : activeTab === 'referrals' ? (
        <ReferralIntelligence />
      ) : activeTab === 'submissions' ? (
        <SubmissionsTab
          submissions={submissions}
          filter={filter}
          onReview={reviewSubmission}
        />
      ) : activeTab === 'corrections' ? (
        <CorrectionsTab
          corrections={corrections}
          filter={filter}
          selectedItems={selectedItems}
          onReviewCorrection={reviewCorrection}
          onRejectOpen={(id) => setRejectModalOpen({ type: 'correction', id })}
          onSelectAllPending={() => selectAllPending('corrections')}
          onToggleItem={toggleItemSelection}
          onBulkReview={bulkReviewCorrections}
          onClearSelection={clearSelection}
        />
      ) : activeTab === 'kvk-errors' ? (
        <KvKErrorsTab
          kvkErrors={kvkErrors}
          filter={filter}
          selectedItems={selectedItems}
          onReviewError={reviewKvkError}
          onRejectOpen={(id) => setRejectModalOpen({ type: 'kvk-error', id })}
          onSelectAllPending={() => selectAllPending('kvk-errors')}
          onToggleItem={toggleItemSelection}
          onBulkReview={bulkReviewKvkErrors}
          onClearSelection={clearSelection}
        />
      ) : activeTab === 'review-reports' ? (
        <ReviewReportsTab filter={dashboardSearch} />
      ) : activeTab === 'matchup-conflicts' ? (
        <KvKMatchupConflictsTab />
      ) : activeTab === 'kvk-bulk' ? (
        <KvKBulkMatchupTab />
      ) : activeTab === 'transfer-hub' ? (
        <TransferHubAdminTab />
      ) : activeTab === 'transfer-status' ? (
        <TransferStatusTab
          transferSubmissions={transferSubmissions}
          filter={filter}
          onReview={reviewTransferSubmission}
        />
      ) : activeTab === 'transfer-apps' ? (
        <TransferApplicationsTab />
      ) : activeTab === 'transfer-outcomes' ? (
        <TransferOutcomesTab />
      ) : activeTab === 'email' ? (
        <EmailTab />
      ) : activeTab === 'bot-telemetry' ? (
        <BotTelemetryTab />
      ) : activeTab === 'tool-access' ? (
        <ToolAccessTab />
      ) : activeTab === 'feedback' ? (
        <FeedbackTab
          items={feedbackItems}
          counts={feedbackCounts}
          onUpdateStatus={updateFeedbackStatus}
          onEmailReply={(email, subject, body) => {
            // S2.2: Switch to email tab and pre-fill compose
            setActiveTab('email');
            // Store pre-fill data for EmailTab via sessionStorage
            sessionStorage.setItem('email_prefill', JSON.stringify({ to: email, subject, body }));
          }}
        />
      ) : activeTab === 'spotlight' ? (
        <SpotlightTab />
      ) : activeTab === 'import' ? (
        <ImportTab />
      ) : activeTab === 'transfer-groups' ? (
        <BotDashboardTransferGroups />
      ) : activeTab === 'gift-codes' ? (
        <GiftCodeAnalyticsTab />
      ) : null}
      </Suspense>

      {/* Reject Modal with Reason */}
      {rejectModalOpen && (
        <RejectModal
          rejectModalOpen={rejectModalOpen}
          rejectReason={rejectReason}
          onRejectReasonChange={setRejectReason}
          onClose={() => { setRejectModalOpen(null); setRejectReason(''); }}
          onConfirm={() => {
            if (rejectModalOpen.type === 'kvk-error') {
              reviewKvkError(rejectModalOpen.id, 'rejected', rejectReason);
            } else if (rejectModalOpen.type === 'correction') {
              reviewCorrection(rejectModalOpen.id, 'rejected', rejectReason);
            }
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
