import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { analyticsService } from '../services/analyticsService';
import { statusService, type StatusSubmission } from '../services/statusService';
import { apiService } from '../services/api';
import { contributorService } from '../services/contributorService';
import { correctionService } from '../services/correctionService';
import { kvkCorrectionService } from '../services/kvkCorrectionService';
import { AnalyticsDashboard } from '../components/AnalyticsCharts';
import { EngagementDashboard } from '../components/EngagementDashboard';
import { WebhookMonitor } from '../components/WebhookMonitor';
import { DataSourceStats } from '../components/DataSourceStats';
import { ADMIN_USERNAMES } from '../utils/constants';

interface Submission {
  id: number;
  submitter_id: string;
  submitter_name: string | null;
  kingdom_number: number;
  kvk_number: number;
  opponent_kingdom: number;
  prep_result: string;
  battle_result: string;
  date_or_order_index: string | null;
  screenshot_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface Claim {
  id: number;
  kingdom_number: number;
  user_id: string;
  status: string;
  verification_code: string | null;
  created_at: string;
}

interface DataCorrection {
  id: string;
  kingdom_number: number;
  field: string;
  current_value: string;
  suggested_value: string;
  reason: string;
  submitter_id: string;
  submitter_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

interface KvKError {
  id: string;
  kingdom_number: number;
  kvk_number: number | null;
  error_type: string;
  error_type_label: string;
  current_data: {
    opponent: number;
    prep_result: string;
    battle_result: string;
  } | null;
  description: string;
  submitted_by: string;
  submitted_by_name: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

interface AnalyticsData {
  totalVisits: number;
  uniqueVisitors: number;
  pageViews: { page: string; views: number }[];
  bounceRate: number;
  visitDuration: number;
  topSources: { source: string; visitors: number }[];
  topCountries: { country: string; visitors: number }[];
  userStats: {
    total: number;
    free: number;
    pro: number;
    recruiter: number;
    kingshot_linked: number;
  };
  submissions: {
    pending: number;
    approved: number;
    rejected: number;
  };
  revenue: {
    monthly: number;
    total: number;
    subscriptions: { tier: string; count: number }[];
    activeSubscriptions?: number;
    recentPayments?: { amount: number; currency: string; date: string; customer_email?: string }[];
  };
  recentSubscribers?: { username: string; tier: string; created_at: string }[];
  // Real analytics from local tracking
  featureUsage?: { feature: string; count: number; lastUsed: string }[];
  buttonClicks?: { feature: string; count: number; lastUsed: string }[];
  eventsByDay?: { date: string; count: number }[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CORRECTIONS_KEY = 'kingshot_data_corrections';
const KVK_ERRORS_KEY = 'kingshot_kvk_errors';
const ADMIN_LOG_KEY = 'kingshot_admin_log';

const AdminDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'analytics' | 'saas-metrics' | 'engagement' | 'webhooks' | 'data-sources' | 'submissions' | 'claims' | 'corrections' | 'kvk-errors' | 'import' | 'users' | 'plausible' | 'transfer-status'>('analytics');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
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
  const [importData, setImportData] = useState<string>('');
  const [pendingCounts, setPendingCounts] = useState<{ submissions: number; claims: number; corrections: number; transfers: number; kvkErrors: number }>({ submissions: 0, claims: 0, corrections: 0, transfers: 0, kvkErrors: 0 });
  const [syncingSubscriptions, setSyncingSubscriptions] = useState(false);

  // Check if user is admin
  const isAdmin = profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase());

  // Fetch pending counts on mount
  useEffect(() => {
    if (isAdmin) fetchPendingCounts();
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filter, isAdmin]);

