/**
 * Application Constants - Single Source of Truth
 * 
 * This file contains centralized constants used across the application.
 * Always import from here to ensure consistency.
 */

// Admin users - usernames that have admin access and auto-Recruiter tier
// SINGLE SOURCE OF TRUTH: Admins are automatically Recruiters everywhere
export const ADMIN_USERNAMES: readonly string[] = ['gatreno'];
export const ADMIN_EMAILS: readonly string[] = ['gatreno@gmail.com'];

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

// Get effective subscription tier (admins are always recruiters)
export const getEffectiveTier = (
  tier: 'free' | 'pro' | 'recruiter' | null | undefined,
  username: string | null | undefined
): 'free' | 'pro' | 'recruiter' => {
  if (isAdminUsername(username)) return 'recruiter';
  return tier || 'free';
};
