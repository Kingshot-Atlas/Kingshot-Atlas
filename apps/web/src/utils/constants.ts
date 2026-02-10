/**
 * Application Constants - Single Source of Truth
 * 
 * This file contains centralized constants used across the application.
 * Always import from here to ensure consistency.
 */

// Subscription tier type - includes admin as a display tier
// Legacy DB values 'pro' and 'recruiter' are normalized to 'supporter' by getDisplayTier()
export type SubscriptionTier = 'free' | 'supporter' | 'admin';

// Admin users - usernames that have admin access
// SINGLE SOURCE OF TRUTH: Admins have full access but display as "Admin"
export const ADMIN_USERNAMES: readonly string[] = ['gatreno'];
export const ADMIN_EMAILS: readonly string[] = ['gatreno@gmail.com'];

// Subscription colors - SINGLE SOURCE OF TRUTH for tier styling
// Supporter = Pink, Admin = Gold
export const SUBSCRIPTION_COLORS = {
  free: '#6b7280',      // Gray
  supporter: '#FF6B8A', // Pink - Atlas Supporter
  admin: '#f59e0b',     // Gold - Admin
} as const;

// BADGE DISPLAY NAMES - Use these for user-facing badge text
export const TIER_DISPLAY_NAMES = {
  free: null,           // No badge for free users
  supporter: 'SUPPORTER',
  admin: 'ADMIN',
} as const;

// Strip decorative characters from username for matching
// Handles fancy brackets like 『』「」【】, quotes, and other decorations
const stripDecorations = (username: string): string => {
  return username
    .replace(/[『』「」【】「」〖〗《》〈〉⟨⟩｢｣[\](){}]/g, '')
    .trim()
    .toLowerCase();
};

// Helper function to check if a username is an admin
// Handles decorated names like 『Gatreno』 → gatreno
export const isAdminUsername = (username: string | null | undefined): boolean => {
  if (!username) return false;
  const cleanName = stripDecorations(username);
  return ADMIN_USERNAMES.includes(cleanName);
};

// Helper function to check if an email is an admin
export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

// Get effective tier for ACCESS purposes (admins get supporter-level access)
export const getAccessTier = (
  tier: string | null | undefined,
  username: string | null | undefined
): 'free' | 'supporter' => {
  if (isAdminUsername(username)) return 'supporter'; // Full access
  // Normalize legacy tier values
  if (tier === 'pro' || tier === 'recruiter' || tier === 'supporter') return 'supporter';
  return 'free';
};

// Get effective tier for DISPLAY purposes (admins show as "admin")
// Accepts legacy DB values (pro, recruiter) and normalizes to supporter
export const getDisplayTier = (
  tier: string | null | undefined,
  username: string | null | undefined
): SubscriptionTier => {
  if (isAdminUsername(username)) return 'admin';
  // Normalize legacy tier values
  if (tier === 'pro' || tier === 'recruiter' || tier === 'supporter') return 'supporter';
  return 'free';
};

// Legacy alias for backward compatibility
export const getEffectiveTier = getAccessTier;

// ─── Referral Tier System ───
export type ReferralTier = 'scout' | 'recruiter' | 'consul' | 'ambassador';

export const REFERRAL_TIER_THRESHOLDS: Record<ReferralTier, number> = {
  scout: 2,
  recruiter: 5,
  consul: 10,
  ambassador: 20,
} as const;

export const REFERRAL_TIER_COLORS: Record<ReferralTier, string> = {
  scout: '#ffffff',     // White
  recruiter: '#4ade80', // Soft Green
  consul: '#b890dd',    // Light Purple
  ambassador: '#a24cf3', // Purple
} as const;

export const REFERRAL_TIER_LABELS: Record<ReferralTier, string> = {
  scout: 'Scout',
  recruiter: 'Recruiter',
  consul: 'Consul',
  ambassador: 'Ambassador',
} as const;

export const REFERRAL_TIER_ORDER: ReferralTier[] = ['scout', 'recruiter', 'consul', 'ambassador'];

export const getReferralTierFromCount = (count: number): ReferralTier | null => {
  if (count >= 20) return 'ambassador';
  if (count >= 10) return 'consul';
  if (count >= 5) return 'recruiter';
  if (count >= 2) return 'scout';
  return null;
};

export const getNextReferralTier = (currentTier: ReferralTier | null): { tier: ReferralTier; threshold: number } | null => {
  if (!currentTier) return { tier: 'scout', threshold: 2 };
  const idx = REFERRAL_TIER_ORDER.indexOf(currentTier);
  if (idx < 0 || idx >= REFERRAL_TIER_ORDER.length - 1) return null;
  const next = REFERRAL_TIER_ORDER[idx + 1] as ReferralTier;
  return { tier: next, threshold: REFERRAL_TIER_THRESHOLDS[next] };
};

// Referral eligibility: must have linked account with TC25+
export const isReferralEligible = (profile: { linked_player_id?: string | null; linked_tc_level?: number | null }): boolean => {
  return !!profile.linked_player_id && (profile.linked_tc_level ?? 0) >= 25;
};

// Get tier color for UI elements (borders, buttons) - white for free, colored for paid
// Supporter = Pink, Admin = Gold
export const getTierBorderColor = (tier: string | null | undefined): string => {
  switch (tier) {
    case 'supporter':
    case 'pro':        // Legacy
    case 'recruiter':  // Legacy
      return SUBSCRIPTION_COLORS.supporter;
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    default: return '#ffffff'; // White for free users
  }
};
