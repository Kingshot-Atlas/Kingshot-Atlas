import { supabase } from '../lib/supabase';

/**
 * Get fresh auth headers for backend API calls.
 * 
 * Always fetches a fresh session from Supabase to avoid stale/expired tokens
 * that can occur when using session state from React context.
 * 
 * Pattern: Use this instead of `session.access_token` from useAuth().
 * 
 * @param options.requireAuth - If true, throws when no session exists (default: true)
 * @returns Headers object with Authorization, X-User-Id, and optionally X-User-Email
 */
export async function getAuthHeaders(
  options: { requireAuth?: boolean } = {}
): Promise<Record<string, string>> {
  const { requireAuth = true } = options;

  if (!supabase) {
    if (requireAuth) throw new Error('Supabase not configured');
    return {};
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session?.access_token) {
    if (requireAuth) throw new Error('Please sign in again to continue.');
    return {};
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'X-User-Id': session.user?.id || '',
    'X-User-Email': session.user?.email || '',
  };
}
