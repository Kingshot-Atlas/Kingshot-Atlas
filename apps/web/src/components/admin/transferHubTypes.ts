import { colors } from '../../utils/styles';

// =============================================
// TYPES
// =============================================

export interface EditorClaim {
  id: string;
  kingdom_number: number;
  user_id: string;
  role: string;
  status: string;
  endorsement_count: number;
  required_endorsements: number;
  nominated_at: string;
  activated_at: string | null;
  last_active_at: string | null;
  created_at: string;
  // Joined
  username?: string;
  linked_username?: string | null;
  linked_kingdom?: number | null;
  linked_tc_level?: number | null;
}

export interface KingdomFund {
  id: string;
  kingdom_number: number;
  balance: string;
  tier: string;
  total_contributed: string;
  contributor_count: number;
  is_recruiting: boolean;
  recruitment_pitch: string | null;
  main_language: string | null;
  min_tc_level: number | null;
  min_power_million: number | null;
  admin_tier_override: string | null;
  created_at: string;
  updated_at: string;
  last_depletion_at: string | null;
  // Joined
  atlas_score?: string | null;
}

export interface TransferProfile {
  id: string;
  user_id: string;
  username: string;
  current_kingdom: number;
  tc_level: number;
  power_million: number | null;
  power_range: string;
  main_language: string;
  group_size: string;
  player_bio: string;
  is_active: boolean;
  is_anonymous: boolean;
  looking_for: string[];
  created_at: string;
  updated_at: string;
  last_active_at: string | null;
  // Joined
  profile_username?: string;
}

export interface TransferHubStats {
  totalEditors: number;
  pendingEditors: number;
  activeEditors: number;
  totalFunds: number;
  totalFundBalance: number;
  totalContributed: number;
  recruitingKingdoms: number;
  totalProfiles: number;
  activeProfiles: number;
  totalApplications: number;
  pendingApplications: number;
  acceptedApplications: number;
  totalInvites: number;
  totalProfileViews: number;
}

export interface AuditLogEntry {
  id: string;
  editor_id: string | null;
  kingdom_number: number;
  action: string;
  performed_by: string | null;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  // Joined
  performer_name?: string;
  target_name?: string;
}

export type SubTab = 'overview' | 'editors' | 'co-editors' | 'funds' | 'profiles' | 'audit-log';

// =============================================
// CONSTANTS
// =============================================

export const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  gold: { bg: `${colors.gold}15`, border: `${colors.gold}40`, text: colors.gold },
  silver: { bg: '#d1d5db15', border: '#d1d5db40', text: '#d1d5db' },
  bronze: { bg: `${colors.bronze}15`, border: `${colors.bronze}40`, text: colors.bronze },
  standard: { bg: `${colors.textMuted}15`, border: `${colors.textMuted}40`, text: colors.textMuted },
};

export const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  active: { bg: `${colors.success}15`, border: `${colors.success}40`, text: colors.success },
  pending: { bg: `${colors.warning}15`, border: `${colors.warning}40`, text: colors.warning },
  inactive: { bg: `${colors.textMuted}15`, border: `${colors.textMuted}40`, text: colors.textMuted },
  suspended: { bg: `${colors.error}15`, border: `${colors.error}40`, text: colors.error },
  cancelled: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
};
