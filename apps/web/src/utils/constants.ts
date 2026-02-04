/**
 * Application Constants - Single Source of Truth
 * 
 * This file contains centralized constants used across the application.
 * Always import from here to ensure consistency.
 */

// Subscription tier type - includes admin as a display tier
export type SubscriptionTier = 'free' | 'pro' | 'recruiter' | 'admin';

// Admin users - usernames that have admin access
// SINGLE SOURCE OF TRUTH: Admins have full access but display as "Admin" (not Recruiter)
export const ADMIN_USERNAMES: readonly string[] = ['gatreno'];
export const ADMIN_EMAILS: readonly string[] = ['gatreno@gmail.com'];

// Subscription colors - SINGLE SOURCE OF TRUTH for tier styling
// Supporter = Pink, Recruiter = Purple, Admin = Gold
export const SUBSCRIPTION_COLORS = {
  free: '#6b7280',      // Gray
  pro: '#FF6B8A',       // Pink - Atlas Supporter
  recruiter: '#a855f7', // Purple - Atlas Recruiter
  admin: '#f59e0b',     // Gold - Admin
} as const;

// Helper function to check if a username is an admin
export const isAdminUsername = (username: string | null | undefined): boolean => {
  if (!username) return false;
  return ADMIN_USERNAMES.includes(username.toLowerCase());
};

// Helper function to check if an email is an admin
export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

// Get effective tier for ACCESS purposes (admins get recruiter-level access)
export const getAccessTier = (
  tier: 'free' | 'pro' | 'recruiter' | null | undefined,
  username: string | null | undefined
): 'free' | 'pro' | 'recruiter' => {
  if (isAdminUsername(username)) return 'recruiter'; // Full access
  return tier || 'free';
};

// Get effective tier for DISPLAY purposes (admins show as "admin", not "recruiter")
export const getDisplayTier = (
  tier: 'free' | 'pro' | 'recruiter' | null | undefined,
  username: string | null | undefined
): SubscriptionTier => {
  if (isAdminUsername(username)) return 'admin';
  return tier || 'free';
};

// Legacy alias for backward compatibility (use getAccessTier for access, getDisplayTier for display)
export const getEffectiveTier = getAccessTier;

// Get tier color for UI elements (borders, buttons) - white for free, colored for paid
// Supporter = Pink, Recruiter = Purple, Admin = Gold
export const getTierBorderColor = (tier: SubscriptionTier | null | undefined): string => {
  switch (tier) {
    case 'pro': return SUBSCRIPTION_COLORS.pro;       // Pink
    case 'recruiter': return SUBSCRIPTION_COLORS.recruiter; // Purple
    case 'admin': return SUBSCRIPTION_COLORS.admin;   // Gold
    default: return '#ffffff'; // White for free users
  }
};
