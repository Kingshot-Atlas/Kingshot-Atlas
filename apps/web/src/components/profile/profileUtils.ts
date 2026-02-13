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

// Get auth provider from user metadata
export const getAuthProvider = (user: { app_metadata?: { provider?: string; providers?: string[] } } | null): 'discord' | 'google' | 'email' | null => {
  if (!user) return null;
  const provider = user.app_metadata?.provider || user.app_metadata?.providers?.[0];
  if (provider === 'discord') return 'discord';
  if (provider === 'google') return 'google';
  if (provider === 'email') return 'email';
  return null;
};
