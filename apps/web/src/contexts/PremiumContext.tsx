import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
    adFree: true,
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

      // Check if user is admin - admins get ALL features (Supporter tier)
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
        setTier('supporter'); // Full access
        setLoading(false);
        return;
      } else {
        setIsAdminUser(false);
      }

      // Logged in - default to free
      setTier('free');

      // Check local cache first
      const cached = localStorage.getItem(PREMIUM_KEY);
      if (cached && (cached === 'supporter' || cached === 'pro' || cached === 'recruiter')) {
        setTier('supporter'); // Normalize legacy cached values
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
            const fetchedTier = data.subscription_tier;
            // Normalize legacy tier values (pro/recruiter → supporter)
            if (fetchedTier === 'pro' || fetchedTier === 'recruiter' || fetchedTier === 'supporter') {
              setTier('supporter');
              localStorage.setItem(PREMIUM_KEY, 'supporter');
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
