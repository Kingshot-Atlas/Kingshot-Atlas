import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ADMIN_EMAILS, ADMIN_USERNAMES } from '../utils/constants';

// 4 tiers: anonymous (not logged in), free (logged in), pro, recruiter
export type SubscriptionTier = 'anonymous' | 'free' | 'pro' | 'recruiter';

export interface PremiumFeatures {
  // Content access
  fullKvkHistory: boolean;
  kvkHistoryLimit: number; // How many KvKs can view
  viewKingdomProfiles: boolean;
  viewDetailedStats: boolean;
  
  // Features
  watchlistLimit: number;
  advancedFilters: boolean;
  multiCompare: number; // max kingdoms to compare
  exportData: boolean;
  submitData: boolean; // Can submit KvK results
  prioritySubmissions: boolean;
  scoreSimulator: boolean; // Pro feature: simulate future KvK scores
  
  // Premium perks
  adFree: boolean;
  proBadge: boolean;
  earlyAccess: boolean;
  
  // Recruiter features
  claimKingdom: boolean;
  recruiterDashboard: boolean;
  customBanner: boolean;
  recruitInbox: boolean;
  apiAccess: boolean;
}

const TIER_FEATURES: Record<SubscriptionTier, PremiumFeatures> = {
  // Not logged in - can browse with full KvK history
  anonymous: {
    fullKvkHistory: true,
    kvkHistoryLimit: 999,
    viewKingdomProfiles: true,
    viewDetailedStats: false,
    watchlistLimit: 0,
    advancedFilters: false,
    multiCompare: 0, // Must log in to compare
    exportData: false,
    submitData: false,
    prioritySubmissions: false,
    scoreSimulator: false,
    adFree: false,
    proBadge: false,
    earlyAccess: false,
    claimKingdom: false,
    recruiterDashboard: false,
    customBanner: false,
    recruitInbox: false,
    apiAccess: false,
  },
  // Logged in free user - full KvK history access
  free: {
    fullKvkHistory: true,
    kvkHistoryLimit: 999,
    viewKingdomProfiles: true,
    viewDetailedStats: true,
    watchlistLimit: 3,
    advancedFilters: false,
    multiCompare: 2, // Free users can compare 2 kingdoms
    exportData: false,
    submitData: true,
    prioritySubmissions: false,
    scoreSimulator: false,
    adFree: false,
    proBadge: false,
    earlyAccess: false,
    claimKingdom: false,
    recruiterDashboard: false,
    customBanner: false,
    recruitInbox: false,
    apiAccess: false,
  },
  // Atlas Pro - power users
  pro: {
    fullKvkHistory: true,
    kvkHistoryLimit: 999,
    viewKingdomProfiles: true,
    viewDetailedStats: true,
    watchlistLimit: 20,
    advancedFilters: true,
    multiCompare: 5,
    exportData: false,
    submitData: true,
    prioritySubmissions: true,
    scoreSimulator: true,
    adFree: true,
    proBadge: true,
    earlyAccess: true,
    claimKingdom: false,
    recruiterDashboard: false,
    customBanner: false,
    recruitInbox: false,
    apiAccess: false,
  },
  // Atlas Recruiter - kingdom managers
  recruiter: {
    fullKvkHistory: true,
    kvkHistoryLimit: 999,
    viewKingdomProfiles: true,
    viewDetailedStats: true,
    watchlistLimit: 50,
    advancedFilters: true,
    multiCompare: 5,
    exportData: false,
    submitData: true,
    prioritySubmissions: true,
    scoreSimulator: true,
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
  tierName: string;
  features: PremiumFeatures;
  isLoggedIn: boolean;
  isPro: boolean;
  isRecruiter: boolean;
  isAdmin: boolean; // True if user is admin (displays as Admin, not Recruiter)
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
  pro: 'Atlas Pro',
  recruiter: 'Atlas Recruiter',
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
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('anonymous');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
      // Not logged in = anonymous
      if (!user) {
        setTier('anonymous');
        localStorage.removeItem(PREMIUM_KEY);
        setLoading(false);
        return;
      }

      // Check if user is admin - admins get ALL features (Recruiter tier)
      // Multiple checks for robustness:
      // 1. Profile has is_admin flag
      // 2. Email matches admin list
      // 3. Username matches admin list (from profile, user_metadata, or email prefix)
      const emailPrefix = user.email?.split('@')[0]?.toLowerCase();
      const preferredUsername = user.user_metadata?.preferred_username?.toLowerCase();
      const fullName = user.user_metadata?.full_name?.toLowerCase();
      const userName = user.user_metadata?.name?.toLowerCase();
      
      const isAdmin = 
        ADMIN_EMAILS.includes(user.email?.toLowerCase() || '') ||
        ADMIN_USERNAMES.includes(emailPrefix || '') ||
        ADMIN_USERNAMES.includes(preferredUsername || '') ||
        ADMIN_USERNAMES.includes(fullName || '') ||
        ADMIN_USERNAMES.includes(userName || '');
      
      if (isAdmin) {
        logger.info('Admin user detected, granting full access:', user.email);
        setIsAdminUser(true);
        setTier('recruiter'); // Full access
        setLoading(false);
        return;
      } else {
        setIsAdminUser(false);
      }

      // Logged in - default to free
      setTier('free');

      // Check local cache first
      const cached = localStorage.getItem(PREMIUM_KEY);
      if (cached && (cached === 'pro' || cached === 'recruiter')) {
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
            // Only cache paid tiers
            if (fetchedTier === 'pro' || fetchedTier === 'recruiter') {
              setTier(fetchedTier);
              localStorage.setItem(PREMIUM_KEY, fetchedTier);
            } else {
              setTier('free');
            }
          }
        } catch (err) {
          logger.warn('Failed to fetch subscription tier:', err);
        }
      }

    setLoading(false);
  };

  useEffect(() => {
    fetchSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  
  // Manual refresh function for after checkout completion
  const refreshSubscription = async () => {
    if (user) {
      setLoading(true);
      await fetchSubscription();
    }
  };

  const features = TIER_FEATURES[tier];
  const tierName = isAdminUser ? ADMIN_TIER_NAME : TIER_NAMES[tier];
  const isLoggedIn = tier !== 'anonymous';
  const isPro = tier === 'pro' || tier === 'recruiter';
  const isRecruiter = tier === 'recruiter';
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
    return '/upgrade';
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
        title: 'Upgrade to Atlas Pro',
        message: `Get full access to ${feature} with Atlas Pro. Support the project and unlock premium features.`,
        cta: 'Learn More',
      };
    }
    if (tier === 'pro') {
      return {
        title: 'Upgrade to Recruiter',
        message: `${feature} is available with Atlas Recruiter. Perfect for alliance leaders and kingdom managers.`,
        cta: 'View Recruiter',
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
      isPro,
      isRecruiter,
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
