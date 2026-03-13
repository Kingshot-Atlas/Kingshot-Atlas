import { useAuth } from '../contexts/AuthContext';

/**
 * Hook that checks if the current user is an admin using the `is_admin`
 * boolean from the profiles table (database source of truth).
 *
 * Returns:
 * - `isAdmin` — true when profile.is_admin is true
 * - `isLoading` — true while auth/profile is still loading
 * - `profile` — the full user profile (for convenience)
 */
export function useAdminGuard() {
  const { profile, loading } = useAuth();

  return {
    isAdmin: !!profile?.is_admin,
    isLoading: loading,
    profile,
  };
}
