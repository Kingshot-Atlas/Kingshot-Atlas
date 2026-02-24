// Admin Dashboard shared types

export interface Submission {
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
  screenshot2_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface Claim {
  id: number;
  kingdom_number: number;
  user_id: string;
  status: string;
  verification_code: string | null;
  created_at: string;
}

export interface DataCorrection {
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

export interface KvKError {
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
  corrected_data?: {
    opponent?: number;
    prep_result?: string;
    battle_result?: string;
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

export interface NewKingdomSubmission {
  id: string;
  kingdom_number: number;
  first_kvk_id: number | null; // null = hasn't had first KvK yet
  kvk_history: Array<{ kvk: number; prep: 'W' | 'L'; battle: 'W' | 'L' }>;
  submitted_by: string;
  submitted_by_user_id?: string;
  submitted_by_kingdom: number | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
}

export interface AnalyticsData {
  totalVisits: number;
  uniqueVisitors: number;
  pageViews: { page: string; views: number }[];
  totalPageViews?: number;
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
  featureUsage?: { feature: string; count: number; lastUsed: string }[];
  buttonClicks?: { feature: string; count: number; lastUsed: string }[];
  eventsByDay?: { date: string; count: number }[];
}

export type AdminTab = 
  | 'analytics' 
  | 'saas-metrics' 
  | 'engagement' 
  | 'user-heatmap'
  | 'webhooks' 
  | 'data-sources' 
  | 'discord-bot'
  | 'discord-roles'
  | 'referrals'
  | 'submissions' 
  | 'new-kingdoms' 
  | 'claims' 
  | 'corrections' 
  | 'kvk-errors' 
  | 'import' 
  | 'plausible' 
  | 'transfer-status'
  | 'transfer-apps'
  | 'transfer-hub'
  | 'transfer-outcomes'
  | 'feedback'
  | 'email'
  | 'bot-telemetry'
  | 'gift-codes'
  | 'battle-planner'
  | 'spotlight'
  | 'finance'
  | 'kvk-bulk'
  | 'review-reports';

export type AdminCategory = 'overview' | 'review' | 'transfer' | 'finance' | 'operations';

export interface PendingCounts {
  submissions: number;
  claims: number;
  corrections: number;
  transfers: number;
  kvkErrors: number;
  feedback: number;
  reviewReports: number;
}

export interface ApiHealth {
  api: 'ok' | 'error' | 'loading';
  supabase: 'ok' | 'error' | 'loading';
  stripe: 'ok' | 'error' | 'loading';
}
