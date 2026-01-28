import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SubscriptionTier = 'free' | 'pro' | 'recruiter';

export interface PremiumFeatures {
  fullKvkHistory: boolean;
  watchlistLimit: number;
  advancedFilters: boolean;
  multiCompare: number; // max kingdoms to compare
  exportData: boolean;
  prioritySubmissions: boolean;
  adFree: boolean;
  proBadge: boolean;
  earlyAccess: boolean;
  claimKingdom: boolean;
  recruiterDashboard: boolean;
  customBanner: boolean;
  recruitInbox: boolean;
  apiAccess: boolean;
}

const TIER_FEATURES: Record<SubscriptionTier, PremiumFeatures> = {
  free: {
    fullKvkHistory: false,
    watchlistLimit: 3,
    advancedFilters: false,
    multiCompare: 2,
    exportData: false,
    prioritySubmissions: false,
    adFree: false,
    proBadge: false,
    earlyAccess: false,
    claimKingdom: false,
    recruiterDashboard: false,
    customBanner: false,
    recruitInbox: false,
    apiAccess: false,
  },
  pro: {
    fullKvkHistory: true,
    watchlistLimit: 20,
    advancedFilters: true,
    multiCompare: 4,
    exportData: true,
    prioritySubmissions: true,
    adFree: true,
    proBadge: true,
    earlyAccess: true,
    claimKingdom: false,
    recruiterDashboard: false,
    customBanner: false,
    recruitInbox: false,
    apiAccess: false,
  },
  recruiter: {
    fullKvkHistory: true,
    watchlistLimit: 50,
    advancedFilters: true,
    multiCompare: 10,
    exportData: true,
    prioritySubmissions: true,
    adFree: true,
    proBadge: true,
    earlyAccess: true,
    claimKingdom: true,
    recruiterDashboard: true,
    customBanner: true,
    recruitInbox: true,
    apiAccess: true,
  },
};

interface PremiumContextType {
  tier: SubscriptionTier;
  features: PremiumFeatures;
  isPro: boolean;
  isRecruiter: boolean;
  loading: boolean;
  checkFeature: (feature: keyof PremiumFeatures) => boolean;
  getUpgradeUrl: () => string;
}

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
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) {
        setTier('free');
        setLoading(false);
        return;
      }

      // Check local cache first
      const cached = localStorage.getItem(PREMIUM_KEY);
      if (cached) {
        setTier(cached as SubscriptionTier);
      }

      // Fetch from Supabase if configured
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', user.id)
            .single();

          if (!error && data?.subscription_tier) {
            const fetchedTier = data.subscription_tier as SubscriptionTier;
            setTier(fetchedTier);
            localStorage.setItem(PREMIUM_KEY, fetchedTier);
          }
        } catch (err) {
          console.warn('Failed to fetch subscription tier:', err);
        }
      }

      setLoading(false);
    };

    fetchSubscription();
  }, [user]);

  const features = TIER_FEATURES[tier];
  const isPro = tier === 'pro' || tier === 'recruiter';
  const isRecruiter = tier === 'recruiter';

  const checkFeature = (feature: keyof PremiumFeatures): boolean => {
    return features[feature] as boolean;
  };

  const getUpgradeUrl = (): string => {
    // Placeholder - will be replaced with actual Stripe checkout link
    return '/upgrade';
  };

  return (
    <PremiumContext.Provider value={{
      tier,
      features,
      isPro,
      isRecruiter,
      loading,
      checkFeature,
      getUpgradeUrl,
    }}>
      {children}
    </PremiumContext.Provider>
  );
};
