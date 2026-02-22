import { colors } from '../../utils/styles';

// Get border color for avatar based on subscription tier
// Supporter = Pink, Admin = Gold
export const getTierBorderColor = (tier: string): string => {
  switch (tier) {
    case 'admin': return colors.amber;       // Gold - Admin
    case 'supporter':
    case 'pro':                           // Legacy
    case 'recruiter':                     // Legacy
      return '#FF6B8A';                   // Pink - Atlas Supporter
    default: return '#ffffff';            // White
  }
};

// Get auth provider from user metadata (returns primary provider)
// Also checks the providers array for multi-provider users
export const getAuthProvider = (user: { app_metadata?: { provider?: string; providers?: string[] } } | null): 'discord' | 'google' | 'email' | null => {
  if (!user) return null;
  const primary = user.app_metadata?.provider;
  if (primary === 'discord') return 'discord';
  if (primary === 'google') return 'google';
  if (primary === 'email') return 'email';
  // Fallback: check providers array
  const providers = user.app_metadata?.providers || [];
  if (providers.includes('discord')) return 'discord';
  if (providers.includes('google')) return 'google';
  if (providers.includes('email')) return 'email';
  return null;
};
