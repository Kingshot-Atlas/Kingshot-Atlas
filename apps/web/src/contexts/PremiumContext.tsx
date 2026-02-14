import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ADMIN_EMAILS, ADMIN_USERNAMES } from '../utils/constants';

// 3 tiers: anonymous (not logged in), free (logged in), supporter (paid)
export type SubscriptionTier = 'anonymous' | 'free' | 'supporter';

export interface PremiumFeatures {
  // Content access
  fullKvkHistory: boolean;
  kvkHistoryLimit: number; // How many KvKs can view
  viewKingdomProfiles: boolean;
  
  // Features
  multiCompare: number; // max kingdoms to compare (2 anon, 3 free, 5 linked/supporter)
  submitData: boolean; // Can submit KvK results
  scoreSimulator: boolean;
  
  // Premium perks
  adFree: boolean;
  supporterBadge: boolean;
  earlyAccess: boolean;
}

const TIER_FEATURES: Record<SubscriptionTier, PremiumFeatures> = {
  // Not logged in - can browse with full KvK history
  anonymous: {
    fullKvkHistory: true,
    kvkHistoryLimit: 999,
    viewKingdomProfiles: true,
    multiCompare: 2, // Anonymous can compare 2
    submitData: false,
    scoreSimulator: true,
    adFree: false,
    supporterBadge: false,
    earlyAccess: false,
  },
  // Logged in free user
  free: {
    fullKvkHistory: true,
    kvkHistoryLimit: 999,
    viewKingdomProfiles: true,
    multiCompare: 3, // Logged in can compare 3
    submitData: true,
    scoreSimulator: true,
    adFree: false,
    supporterBadge: false,
    earlyAccess: false,
  },
  // Atlas Supporter ($4.99/mo)
  supporter: {
    fullKvkHistory: true,
    kvkHistoryLimit: 999,
    viewKingdomProfiles: true,
    multiCompare: 5, // Supporters can compare 5
    submitData: true,
    scoreSimulator: true,
    adFree: false,
    supporterBadge: true,
    earlyAccess: true,
  },
};

interface PremiumContextType {
  tier: SubscriptionTier;
  tierName: string;
  features: PremiumFeatures;
  isLoggedIn: boolean;
  isSupporter: boolean;
  isAdmin: boolean;
  loading: boolean;
  checkFeature: (feature: keyof PremiumFeatures) => boolean;
  getFeatureLimit: (feature: keyof PremiumFeatures) => number;
  getUpgradeUrl: () => string;
  getUpgradeMessage: (feature: string) => { title: string; message: string; cta: string };
  refreshSubscription: () => Promise<void>;
}

const TIER_NAMES: Record<SubscriptionTier, string> = {
  anonymous: 'Guest',
  free: 'Free',
  supporter: 'Atlas Supporter',
};

// Display name for admins (overrides tier name)
const ADMIN_TIER_NAME = 'Admin';

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
};

const PREMIUM_KEY = 'kingshot_premium_tier';

export const PremiumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Derive admin status from user metadata (no fetch needed)
  const isAdminUser = useMemo(() => {
    if (!user) return false;
    const emailPrefix = user.email?.split('@')[0]?.toLowerCase();
    const preferredUsername = user.user_metadata?.preferred_username?.toLowerCase();
    const fullName = user.user_metadata?.full_name?.toLowerCase();
    const userName = user.user_metadata?.name?.toLowerCase();
    return (
      ADMIN_EMAILS.includes(user.email?.toLowerCase() || '') ||
      ADMIN_USERNAMES.includes(emailPrefix || '') ||
      ADMIN_USERNAMES.includes(preferredUsername || '') ||
      ADMIN_USERNAMES.includes(fullName || '') ||
      ADMIN_USERNAMES.includes(userName || '')
    );
  }, [user]);

  // React Query hook for subscription tier (ADR-022 migration)
  const { data: fetchedTier, isLoading: loading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async (): Promise<SubscriptionTier> => {
      if (!user) {
        localStorage.removeItem(PREMIUM_KEY);
        return 'anonymous';
      }
      if (isAdminUser) {
        logger.info('Admin user detected, granting full access:', user.email);
        return 'supporter';
      }
      // Check local cache first for instant UI
      const cached = localStorage.getItem(PREMIUM_KEY);
      let result: SubscriptionTier = cached === 'supporter' ? 'supporter' : 'free';

      // Fetch from Supabase if configured
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', user.id)
            .single();
          if (!error && data?.subscription_tier) {
            if (data.subscription_tier === 'supporter') {
              result = 'supporter';
              localStorage.setItem(PREMIUM_KEY, 'supporter');
            } else {
              result = 'free';
              localStorage.removeItem(PREMIUM_KEY);
            }
          }
        } catch (err) {
          logger.warn('Failed to fetch subscription tier:', err);
        }
      }
      return result;
    },
    enabled: true, // Always run, handles null user internally
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: (prev) => prev, // Keep previous data during refetch
  });

  const tier: SubscriptionTier = fetchedTier ?? (user ? 'free' : 'anonymous');

  // Manual refresh function for after checkout completion
  const refreshSubscription = useCallback(async () => {
    if (user) {
      await queryClient.invalidateQueries({ queryKey: ['subscription', user.id] });
    }
  }, [user, queryClient]);

  // Override multiCompare for linked users: linked accounts get 5 slots regardless of tier
  const isLinked = !!profile?.linked_username;
  const baseFeatures = TIER_FEATURES[tier];
  const features: PremiumFeatures = isLinked && baseFeatures.multiCompare < 5
    ? { ...baseFeatures, multiCompare: 5 }
    : baseFeatures;
  const tierName = isAdminUser ? ADMIN_TIER_NAME : TIER_NAMES[tier];
  const isLoggedIn = tier !== 'anonymous';
  const isSupporter = tier === 'supporter';
  const isAdmin = isAdminUser;

  const checkFeature = (feature: keyof PremiumFeatures): boolean => {
    const value = features[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    return false;
  };

  const getFeatureLimit = (feature: keyof PremiumFeatures): number => {
    const value = features[feature];
    if (typeof value === 'number') return value;
    return 0;
  };

  const getUpgradeUrl = (): string => {
    return '/support';
  };

  // Gentle, non-aggressive upgrade messaging
  const getUpgradeMessage = (feature: string): { title: string; message: string; cta: string } => {
    if (tier === 'anonymous') {
      return {
        title: 'Sign in to unlock more',
        message: `Create a free account to access ${feature} and more features.`,
        cta: 'Sign In Free',
      };
    }
    if (tier === 'free') {
      return {
        title: 'Become a Supporter',
        message: `Support Atlas and get access to ${feature} plus exclusive perks.`,
        cta: 'Support Atlas',
      };
    }
    return { title: '', message: '', cta: '' };
  };

  return (
    <PremiumContext.Provider value={{
      tier,
      tierName,
      features,
      isLoggedIn,
      isSupporter,
      isAdmin,
      loading,
      checkFeature,
      getFeatureLimit,
      getUpgradeUrl,
      getUpgradeMessage,
      refreshSubscription,
    }}>
      {children}
    </PremiumContext.Provider>
  );
};
