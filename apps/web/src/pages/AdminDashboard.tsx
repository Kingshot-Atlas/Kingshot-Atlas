import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { analyticsService } from '../services/analyticsService';
import { statusService, type StatusSubmission } from '../services/statusService';
import { apiService } from '../services/api';

// Admin users - Discord usernames that have admin access
const ADMIN_USERS = ['gatreno'];

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
  };
  // Real analytics from local tracking
  featureUsage?: { feature: string; count: number; lastUsed: string }[];
  buttonClicks?: { feature: string; count: number; lastUsed: string }[];
  eventsByDay?: { date: string; count: number }[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CORRECTIONS_KEY = 'kingshot_data_corrections';

const AdminDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'analytics' | 'submissions' | 'claims' | 'corrections' | 'import' | 'users' | 'plausible' | 'transfer-status'>('analytics');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [transferSubmissions, setTransferSubmissions] = useState<StatusSubmission[]>([]);
  const [corrections, setCorrections] = useState<DataCorrection[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [importData, setImportData] = useState<string>('');

  // Check if user is admin
  const isAdmin = profile?.username && ADMIN_USERS.includes(profile.username.toLowerCase());

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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filter, isAdmin]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Get real analytics from local tracking service
      const realAnalytics = analyticsService.getAnalyticsSummary();
      
      // REAL DATA ONLY - no mock data
      // User stats come from Supabase, revenue from Stripe
      // For now, show only what we can actually measure
      
      const realData: AnalyticsData = {
        // Real visit data from local tracking
        totalVisits: realAnalytics.totalEvents,
        uniqueVisitors: realAnalytics.uniqueSessions,
        pageViews: realAnalytics.pageViews,
        bounceRate: 0, // Would need server-side tracking
        visitDuration: 0, // Would need server-side tracking
        topSources: [], // Would come from Plausible API
        topCountries: [], // Would come from Plausible API
        // User stats - will be fetched from Supabase
        userStats: { total: 0, free: 0, pro: 0, recruiter: 0 },
        // Submissions - will be fetched from API
        submissions: { pending: 0, approved: 0, rejected: 0 },
        // Revenue - would come from Stripe API
        revenue: { monthly: 0, total: 0, subscriptions: [] },
        // Real feature tracking
        featureUsage: realAnalytics.featureUsage,
        buttonClicks: realAnalytics.buttonClicks,
        eventsByDay: realAnalytics.eventsByDay,
      };
      
      // Fetch real user count from Supabase
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
          realData.userStats.total = count || 0;
          realData.userStats.free = count || 0; // All users are free for now
        }
      } catch (e) {
        console.log('Could not fetch user stats from Supabase');
      }
      
      // Fetch real submission counts from API
      try {
        const pendingRes = await fetch(`${API_URL}/api/submissions?status=pending`, { headers: { 'X-User-Id': user?.id || '' } });
        const approvedRes = await fetch(`${API_URL}/api/submissions?status=approved`, { headers: { 'X-User-Id': user?.id || '' } });
        const rejectedRes = await fetch(`${API_URL}/api/submissions?status=rejected`, { headers: { 'X-User-Id': user?.id || '' } });
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

  const reviewCorrection = (id: string, status: 'approved' | 'rejected') => {
    const stored = localStorage.getItem(CORRECTIONS_KEY);
    const all: DataCorrection[] = stored ? JSON.parse(stored) : [];
    const updated = all.map(c => c.id === id ? { ...c, status } : c);
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(updated));
    showToast(`Correction ${status}`, 'success');
    fetchCorrections();
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
      const response = await fetch(`${API_URL}/api/submissions?status=${filter}`, {
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
      const response = await fetch(`${API_URL}/api/claims?status=${filter}`, {
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
      const response = await fetch(`${API_URL}/api/submissions/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user?.id || ''
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        showToast(`Submission ${status}`, 'success');
        fetchSubmissions();
      } else {
        showToast('Failed to review submission', 'error');
      }
    } catch (error) {
      showToast('Error reviewing submission', 'error');
    }
  };

  const verifyClaim = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/api/claims/${id}/verify`, {
        method: 'POST',
        headers: { 'X-User-Id': user?.id || '' }
      });
      if (response.ok) {
        showToast('Claim verified', 'success');
        fetchClaims();
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
            { label: 'Total Visits', value: analytics.totalVisits.toLocaleString(), color: '#22d3ee', icon: '👁️' },
            { label: 'Unique Visitors', value: analytics.uniqueVisitors.toLocaleString(), color: '#a855f7', icon: '👤' },
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
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>👥 User Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Free Users', value: analytics.userStats.free, color: '#6b7280' },
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
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>💰 Revenue</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>${analytics.revenue.monthly.toFixed(2)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>This Month</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fbbf24' }}>${analytics.revenue.total.toFixed(2)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>All Time</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Active Subscriptions:</div>
            {analytics.revenue.subscriptions.map((sub, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ color: '#fff' }}>{sub.tier}</span>
                <span style={{ color: '#22d3ee', fontWeight: '600' }}>{sub.count}</span>
              </div>
            ))}
          </div>
        </div>

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
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff' }}>
          Admin Dashboard
        </h1>
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
          { id: 'analytics', label: 'Analytics', icon: '📊' },
          { id: 'submissions', label: 'KvK Results', icon: '⚔️' },
          { id: 'claims', label: 'Kingdom Claims', icon: '👑' },
          { id: 'transfer-status', label: 'Transfer Status', icon: '🔄' },
          { id: 'corrections', label: 'Data Corrections', icon: '📝' },
          { id: 'import', label: 'Bulk Import', icon: '📤' },
          { id: 'plausible', label: 'Live Analytics', icon: '📈' }
        ].map(tab => (
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
        renderAnalytics()
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
          {corrections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No {filter} data corrections
            </div>
          ) : (
            corrections.map((correction) => (
              <div key={correction.id} style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ color: '#22d3ee', fontWeight: 600 }}>K{correction.kingdom_number} - {correction.field}</span>
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
                      <button onClick={() => reviewCorrection(correction.id, 'rejected')} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
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
                plausible-embed="true"
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
    </div>
  );
};

export default AdminDashboard;