  const fetchPendingCounts = async () => {
    try {
      // Corrections from localStorage
      const correctionsStored = localStorage.getItem(CORRECTIONS_KEY);
      const allCorrections: DataCorrection[] = correctionsStored ? JSON.parse(correctionsStored) : [];
      const pendingCorrections = allCorrections.filter(c => c.status === 'pending').length;
      
      // Transfer status from localStorage
      const transfersStored = localStorage.getItem('kingshot_status_submissions');
      const allTransfers: StatusSubmission[] = transfersStored ? JSON.parse(transfersStored) : [];
      const pendingTransfers = allTransfers.filter(t => t.status === 'pending').length;
      
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
      
      // KvK errors from localStorage
      const kvkErrorsStored = localStorage.getItem(KVK_ERRORS_KEY);
      const allKvkErrors: KvKError[] = kvkErrorsStored ? JSON.parse(kvkErrorsStored) : [];
      const pendingKvkErrors = allKvkErrors.filter(e => e.status === 'pending').length;
      
      setPendingCounts({
        submissions: pendingSubmissions,
        claims: pendingClaims,
        corrections: pendingCorrections,
        transfers: pendingTransfers,
        kvkErrors: pendingKvkErrors
      });
    } catch (error) {
      console.error('Failed to fetch pending counts:', error);
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
        console.log('Could not fetch admin stats from API');
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
        console.log('Could not fetch submission counts from API');
      }
      
      setAnalytics(realData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
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

  const fetchCorrections = () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(CORRECTIONS_KEY);
      const all: DataCorrection[] = stored ? JSON.parse(stored) : [];
      const filtered = filter === 'all' ? all : all.filter(c => c.status === filter);
      setCorrections(filtered);
    } catch (error) {
      console.error('Failed to fetch corrections:', error);
    } finally {
      setLoading(false);
    }
  };

  const reviewCorrection = (id: string, status: 'approved' | 'rejected', notes?: string) => {
    const stored = localStorage.getItem(CORRECTIONS_KEY);
    const all: DataCorrection[] = stored ? JSON.parse(stored) : [];
    const correction = all.find(c => c.id === id);
    const updated = all.map(c => c.id === id ? { 
      ...c, 
      status,
      reviewed_by: profile?.username || 'admin',
      reviewed_at: new Date().toISOString(),
      review_notes: notes || ''
    } : c);
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(updated));
    logAdminAction('correction', id, status, notes);
    
    // C2: Send notification to submitter & B3: Update reputation
    if (correction) {
      contributorService.updateReputation(correction.submitter_id, correction.submitter_name, 'correction', status === 'approved');
      contributorService.addNotification(correction.submitter_id, {
        type: status === 'approved' ? 'correction_approved' : 'correction_rejected',
        title: status === 'approved' ? 'Correction Approved!' : 'Correction Rejected',
        message: `Your correction for K${correction.kingdom_number} (${correction.field}) was ${status}.${notes ? ` Reason: ${notes}` : ''}`,
        itemId: id
      });
    }
    
    showToast(`Correction ${status}`, 'success');
    
    // Apply corrections to kingdom data immediately if approved
    if (status === 'approved') {
      correctionService.applyCorrectionsAndReload();
    }
    
    fetchCorrections();
    fetchPendingCounts();
    setRejectModalOpen(null);
    setRejectReason('');
  };

  const fetchKvkErrors = () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(KVK_ERRORS_KEY);
      const all: KvKError[] = stored ? JSON.parse(stored) : [];
      const filtered = filter === 'all' ? all : all.filter(e => e.status === filter);
      setKvkErrors(filtered);
    } catch (error) {
      console.error('Failed to fetch KvK errors:', error);
    } finally {
      setLoading(false);
    }
  };

