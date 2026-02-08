// Stripe configuration for subscription management
// See /docs/STRIPE_QUICK_SETUP.md for setup instructions

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  
  // Payment Link IDs (direct links - no backend needed)
  // Note: "pro" tier is now displayed as "Atlas Supporter" to users
  paymentLinks: {
    supporter: {
      monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY_LINK || '',
      yearly: import.meta.env.VITE_STRIPE_PRO_YEARLY_LINK || '',
    },
  },
  
  // Customer portal URL for managing subscriptions
  customerPortalUrl: import.meta.env.VITE_STRIPE_PORTAL_URL || '',
  
  // Ko-fi fallback URL
  kofiUrl: 'https://ko-fi.com/ksatlas',
};

// Check if Stripe is configured (has payment links or API is available)
export const isStripeConfigured = Boolean(
  STRIPE_CONFIG.paymentLinks.supporter.monthly || STRIPE_CONFIG.paymentLinks.supporter.yearly
);

// Create checkout session via API (preferred method)
export const createCheckoutSession = async (
  tier: string,
  billingCycle: 'monthly' | 'yearly',
  userId: string,
  userEmail?: string
): Promise<{ checkout_url: string; session_id: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/stripe/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tier,
      billing_cycle: billingCycle,
      user_id: userId,
      user_email: userEmail,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.error || 'Failed to create checkout session');
  }
  
  return response.json();
};

// Get checkout URL for a specific tier and billing cycle
// This function tries API first, then payment links, then Ko-fi fallback
export const getCheckoutUrl = (
  _tier: string,
  billingCycle: 'monthly' | 'yearly',
  userId?: string
): string => {
  // Try payment links first (no backend needed, instant redirect)
  const paymentLink = STRIPE_CONFIG.paymentLinks.supporter[billingCycle];
  if (paymentLink) {
    const url = paymentLink.startsWith('http') 
      ? paymentLink 
      : `https://buy.stripe.com/${paymentLink}`;
    return userId ? `${url}?client_reference_id=${userId}` : url;
  }
  
  // Fallback to Ko-fi
  return STRIPE_CONFIG.kofiUrl;
};

// Async version that uses API checkout session
export const getCheckoutUrlAsync = async (
  tier: string,
  billingCycle: 'monthly' | 'yearly',
  userId: string,
  userEmail?: string
): Promise<string> => {
  try {
    // Try API checkout session first
    const { checkout_url } = await createCheckoutSession(tier, billingCycle, userId, userEmail);
    return checkout_url;
  } catch (error) {
    console.warn('API checkout failed, falling back to payment link:', error);
    // Fallback to direct payment link or Ko-fi
    return getCheckoutUrl(tier, billingCycle, userId);
  }
};

// Get customer portal URL for subscription management
export const getCustomerPortalUrl = (): string => {
  return STRIPE_CONFIG.customerPortalUrl || '/profile';
};

// Create customer portal session via API (for managing subscriptions)
export const createPortalSession = async (userId: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/stripe/portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.error || 'Failed to create portal session');
  }
  
  const data = await response.json();
  return data.portal_url;
};

// Sync subscription from Stripe (for recovery when webhook fails)
export const syncSubscription = async (userId: string): Promise<{
  synced: boolean;
  tier: string;
  message: string;
}> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/stripe/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.error || 'Failed to sync subscription');
  }
  
  return response.json();
};

// Check if user has an active subscription (client-side check)
export const hasActiveSubscription = (
  tier: string | undefined,
  expiresAt: string | undefined
): boolean => {
  if (!tier || tier === 'free') return false;
  if (!expiresAt) return true; // No expiry = lifetime or manual
  return new Date(expiresAt) > new Date();
};
