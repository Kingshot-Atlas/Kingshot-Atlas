import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
const AnalyticsDashboard = lazy(() => import('../components/AnalyticsCharts').then(m => ({ default: m.AnalyticsDashboard })));
const EngagementDashboard = lazy(() => import('../components/EngagementDashboard').then(m => ({ default: m.EngagementDashboard })));
const WebhookMonitor = lazy(() => import('../components/WebhookMonitor').then(m => ({ default: m.WebhookMonitor })));
const DataSourceStats = lazy(() => import('../components/DataSourceStats').then(m => ({ default: m.DataSourceStats })));
const BotDashboard = lazy(() => import('../components/BotDashboard').then(m => ({ default: m.BotDashboard })));
const DiscordRolesDashboard = lazy(() => import('../components/DiscordRolesDashboard').then(m => ({ default: m.DiscordRolesDashboard })));
import { ADMIN_USERNAMES } from '../utils/constants';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { getAuthHeaders } from '../services/authHeaders';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { getCurrentKvK, incrementKvK } from '../services/configService';
import { CURRENT_KVK } from '../constants';
import { 
  AnalyticsOverview, 
  SubmissionsTab, 
  NewKingdomsTab, 
  ClaimsTab,
  AdminActivityFeed,
  PlausibleInsights,
  SkeletonGrid,
  type Submission,
  type Claim,
  type DataCorrection,
  type KvKError,
  type NewKingdomSubmission,
  type AnalyticsData
} from '../components/admin';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const ADMIN_LOG_KEY = 'kingshot_admin_log';

const AdminDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'analytics' | 'saas-metrics' | 'engagement' | 'webhooks' | 'data-sources' | 'discord-bot' | 'discord-roles' | 'submissions' | 'new-kingdoms' | 'claims' | 'corrections' | 'kvk-errors' | 'import' | 'users' | 'plausible' | 'transfer-status' | 'feedback'>('analytics');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [transferSubmissions, setTransferSubmissions] = useState<StatusSubmission[]>([]);
  const [corrections, setCorrections] = useState<DataCorrection[]>([]);
  const [kvkErrors, setKvkErrors] = useState<KvKError[]>([]);
  const [newKingdomSubmissions, setNewKingdomSubmissions] = useState<NewKingdomSubmission[]>([]);
  const [rejectModalOpen, setRejectModalOpen] = useState<{ type: string; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewAsUser, setViewAsUser] = useState(false); // A4: View as user mode
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [importData, setImportData] = useState<string>('');
  const [duplicateRows, setDuplicateRows] = useState<Array<{ existing: Record<string, unknown>; incoming: Record<string, unknown>; action: 'replace' | 'skip' }>>([]);
  const [newRows, setNewRows] = useState<Array<Record<string, unknown>>>([]);
  const [importProcessing, setImportProcessing] = useState(false);
  const [missingKingdomsForImport, setMissingKingdomsForImport] = useState<number[]>([]);
  const [importStep, setImportStep] = useState<'input' | 'preview' | 'duplicates' | 'importing'>('input');
  const [parsedRecords, setParsedRecords] = useState<Array<Record<string, unknown>>>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; field: string; value: string; message: string }>>([]);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; phase: string }>({ current: 0, total: 0, phase: '' });
  const [importHistory, setImportHistory] = useState<Array<{ id: string; admin_username: string; total_rows: number; inserted_rows: number; replaced_rows: number; skipped_rows: number; kingdoms_created: number; kvk_numbers: number[]; validation_errors: number; created_at: string }>>([]);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{ updated: number; avgScore: number; ranksFixed: number } | null>(null);
  const [pendingCounts, setPendingCounts] = useState<{ submissions: number; claims: number; corrections: number; transfers: number; kvkErrors: number; feedback: number }>({ submissions: 0, claims: 0, corrections: 0, transfers: 0, kvkErrors: 0, feedback: 0 });
  const [feedbackItems, setFeedbackItems] = useState<Array<{ id: string; type: string; message: string; email: string | null; status: string; page_url: string | null; created_at: string; admin_notes: string | null }>>([]); 
  const [feedbackCounts, setFeedbackCounts] = useState<{ new: number; reviewed: number; in_progress: number; resolved: number; closed: number }>({ new: 0, reviewed: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [syncingSubscriptions, setSyncingSubscriptions] = useState(false);
  const [currentKvK, setCurrentKvK] = useState<number>(CURRENT_KVK);
  const [incrementingKvK, setIncrementingKvK] = useState(false);
  const [apiHealth, setApiHealth] = useState<{ api: 'ok' | 'error' | 'loading'; supabase: 'ok' | 'error' | 'loading'; stripe: 'ok' | 'error' | 'loading' }>({ api: 'loading', supabase: 'loading', stripe: 'loading' });
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Check if user is admin
  const isAdmin = profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase());

  // Fetch pending counts on mount
  useEffect(() => {
    if (isAdmin) fetchPendingCounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Fetch current KvK from API on mount
  useEffect(() => {
    if (isAdmin) {
      getCurrentKvK().then(kvk => setCurrentKvK(kvk));
    }
  }, [isAdmin]);

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
        case '3': setActiveTab('claims'); break;
        case '4': setActiveTab('saas-metrics'); break;
        case '5': setActiveTab('webhooks'); break;
        case '6': setActiveTab('discord-bot'); break;
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
    } else if (activeTab === 'claims') {
      fetchClaims();
    } else if (activeTab === 'corrections') {
      fetchCorrections();
    } else if (activeTab === 'transfer-status') {
      fetchTransferSubmissions();
    } else if (activeTab === 'kvk-errors') {
      fetchKvkErrors();
    } else if (activeTab === 'new-kingdoms') {
      fetchNewKingdomSubmissions();
    } else if (activeTab === 'feedback') {
      fetchFeedback();
      fetchFeedbackCounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filter, isAdmin]);

  const fetchNewKingdomSubmissions = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query = supabase
        .from('new_kingdom_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching new kingdom submissions:', error);
        showToast('Failed to load submissions', 'error');
      } else {
        setNewKingdomSubmissions(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveNewKingdom = async (submission: NewKingdomSubmission) => {
    if (!supabase) return;
    try {
      // 1. Create the kingdom record in Supabase kingdoms table
      const { error: kingdomError } = await supabase
        .from('kingdoms')
        .insert({
          kingdom_number: submission.kingdom_number,
          first_kvk_id: submission.first_kvk_id,
          total_kvks: 0,
          prep_wins: 0,
          prep_losses: 0,
          battle_wins: 0,
          battle_losses: 0,
          dominations: 0,
          invasions: 0,
          atlas_score: 0,
          most_recent_status: 'Unannounced'
        });
      
      if (kingdomError) {
        // Check if kingdom already exists (might have been created via another path)
        if (kingdomError.code !== '23505') { // Not a duplicate key error
          throw kingdomError;
        }
      }
      
      // 2. Insert KvK history records (if kingdom had their first KvK)
      if (submission.first_kvk_id !== null && submission.kvk_history.length > 0) {
        const kvkRecords = submission.kvk_history.map(kvk => ({
          kingdom_number: submission.kingdom_number,
          kvk_number: kvk.kvk,
          prep_result: kvk.prep,
          battle_result: kvk.battle,
          overall_result: kvk.battle, // Battle result determines overall
          order_index: kvk.kvk
        }));
        
        const { error: kvkError } = await supabase
          .from('kvk_history')
          .insert(kvkRecords);
        
        if (kvkError) {
          console.error('KvK history insert error:', kvkError);
          // Don't fail the whole approval - kingdom was created
        }
      }
      
      // 3. Update submission status to approved
      const { error: updateError } = await supabase
        .from('new_kingdom_submissions')
        .update({
          status: 'approved',
          reviewed_by: profile?.username || 'Admin',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submission.id);
      
      if (updateError) throw updateError;
      
      const kvkMsg = submission.first_kvk_id === null 
        ? '(no KvK history yet)' 
        : `with ${submission.kvk_history.length} KvK record(s)`;
      showToast(`Kingdom ${submission.kingdom_number} created ${kvkMsg}`, 'success');
      fetchNewKingdomSubmissions();
    } catch (err) {
      console.error('Approve error:', err);
      showToast('Failed to approve submission', 'error');
    }
  };

  const handleRejectNewKingdom = async (submissionId: string, reason: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('new_kingdom_submissions')
        .update({
          status: 'rejected',
          reviewed_by: profile?.username || 'Admin',
          reviewed_at: new Date().toISOString(),
          review_notes: reason
        })
        .eq('id', submissionId);
      
      if (error) throw error;
      
      showToast('Submission rejected', 'success');
      setRejectModalOpen(null);
      setRejectReason('');
      fetchNewKingdomSubmissions();
    } catch (err) {
      console.error('Reject error:', err);
      showToast('Failed to reject submission', 'error');
    }
  };

  const fetchPendingCounts = async () => {
    try {
      // Corrections from Supabase
      let pendingCorrections = 0;
      if (supabase) {
        const { count } = await supabase
          .from('data_corrections')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        pendingCorrections = count || 0;
      }
      
      // Transfer status from Supabase (source of truth)
      let pendingTransfers = 0;
      try {
        const transfers = await statusService.fetchAllSubmissions('pending');
        pendingTransfers = transfers.length;
      } catch { /* Supabase might not be available */ }
      
      // Submissions and claims from API
      let pendingSubmissions = 0;
      let pendingClaims = 0;
      
      try {
        const authHeaders = await getAuthHeaders({ requireAuth: false });
        const submissionsRes = await fetch(`${API_URL}/api/v1/submissions?status=pending`, {
          headers: authHeaders
        });
        if (submissionsRes.ok) {
          const data = await submissionsRes.json();
          pendingSubmissions = Array.isArray(data) ? data.length : 0;
        }
      } catch { /* API might not be available */ }
      
      try {
        const authHeaders = await getAuthHeaders({ requireAuth: false });
        const claimsRes = await fetch(`${API_URL}/api/v1/claims?status=pending`, {
          headers: authHeaders
        });
        if (claimsRes.ok) {
          const data = await claimsRes.json();
          pendingClaims = Array.isArray(data) ? data.length : 0;
        }
      } catch { /* API might not be available */ }
      
      // KvK errors from Supabase
      let pendingKvkErrors = 0;
      if (supabase) {
        const { count } = await supabase
          .from('kvk_errors')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        pendingKvkErrors = count || 0;
      }
      
      // Feedback count from Supabase
      let pendingFeedback = 0;
      if (supabase) {
        try {
          const { count } = await supabase
            .from('feedback')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'new');
          pendingFeedback = count || 0;
        } catch { /* Table might not exist yet */ }
      }

      setPendingCounts({
        submissions: pendingSubmissions,
        claims: pendingClaims,
        corrections: pendingCorrections,
        transfers: pendingTransfers,
        kvkErrors: pendingKvkErrors,
        feedback: pendingFeedback
      });
    } catch (error) {
      console.error('Failed to fetch pending counts:', error);
    }
  };

  const fetchFeedback = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query = supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filter === 'pending') {
        query = query.eq('status', 'new');
      } else if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      const { data, error } = await query.limit(100);
      if (error) throw error;
      setFeedbackItems(data || []);
    } catch (error) {
      logger.error('Failed to fetch feedback:', error);
      showToast('Failed to load feedback', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbackCounts = async () => {
    if (!supabase) return;
    try {
      // Fetch all feedback to count by status (independent of filter)
      const { data, error } = await supabase
        .from('feedback')
        .select('status');
      
      if (error) throw error;
      
      const counts = { new: 0, reviewed: 0, in_progress: 0, resolved: 0, closed: 0 };
      (data || []).forEach(item => {
        const status = item.status as keyof typeof counts;
        if (status in counts) {
          counts[status]++;
        }
      });
      setFeedbackCounts(counts);
    } catch (error) {
      logger.error('Failed to fetch feedback counts:', error);
    }
  };

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
      fetchFeedback();
      fetchFeedbackCounts();
      fetchPendingCounts();
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
      const health: { api: 'ok' | 'error' | 'loading'; supabase: 'ok' | 'error' | 'loading'; stripe: 'ok' | 'error' | 'loading' } = { api: 'loading', supabase: 'loading', stripe: 'loading' };
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
      console.error('Failed to fetch analytics:', error);
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
      console.error('Failed to increment KvK:', error);
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
      console.error('Failed to sync subscriptions:', error);
      showToast('Failed to sync subscriptions', 'error');
    } finally {
      setSyncingSubscriptions(false);
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
        console.error('Failed to fetch corrections:', error);
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
      console.error('Failed to fetch corrections:', error);
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
    fetchPendingCounts();
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
        console.error('Failed to fetch KvK errors:', error);
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
      console.error('Failed to fetch KvK errors:', error);
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
    if (status === 'approved' && kvkError?.current_data) {
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
    
    const toastMsg = status === 'approved' 
      ? `✅ KvK #${kvkError?.kvk_number} correction applied! Data updated for K${kvkError?.kingdom_number} and K${kvkError?.current_data?.opponent}`
      : `KvK error report rejected`;
    showToast(toastMsg, 'success');
    fetchKvkErrors();
    fetchPendingCounts();
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
    fetchPendingCounts();
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
    fetchPendingCounts();
  };

  // Helper to create empty kingdom records
  const createEmptyKingdom = (kingdomNumber: number) => ({
    kingdom_number: kingdomNumber,
    total_kvks: 0,
    prep_wins: 0,
    prep_losses: 0,
    prep_win_rate: 0,
    prep_streak: 0,
    prep_loss_streak: 0,
    prep_best_streak: 0,
    battle_wins: 0,
    battle_losses: 0,
    battle_win_rate: 0,
    battle_streak: 0,
    battle_loss_streak: 0,
    battle_best_streak: 0,
    dominations: 0,
    reversals: 0,
    comebacks: 0,
    invasions: 0,
    atlas_score: 0,
    most_recent_status: 'Unannounced',
    last_updated: new Date().toISOString()
  });

  // Fetch import history from Supabase
  const fetchImportHistory = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('import_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setImportHistory(data);
  };

  // Step 1: Parse & Validate CSV → show preview
  const handleParseAndPreview = () => {
    if (!importData.trim()) {
      showToast('Please paste CSV data', 'error');
      return;
    }
    const lines = importData.trim().split('\n');
    if (lines.length < 2) {
      showToast('CSV must have header and at least one data row', 'error');
      return;
    }
    const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase()) || [];

    // Validate required columns
    const hasOpponentCol = headers.includes('opponent_kingdom') || headers.includes('opponent_number');
    const requiredCols = ['kingdom_number', 'kvk_number', 'prep_result', 'battle_result', 'overall_result', 'kvk_date'];
    const missingCols = requiredCols.filter(col => !headers.includes(col));
    if (!hasOpponentCol) missingCols.push('opponent_kingdom');
    if (missingCols.length > 0) {
      showToast(`Missing columns: ${missingCols.join(', ')}`, 'error');
      return;
    }

    const opponentHeader = headers.includes('opponent_kingdom') ? 'opponent_kingdom' : 'opponent_number';
    const rawRecords = lines.slice(1).filter(line => line.trim()).map(line => {
      const values = line.split(',');
      const record: Record<string, string> = {};
      headers.forEach((h, i) => record[h] = values[i]?.trim() || '');
      return record;
    });

    // Validate each row
    const errors: Array<{ row: number; field: string; value: string; message: string }> = [];
    const validResults = ['W', 'L', 'B'];
    const validOutcomes = ['DOMINATION', 'INVASION', 'COMEBACK', 'REVERSAL', 'BYE'];

    const kvkRecords = rawRecords.map((r, idx) => {
      const rowNum = idx + 2; // 1-indexed, skip header
      const kn = parseInt(r.kingdom_number || '0', 10);
      const kvk = parseInt(r.kvk_number || '0', 10);
      const opp = parseInt(r[opponentHeader] || '0', 10);
      const prep = r.prep_result?.toUpperCase() || '';
      const battle = r.battle_result?.toUpperCase() || '';
      const overall = r.overall_result || '';
      const date = r.kvk_date || '';
      const isBye = overall.toUpperCase() === 'BYE' || (opp === 0 && prep === 'B' && battle === 'B');

      if (!kn || kn <= 0) errors.push({ row: rowNum, field: 'kingdom_number', value: r.kingdom_number || '', message: 'Must be a positive integer' });
      if (!kvk || kvk <= 0) errors.push({ row: rowNum, field: 'kvk_number', value: r.kvk_number || '', message: 'Must be a positive integer' });
      if (!isBye && opp <= 0) errors.push({ row: rowNum, field: opponentHeader, value: r[opponentHeader] || '', message: 'Must be a positive integer (or 0 for Bye)' });
      if (!validResults.includes(prep)) errors.push({ row: rowNum, field: 'prep_result', value: prep, message: `Must be W, L, or B (got "${prep}")` });
      if (!validResults.includes(battle)) errors.push({ row: rowNum, field: 'battle_result', value: battle, message: `Must be W, L, or B (got "${battle}")` });
      if (!validOutcomes.includes(overall.toUpperCase()) && overall) errors.push({ row: rowNum, field: 'overall_result', value: overall, message: `Expected Domination/Invasion/Comeback/Reversal/Bye` });
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push({ row: rowNum, field: 'kvk_date', value: date, message: 'Must be YYYY-MM-DD format' });

      return {
        kingdom_number: kn,
        kvk_number: kvk,
        opponent_kingdom: opp,
        prep_result: prep || null,
        battle_result: battle || null,
        overall_result: overall || null,
        kvk_date: date || null,
        order_index: r.order_index ? parseInt(r.order_index, 10) : kvk
      };
    });

    setValidationErrors(errors);
    setParsedRecords(kvkRecords);
    setImportStep('preview');
    if (errors.length > 0) {
      showToast(`${errors.length} validation issue(s) found — review highlighted rows`, 'error');
    }
  };

  // Step 2: Check duplicates and proceed
  const handleCheckDuplicates = async () => {
    if (!supabase) return;
    // Filter out rows with critical errors (kingdom_number or kvk_number = 0)
    const validRecords = parsedRecords.filter(r => (r.kingdom_number as number) > 0 && (r.kvk_number as number) > 0);
    if (validRecords.length === 0) {
      showToast('No valid rows to import after filtering errors', 'error');
      return;
    }

    setImportProcessing(true);
    try {
      // Check missing kingdoms
      const allKingdomNumbers = new Set<number>();
      validRecords.forEach(r => {
        if ((r.kingdom_number as number) > 0) allKingdomNumbers.add(r.kingdom_number as number);
        if ((r.opponent_kingdom as number) > 0) allKingdomNumbers.add(r.opponent_kingdom as number);
      });

      const { data: existingKingdoms } = await supabase
        .from('kingdoms')
        .select('kingdom_number')
        .in('kingdom_number', Array.from(allKingdomNumbers));
      const existingSet = new Set((existingKingdoms || []).map(k => k.kingdom_number));
      const missingKingdoms = Array.from(allKingdomNumbers).filter(kn => !existingSet.has(kn));
      setMissingKingdomsForImport(missingKingdoms);

      // Check for duplicates
      const uniqueKvkNumbers = [...new Set(validRecords.map(r => r.kvk_number as number))];
      const uniqueKingdomNumbers = [...new Set(validRecords.map(r => r.kingdom_number as number))];

      const { data: existingRows } = await supabase
        .from('kvk_history')
        .select('*')
        .in('kingdom_number', uniqueKingdomNumbers)
        .in('kvk_number', uniqueKvkNumbers);

      const existingMap = new Map<string, Record<string, unknown>>();
      (existingRows || []).forEach(row => {
        existingMap.set(`${row.kingdom_number}-${row.kvk_number}`, row);
      });

      const freshRows: Record<string, unknown>[] = [];
      const dupes: Array<{ existing: Record<string, unknown>; incoming: Record<string, unknown>; action: 'replace' | 'skip' }> = [];

      validRecords.forEach(r => {
        const key = `${r.kingdom_number}-${r.kvk_number}`;
        const existing = existingMap.get(key);
        if (existing) {
          dupes.push({ existing, incoming: r, action: 'skip' });
        } else {
          freshRows.push(r);
        }
      });

      setNewRows(freshRows);
      setDuplicateRows(dupes);

      if (dupes.length > 0) {
        setImportStep('duplicates');
        showToast(`Found ${dupes.length} duplicate row(s). Review below.`, 'info');
      } else {
        // No duplicates — go straight to import
        await executeImport(freshRows, [], missingKingdoms);
      }
    } catch (error) {
      console.error('Duplicate check error:', error);
      showToast('Error checking for duplicates', 'error');
    } finally {
      setImportProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    const rowsToReplace = duplicateRows.filter(d => d.action === 'replace').map(d => d.incoming);
    const skippedCount = duplicateRows.filter(d => d.action === 'skip').length;
    await executeImport(newRows, rowsToReplace, missingKingdomsForImport, skippedCount);
  };

  const executeImport = async (freshRows: Record<string, unknown>[], replaceRows: Record<string, unknown>[], missingKingdoms: number[], skippedCount = 0) => {
    if (!supabase) return;
    setImportStep('importing');
    setImportProcessing(true);
    const totalOps = freshRows.length + replaceRows.length + (missingKingdoms.length > 0 ? 1 : 0);
    let completedOps = 0;

    try {
      // Phase 1: Auto-create missing kingdoms
      if (missingKingdoms.length > 0) {
        setImportProgress({ current: 0, total: totalOps, phase: `Creating ${missingKingdoms.length} missing kingdoms...` });
        const batchSize = 200;
        for (let i = 0; i < missingKingdoms.length; i += batchSize) {
          const batch = missingKingdoms.slice(i, i + batchSize).map(kn => createEmptyKingdom(kn));
          const { error: createError } = await supabase
            .from('kingdoms')
            .upsert(batch, { onConflict: 'kingdom_number' });
          if (createError) {
            console.error('Failed to create missing kingdoms:', createError);
            showToast(`Warning: Could not create some missing kingdoms`, 'error');
          }
        }
        completedOps++;
        setImportProgress({ current: completedOps, total: totalOps, phase: 'Kingdoms created' });
      }

      let insertedCount = 0;
      let replacedCount = 0;
      const batchSize = 50;

      // Disable expensive triggers during bulk insert (recalc happens in Phases 5-7 instead)
      setImportProgress({ current: completedOps, total: totalOps, phase: 'Preparing bulk insert...' });
      const { error: disableErr } = await supabase.rpc('disable_kvk_triggers');
      if (disableErr) console.error('Could not disable triggers (non-fatal):', disableErr);

      // Phase 2: Insert fresh rows in batches
      if (freshRows.length > 0) {
        setImportProgress({ current: completedOps, total: totalOps, phase: `Inserting ${freshRows.length} new rows...` });
        for (let i = 0; i < freshRows.length; i += batchSize) {
          const batch = freshRows.slice(i, i + batchSize);
          const { error } = await supabase.from('kvk_history').insert(batch);
          if (error) {
            console.error('Insert error:', error);
            await supabase.rpc('enable_kvk_triggers');
            showToast(`Insert failed at row ${i + 1}: ${error.message}`, 'error');
            setImportProcessing(false);
            return;
          }
          insertedCount += batch.length;
          completedOps += batch.length;
          setImportProgress({ current: completedOps, total: totalOps, phase: `Inserted ${insertedCount}/${freshRows.length} new rows...` });
        }
      }

      // Phase 3: Upsert replacement rows in batches
      if (replaceRows.length > 0) {
        setImportProgress({ current: completedOps, total: totalOps, phase: `Replacing ${replaceRows.length} existing rows...` });
        for (let i = 0; i < replaceRows.length; i += batchSize) {
          const batch = replaceRows.slice(i, i + batchSize);
          const { error } = await supabase
            .from('kvk_history')
            .upsert(batch, { onConflict: 'kingdom_number,kvk_number', ignoreDuplicates: false });
          if (error) {
            console.error('Upsert error:', error);
            await supabase.rpc('enable_kvk_triggers');
            showToast(`Replace failed at row ${i + 1}: ${error.message}`, 'error');
            setImportProcessing(false);
            return;
          }
          replacedCount += batch.length;
          completedOps += batch.length;
          setImportProgress({ current: completedOps, total: totalOps, phase: `Replaced ${replacedCount}/${replaceRows.length} rows...` });
        }
      }

      // Re-enable triggers before recalc phases
      const { error: enableErr } = await supabase.rpc('enable_kvk_triggers');
      if (enableErr) console.error('Could not re-enable triggers:', enableErr);

      // Phase 4: Log to import_history
      const kvkNums = [...new Set([...freshRows, ...replaceRows].map(r => r.kvk_number as number))];
      await supabase.from('import_history').insert({
        admin_user_id: user?.id,
        admin_username: profile?.username || 'unknown',
        total_rows: freshRows.length + replaceRows.length + skippedCount,
        inserted_rows: insertedCount,
        replaced_rows: replacedCount,
        skipped_rows: skippedCount,
        kingdoms_created: missingKingdoms.length,
        kvk_numbers: kvkNums,
        validation_errors: validationErrors.length
      });

      // Phase 5: Auto-recalculate scores for affected kingdoms
      setImportProgress({ current: completedOps, total: totalOps, phase: 'Recalculating Atlas Scores...' });
      const { data: recalcData, error: recalcError } = await supabase.rpc('recalculate_all_kingdom_scores');
      const recalcUpdated = recalcError ? 0 : (recalcData?.[0]?.updated_count ?? 0);
      if (recalcError) console.error('Auto-recalc error (non-fatal):', recalcError);

      // Phase 6: Auto-backfill score_history via edge function (handles batching internally)
      let backfillCreated = 0;
      for (const kvk of kvkNums) {
        setImportProgress({ current: completedOps, total: totalOps, phase: `Backfilling score history for KvK #${kvk}...` });
        const { data: bfData, error: bfError } = await supabase.functions.invoke('backfill-score-history', {
          body: { kvk_number: kvk }
        });
        if (bfError) {
          console.error(`Backfill error for KvK #${kvk} (non-fatal):`, bfError);
        } else {
          backfillCreated += bfData?.created ?? 0;
        }
      }

      // Phase 7: Recalculate ranks via edge function (handles pagination internally)
      let ranksFixed = 0;
      for (const kvk of kvkNums) {
        setImportProgress({ current: completedOps, total: totalOps, phase: `Recalculating ranks for KvK #${kvk}...` });
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: rankData, error: rankError } = await supabase.functions.invoke('backfill-score-history', {
            body: { kvk_number: kvk, action: 'recalculate_ranks', offset }
          });
          if (rankError) {
            console.error(`Rank recalc error for KvK #${kvk} (non-fatal):`, rankError);
            hasMore = false;
          } else {
            ranksFixed += rankData?.updated ?? 0;
            hasMore = rankData?.has_more ?? false;
            offset = rankData?.next_offset ?? 0;
          }
        }
      }

      // Reload caches
      kvkHistoryService.invalidateCache();
      apiService.reloadData();
      queryClient.invalidateQueries({ queryKey: kingdomKeys.all });

      const parts: string[] = [];
      if (insertedCount > 0) parts.push(`${insertedCount} new`);
      if (replacedCount > 0) parts.push(`${replacedCount} replaced`);
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      const createdMsg = missingKingdoms.length > 0 ? ` (created ${missingKingdoms.length} new kingdoms)` : '';
      const recalcMsg = recalcUpdated > 0 ? ` | ${recalcUpdated} scores recalculated` : '';
      const backfillMsg = backfillCreated > 0 ? ` | ${backfillCreated} score history entries created` : '';
      const rankMsg = ranksFixed > 0 ? ` | ${ranksFixed} rank(s) fixed` : '';
      setImportProgress({ current: totalOps, total: totalOps, phase: 'Complete!' });
      showToast(`Imported ${parts.join(', ')} KvK records${createdMsg}${recalcMsg}${backfillMsg}${rankMsg}`, 'success');

      // Reset after short delay so user sees "Complete!"
      setTimeout(() => {
        setImportData('');
        setImportStep('input');
        setParsedRecords([]);
        setValidationErrors([]);
        setDuplicateRows([]);
        setNewRows([]);
        fetchImportHistory();
      }, 1500);
    } catch (error) {
      console.error('Import error:', error);
      if (supabase) await supabase.rpc('enable_kvk_triggers');
      showToast('Import failed unexpectedly', 'error');
    } finally {
      setImportProcessing(false);
    }
  };

  // Recalculate Atlas Scores for all kingdoms after import
  const handleRecalculateScores = async () => {
    if (!supabase) return;
    setRecalculating(true);
    setRecalcResult(null);
    try {
      // Step 1: Recalculate all kingdom stats + atlas scores
      const { data: recalcData, error: recalcError } = await supabase.rpc('recalculate_all_kingdom_scores');
      if (recalcError) {
        console.error('Recalc error:', recalcError);
        showToast(`Score recalculation failed: ${recalcError.message}`, 'error');
        setRecalculating(false);
        return;
      }
      const updated = recalcData?.[0]?.updated_count ?? 0;
      const avgScore = recalcData?.[0]?.avg_score ?? 0;

      // Step 2: Fix rank consistency
      const { data: rankData, error: rankError } = await supabase.rpc('verify_and_fix_rank_consistency');
      if (rankError) {
        console.error('Rank fix error:', rankError);
        showToast(`Ranks fix failed: ${rankError.message}`, 'error');
      }
      const ranksFixed = rankData?.filter((r: Record<string, unknown>) => (r.mismatches_found as number) > 0)
        .reduce((sum: number, r: Record<string, unknown>) => sum + (r.mismatches_fixed as number || 0), 0) ?? 0;

      // Refresh caches
      kvkHistoryService.invalidateCache();
      apiService.reloadData();
      queryClient.invalidateQueries({ queryKey: kingdomKeys.all });

      setRecalcResult({ updated, avgScore: parseFloat(String(avgScore)), ranksFixed });
      showToast(`Recalculated ${updated} kingdoms (avg score: ${avgScore}). ${ranksFixed} rank(s) fixed.`, 'success');
    } catch (error) {
      console.error('Recalc error:', error);
      showToast('Score recalculation failed', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  // Bulk create empty kingdoms (for admin use)
  const handleBulkCreateKingdoms = async (startNum: number, endNum: number) => {
    if (!supabase) {
      showToast('Supabase not available', 'error');
      return;
    }
    
    try {
      // Check which kingdoms already exist
      const { data: existingKingdoms } = await supabase
        .from('kingdoms')
        .select('kingdom_number')
        .gte('kingdom_number', startNum)
        .lte('kingdom_number', endNum);
      
      const existingSet = new Set((existingKingdoms || []).map(k => k.kingdom_number));
      
      // Create list of kingdoms to add
      const kingdomsToCreate: ReturnType<typeof createEmptyKingdom>[] = [];
      for (let kn = startNum; kn <= endNum; kn++) {
        if (!existingSet.has(kn)) {
          kingdomsToCreate.push(createEmptyKingdom(kn));
        }
      }
      
      if (kingdomsToCreate.length === 0) {
        showToast(`All kingdoms ${startNum}-${endNum} already exist`, 'info');
        return;
      }
      
      // Insert in batches of 500 to avoid timeouts
      const batchSize = 500;
      let created = 0;
      for (let i = 0; i < kingdomsToCreate.length; i += batchSize) {
        const batch = kingdomsToCreate.slice(i, i + batchSize);
        const { error } = await supabase
          .from('kingdoms')
          .upsert(batch, { onConflict: 'kingdom_number' });
        
        if (error) {
          console.error('Batch insert error:', error);
          showToast(`Error creating kingdoms: ${error.message}`, 'error');
          return;
        }
        created += batch.length;
      }
      
      // Refresh caches
      kvkHistoryService.invalidateCache();
      apiService.reloadData();
      queryClient.invalidateQueries({ queryKey: kingdomKeys.all });
      
      showToast(`✅ Created ${created} empty kingdom profiles (${startNum}-${endNum})`, 'success');
    } catch (error) {
      console.error('Bulk create kingdoms error:', error);
      showToast('Failed to create kingdoms', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportData(event.target?.result as string || '');
    };
    reader.readAsText(file);
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
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const response = await fetch(`${API_URL}/api/v1/claims?status=${filter}`, {
        headers: authHeaders
      });
      if (response.ok) {
        setClaims(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch claims:', error);
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
        fetchPendingCounts();
      } else {
        showToast('Failed to review submission', 'error');
      }
    } catch (error) {
      showToast('Error reviewing submission', 'error');
    }
  };

  const verifyClaim = async (id: number) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v1/claims/${id}/verify`, {
        method: 'POST',
        headers: authHeaders
      });
      if (response.ok) {
        showToast('Claim verified', 'success');
        fetchClaims();
        fetchPendingCounts();
      } else {
        showToast('Failed to verify claim', 'error');
      }
    } catch (error) {
      showToast('Error verifying claim', 'error');
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
      console.error('Failed to fetch transfer submissions:', error);
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
      fetchPendingCounts();
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
    if (['analytics', 'saas-metrics', 'engagement', 'plausible'].includes(activeTab)) return 'analytics';
    if (['submissions', 'new-kingdoms', 'claims', 'transfer-status', 'corrections', 'kvk-errors'].includes(activeTab)) return 'review';
    return 'system';
  };
  const activeCategory = getActiveCategory();
  const totalPending = pendingCounts.submissions + pendingCounts.claims + pendingCounts.corrections + pendingCounts.transfers + pendingCounts.kvkErrors + pendingCounts.feedback;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
      {/* Compact Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>Admin</h1>
          {totalPending > 0 && (
            <div style={{ 
              padding: '0.2rem 0.6rem', 
              backgroundColor: '#fbbf2420', 
              borderRadius: '12px',
              border: '1px solid #fbbf2450',
              color: '#fbbf24',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {totalPending} pending
            </div>
          )}
          {viewAsUser && <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontStyle: 'italic' }}>(User View)</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setViewAsUser(!viewAsUser)}
            style={{
              padding: '0.3rem 0.6rem',
              backgroundColor: viewAsUser ? '#fbbf2420' : 'transparent',
              borderRadius: '6px',
              border: viewAsUser ? '1px solid #fbbf2450' : '1px solid #3a3a3a',
              color: viewAsUser ? '#fbbf24' : '#6b7280',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            👁️ {viewAsUser ? 'Exit' : 'User View'}
          </button>
          {/* Health Status Indicators */}
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            {[
              { label: 'API', status: apiHealth.api },
              { label: 'DB', status: apiHealth.supabase },
              { label: '$', status: apiHealth.stripe },
            ].map(s => (
              <div key={s.label} title={`${s.label}: ${s.status}`} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: s.status === 'ok' ? '#22c55e' : s.status === 'error' ? '#ef4444' : '#fbbf24',
                boxShadow: s.status === 'ok' ? '0 0 4px #22c55e60' : s.status === 'error' ? '0 0 4px #ef444460' : 'none',
              }} />
            ))}
          </div>
          <div style={{ 
            padding: '0.3rem 0.6rem', 
            backgroundColor: '#22c55e15', 
            borderRadius: '6px',
            color: '#22c55e',
            fontSize: '0.75rem',
            fontWeight: 500
          }}>
            ✓ {profile?.username}
          </div>
        </div>
      </div>

      {/* Primary Category Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.25rem', 
        marginBottom: '0.75rem',
        backgroundColor: '#111116',
        padding: '0.25rem',
        borderRadius: '8px',
        width: 'fit-content'
      }}>
        {[
          { id: 'analytics', label: 'Analytics', icon: '📊' },
          { id: 'review', label: 'Review', icon: '📋', count: pendingCounts.submissions + pendingCounts.claims + pendingCounts.corrections + pendingCounts.transfers + pendingCounts.kvkErrors },
          { id: 'system', label: 'System', icon: '⚙️', count: pendingCounts.feedback }
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              if (cat.id === 'analytics') setActiveTab('analytics');
              else if (cat.id === 'review') setActiveTab('submissions');
              else setActiveTab('feedback');
            }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: activeCategory === cat.id ? '#22d3ee' : 'transparent',
              color: activeCategory === cat.id ? '#0a0a0a' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            {cat.label}
            {(cat.count ?? 0) > 0 && (
              <span style={{
                backgroundColor: activeCategory === cat.id ? '#0a0a0a' : '#fbbf24',
                color: activeCategory === cat.id ? '#22d3ee' : '#0a0a0a',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.15rem 0.4rem',
                borderRadius: '9999px'
              }}>
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Secondary Sub-tabs based on category */}
      <div style={{ 
        display: 'flex', 
        gap: '0.35rem', 
        marginBottom: '1rem',
        flexWrap: 'wrap',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #1a1a1a'
      }}>
        {activeCategory === 'analytics' && [
          { id: 'analytics', label: 'Overview' },
          { id: 'saas-metrics', label: 'Revenue' },
          { id: 'engagement', label: 'Engagement' },
          { id: 'plausible', label: 'Live Traffic' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              padding: '0.35rem 0.7rem',
              backgroundColor: activeTab === tab.id ? '#22d3ee20' : 'transparent',
              color: activeTab === tab.id ? '#22d3ee' : '#6b7280',
              border: activeTab === tab.id ? '1px solid #22d3ee40' : '1px solid transparent',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            {tab.label}
          </button>
        ))}
        {activeCategory === 'review' && [
          { id: 'submissions', label: 'KvK Results', count: pendingCounts.submissions },
          { id: 'new-kingdoms', label: 'New Kingdoms', count: 0 },
          { id: 'claims', label: 'Claims', count: pendingCounts.claims },
          { id: 'transfer-status', label: 'Transfer Status', count: pendingCounts.transfers },
          { id: 'corrections', label: 'Corrections', count: pendingCounts.corrections },
          { id: 'kvk-errors', label: 'KvK Errors', count: pendingCounts.kvkErrors }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              padding: '0.35rem 0.7rem',
              backgroundColor: activeTab === tab.id ? '#22d3ee20' : 'transparent',
              color: activeTab === tab.id ? '#22d3ee' : '#6b7280',
              border: activeTab === tab.id ? '1px solid #22d3ee40' : '1px solid transparent',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                backgroundColor: activeTab === tab.id ? '#22d3ee' : '#fbbf24',
                color: '#0a0a0a',
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '0.1rem 0.3rem',
                borderRadius: '9999px'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
        {activeCategory === 'system' && [
          { id: 'feedback', label: 'Feedback', count: pendingCounts.feedback },
          { id: 'discord-bot', label: 'Discord Bot', count: 0 },
          { id: 'discord-roles', label: 'Discord Roles', count: 0 },
          { id: 'webhooks', label: 'Webhooks', count: 0 },
          { id: 'data-sources', label: 'Data Sources', count: 0 },
          { id: 'import', label: 'Import', count: 0 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              padding: '0.35rem 0.7rem',
              backgroundColor: activeTab === tab.id ? '#22d3ee20' : 'transparent',
              color: activeTab === tab.id ? '#22d3ee' : '#6b7280',
              border: activeTab === tab.id ? '1px solid #22d3ee40' : '1px solid transparent',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                backgroundColor: activeTab === tab.id ? '#22d3ee' : '#fbbf24',
                color: '#0a0a0a',
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '0.1rem 0.3rem',
                borderRadius: '9999px'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter (not for analytics) */}
      {activeTab !== 'analytics' && activeTab !== 'import' && (
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
            {activeTab === 'claims' && <option value="verified">Verified</option>}
            <option value="all">All</option>
          </select>
        </div>
      )}

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
          {/* Plausible Insights: Sources, Countries, Top Pages */}
          <div style={{ marginTop: '1.5rem' }}>
            <PlausibleInsights />
          </div>
          {/* Admin Activity Feed */}
          <div style={{ marginTop: '1.5rem' }}>
            <AdminActivityFeed />
          </div>
        </>
      ) : activeTab === 'saas-metrics' ? (
        <Suspense fallback={<div style={{ padding: '2rem', color: '#6b7280' }}>Loading analytics...</div>}>
          <AnalyticsDashboard />
        </Suspense>
      ) : activeTab === 'engagement' ? (
        <Suspense fallback={<div style={{ padding: '2rem', color: '#6b7280' }}>Loading engagement...</div>}>
          <EngagementDashboard />
        </Suspense>
      ) : activeTab === 'webhooks' ? (
        <Suspense fallback={<div style={{ padding: '2rem', color: '#6b7280' }}>Loading webhooks...</div>}>
          <WebhookMonitor />
        </Suspense>
      ) : activeTab === 'data-sources' ? (
        <Suspense fallback={<div style={{ padding: '2rem', color: '#6b7280' }}>Loading data sources...</div>}>
          <DataSourceStats />
        </Suspense>
      ) : activeTab === 'discord-bot' ? (
        <Suspense fallback={<div style={{ padding: '2rem', color: '#6b7280' }}>Loading bot dashboard...</div>}>
          <BotDashboard />
        </Suspense>
      ) : activeTab === 'discord-roles' ? (
        <Suspense fallback={<div style={{ padding: '2rem', color: '#6b7280' }}>Loading roles dashboard...</div>}>
          <DiscordRolesDashboard />
        </Suspense>
      ) : activeTab === 'new-kingdoms' ? (
        <NewKingdomsTab
          submissions={newKingdomSubmissions}
          filter={filter}
          onApprove={handleApproveNewKingdom}
          onReject={(id) => setRejectModalOpen({ type: 'new-kingdom', id })}
        />
      ) : activeTab === 'submissions' ? (
        <SubmissionsTab
          submissions={submissions}
          filter={filter}
          onReview={reviewSubmission}
        />
      ) : activeTab === 'claims' ? (
        <ClaimsTab
          claims={claims}
          filter={filter}
          onVerify={verifyClaim}
        />
      ) : activeTab === 'corrections' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* A2: Bulk Actions Toolbar */}
          {filter === 'pending' && corrections.some(c => c.status === 'pending') && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', backgroundColor: '#111116', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
              <button onClick={() => selectAllPending('corrections')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '6px', color: '#22d3ee', fontSize: '0.8rem', cursor: 'pointer' }}>
                Select All ({corrections.filter(c => c.status === 'pending').length})
              </button>
              {selectedItems.size > 0 && (
                <>
                  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{selectedItems.size} selected</span>
                  <button onClick={() => bulkReviewCorrections('approved')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    ✓ Approve All
                  </button>
                  <button onClick={() => bulkReviewCorrections('rejected')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    ✗ Reject All
                  </button>
                  <button onClick={clearSelection} style={{ padding: '0.4rem 0.75rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '6px', color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer' }}>
                    Clear
                  </button>
                </>
              )}
            </div>
          )}
          {corrections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No {filter} data corrections
            </div>
          ) : (
            corrections.map((correction) => (
              <div key={correction.id} style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: selectedItems.has(correction.id) ? '2px solid #22d3ee' : '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {correction.status === 'pending' && (
                      <input type="checkbox" checked={selectedItems.has(correction.id)} onChange={() => toggleItemSelection(correction.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                    )}
                    <span style={{ color: '#22d3ee', fontWeight: 600 }}>K{correction.kingdom_number} - {correction.field}</span>
                  </div>
                  <div style={{ 
                    padding: '0.25rem 0.75rem',
                    backgroundColor: correction.status === 'pending' ? '#fbbf2420' : correction.status === 'approved' ? '#22c55e20' : '#ef444420',
                    color: correction.status === 'pending' ? '#fbbf24' : correction.status === 'approved' ? '#22c55e' : '#ef4444',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {correction.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Current: </span>
                    <span style={{ color: '#ef4444' }}>{correction.current_value}</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Suggested: </span>
                    <span style={{ color: '#22c55e' }}>{correction.suggested_value}</span>
                  </div>
                </div>

                {correction.reason && (
                  <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Reason: {correction.reason}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    By {correction.submitter_name} • {new Date(correction.created_at).toLocaleDateString()}
                  </div>
                  
                  {correction.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => reviewCorrection(correction.id, 'approved')} style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        Approve
                      </button>
                      <button onClick={() => setRejectModalOpen({ type: 'correction', id: correction.id })} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'kvk-errors' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* A2: Bulk Actions Toolbar for KvK Errors */}
          {filter === 'pending' && kvkErrors.some(e => e.status === 'pending') && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', backgroundColor: '#111116', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
              <button onClick={() => selectAllPending('kvk-errors')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '6px', color: '#22d3ee', fontSize: '0.8rem', cursor: 'pointer' }}>
                Select All ({kvkErrors.filter(e => e.status === 'pending').length})
              </button>
              {selectedItems.size > 0 && (
                <>
                  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{selectedItems.size} selected</span>
                  <button onClick={() => bulkReviewKvkErrors('approved')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    ✓ Approve All
                  </button>
                  <button onClick={() => bulkReviewKvkErrors('rejected')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    ✗ Reject All
                  </button>
                  <button onClick={clearSelection} style={{ padding: '0.4rem 0.75rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '6px', color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer' }}>
                    Clear
                  </button>
                </>
              )}
            </div>
          )}
          {kvkErrors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No {filter} KvK error reports
            </div>
          ) : (
            kvkErrors.map((error) => (
              <div key={error.id} style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: selectedItems.has(error.id) ? '2px solid #22d3ee' : '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {error.status === 'pending' && (
                      <input type="checkbox" checked={selectedItems.has(error.id)} onChange={() => toggleItemSelection(error.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                    )}
                    <span style={{ color: '#22d3ee', fontWeight: 600 }}>K{error.kingdom_number}</span>
                    {error.kvk_number && <span style={{ color: '#6b7280' }}> - KvK #{error.kvk_number}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ 
                      padding: '0.2rem 0.5rem',
                      backgroundColor: '#ef444420',
                      color: '#ef4444',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600
                    }}>
                      {error.error_type_label}
                    </span>
                    <div style={{ 
                      padding: '0.25rem 0.75rem',
                      backgroundColor: error.status === 'pending' ? '#fbbf2420' : error.status === 'approved' ? '#22c55e20' : '#ef444420',
                      color: error.status === 'pending' ? '#fbbf24' : error.status === 'approved' ? '#22c55e' : '#ef4444',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {error.status.toUpperCase()}
                    </div>
                  </div>
                </div>
                
                {error.current_data && (() => {
                  // Calculate what will change based on error_type
                  const willFlipPrep = error.error_type === 'wrong_prep_result' || error.error_type === 'wrong_both_results';
                  const willFlipBattle = error.error_type === 'wrong_battle_result' || error.error_type === 'wrong_both_results';
                  const newPrep = willFlipPrep 
                    ? (error.current_data.prep_result === 'Win' ? 'Loss' : 'Win')
                    : error.current_data.prep_result;
                  const newBattle = willFlipBattle
                    ? (error.current_data.battle_result === 'Win' ? 'Loss' : 'Win')
                    : error.current_data.battle_result;
                  // Calculate overall result
                  const prepWin = newPrep === 'Win';
                  const battleWin = newBattle === 'Win';
                  const newOverall = prepWin && battleWin ? 'Domination' 
                    : !prepWin && battleWin ? 'Comeback'
                    : prepWin && !battleWin ? 'Prep Only'
                    : 'Invasion';
                  
                  return (
                    <div style={{ 
                      marginBottom: '1rem',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '8px',
                      border: '1px solid #1f1f1f'
                    }}>
                      {/* Before → After Preview */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center' }}>
                        {/* BEFORE */}
                        <div>
                          <div style={{ color: '#ef4444', fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 600 }}>❌ CURRENT (WRONG)</div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                            <div>
                              <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Prep</div>
                              <div style={{ 
                                color: error.current_data.prep_result === 'Win' ? '#22c55e' : '#ef4444',
                                textDecoration: willFlipPrep ? 'line-through' : 'none',
                                opacity: willFlipPrep ? 0.5 : 1
                              }}>
                                {error.current_data.prep_result === 'Win' ? 'W' : 'L'}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Battle</div>
                              <div style={{ 
                                color: error.current_data.battle_result === 'Win' ? '#22c55e' : '#ef4444',
                                textDecoration: willFlipBattle ? 'line-through' : 'none',
                                opacity: willFlipBattle ? 0.5 : 1
                              }}>
                                {error.current_data.battle_result === 'Win' ? 'W' : 'L'}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Arrow */}
                        <div style={{ color: '#22d3ee', fontSize: '1.5rem', fontWeight: 700 }}>→</div>
                        
                        {/* AFTER */}
                        <div>
                          <div style={{ color: '#22c55e', fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 600 }}>✓ AFTER APPROVAL</div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                            <div>
                              <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Prep</div>
                              <div style={{ 
                                color: newPrep === 'Win' ? '#22c55e' : '#ef4444',
                                fontWeight: willFlipPrep ? 700 : 400
                              }}>
                                {newPrep === 'Win' ? 'W' : 'L'}
                                {willFlipPrep && <span style={{ color: '#fbbf24', marginLeft: '0.25rem' }}>⚡</span>}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Battle</div>
                              <div style={{ 
                                color: newBattle === 'Win' ? '#22c55e' : '#ef4444',
                                fontWeight: willFlipBattle ? 700 : 400
                              }}>
                                {newBattle === 'Win' ? 'W' : 'L'}
                                {willFlipBattle && <span style={{ color: '#fbbf24', marginLeft: '0.25rem' }}>⚡</span>}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Result</div>
                              <div style={{ 
                                color: newOverall === 'Domination' ? '#22c55e' : newOverall === 'Invasion' ? '#ef4444' : '#fbbf24',
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}>
                                {newOverall}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Opponent info */}
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #1f1f1f', color: '#6b7280', fontSize: '0.75rem' }}>
                        vs <span style={{ color: '#22d3ee' }}>K{error.current_data.opponent}</span>
                        {' '}• Also updates K{error.current_data.opponent}&apos;s record (inverse)
                      </div>
                    </div>
                  );
                })()}

                <div style={{ color: '#fff', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#1a1a20', borderRadius: '6px' }}>
                  <span style={{ color: '#6b7280' }}>Description: </span>
                  {error.description}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    By {error.submitted_by_name} • {new Date(error.submitted_at).toLocaleDateString()}
                  </div>
                  
                  {error.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => reviewKvkError(error.id, 'approved')} style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        Approve
                      </button>
                      <button onClick={() => setRejectModalOpen({ type: 'kvk-error', id: error.id })} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'transfer-status' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {transferSubmissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No {filter} transfer status submissions
            </div>
          ) : (
            transferSubmissions.map((sub) => (
              <div key={sub.id} style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ color: '#22d3ee', fontWeight: 600, fontSize: '1.25rem' }}>Kingdom {sub.kingdom_number}</span>
                  <div style={{ 
                    padding: '0.25rem 0.75rem',
                    backgroundColor: sub.status === 'pending' ? '#fbbf2420' : sub.status === 'approved' ? '#22c55e20' : '#ef444420',
                    color: sub.status === 'pending' ? '#fbbf24' : sub.status === 'approved' ? '#22c55e' : '#ef4444',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {sub.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Previous Status: </span>
                    <span style={{ color: '#ef4444' }}>{sub.old_status || 'Unknown'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>New Status: </span>
                    <span style={{ color: '#22c55e' }}>{sub.new_status}</span>
                  </div>
                </div>

                {sub.notes && (
                  <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Notes: {sub.notes}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                    {sub.reviewed_at && ` • Reviewed ${new Date(sub.reviewed_at).toLocaleDateString()}`}
                  </div>
                  
                  {sub.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => reviewTransferSubmission(sub.id, 'approved')} style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        Approve
                      </button>
                      <button onClick={() => reviewTransferSubmission(sub.id, 'rejected')} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'plausible' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#fff', margin: 0 }}>📈 Plausible Analytics - Live Dashboard</h3>
              <a 
                href="https://plausible.io/ks-atlas.com" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#22d3ee20',
                  border: '1px solid #22d3ee50',
                  borderRadius: '6px',
                  color: '#22d3ee',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}
              >
                Open Full Dashboard ↗
              </a>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Real-time, privacy-friendly analytics powered by Plausible. No cookies, GDPR compliant.
            </p>
            <div style={{ 
              backgroundColor: '#0a0a0a', 
              borderRadius: '8px', 
              overflow: 'hidden',
              border: '1px solid #1a1a1f'
            }}>
              <iframe
                data-plausible-embed="true"
                src="https://plausible.io/share/ks-atlas.com?auth=C7E_v7N68QzEmvXVyTiHj&embed=true&theme=dark"
                loading="lazy"
                style={{ 
                  width: '100%', 
                  height: '600px', 
                  border: 'none',
                  backgroundColor: '#0a0a0a'
                }}
                title="Plausible Analytics"
              />
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '1rem', fontStyle: 'italic' }}>
              Tip: Click "Full Dashboard" to see detailed breakdowns, goals, and custom reports.
            </p>
          </div>

          {/* Quick Stats from Plausible */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Bounce Rate', value: `${analytics?.bounceRate || 42}%`, color: '#f97316', icon: '↩️', desc: 'Single page visits' },
              { label: 'Avg. Visit Duration', value: `${Math.floor((analytics?.visitDuration || 187) / 60)}m ${(analytics?.visitDuration || 187) % 60}s`, color: '#22c55e', icon: '⏱️', desc: 'Time on site' },
            ].map((metric, i) => (
              <div key={i} style={{
                backgroundColor: '#111116',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid #2a2a2a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span>{metric.icon}</span>
                  <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{metric.label}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: metric.color }}>
                  {metric.value}
                </div>
                <div style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {metric.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Top Traffic Sources */}
          <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🔗 Top Traffic Sources</h3>
            {(analytics?.topSources || []).map((source, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: i < (analytics?.topSources?.length || 0) - 1 ? '1px solid #1a1a1f' : 'none'
              }}>
                <span style={{ color: '#fff' }}>{source.source}</span>
                <span style={{ color: '#22d3ee', fontWeight: '600' }}>{source.visitors.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Top Countries */}
          <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🌍 Top Countries</h3>
            {(analytics?.topCountries || []).map((country, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: i < (analytics?.topCountries?.length || 0) - 1 ? '1px solid #1a1a1f' : 'none'
              }}>
                <span style={{ color: '#fff' }}>{country.country}</span>
                <span style={{ color: '#a855f7', fontWeight: '600' }}>{country.visitors.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Feature Usage - Real tracking data */}
          <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🎯 Feature Usage (Real Data)</h3>
            {(analytics?.featureUsage || []).length > 0 ? (
              analytics?.featureUsage?.map((feature, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: i < (analytics?.featureUsage?.length || 0) - 1 ? '1px solid #1a1a1f' : 'none'
                }}>
                  <span style={{ color: '#fff' }}>{feature.feature}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#22c55e', fontWeight: '600' }}>{feature.count}x</span>
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                      {new Date(feature.lastUsed).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No feature usage data yet. Data will appear as users interact with the app.</p>
            )}
          </div>

          {/* Button Clicks - Real tracking data */}
          <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🖱️ Button Clicks (Real Data)</h3>
            {(analytics?.buttonClicks || []).length > 0 ? (
              analytics?.buttonClicks?.map((button, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: i < (analytics?.buttonClicks?.length || 0) - 1 ? '1px solid #1a1a1f' : 'none'
                }}>
                  <span style={{ color: '#fff' }}>{button.feature}</span>
                  <span style={{ color: '#f97316', fontWeight: '600' }}>{button.count}x</span>
                </div>
              ))
            ) : (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No button click data yet. Data will appear as users interact with the app.</p>
            )}
          </div>

          {/* Activity Timeline - Events by Day */}
          {analytics?.eventsByDay && analytics.eventsByDay.length > 0 && (
            <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
              <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>📊 Activity (Last 7 Days)</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '100px' }}>
                {analytics.eventsByDay.map((day, i) => {
                  const maxCount = Math.max(...analytics.eventsByDay!.map(d => d.count), 1);
                  const height = (day.count / maxCount) * 100;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                      <div style={{ 
                        width: '100%', 
                        height: `${Math.max(height, 4)}%`,
                        backgroundColor: '#22d3ee',
                        borderRadius: '4px 4px 0 0',
                        minHeight: '4px'
                      }} />
                      <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>
                        {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'feedback' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Feedback Stats */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {(['new', 'reviewed', 'in_progress', 'resolved', 'closed'] as const).map(status => {
              const count = feedbackCounts[status];
              const colors: Record<string, string> = { new: '#fbbf24', reviewed: '#22d3ee', in_progress: '#a855f7', resolved: '#22c55e', closed: '#6b7280' };
              return (
                <div key={status} style={{ backgroundColor: '#111116', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #2a2a2a', minWidth: '80px', textAlign: 'center' }}>
                  <div style={{ color: colors[status], fontWeight: 700, fontSize: '1.25rem' }}>{count}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</div>
                </div>
              );
            })}
          </div>

          {feedbackItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No feedback found
            </div>
          ) : (
            feedbackItems.map((item) => (
              <div key={item.id} style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1rem', border: '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.25rem' }}>
                      {item.type === 'bug' ? '🐛' : item.type === 'feature' ? '✨' : '💭'}
                    </span>
                    <span style={{ color: '#fff', fontWeight: 600, textTransform: 'capitalize' }}>{item.type}</span>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.7rem', 
                      fontWeight: 600,
                      backgroundColor: item.status === 'new' ? '#fbbf2420' : item.status === 'resolved' ? '#22c55e20' : '#22d3ee20',
                      color: item.status === 'new' ? '#fbbf24' : item.status === 'resolved' ? '#22c55e' : '#22d3ee'
                    }}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <p style={{ color: '#e5e7eb', fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {item.message}
                </p>
                
                {item.email && (
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                    📧 <a href={`mailto:${item.email}`} style={{ color: '#22d3ee' }}>{item.email}</a>
                  </div>
                )}
                
                {item.page_url && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    📍 {item.page_url.replace(window.location.origin, '')}
                  </div>
                )}

                {item.admin_notes && (
                  <div style={{ backgroundColor: '#0a0a0a', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                    <span style={{ color: '#6b7280' }}>Admin notes:</span> <span style={{ color: '#9ca3af' }}>{item.admin_notes}</span>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {item.status === 'new' && (
                    <button onClick={() => updateFeedbackStatus(item.id, 'reviewed')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '6px', color: '#22d3ee', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                      ✓ Mark Reviewed
                    </button>
                  )}
                  {(item.status === 'new' || item.status === 'reviewed') && (
                    <button onClick={() => updateFeedbackStatus(item.id, 'in_progress')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '6px', color: '#a855f7', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                      🔧 In Progress
                    </button>
                  )}
                  {item.status !== 'resolved' && item.status !== 'closed' && (
                    <button onClick={() => updateFeedbackStatus(item.id, 'resolved')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22c55e20', border: '1px solid #22c55e50', borderRadius: '6px', color: '#22c55e', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                      ✅ Resolved
                    </button>
                  )}
                  {item.status !== 'closed' && (
                    <button onClick={() => updateFeedbackStatus(item.id, 'closed')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#6b728020', border: '1px solid #6b728050', borderRadius: '6px', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                      ✕ Close
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'import' ? (
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Bulk Import KvK Results</h3>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', fontSize: '0.75rem' }}>
            {(['input', 'preview', 'duplicates', 'importing'] as const).map((step, i) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: importStep === step ? '#22d3ee20' : 'transparent', color: importStep === step ? '#22d3ee' : '#4b5563', fontWeight: importStep === step ? 600 : 400, border: `1px solid ${importStep === step ? '#22d3ee50' : '#2a2a2a'}` }}>
                  {i + 1}. {step === 'input' ? 'Input' : step === 'preview' ? 'Preview' : step === 'duplicates' ? 'Duplicates' : 'Import'}
                </span>
                {i < 3 && <span style={{ color: '#2a2a2a' }}>→</span>}
              </div>
            ))}
          </div>

          {/* Step 1: Input */}
          {importStep === 'input' && (
            <>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Required columns: <code style={{ color: '#22d3ee' }}>kingdom_number, kvk_number, opponent_kingdom, prep_result, battle_result, overall_result, kvk_date</code>
              </p>
              <p style={{ color: '#4b5563', fontSize: '0.75rem', marginBottom: '1rem' }}>
                Results: W/L/B. Date: YYYY-MM-DD. Also accepts <code style={{ color: '#4b5563' }}>opponent_number</code> as alias.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '8px', color: '#22d3ee', cursor: 'pointer', fontWeight: 500 }}>
                  📁 Choose CSV File
                </button>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Or paste CSV data:</label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="kingdom_number,kvk_number,opponent_kingdom,prep_result,battle_result,overall_result,kvk_date&#10;172,10,245,W,L,Reversal,2026-02-01&#10;172,11,301,W,W,Domination,2026-02-22"
                  style={{ width: '100%', height: '200px', padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>
              <button onClick={handleParseAndPreview} style={{ padding: '0.75rem 2rem', backgroundColor: '#22d3ee', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 600, cursor: 'pointer' }}>
                Preview & Validate
              </button>
            </>
          )}

          {/* Step 2: Preview with validation */}
          {importStep === 'preview' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{parsedRecords.length} rows parsed</span>
                  {validationErrors.length > 0 && (
                    <span style={{ color: '#ef4444', marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                      ⚠️ {validationErrors.length} validation error{validationErrors.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {validationErrors.length === 0 && (
                    <span style={{ color: '#22c55e', marginLeft: '0.75rem', fontSize: '0.85rem' }}>✓ All rows valid</span>
                  )}
                </div>
                <button onClick={() => { setImportStep('input'); setParsedRecords([]); setValidationErrors([]); }} style={{ padding: '0.4rem 0.75rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '6px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.75rem' }}>
                  ← Back
                </button>
              </div>

              {/* Validation errors summary */}
              {validationErrors.length > 0 && (
                <div style={{ backgroundColor: '#ef444410', border: '1px solid #ef444430', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', maxHeight: '150px', overflowY: 'auto' }}>
                  <p style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>Validation Errors:</p>
                  {validationErrors.map((err, i) => (
                    <div key={i} style={{ color: '#f87171', fontSize: '0.75rem', padding: '0.15rem 0' }}>
                      Row {err.row}: <span style={{ color: '#9ca3af' }}>{err.field}</span> = <code style={{ color: '#fbbf24' }}>{err.value || '(empty)'}</code> — {err.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview table */}
              <div style={{ overflowX: 'auto', maxHeight: '350px', overflowY: 'auto', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, backgroundColor: '#0a0a0a', zIndex: 1 }}>
                      <th style={{ textAlign: 'left', color: '#6b7280', padding: '0.5rem', borderBottom: '1px solid #2a2a2a' }}>#</th>
                      <th style={{ textAlign: 'left', color: '#6b7280', padding: '0.5rem', borderBottom: '1px solid #2a2a2a' }}>Kingdom</th>
                      <th style={{ textAlign: 'left', color: '#6b7280', padding: '0.5rem', borderBottom: '1px solid #2a2a2a' }}>KvK</th>
                      <th style={{ textAlign: 'left', color: '#6b7280', padding: '0.5rem', borderBottom: '1px solid #2a2a2a' }}>Opponent</th>
                      <th style={{ textAlign: 'left', color: '#6b7280', padding: '0.5rem', borderBottom: '1px solid #2a2a2a' }}>Prep</th>
                      <th style={{ textAlign: 'left', color: '#6b7280', padding: '0.5rem', borderBottom: '1px solid #2a2a2a' }}>Battle</th>
                      <th style={{ textAlign: 'left', color: '#6b7280', padding: '0.5rem', borderBottom: '1px solid #2a2a2a' }}>Result</th>
                      <th style={{ textAlign: 'left', color: '#6b7280', padding: '0.5rem', borderBottom: '1px solid #2a2a2a' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRecords.map((r, idx) => {
                      const rowNum = idx + 2;
                      const rowErrors = validationErrors.filter(e => e.row === rowNum);
                      const errorFields = new Set(rowErrors.map(e => e.field));
                      const hasError = rowErrors.length > 0;
                      const cellStyle = (field: string) => ({
                        padding: '0.35rem 0.5rem',
                        color: errorFields.has(field) ? '#ef4444' : '#fff',
                        backgroundColor: errorFields.has(field) ? '#ef444410' : 'transparent',
                        fontFamily: 'monospace' as const,
                        borderBottom: '1px solid #1a1a1f'
                      });
                      return (
                        <tr key={idx} style={{ backgroundColor: hasError ? '#ef444408' : 'transparent' }}>
                          <td style={{ padding: '0.35rem 0.5rem', color: hasError ? '#ef4444' : '#4b5563', borderBottom: '1px solid #1a1a1f', fontSize: '0.7rem' }}>{rowNum}</td>
                          <td style={cellStyle('kingdom_number')}>{String(r.kingdom_number)}</td>
                          <td style={cellStyle('kvk_number')}>{String(r.kvk_number)}</td>
                          <td style={cellStyle('opponent_kingdom')}>{String(r.opponent_kingdom)}</td>
                          <td style={cellStyle('prep_result')}>{String(r.prep_result ?? '')}</td>
                          <td style={cellStyle('battle_result')}>{String(r.battle_result ?? '')}</td>
                          <td style={cellStyle('overall_result')}>{String(r.overall_result ?? '')}</td>
                          <td style={cellStyle('kvk_date')}>{String(r.kvk_date ?? '')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  onClick={handleCheckDuplicates}
                  disabled={importProcessing}
                  style={{ padding: '0.75rem 2rem', backgroundColor: importProcessing ? '#4b5563' : '#22c55e', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: importProcessing ? 'not-allowed' : 'pointer' }}
                >
                  {importProcessing ? 'Checking...' : `Import ${parsedRecords.filter(r => (r.kingdom_number as number) > 0).length} Rows`}
                </button>
                {validationErrors.length > 0 && (
                  <p style={{ color: '#fbbf24', fontSize: '0.75rem', alignSelf: 'center' }}>
                    Rows with critical errors (missing kingdom/kvk) will be skipped.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Duplicate review */}
          {importStep === 'duplicates' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ color: '#fbbf24', margin: 0 }}>
                  ⚠️ {duplicateRows.length} Duplicate Row{duplicateRows.length !== 1 ? 's' : ''} Found
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { setImportStep('preview'); }} style={{ padding: '0.4rem 0.75rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '6px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.75rem' }}>← Back</button>
                  <button onClick={() => setDuplicateRows(prev => prev.map(d => ({ ...d, action: 'replace' as const })))} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22c55e20', border: '1px solid #22c55e50', borderRadius: '6px', color: '#22c55e', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>Replace All</button>
                  <button onClick={() => setDuplicateRows(prev => prev.map(d => ({ ...d, action: 'skip' as const })))} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#ef444420', border: '1px solid #ef444450', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>Skip All</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {newRows.length > 0 && (
                  <span style={{ color: '#6b7280' }}>{newRows.length} new row{newRows.length !== 1 ? 's' : ''} will be imported.</span>
                )}
                <span style={{ color: '#22c55e' }}>✓ {duplicateRows.filter(d => d.action === 'replace').length} replacing</span>
                <span style={{ color: '#ef4444' }}>✗ {duplicateRows.filter(d => d.action === 'skip').length} skipping</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {duplicateRows.map((dup, idx) => {
                  const ex = dup.existing as Record<string, unknown>;
                  const inc = dup.incoming as Record<string, unknown>;
                  const fields = ['opponent_kingdom', 'prep_result', 'battle_result', 'overall_result', 'kvk_date', 'order_index'];
                  const hasChanges = fields.some(f => String(ex[f] ?? '') !== String(inc[f] ?? ''));
                  return (
                    <div key={idx} style={{ backgroundColor: '#0a0a0a', borderRadius: '8px', border: `1px solid ${dup.action === 'replace' ? '#22c55e40' : '#ef444440'}`, padding: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>K{String(inc.kingdom_number)} — KvK #{String(inc.kvk_number)}</span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={() => setDuplicateRows(prev => prev.map((d, i) => i === idx ? { ...d, action: 'replace' } : d))} style={{ padding: '0.25rem 0.6rem', backgroundColor: dup.action === 'replace' ? '#22c55e' : 'transparent', border: '1px solid #22c55e50', borderRadius: '4px', color: dup.action === 'replace' ? '#fff' : '#22c55e', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>Replace</button>
                          <button onClick={() => setDuplicateRows(prev => prev.map((d, i) => i === idx ? { ...d, action: 'skip' } : d))} style={{ padding: '0.25rem 0.6rem', backgroundColor: dup.action === 'skip' ? '#ef4444' : 'transparent', border: '1px solid #ef444450', borderRadius: '4px', color: dup.action === 'skip' ? '#fff' : '#ef4444', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>Skip</button>
                        </div>
                      </div>
                      {hasChanges ? (
                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                          <thead><tr>
                            <th style={{ textAlign: 'left', color: '#6b7280', padding: '0.2rem 0.4rem', borderBottom: '1px solid #2a2a2a' }}>Field</th>
                            <th style={{ textAlign: 'left', color: '#ef4444', padding: '0.2rem 0.4rem', borderBottom: '1px solid #2a2a2a' }}>Current</th>
                            <th style={{ textAlign: 'left', color: '#22c55e', padding: '0.2rem 0.4rem', borderBottom: '1px solid #2a2a2a' }}>New</th>
                          </tr></thead>
                          <tbody>
                            {fields.filter(f => String(ex[f] ?? '') !== String(inc[f] ?? '')).map(f => (
                              <tr key={f}>
                                <td style={{ color: '#9ca3af', padding: '0.2rem 0.4rem' }}>{f}</td>
                                <td style={{ color: '#ef4444', padding: '0.2rem 0.4rem', fontFamily: 'monospace' }}>{String(ex[f] ?? '—')}</td>
                                <td style={{ color: '#22c55e', padding: '0.2rem 0.4rem', fontFamily: 'monospace' }}>{String(inc[f] ?? '—')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>No field changes — identical row already exists.</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button onClick={handleConfirmImport} disabled={importProcessing} style={{ padding: '0.75rem 2rem', backgroundColor: importProcessing ? '#4b5563' : '#22c55e', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: importProcessing ? 'not-allowed' : 'pointer' }}>
                  {importProcessing ? 'Importing...' : `Confirm Import (${newRows.length} new + ${duplicateRows.filter(d => d.action === 'replace').length} replaced)`}
                </button>
                <button onClick={() => { setImportStep('input'); setDuplicateRows([]); setNewRows([]); setParsedRecords([]); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Step 4: Importing with progress */}
          {importStep === 'importing' && (
            <div style={{ padding: '2rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: '24px', height: '24px', border: '3px solid #22d3ee40', borderTop: '3px solid #22d3ee', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#fff', fontWeight: 600 }}>Importing...</span>
              </div>
              <div style={{ backgroundColor: '#0a0a0a', borderRadius: '8px', overflow: 'hidden', height: '8px', marginBottom: '0.5rem' }}>
                <div style={{ height: '100%', backgroundColor: importProgress.phase === 'Complete!' ? '#22c55e' : '#22d3ee', borderRadius: '8px', transition: 'width 0.3s ease', width: importProgress.total > 0 ? `${Math.min(100, (importProgress.current / importProgress.total) * 100)}%` : '0%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: '#9ca3af' }}>{importProgress.phase}</span>
                <span style={{ color: '#6b7280' }}>{importProgress.total > 0 ? `${importProgress.current}/${importProgress.total}` : ''}</span>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Import History */}
          {importStep === 'input' && (
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #2a2a2a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ color: '#fff', margin: 0 }}>Import History</h4>
                <button onClick={fetchImportHistory} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#6b7280', cursor: 'pointer', fontSize: '0.7rem' }}>Refresh</button>
              </div>
              {importHistory.length === 0 ? (
                <p style={{ color: '#4b5563', fontSize: '0.8rem' }}>No import history yet. <button onClick={fetchImportHistory} style={{ color: '#22d3ee', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Load history</button></p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {importHistory.map(h => (
                    <div key={h.id} style={{ backgroundColor: '#0a0a0a', borderRadius: '6px', padding: '0.6rem 0.75rem', border: '1px solid #1a1a1f', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#22d3ee', fontWeight: 600 }}>{h.admin_username}</span>
                        <span style={{ color: '#4b5563' }}>{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: '#9ca3af' }}>
                        <span>{h.total_rows} total</span>
                        {h.inserted_rows > 0 && <span style={{ color: '#22c55e' }}>+{h.inserted_rows} new</span>}
                        {h.replaced_rows > 0 && <span style={{ color: '#fbbf24' }}>{h.replaced_rows} replaced</span>}
                        {h.skipped_rows > 0 && <span style={{ color: '#6b7280' }}>{h.skipped_rows} skipped</span>}
                        {h.kingdoms_created > 0 && <span style={{ color: '#a855f7' }}>{h.kingdoms_created} kingdoms created</span>}
                        {h.kvk_numbers?.length > 0 && <span>KvK {h.kvk_numbers.join(', ')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recalculate Atlas Scores (only on input step) */}
          {importStep === 'input' && (
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #2a2a2a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ color: '#fff', margin: 0 }}>Recalculate Atlas Scores</h4>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                    Recalculates stats, Atlas Scores, and rank consistency for all kingdoms with KvK data. Run after bulk imports.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleRecalculateScores}
                  disabled={recalculating}
                  style={{ padding: '0.6rem 1.25rem', backgroundColor: recalculating ? '#4b5563' : '#f59e0b20', border: `1px solid ${recalculating ? '#4b5563' : '#f59e0b50'}`, borderRadius: '8px', color: recalculating ? '#9ca3af' : '#f59e0b', cursor: recalculating ? 'not-allowed' : 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
                >
                  {recalculating ? '⏳ Recalculating...' : '🔄 Recalculate All Scores'}
                </button>
                {recalcResult && (
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                    <span style={{ color: '#22c55e' }}>✓ {recalcResult.updated} kingdoms updated</span>
                    <span>Avg score: {recalcResult.avgScore.toFixed(2)}</span>
                    {recalcResult.ranksFixed > 0 && <span style={{ color: '#fbbf24' }}>{recalcResult.ranksFixed} rank(s) corrected</span>}
                    {recalcResult.ranksFixed === 0 && <span style={{ color: '#22c55e' }}>All ranks consistent</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bulk Create Kingdoms (only on input step) */}
          {importStep === 'input' && (
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #2a2a2a' }}>
              <h4 style={{ color: '#fff', marginBottom: '0.75rem' }}>Bulk Create Empty Kingdoms</h4>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Create placeholder kingdom profiles with no KvK data. Useful for adding all kingdoms that participated in a KvK.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={() => handleBulkCreateKingdoms(1, 1304)} style={{ padding: '0.6rem 1.25rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '8px', color: '#a855f7', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>Create Kingdoms 1-1304</button>
                <button onClick={() => handleBulkCreateKingdoms(1305, 1500)} style={{ padding: '0.6rem 1.25rem', backgroundColor: '#6b728020', border: '1px solid #6b728050', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>Create 1305-1500</button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Reject Modal with Reason */}
      {rejectModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => { setRejectModalOpen(null); setRejectReason(''); }}
        >
          <div
            style={{
              backgroundColor: '#131318',
              borderRadius: '16px',
              border: '1px solid #2a2a2a',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
              Reject with Reason
            </h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this submission is being rejected..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
                resize: 'vertical',
                marginBottom: '1rem'
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setRejectModalOpen(null); setRejectReason(''); }}
                style={{
                  padding: '0.6rem 1rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #3a3a3a',
                  borderRadius: '8px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (rejectModalOpen.type === 'kvk-error') {
                    reviewKvkError(rejectModalOpen.id, 'rejected', rejectReason);
                  } else if (rejectModalOpen.type === 'correction') {
                    reviewCorrection(rejectModalOpen.id, 'rejected', rejectReason);
                  } else if (rejectModalOpen.type === 'new-kingdom') {
                    handleRejectNewKingdom(rejectModalOpen.id, rejectReason);
                  }
                }}
                style={{
                  padding: '0.6rem 1rem',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
