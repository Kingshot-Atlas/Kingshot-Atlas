/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  
  // Stripe — Atlas Supporter tier
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_STRIPE_SUPPORTER_MONTHLY_LINK?: string;
  readonly VITE_STRIPE_SUPPORTER_YEARLY_LINK?: string;
  // Legacy names (kept for backward compat with existing Cloudflare Pages env vars)
  readonly VITE_STRIPE_PRO_MONTHLY_LINK?: string;
  readonly VITE_STRIPE_PRO_YEARLY_LINK?: string;
  readonly VITE_STRIPE_PORTAL_URL?: string;
  
  // API
  readonly VITE_API_URL?: string;
  
  // Discord
  readonly VITE_DISCORD_INVITE?: string;
  
  // Sentry
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_ENVIRONMENT?: string;
  readonly VITE_VERSION?: string;
  
  // Ads
  readonly VITE_ETHICALADS_PUBLISHER_ID?: string;
  
  // Vite built-ins
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
