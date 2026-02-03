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
import { ADMIN_USERNAMES } from '../utils/constants';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { getCurrentKvK, incrementKvK } from '../services/configService';
import { CURRENT_KVK } from '../constants';
import { 
  AnalyticsOverview, 
  SubmissionsTab, 
  NewKingdomsTab, 
  ClaimsTab,
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
  const [activeTab, setActiveTab] = useState<'analytics' | 'saas-metrics' | 'engagement' | 'webhooks' | 'data-sources' | 'discord-bot' | 'submissions' | 'new-kingdoms' | 'claims' | 'corrections' | 'kvk-errors' | 'import' | 'users' | 'plausible' | 'transfer-status' | 'feedback'>('analytics');
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
  const [pendingCounts, setPendingCounts] = useState<{ submissions: number; claims: number; corrections: number; transfers: number; kvkErrors: number; feedback: number }>({ submissions: 0, claims: 0, corrections: 0, transfers: 0, kvkErrors: 0, feedback: 0 });
  const [feedbackItems, setFeedbackItems] = useState<Array<{ id: string; type: string; message: string; email: string | null; status: string; page_url: string | null; created_at: string; admin_notes: string | null }>>([]); 
  const [feedbackCounts, setFeedbackCounts] = useState<{ new: number; reviewed: number; in_progress: number; resolved: number; closed: number }>({ new: 0, reviewed: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [syncingSubscriptions, setSyncingSubscriptions] = useState(false);
  const [currentKvK, setCurrentKvK] = useState<number>(CURRENT_KVK);
  const [incrementingKvK, setIncrementingKvK] = useState(false);

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
        const submissionsRes = await fetch(`${API_URL}/api/v1/submissions?status=pending`, {
          headers: { 'X-User-Id': user?.id || '' }
        });
        if (submissionsRes.ok) {
          const data = await submissionsRes.json();
          pendingSubmissions = Array.isArray(data) ? data.length : 0;
        }
      } catch { /* API might not be available */ }
      
      try {
        const claimsRes = await fetch(`${API_URL}/api/v1/claims?status=pending`, {
          headers: { 'X-User-Id': user?.id || '' }
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
      try {
        const adminRes = await fetch(`${API_URL}/api/v1/admin/stats/overview`);
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          realData.userStats = {
            total: adminData.users?.total || 0,
            free: adminData.users?.free || 0,
            pro: adminData.users?.pro || 0,
            recruiter: adminData.users?.recruiter || 0,
            kingshot_linked: adminData.users?.kingshot_linked || 0,
          };
          realData.revenue = {
            monthly: adminData.revenue?.mrr || 0,
            total: adminData.revenue?.total || 0,
            subscriptions: adminData.subscriptions || [],
            activeSubscriptions: adminData.revenue?.active_subscriptions || 0,
            recentPayments: adminData.recent_payments || [],
          };
          realData.recentSubscribers = adminData.recent_subscribers || [];
        }
      } catch (e) {
        logger.log('Could not fetch admin stats from API');
      }
      
      // Fetch real submission counts from API
      try {
        const pendingRes = await fetch(`${API_URL}/api/v1/submissions?status=pending`, { headers: { 'X-User-Id': user?.id || '' } });
        const approvedRes = await fetch(`${API_URL}/api/v1/submissions?status=approved`, { headers: { 'X-User-Id': user?.id || '' } });
        const rejectedRes = await fetch(`${API_URL}/api/v1/submissions?status=rejected`, { headers: { 'X-User-Id': user?.id || '' } });
        if (pendingRes.ok) realData.submissions.pending = (await pendingRes.json()).length;
        if (approvedRes.ok) realData.submissions.approved = (await approvedRes.json()).length;
        if (rejectedRes.ok) realData.submissions.rejected = (await rejectedRes.json()).length;
      } catch (e) {
        logger.log('Could not fetch submission counts from API');
      }
      
      setAnalytics(realData);
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
      const res = await fetch(`${API_URL}/api/v1/admin/subscriptions/sync-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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
    atlas_score: 50.0,
    most_recent_status: 'Unannounced',
    last_updated: new Date().toISOString()
  });

  const handleBulkImport = async () => {
    if (!importData.trim()) {
      showToast('Please paste CSV data', 'error');
      return;
    }
    if (!supabase) {
      showToast('Supabase not available', 'error');
      return;
    }
    try {
      const lines = importData.trim().split('\n');
      if (lines.length < 2) {
        showToast('CSV must have header and at least one data row', 'error');
        return;
      }
      const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase()) || [];
      
      // Validate required columns
      const requiredCols = ['kingdom_number', 'kvk_number', 'opponent_number', 'prep_result', 'battle_result', 'overall_result', 'kvk_date'];
      const missingCols = requiredCols.filter(col => !headers.includes(col));
      if (missingCols.length > 0) {
        showToast(`Missing columns: ${missingCols.join(', ')}`, 'error');
        return;
      }
      
      const records = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',');
        const record: Record<string, string> = {};
        headers.forEach((h, i) => record[h] = values[i]?.trim() || '');
        return record;
      });
      
      // Collect all unique kingdom numbers (both kingdom and opponent)
      const allKingdomNumbers = new Set<number>();
      records.forEach(r => {
        const kn = parseInt(r.kingdom_number || '0', 10);
        const on = parseInt(r.opponent_number || '0', 10);
        if (kn > 0) allKingdomNumbers.add(kn);
        if (on > 0) allKingdomNumbers.add(on);
      });
      
      // Check which kingdoms already exist
      const { data: existingKingdoms } = await supabase
        .from('kingdoms')
        .select('kingdom_number')
        .in('kingdom_number', Array.from(allKingdomNumbers));
      
      const existingSet = new Set((existingKingdoms || []).map(k => k.kingdom_number));
      const missingKingdoms = Array.from(allKingdomNumbers).filter(kn => !existingSet.has(kn));
      
      // Auto-create missing kingdoms with empty data
      if (missingKingdoms.length > 0) {
        const newKingdoms = missingKingdoms.map(kn => createEmptyKingdom(kn));
        const { error: createError } = await supabase
          .from('kingdoms')
          .upsert(newKingdoms, { onConflict: 'kingdom_number' });
        
        if (createError) {
          console.error('Failed to create missing kingdoms:', createError);
          showToast(`Warning: Could not create ${missingKingdoms.length} missing kingdoms`, 'error');
        } else {
          console.log(`Auto-created ${missingKingdoms.length} kingdoms: ${missingKingdoms.join(', ')}`);
        }
      }
      
      // Transform to kvk_history format
      const kvkRecords = records.map(r => ({
        kingdom_number: parseInt(r.kingdom_number || '0', 10),
        kvk_number: parseInt(r.kvk_number || '0', 10),
        opponent_number: parseInt(r.opponent_number || '0', 10),
        prep_result: r.prep_result?.toUpperCase() || null,
        battle_result: r.battle_result?.toUpperCase() || null,
        overall_result: r.overall_result?.toUpperCase() || null,
        kvk_date: r.kvk_date || null,
        order_index: parseInt(r.kvk_number || '0', 10)
      }));
      
      // Insert into Supabase kvk_history table
      const { error } = await supabase
        .from('kvk_history')
        .upsert(kvkRecords, { 
          onConflict: 'kingdom_number,kvk_number',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error('Bulk import error:', error);
        showToast(`Import failed: ${error.message}`, 'error');
        return;
      }
      
      // Also reload data to refresh caches
      kvkHistoryService.invalidateCache();
      apiService.reloadData();
      queryClient.invalidateQueries({ queryKey: kingdomKeys.all });
      
      const createdMsg = missingKingdoms.length > 0 ? ` (created ${missingKingdoms.length} new kingdoms)` : '';
      showToast(`✅ Imported ${records.length} KvK records to database${createdMsg}`, 'success');
      setImportData('');
    } catch (error) {
      console.error('Bulk import error:', error);
      showToast('Invalid CSV format or data', 'error');
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
      const response = await fetch(`${API_URL}/api/v1/submissions?status=${filter}`, {
        headers: { 'X-User-Id': user?.id || '' }
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
      const response = await fetch(`${API_URL}/api/v1/claims?status=${filter}`, {
        headers: { 'X-User-Id': user?.id || '' }
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
      const response = await fetch(`${API_URL}/api/v1/submissions/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user?.id || '',
          'X-User-Email': user?.email || ''
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
      const response = await fetch(`${API_URL}/api/v1/claims/${id}/verify`, {
        method: 'POST',
        headers: { 'X-User-Id': user?.id || '' }
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
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          Loading...
        </div>
      ) : activeTab === 'analytics' ? (
        <AnalyticsOverview 
          analytics={analytics} 
          syncingSubscriptions={syncingSubscriptions}
          onSyncSubscriptions={syncSubscriptions}
          currentKvK={currentKvK}
          incrementingKvK={incrementingKvK}
          onIncrementKvK={handleIncrementKvK}
        />
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
                  const willFlipPrep = error.error_type === 'wrong_prep_result';
                  const willFlipBattle = error.error_type === 'wrong_battle_result';
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
                src="https://plausible.io/share/ks-atlas.com?auth=YOUR_SHARED_LINK_AUTH&embed=true&theme=dark"
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
              Note: To enable the embedded dashboard, create a shared link in Plausible settings and replace YOUR_SHARED_LINK_AUTH with your auth token.
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
          <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Bulk Import KvK Results</h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Upload a CSV file or paste data directly. Required columns: <code style={{ color: '#22d3ee' }}>kingdom_number, kvk_number, opponent_number, prep_result, battle_result, overall_result, kvk_date</code>
          </p>
          <p style={{ color: '#4b5563', fontSize: '0.75rem', marginBottom: '1rem' }}>
            Results should be W/L/D. Date format: YYYY-MM-DD. Data will be inserted directly into the kvk_history table.
          </p>
          
          <div style={{ marginBottom: '1rem' }}>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '8px', color: '#22d3ee', cursor: 'pointer', fontWeight: 500 }}>
              📁 Choose CSV File
            </button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Or paste CSV data:
            </label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="kingdom_number,kvk_number,opponent_number,prep_result,battle_result,overall_result,kvk_date&#10;172,10,245,W,L,L,2026-02-01&#10;172,11,301,W,W,W,2026-02-22"
              style={{ width: '100%', height: '200px', padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          <button onClick={handleBulkImport} style={{ padding: '0.75rem 2rem', backgroundColor: '#22c55e', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Import Data
          </button>

          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #2a2a2a' }}>
            <h4 style={{ color: '#fff', marginBottom: '0.75rem' }}>Bulk Create Empty Kingdoms</h4>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Create placeholder kingdom profiles with no KvK data. Useful for adding all kingdoms that participated in a KvK.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => handleBulkCreateKingdoms(1, 1304)} 
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '8px', color: '#a855f7', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
              >
                Create Kingdoms 1-1304
              </button>
              <button 
                onClick={() => handleBulkCreateKingdoms(1305, 1500)} 
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#6b728020', border: '1px solid #6b728050', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
              >
                Create 1305-1500
              </button>
            </div>
          </div>
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
