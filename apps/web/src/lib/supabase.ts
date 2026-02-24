import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vite uses import.meta.env for environment variables (not process.env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Disable detectSessionInUrl on the Discord linking callback page.
// When Discord redirects back with ?code=DISCORD_CODE, Supabase's PKCE
// flow tries to exchange that code as a Supabase auth code, fails, and
// calls _removeSession() — destroying the user's session before our
// DiscordCallback handler can use it to call the Edge Function.
// On all other pages (including /auth/callback for Google/Discord sign-in),
// detectSessionInUrl must remain enabled for normal auth to work.
const isDiscordLinkCallback = typeof window !== 'undefined'
  && window.location.pathname === '/auth/discord/callback';

export const supabase: SupabaseClient | null = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: !isDiscordLinkCallback,
        flowType: 'pkce',
      }
    })
  : null;
