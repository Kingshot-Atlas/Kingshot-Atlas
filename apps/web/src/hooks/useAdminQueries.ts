import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getAuthHeaders } from '../services/authHeaders';
import { logger } from '../utils/logger';
import { statusService } from '../services/statusService';
import type { PendingCounts } from '../components/admin/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ─── Query Keys ───────────────────────────────────────────────
export const adminKeys = {
  all: ['admin'] as const,
  pendingCounts: () => [...adminKeys.all, 'pendingCounts'] as const,
  submissions: (filter: string) => [...adminKeys.all, 'submissions', filter] as const,
  claims: (filter: string) => [...adminKeys.all, 'claims', filter] as const,
  corrections: (filter: string) => [...adminKeys.all, 'corrections', filter] as const,
  feedback: (filter: string) => [...adminKeys.all, 'feedback', filter] as const,
  feedbackCounts: () => [...adminKeys.all, 'feedbackCounts'] as const,
  unreadEmails: () => [...adminKeys.all, 'unreadEmails'] as const,
  webhookEvents: (filter: string) => [...adminKeys.all, 'webhookEvents', filter] as const,
  webhookStats: () => [...adminKeys.all, 'webhookStats'] as const,
  transferApplications: (filter: string) => [...adminKeys.all, 'transferApps', filter] as const,
  transferAnalytics: () => [...adminKeys.all, 'transferAnalytics'] as const,
};

// ─── Pending Counts ───────────────────────────────────────────
async function fetchPendingCounts(): Promise<PendingCounts> {
  const counts: PendingCounts = {
    submissions: 0,
    claims: 0,
    corrections: 0,
    transfers: 0,
    kvkErrors: 0,
    feedback: 0,
    reviewReports: 0,
  };

  // Corrections from Supabase
  if (supabase) {
    const { count } = await supabase
      .from('data_corrections')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    counts.corrections = count || 0;
  }

  // Transfer status from Supabase
  try {
    const transfers = await statusService.fetchAllSubmissions('pending');
    counts.transfers = transfers.length;
  } catch { /* Supabase might not be available */ }

  // Submissions from API
  try {
    const authHeaders = await getAuthHeaders({ requireAuth: false });
    const res = await fetch(`${API_URL}/api/v1/submissions?status=pending`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      counts.submissions = Array.isArray(data) ? data.length : 0;
    }
  } catch { /* API might not be available */ }

  // Claims from API
  try {
    const authHeaders = await getAuthHeaders({ requireAuth: false });
    const res = await fetch(`${API_URL}/api/v1/claims?status=pending`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      counts.claims = Array.isArray(data) ? data.length : 0;
    }
  } catch { /* API might not be available */ }

  // KvK errors from Supabase
  if (supabase) {
    const { count } = await supabase
      .from('kvk_errors')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    counts.kvkErrors = count || 0;
  }

  // Feedback count from Supabase
  if (supabase) {
    try {
      const { count } = await supabase
        .from('feedback')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
      counts.feedback = count || 0;
    } catch { /* Table might not exist yet */ }
  }

  // Review reports from Supabase
  if (supabase) {
    try {
      const { count } = await supabase
        .from('review_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      counts.reviewReports = count || 0;
    } catch { /* Table might not exist yet */ }
  }

  return counts;
}

export function useAdminPendingCounts(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.pendingCounts(),
    queryFn: fetchPendingCounts,
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every 60s
  });
}

// ─── Unread Email Count ───────────────────────────────────────
async function fetchUnreadEmailCount(): Promise<number> {
  const authHeaders = await getAuthHeaders({ requireAuth: false });
  const res = await fetch(`${API_URL}/api/v1/admin/email/stats`, { headers: authHeaders });
  if (res.ok) {
    const data = await res.json();
    return data.unread || 0;
  }
  return 0;
}

export function useUnreadEmailCount(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.unreadEmails(),
    queryFn: fetchUnreadEmailCount,
    enabled,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000, // Poll every 30s
  });
}

// ─── Submissions ──────────────────────────────────────────────
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

