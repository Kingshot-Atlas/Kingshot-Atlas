// =============================================
// TYPES
// =============================================

export interface ReferralRecord {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  status: string;
  source: string;
  created_at: string;
  verified_at: string | null;
  signup_ip: string | null;
}

export interface ReferrerProfile {
  id: string;
  username: string;
  linked_username: string | null;
  referral_count: number;
  referral_tier: string | null;
  linked_kingdom: number | null;
}

export interface Metrics {
  total: number;
  pending: number;
  verified: number;
  invalid: number;
  conversionRate: number;
  uniqueReferrers: number;
  sourceBreakdown: { source: string; count: number; verified: number }[];
  tierBreakdown: { tier: string; count: number }[];
  topReferrers: ReferrerProfile[];
  recentReferrals: ReferralRecord[];
  suspiciousIps: number;
  dailyTrend: { date: string; count: number }[];
  avgTimeToVerify: number | null;
  thisMonthCount: number;
  lastMonthCount: number;
}

export const SOURCE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  referral_link: { label: 'Referral Links', icon: '🔗', color: '#22d3ee' },
  endorsement: { label: 'Endorsements', icon: '🗳️', color: '#a855f7' },
  review_invite: { label: 'Reviews', icon: '⭐', color: '#fbbf24' },
  transfer_listing: { label: 'Transfer Hub', icon: '🔄', color: '#22c55e' },
  manual_admin: { label: 'Manual (Admin)', icon: '✏️', color: '#f97316' },
};
