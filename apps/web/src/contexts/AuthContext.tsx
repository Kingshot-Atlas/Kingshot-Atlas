import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { logger } from '../utils/logger';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { userDataService } from '../services/userDataService';
import { generateRandomUsername } from '../utils/randomUsername';

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string | null; // Custom display name (shown publicly instead of OAuth username)
  email: string;
  avatar_url: string;
  home_kingdom: number | null;
  alliance_tag: string;
  language: string;
  region: string;
  bio: string;
  theme_color: string;
  badge_style: string;
  created_at: string;
  is_admin?: boolean;
  linked_player_id?: string;
  linked_username?: string;
  linked_avatar_url?: string | null;
  linked_kingdom?: number;
  linked_tc_level?: number;
  linked_last_synced?: string;
  subscription_tier?: 'free' | 'pro' | 'recruiter';
  discord_id?: string | null;
  discord_username?: string | null;
  discord_linked_at?: string | null;
}

/**
 * Get the display name for a user (prefers display_name over OAuth username)
 */
export const getDisplayName = (profile: UserProfile | null): string => {
  if (!profile) return 'User';
  return profile.display_name || profile.username || 'User';
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithDiscord: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshLinkedPlayer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const PROFILE_KEY = 'kingshot_profile';

// Strip any existing cache-busting params from avatar URL (for clean storage)
const getCleanAvatarUrl = (url: string | undefined): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('_t');
    return urlObj.toString();
  } catch {
    return url;
  }
};

