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
    .replace(/[『』「」【】「」〖〗《》〈〉⟨⟩｢｣\[\](){}]/g, '')
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