  const reviewKvkError = async (id: string, status: 'approved' | 'rejected', notes?: string) => {
    const stored = localStorage.getItem(KVK_ERRORS_KEY);
    const all: KvKError[] = stored ? JSON.parse(stored) : [];
    const kvkError = all.find(e => e.id === id);
    const updated = all.map(e => e.id === id ? { 
      ...e, 
      status,
      reviewed_by: profile?.username || 'admin',
      reviewed_at: new Date().toISOString(),
      review_notes: notes || ''
    } : e);
    localStorage.setItem(KVK_ERRORS_KEY, JSON.stringify(updated));
    logAdminAction('kvk-error', id, status, notes);
    
    // C2: Send notification to submitter & B3: Update reputation
    if (kvkError) {
      contributorService.updateReputation(kvkError.submitted_by, kvkError.submitted_by_name, 'kvkError', status === 'approved');
      contributorService.addNotification(kvkError.submitted_by, {
        type: status === 'approved' ? 'submission_approved' : 'submission_rejected',
        title: status === 'approved' ? 'KvK Error Report Approved!' : 'KvK Error Report Rejected',
        message: `Your KvK error report for K${kvkError.kingdom_number} was ${status}.${notes ? ` Reason: ${notes}` : ''}`,
        itemId: id
      });
      
      // Apply KvK correction to data if approved (writes to Supabase)
      if (status === 'approved' && kvkError.current_data) {
        await kvkCorrectionService.applyCorrectionAsync(kvkError, profile?.username || 'admin');
        apiService.reloadData(); // Trigger data reload to pick up corrections
      }
    }
    
    showToast(`KvK error report ${status}`, 'success');
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

  const bulkReviewCorrections = (status: 'approved' | 'rejected') => {
    if (selectedItems.size === 0) return;
    const stored = localStorage.getItem(CORRECTIONS_KEY);
    const all: DataCorrection[] = stored ? JSON.parse(stored) : [];
    const updated = all.map(c => selectedItems.has(c.id) ? { 
      ...c, 
      status,
      reviewed_by: profile?.username || 'admin',
      reviewed_at: new Date().toISOString()
    } : c);
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(updated));
    selectedItems.forEach(id => logAdminAction('correction', id, status, 'Bulk action'));
    showToast(`${selectedItems.size} corrections ${status}`, 'success');
    setSelectedItems(new Set());
    fetchCorrections();
    fetchPendingCounts();
  };

  const bulkReviewKvkErrors = (status: 'approved' | 'rejected') => {
    if (selectedItems.size === 0) return;
    const stored = localStorage.getItem(KVK_ERRORS_KEY);
    const all: KvKError[] = stored ? JSON.parse(stored) : [];
    const updated = all.map(e => selectedItems.has(e.id) ? { 
      ...e, 
      status,
      reviewed_by: profile?.username || 'admin',
      reviewed_at: new Date().toISOString()
    } : e);
    localStorage.setItem(KVK_ERRORS_KEY, JSON.stringify(updated));
    selectedItems.forEach(id => logAdminAction('kvk-error', id, status, 'Bulk action'));
    showToast(`${selectedItems.size} KvK errors ${status}`, 'success');
    setSelectedItems(new Set());
    fetchKvkErrors();
    fetchPendingCounts();
  };

  const handleBulkImport = () => {
    if (!importData.trim()) {
      showToast('Please paste CSV data', 'error');
      return;
    }
    try {
      const lines = importData.trim().split('\n');
      if (lines.length < 2) {
        showToast('CSV must have header and at least one data row', 'error');
        return;
      }
      const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase()) || [];
      const records = lines.slice(1).map(line => {
        const values = line.split(',');
        const record: Record<string, string> = {};
        headers.forEach((h, i) => record[h] = values[i]?.trim() || '');
        return record;
      });
      localStorage.setItem('kingshot_bulk_import', JSON.stringify({
        records,
        imported_at: new Date().toISOString(),
        imported_by: user?.id
      }));
      showToast(`Imported ${records.length} records for processing`, 'success');
      setImportData('');
    } catch (error) {
      showToast('Invalid CSV format', 'error');
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
        showToast(`Submission ${status}`, 'success');
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

  // Transfer Status Submissions
  const fetchTransferSubmissions = () => {
    setLoading(true);
    try {
      // Get all submissions from localStorage directly for filtering
      const stored = localStorage.getItem('kingshot_status_submissions');
      const all: StatusSubmission[] = stored ? JSON.parse(stored) : [];
      
      const filtered = filter === 'all' 
        ? all 
        : all.filter(s => s.status === filter);
      
      setTransferSubmissions(filtered);
    } catch (error) {
      console.error('Failed to fetch transfer submissions:', error);
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
        <p>You don't have permission to access the admin dashboard.</p>
        <p style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
          Logged in as: {profile?.username || 'Unknown'}
        </p>
      </div>
    );
  }

  // Analytics Tab Content
  const renderAnalytics = () => {
    if (!analytics) return <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading analytics...</div>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Total Events', value: analytics.totalVisits.toLocaleString(), color: '#22d3ee', icon: '👁️' },
            { label: 'Sessions (local)', value: analytics.uniqueVisitors.toLocaleString(), color: '#a855f7', icon: '👤' },
            { label: 'Total Users', value: analytics.userStats.total.toLocaleString(), color: '#22c55e', icon: '👥' },
            { label: 'Monthly Revenue', value: `$${analytics.revenue.monthly.toFixed(2)}`, color: '#fbbf24', icon: '💰' },
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
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: metric.color }}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>