// Add cache-busting timestamp to avatar URLs at render time
// This is exported so components can use it when displaying avatars
export const getCacheBustedAvatarUrl = (url: string | undefined): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('_t', Date.now().toString());
    return urlObj.toString();
  } catch {
    return url;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured;

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchOrCreateProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchOrCreateProfile(session.user);
        // Sync user data across devices
        userDataService.setUserId(session.user.id);
      } else {
        setProfile(null);
        userDataService.setUserId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set Sentry user context when profile changes
  useEffect(() => {
    if (profile) {
      Sentry.setUser({
        id: profile.id,
        username: profile.username,
        email: profile.email,
      });
      // Add custom context for debugging
      Sentry.setContext('user_profile', {
        home_kingdom: profile.home_kingdom,
        subscription_tier: profile.subscription_tier || 'free',
        is_admin: profile.is_admin || false,
        has_linked_player: !!profile.linked_player_id,
      });
    } else {
      // Clear user context on logout
      Sentry.setUser(null);
    }
  }, [profile]);

  const fetchOrCreateProfile = async (user: User) => {
    if (!supabase) {
      // Create local profile when Supabase is not configured
      const avatarUrl = getCleanAvatarUrl(
        user.user_metadata?.avatar_url || 
        user.user_metadata?.picture
      );
      // Generate random username for new users (will be replaced when they link Kingshot account)
      const username = generateRandomUsername();
      const localProfile: UserProfile = {
        id: user.id,
        username,
        email: user.email || '',
        avatar_url: avatarUrl,
        home_kingdom: null,
        alliance_tag: '',
        language: '',
        region: '',
        bio: '',
        theme_color: '#22d3ee',
        badge_style: 'default',
        created_at: new Date().toISOString(),
        is_admin: false
      };
      setProfile(localProfile);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(localProfile));
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one
        const avatarUrl = getCleanAvatarUrl(
          user.user_metadata?.avatar_url || 
          user.user_metadata?.picture
        );
        // Generate random username for new users (will be replaced when they link Kingshot account)
        const username = generateRandomUsername();

        const newProfile: UserProfile = {
          id: user.id,
          username,
          email: user.email || '',
          avatar_url: avatarUrl,
          home_kingdom: null,
          alliance_tag: '',
          language: '',
          region: '',
          bio: '',
          theme_color: '#22d3ee',
          badge_style: 'default',
          created_at: new Date().toISOString(),
          is_admin: false
        };

        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

        if (createError) {
          logger.error('Error creating profile:', createError);
          // Use local profile on error, but preserve any cached linked player data
          const cached = localStorage.getItem(PROFILE_KEY);
          let linkedData = {};
          if (cached) {
            try {
              const cachedProfile = JSON.parse(cached);
              if (cachedProfile.linked_player_id) {
                linkedData = {
                  linked_player_id: cachedProfile.linked_player_id,
                  linked_username: cachedProfile.linked_username,
                  linked_avatar_url: cachedProfile.linked_avatar_url,
                  linked_kingdom: cachedProfile.linked_kingdom,
                  linked_tc_level: cachedProfile.linked_tc_level,
                };
              }
            } catch { /* ignore */ }
          }
          const mergedProfile = { ...newProfile, ...linkedData };
          setProfile(mergedProfile);
          localStorage.setItem(PROFILE_KEY, JSON.stringify(mergedProfile));
        } else if (created) {
          // Merge created profile with any cached linked player data
          const cached = localStorage.getItem(PROFILE_KEY);
          let linkedData = {};
          if (cached) {
            try {
              const cachedProfile = JSON.parse(cached);
              if (cachedProfile.linked_player_id) {
                linkedData = {
                  linked_player_id: cachedProfile.linked_player_id,
                  linked_username: cachedProfile.linked_username,
                  linked_avatar_url: cachedProfile.linked_avatar_url,
                  linked_kingdom: cachedProfile.linked_kingdom,
                  linked_tc_level: cachedProfile.linked_tc_level,
                };
              }
            } catch { /* ignore */ }
          }
          const mergedProfile = { ...created, ...linkedData };
          setProfile(mergedProfile);
          localStorage.setItem(PROFILE_KEY, JSON.stringify(mergedProfile));
        } else {
          // Fallback: merge with cached linked player data
          const cached = localStorage.getItem(PROFILE_KEY);
          let linkedData = {};
          if (cached) {
            try {
              const cachedProfile = JSON.parse(cached);
              if (cachedProfile.linked_player_id) {
                linkedData = {
                  linked_player_id: cachedProfile.linked_player_id,
                  linked_username: cachedProfile.linked_username,
                  linked_avatar_url: cachedProfile.linked_avatar_url,
                  linked_kingdom: cachedProfile.linked_kingdom,
                  linked_tc_level: cachedProfile.linked_tc_level,
                };
              }
            } catch { /* ignore */ }
          }
          const mergedProfile = { ...newProfile, ...linkedData };
          setProfile(mergedProfile);
          localStorage.setItem(PROFILE_KEY, JSON.stringify(mergedProfile));
        }
      } else if (error) {
        // Some other error occurred, try to use cached profile
        logger.error('Error fetching profile:', error);
        const cached = localStorage.getItem(PROFILE_KEY);
        if (cached) {
          setProfile(JSON.parse(cached));
        }
      } else if (data) {
        // Debug: Log OAuth metadata to understand avatar source
        logger.info('OAuth metadata:', {
          avatar_url: user.user_metadata?.avatar_url,
          picture: user.user_metadata?.picture,
          db_avatar: data.avatar_url
        });
        
        // Always prefer fresh avatar from OAuth metadata over cached DB value
        // Store clean URL without cache-busting - apply cache-busting at render time
        const avatarUrl = getCleanAvatarUrl(
          user.user_metadata?.avatar_url || 
          user.user_metadata?.picture || 
          data.avatar_url
        );
        
        logger.info('Final avatar URL:', avatarUrl);
        
        // Merge with cached linked player data (prioritize cache over null DB values)
        const cached = localStorage.getItem(PROFILE_KEY);
        let linkedPlayerData = {};
        if (cached) {
          try {
            const cachedProfile = JSON.parse(cached);
            // Always restore linked player data from cache if DB has null values
            if (cachedProfile.linked_player_id && !data.linked_player_id) {
              linkedPlayerData = {
                linked_player_id: cachedProfile.linked_player_id,
                linked_username: cachedProfile.linked_username,
                linked_avatar_url: cachedProfile.linked_avatar_url,
                linked_kingdom: cachedProfile.linked_kingdom,
                linked_tc_level: cachedProfile.linked_tc_level,
              };
              logger.info('Restored linked player data from cache:', linkedPlayerData);
            }
          } catch {
            // Ignore parse errors
          }
        }
        
        const updatedProfile = { ...data, avatar_url: avatarUrl, ...linkedPlayerData };
        setProfile(updatedProfile);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
        logger.info('Profile loaded:', { hasAvatar: !!avatarUrl, hasLinkedPlayer: !!(updatedProfile.linked_username) });
      }
    } catch (err) {
      logger.error('Error fetching profile:', err);
      // Try cached profile on network error
      const cached = localStorage.getItem(PROFILE_KEY);
      if (cached) {
        setProfile(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/profile`
      }
    });
    if (error) logger.error('Google sign-in error:', error);
  };

  const signInWithDiscord = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/profile`
      }
    });
    if (error) logger.error('Discord sign-in error:', error);
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: { message: 'Auth not configured' } as AuthError };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: { message: 'Auth not configured' } as AuthError };
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/profile`
      }
    });
    return { error };
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    localStorage.removeItem(PROFILE_KEY);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    if (updates.alliance_tag) {
      updates.alliance_tag = updates.alliance_tag.slice(0, 3).toUpperCase();
    }

    // Always update local state and localStorage first (optimistic update)
    const localUpdate = { ...profile, ...updates };
    setProfile(localUpdate as UserProfile);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(localUpdate));

    if (!supabase) {
      return;
    }

    // Send updates to Supabase, filtering out fields that don't exist in the database
    const dbFields = [
      'username', 'display_name', 'email', 'avatar_url', 'home_kingdom', 'alliance_tag',
      'language', 'region', 'bio', 'theme_color', 'badge_style',
      'linked_player_id', 'linked_username', 'linked_avatar_url',
      'linked_kingdom', 'linked_tc_level', 'subscription_tier',
      'stripe_customer_id', 'stripe_subscription_id'
    ];
    
    const dbUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => dbFields.includes(key))
    );
    
    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', user.id);

      if (error) {
        logger.debug('Profile sync skipped:', error.message);
        // Local update already applied, so user sees changes
      } else {
        logger.info('Profile updated in Supabase:', dbUpdates);
      }
    }
  };

  const refreshLinkedPlayer = async () => {
    if (!profile?.linked_player_id) return;
    
    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    
    try {
      const response = await fetch(`${API_BASE}/api/v1/player-link/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: profile.linked_player_id }),
      });

      if (response.ok) {
        const data = await response.json();
        const updates: Partial<UserProfile> = {
          linked_username: data.username,
          linked_avatar_url: data.avatar_url,
          linked_kingdom: data.kingdom,
          linked_tc_level: data.town_center_level,
          linked_last_synced: new Date().toISOString(),
        };
        await updateProfile(updates);
        logger.info('Auto-refreshed linked player data:', data.username);
      }
    } catch (err) {
      logger.error('Failed to auto-refresh linked player:', err);
    }
  };

  // Auto-refresh linked player data on login (if linked and stale)
  useEffect(() => {
    if (profile?.linked_player_id && user) {
      const lastSynced = profile.linked_last_synced ? new Date(profile.linked_last_synced) : null;
      const now = new Date();
      const hoursSinceSync = lastSynced ? (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60) : Infinity;
      
      // Auto-refresh if never synced or last sync > 24 hours ago
      if (hoursSinceSync > 24) {
        refreshLinkedPlayer();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.linked_player_id, user]);

  const contextValue: AuthContextType = {
    user,
    session,
    profile,
    loading,
    isConfigured,
    signInWithGoogle,
    signInWithDiscord,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateProfile,
    refreshLinkedPlayer
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