async function fetchSubmissions(filter: string): Promise<Submission[]> {
  const authHeaders = await getAuthHeaders({ requireAuth: false });
  const res = await fetch(`${API_URL}/api/v1/submissions?status=${filter}`, { headers: authHeaders });
  if (res.ok) {
    return await res.json();
  }
  return [];
}

export function useAdminSubmissions(filter: string, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.submissions(filter),
    queryFn: () => fetchSubmissions(filter),
    enabled,
    staleTime: 30 * 1000,
  });
}

// ─── Claims ───────────────────────────────────────────────────
interface Claim {
  id: number;
  kingdom_number: number;
  user_id: string;
  status: string;
  verification_code: string | null;
  created_at: string;
}

async function fetchClaims(filter: string): Promise<Claim[]> {
  const authHeaders = await getAuthHeaders({ requireAuth: false });
  const res = await fetch(`${API_URL}/api/v1/claims?status=${filter}`, { headers: authHeaders });
  if (res.ok) {
    return await res.json();
  }
  return [];
}

export function useAdminClaims(filter: string, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.claims(filter),
    queryFn: () => fetchClaims(filter),
    enabled,
    staleTime: 30 * 1000,
  });
}

// ─── Feedback ─────────────────────────────────────────────────
interface FeedbackItem {
  id: string;
  type: string;
  message: string;
  email: string | null;
  status: string;
  page_url: string | null;
  created_at: string;
  admin_notes: string | null;
}

interface FeedbackCounts {
  new: number;
  reviewed: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

async function fetchFeedback(filter: string): Promise<FeedbackItem[]> {
  if (!supabase) return [];
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
  return data || [];
}

async function fetchFeedbackCounts(): Promise<FeedbackCounts> {
  if (!supabase) return { new: 0, reviewed: 0, in_progress: 0, resolved: 0, closed: 0 };
  const { data, error } = await supabase.from('feedback').select('status');
  if (error) throw error;

  const counts: FeedbackCounts = { new: 0, reviewed: 0, in_progress: 0, resolved: 0, closed: 0 };
  (data || []).forEach(item => {
    const status = item.status as keyof FeedbackCounts;
    if (status in counts) {
      counts[status]++;
    }
  });
  return counts;
}

export function useAdminFeedback(filter: string, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.feedback(filter),
    queryFn: () => fetchFeedback(filter),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useAdminFeedbackCounts(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.feedbackCounts(),
    queryFn: fetchFeedbackCounts,
    enabled,
    staleTime: 30 * 1000,
  });
}

// ─── Webhook Data ─────────────────────────────────────────────
interface WebhookEvent {
  id: string;
  event_id: string;
  event_type: string;
  status: string;
  error_message?: string;
  processing_time_ms?: number;
  customer_id?: string;
  created_at: string;
  processed_at?: string;
}

interface WebhookStats {
  total_24h: number;
  processed: number;
  failed: number;
  failure_rate: number;
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
}

async function fetchWebhookEvents(filter: string): Promise<WebhookEvent[]> {
  const authHeaders = await getAuthHeaders({ requireAuth: false });
  const statusParam = filter !== 'all' ? `&status=${filter}` : '';
  const res = await fetch(`${API_URL}/api/v1/admin/webhooks/events?limit=50${statusParam}`, { headers: authHeaders });
  if (res.ok) {
    const data = await res.json();
    return data.events || [];
  }
  return [];
}

async function fetchWebhookStats(): Promise<WebhookStats | null> {
  const authHeaders = await getAuthHeaders({ requireAuth: false });
  const res = await fetch(`${API_URL}/api/v1/admin/webhooks/stats`, { headers: authHeaders });
  if (res.ok) {
    return await res.json();
  }
  return null;
}

export function useWebhookEvents(filter: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.webhookEvents(filter),
    queryFn: () => fetchWebhookEvents(filter),
    enabled,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
  });
}