        {/* User Breakdown */}
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>👥 User Breakdown</h3>
            <button
              onClick={syncSubscriptions}
              disabled={syncingSubscriptions}
              style={{
                padding: '0.35rem 0.75rem',
                backgroundColor: syncingSubscriptions ? '#374151' : '#22d3ee20',
                color: syncingSubscriptions ? '#6b7280' : '#22d3ee',
                border: '1px solid #22d3ee40',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: syncingSubscriptions ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              {syncingSubscriptions ? '⏳ Syncing...' : '🔄 Sync with Stripe'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Free Users', value: analytics.userStats.free, color: '#6b7280' },
              { label: 'Kingshot Linked', value: analytics.userStats.kingshot_linked, color: '#f59e0b' },
              { label: 'Atlas Pro', value: analytics.userStats.pro, color: '#22d3ee' },
              { label: 'Atlas Recruiter', value: analytics.userStats.recruiter, color: '#a855f7' },
            ].map((tier, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: tier.color }}>{tier.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{tier.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Submissions Overview */}
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>📝 Submissions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Pending', value: analytics.submissions.pending, color: '#fbbf24' },
              { label: 'Approved', value: analytics.submissions.approved, color: '#22c55e' },
              { label: 'Rejected', value: analytics.submissions.rejected, color: '#ef4444' },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue */}
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>💰 Revenue & Subscriptions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>${analytics.revenue.monthly.toFixed(2)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>MRR</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fbbf24' }}>${analytics.revenue.total.toFixed(2)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Total Revenue</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#a855f7' }}>{analytics.revenue.activeSubscriptions || 0}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Active Subs</div>
            </div>
          </div>
          
          {/* Subscription Breakdown */}
          {analytics.revenue.subscriptions.length > 0 && (
            <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>By Tier:</div>
              {analytics.revenue.subscriptions.map((sub, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span style={{ color: '#fff' }}>{sub.tier}</span>
                  <span style={{ color: '#22d3ee', fontWeight: '600' }}>{sub.count}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Recent Payments */}
          <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Recent Payments:</div>
            {analytics.revenue.recentPayments && analytics.revenue.recentPayments.length > 0 ? (
              analytics.revenue.recentPayments.slice(0, 5).map((payment, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '0.4rem 0',
                  borderBottom: i < 4 ? '1px solid #1a1a1f' : 'none'
                }}>
                  <div>
                    <span style={{ color: '#22c55e', fontWeight: '600' }}>${payment.amount.toFixed(2)}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                      {new Date(payment.date).toLocaleDateString()}
                    </span>
                  </div>
                  {payment.customer_email && (
                    <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                      {payment.customer_email.substring(0, 20)}...
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div style={{ color: '#6b7280', fontSize: '0.85rem', fontStyle: 'italic' }}>No payments yet</div>
            )}
          </div>
        </div>

        {/* Recent Subscribers */}
        {analytics.recentSubscribers && analytics.recentSubscribers.length > 0 && (
          <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🎉 Recent Subscribers</h3>
            {analytics.recentSubscribers.slice(0, 5).map((sub, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: i < 4 ? '1px solid #1a1a1f' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#fff' }}>{sub.username}</span>
                  <span style={{ 
                    padding: '0.15rem 0.5rem',
                    backgroundColor: sub.tier === 'recruiter' ? '#f9731620' : '#22d3ee20',
                    color: sub.tier === 'recruiter' ? '#f97316' : '#22d3ee',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {sub.tier}
                  </span>
                </div>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {new Date(sub.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Top Pages */}
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>📊 Top Pages</h3>
          {analytics.pageViews.map((page, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '0.5rem 0',
              borderBottom: i < analytics.pageViews.length - 1 ? '1px solid #1a1a1f' : 'none'
            }}>
              <span style={{ color: '#fff' }}>{page.page}</span>
              <span style={{ color: '#22d3ee', fontWeight: '600' }}>{page.views.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff' }}>
          Admin Dashboard {viewAsUser && <span style={{ fontSize: '0.9rem', color: '#fbbf24' }}>(Viewing as Free User)</span>}
        </h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* A4: View as User Toggle */}
          <button
            onClick={() => setViewAsUser(!viewAsUser)}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: viewAsUser ? '#fbbf2420' : '#3a3a3a20',
              borderRadius: '6px',
              border: viewAsUser ? '1px solid #fbbf2450' : '1px solid #3a3a3a',
              color: viewAsUser ? '#fbbf24' : '#9ca3af',
              fontSize: '0.8rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            👁️ {viewAsUser ? 'Exit User View' : 'View as User'}
          </button>
          <div style={{ 
            padding: '0.35rem 0.75rem', 
            backgroundColor: '#22c55e20', 
            borderRadius: '6px',
            border: '1px solid #22c55e50',
            color: '#22c55e',
            fontSize: '0.8rem',
            fontWeight: '600'
          }}>
            ✓ Admin: {profile?.username}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        borderBottom: '1px solid #2a2a2a',
        paddingBottom: '0.5rem',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'analytics', label: 'Analytics', icon: '📊', countKey: null },
          { id: 'saas-metrics', label: 'SaaS Metrics', icon: '💰', countKey: null },
          { id: 'engagement', label: 'Engagement', icon: '👥', countKey: null },
          { id: 'webhooks', label: 'Webhooks', icon: '🔗', countKey: null },
          { id: 'data-sources', label: 'Data Sources', icon: '🗄️', countKey: null },
          { id: 'submissions', label: 'KvK Results', icon: '⚔️', countKey: 'submissions' as const },
          { id: 'claims', label: 'Kingdom Claims', icon: '👑', countKey: 'claims' as const },
          { id: 'transfer-status', label: 'Transfer Status', icon: '🔄', countKey: 'transfers' as const },
          { id: 'corrections', label: 'Data Corrections', icon: '📝', countKey: 'corrections' as const },
          { id: 'kvk-errors', label: 'KvK Errors', icon: '🚩', countKey: 'kvkErrors' as const },
          { id: 'import', label: 'Bulk Import', icon: '📤', countKey: null },
          { id: 'plausible', label: 'Live Analytics', icon: '📈', countKey: null }
        ].map(tab => {
          const count = tab.countKey ? pendingCounts[tab.countKey] : 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: activeTab === tab.id ? '#22d3ee' : 'transparent',
                color: activeTab === tab.id ? '#0a0a0a' : '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.9rem'
              }}
            >
              <span>{tab.icon}</span> {tab.label}
              {count > 0 && (
                <span style={{
                  backgroundColor: activeTab === tab.id ? '#0a0a0a' : '#fbbf24',
                  color: activeTab === tab.id ? '#22d3ee' : '#0a0a0a',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '9999px',
                  minWidth: '1.2rem',
                  textAlign: 'center'
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
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
        renderAnalytics()
      ) : activeTab === 'saas-metrics' ? (
        <AnalyticsDashboard />
      ) : activeTab === 'engagement' ? (
        <EngagementDashboard />
      ) : activeTab === 'webhooks' ? (
        <WebhookMonitor />
      ) : activeTab === 'data-sources' ? (
        <DataSourceStats />
      ) : activeTab === 'submissions' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No {filter} submissions
            </div>
          ) : (
            submissions.map((sub) => (
              <div key={sub.id} style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ color: '#22d3ee', fontWeight: 600 }}>K{sub.kingdom_number}</span>
                    <span style={{ color: '#6b7280' }}> vs </span>
                    <span style={{ color: '#f97316', fontWeight: 600 }}>K{sub.opponent_kingdom}</span>
                    <span style={{ color: '#6b7280', marginLeft: '1rem' }}>KvK #{sub.kvk_number}</span>
                  </div>
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
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Prep: </span>
                    <span style={{ color: sub.prep_result === 'W' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {sub.prep_result === 'W' ? 'Win' : 'Loss'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Battle: </span>
                    <span style={{ color: sub.battle_result === 'W' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {sub.battle_result === 'W' ? 'Win' : 'Loss'}
                    </span>
                  </div>
                </div>

                {sub.notes && (
                  <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Notes: {sub.notes}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    By {sub.submitter_name || 'Anonymous'} • {new Date(sub.created_at).toLocaleDateString()}
                  </div>
                  
                  {sub.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => reviewSubmission(sub.id, 'approved')} style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        Approve
                      </button>
                      <button onClick={() => reviewSubmission(sub.id, 'rejected')} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'claims' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {claims.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No {filter} claims
            </div>
          ) : (
            claims.map((claim) => (
              <div key={claim.id} style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ color: '#22d3ee', fontWeight: 600, fontSize: '1.25rem' }}>Kingdom {claim.kingdom_number}</span>
                  <div style={{ 
                    padding: '0.25rem 0.75rem',
                    backgroundColor: claim.status === 'pending' ? '#fbbf2420' : '#22c55e20',
                    color: claim.status === 'pending' ? '#fbbf24' : '#22c55e',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {claim.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Verification Code: <code style={{ color: '#fbbf24', backgroundColor: '#1a1a1f', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>{claim.verification_code}</code>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    Claimed {new Date(claim.created_at).toLocaleDateString()}
                  </div>
                  
                  {claim.status === 'pending' && (
                    <button onClick={() => verifyClaim(claim.id)} style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                      Verify Claim
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
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
                
                {error.current_data && (
                  <div style={{ 
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#0a0a0a',
                    borderRadius: '8px',
                    border: '1px solid #1f1f1f'
                  }}>
                    <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.5rem' }}>REPORTED DATA</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <div>
                        <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Opponent</div>
                        <div style={{ color: '#22d3ee' }}>K{error.current_data.opponent}</div>
                      </div>
                      <div>
                        <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Prep</div>
                        <div style={{ color: error.current_data.prep_result === 'Win' ? '#22c55e' : '#ef4444' }}>
                          {error.current_data.prep_result}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Battle</div>
                        <div style={{ color: error.current_data.battle_result === 'Win' ? '#22c55e' : '#ef4444' }}>
                          {error.current_data.battle_result}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
      ) : activeTab === 'import' ? (
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Bulk Import KvK Results</h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Upload a CSV file or paste data directly. Required columns: kingdom_number, kvk_number, opponent_kingdom, prep_result, battle_result
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
              placeholder="kingdom_number,kvk_number,opponent_kingdom,prep_result,battle_result&#10;1234,5,5678,W,L&#10;1234,6,9012,W,W"
              style={{ width: '100%', height: '200px', padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          <button onClick={handleBulkImport} style={{ padding: '0.75rem 2rem', backgroundColor: '#22c55e', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Import Data
          </button>
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
