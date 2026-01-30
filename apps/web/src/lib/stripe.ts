// Stripe configuration for subscription management
// See /docs/STRIPE_QUICK_SETUP.md for setup instructions

export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  
  // Price IDs from Stripe Dashboard
  prices: {
    pro: {
      monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY || '',
      yearly: import.meta.env.VITE_STRIPE_PRO_YEARLY || '',
    },
    recruiter: {
      monthly: import.meta.env.VITE_STRIPE_RECRUITER_MONTHLY || '',
      yearly: import.meta.env.VITE_STRIPE_RECRUITER_YEARLY || '',
    },
  },
  
  // Payment Link IDs (optional - alternative to price IDs)
  // These are the full payment link URLs or IDs from Stripe Dashboard
  paymentLinks: {
    pro: {
      monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY_LINK || '',
      yearly: import.meta.env.VITE_STRIPE_PRO_YEARLY_LINK || '',
    },
    recruiter: {
      monthly: import.meta.env.VITE_STRIPE_RECRUITER_MONTHLY_LINK || '',
      yearly: import.meta.env.VITE_STRIPE_RECRUITER_YEARLY_LINK || '',
    },
  },
  
  // Customer portal URL for managing subscriptions
  customerPortalUrl: import.meta.env.VITE_STRIPE_PORTAL_URL || '',
  
  // Ko-fi fallback URL
  kofiUrl: 'https://ko-fi.com/ksatlas',
};

// Check if Stripe is fully configured with at least one price
export const isStripeConfigured = Boolean(
  STRIPE_CONFIG.publishableKey && 
  (STRIPE_CONFIG.prices.pro.monthly || STRIPE_CONFIG.paymentLinks.pro.monthly)
);

// Get checkout URL for a specific tier and billing cycle
export const getCheckoutUrl = (
  tier: 'pro' | 'recruiter',
  billingCycle: 'monthly' | 'yearly',
  userId?: string
): string => {
  // First try payment links (easiest setup, no backend needed)
  const paymentLink = STRIPE_CONFIG.paymentLinks[tier][billingCycle];
  if (paymentLink) {
    const url = paymentLink.startsWith('http') 
      ? paymentLink 
      : `https://buy.stripe.com/${paymentLink}`;
    return userId ? `${url}?client_reference_id=${userId}` : url;
  }
  
  // Then try price IDs (requires Stripe Checkout integration)
  const priceId = STRIPE_CONFIG.prices[tier][billingCycle];
  if (priceId && STRIPE_CONFIG.publishableKey) {
    // For price IDs, we'd need Stripe Checkout - fallback to Ko-fi for now
    // In production, this would create a Checkout Session via your backend
    console.log('Price ID found but Payment Link not set. Using Ko-fi fallback.');
  }
  
  // Fallback to Ko-fi
  return STRIPE_CONFIG.kofiUrl;
};

// Get customer portal URL for subscription management
export const getCustomerPortalUrl = (): string => {
  return STRIPE_CONFIG.customerPortalUrl || '/profile';
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