export function useWebhookStats(enabled = true) {
  return useQuery({
    queryKey: adminKeys.webhookStats(),
    queryFn: fetchWebhookStats,
    enabled,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

// ─── Transfer Applications ────────────────────────────────────
interface TransferApp {
  id: string;
  transfer_profile_id: string;
  applicant_user_id: string;
  kingdom_number: number;
  status: string;
  applied_at: string;
  viewed_at: string | null;
  responded_at: string | null;
  expires_at: string;
  applicant_username?: string;
  applicant_kingdom?: number | null;
  profile_tc_level?: number;
  profile_power_million?: number;
  profile_main_language?: string;
}

interface TransferAnalytics {
  total: number;
  byStatus: Record<string, number>;
  byKingdom: { kingdom_number: number; count: number }[];
  avgResponseTimeHours: number | null;
  expiredCount: number;
}

async function fetchTransferApplications(filter: string): Promise<TransferApp[]> {
  if (!supabase) return [];
  let query = supabase
    .from('transfer_applications')
    .select('*')
    .order('applied_at', { ascending: false })
    .limit(200);

  if (filter !== 'all') {
    query = query.eq('status', filter);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Error fetching transfer applications:', error);
    return [];
  }

  // Enrich with profile data
  if (data && data.length > 0) {
    const profileIds = [...new Set(data.map((a: TransferApp) => a.transfer_profile_id))];
    const { data: profiles } = await supabase
      .from('transfer_profiles')
      .select('id, display_name, kingdom_number, tc_level, power_million, main_language')
      .in('id', profileIds);

    const profileMap = new Map((profiles || []).map((p: { id: string }) => [p.id, p]));

    const userIds = [...new Set(data.map((a: TransferApp) => a.applicant_user_id))];
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);

    const userMap = new Map((users || []).map((u: { id: string }) => [u.id, u]));

    return data.map((app: TransferApp) => {
      const profile = profileMap.get(app.transfer_profile_id) as { kingdom_number?: number; tc_level?: number; power_million?: number; main_language?: string } | undefined;
      const user = userMap.get(app.applicant_user_id) as { username?: string } | undefined;
      return {
        ...app,
        applicant_username: user?.username || 'Unknown',
        applicant_kingdom: profile?.kingdom_number,
        profile_tc_level: profile?.tc_level,
        profile_power_million: profile?.power_million,
        profile_main_language: profile?.main_language,
      };
    });
  }

  return data || [];
}

async function fetchTransferAnalytics(): Promise<TransferAnalytics | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('transfer_applications')
    .select('status, kingdom_number, applied_at, responded_at');

  if (error) {
    logger.error('Error fetching transfer analytics:', error);
    return null;
  }

  const apps = data || [];
  const byStatus: Record<string, number> = {};
  const kingdomCounts: Record<number, number> = {};
  let totalResponseTime = 0;
  let responseCount = 0;
  let expiredCount = 0;

  apps.forEach((app: { status: string; kingdom_number: number; applied_at: string; responded_at: string | null }) => {
    byStatus[app.status] = (byStatus[app.status] || 0) + 1;
    kingdomCounts[app.kingdom_number] = (kingdomCounts[app.kingdom_number] || 0) + 1;
    if (app.status === 'expired') expiredCount++;
    if (app.responded_at && app.applied_at) {
      const diff = new Date(app.responded_at).getTime() - new Date(app.applied_at).getTime();
      totalResponseTime += diff;
      responseCount++;
    }
  });

  const byKingdom = Object.entries(kingdomCounts)
    .map(([k, count]) => ({ kingdom_number: Number(k), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total: apps.length,
    byStatus,
    byKingdom,
    avgResponseTimeHours: responseCount > 0 ? totalResponseTime / responseCount / (1000 * 60 * 60) : null,
    expiredCount,
  };
}

export function useTransferApplications(filter: string, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.transferApplications(filter),
    queryFn: () => fetchTransferApplications(filter),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useTransferAnalytics(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.transferAnalytics(),
    queryFn: fetchTransferAnalytics,
    enabled,
    staleTime: 60 * 1000,
  });
}

// ─── Invalidation Helpers ─────────────────────────────────────
export function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return {
    invalidatePendingCounts: () => queryClient.invalidateQueries({ queryKey: adminKeys.pendingCounts() }),
    invalidateSubmissions: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
    invalidateFeedback: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.feedback('') });
      queryClient.invalidateQueries({ queryKey: adminKeys.feedbackCounts() });
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingCounts() });
    },
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  };
}
