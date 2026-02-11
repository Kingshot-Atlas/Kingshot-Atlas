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
  subscription_tier?: string;
  discord_id?: string | null;
  discord_username?: string | null;
  discord_linked_at?: string | null;
  referred_by?: string | null;
  referral_count?: number;
  referral_tier?: string | null;
  show_coordinates?: boolean;
  coordinates?: string | null;
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
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
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
const REFERRAL_KEY = 'kingshot_referral_code';
const REFERRAL_SOURCE_KEY = 'kingshot_referral_source';

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

// Extract Discord ID and username from Supabase auth metadata for Discord-authenticated users
const getDiscordInfoFromAuth = (user: User): { discordId: string | null; discordUsername: string | null } => {
  // Check if user logged in via Discord
  const provider = user.app_metadata?.provider || user.app_metadata?.providers?.[0];
  if (provider !== 'discord') {
    return { discordId: null, discordUsername: null };
  }
  
  // Extract Discord ID from avatar URL: https://cdn.discordapp.com/avatars/332218895765209089/...
  const avatarUrl = user.user_metadata?.avatar_url || '';
  const discordAvatarMatch = avatarUrl.match(/cdn\.discordapp\.com\/avatars\/(\d+)\//);
  const discordId = discordAvatarMatch?.[1] || null;
  
  // Get username from metadata
  const discordUsername = user.user_metadata?.full_name || 
                          user.user_metadata?.name || 
                          user.user_metadata?.custom_claims?.global_name ||
                          null;
  
  return { discordId, discordUsername };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured;

  // Capture ?ref= and ?src= params from URL and store in localStorage for later use during signup
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode && refCode.trim()) {
        localStorage.setItem(REFERRAL_KEY, refCode.trim());
        const srcParam = params.get('src');
        if (srcParam && ['review', 'transfer'].includes(srcParam.trim())) {
          const sourceMap: Record<string, string> = { review: 'review_invite', transfer: 'transfer_listing' };
          localStorage.setItem(REFERRAL_SOURCE_KEY, sourceMap[srcParam.trim()] || 'referral_link');
        } else {
          localStorage.setItem(REFERRAL_SOURCE_KEY, 'referral_link');
        }
      }
    } catch { /* ignore */ }
  }, []);

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
        
        // Auto-populate Discord info if user logged in via Discord
        const { discordId, discordUsername } = getDiscordInfoFromAuth(user);

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
          is_admin: false,
          discord_id: discordId,
          discord_username: discordUsername,
          discord_linked_at: discordId ? new Date().toISOString() : null
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
          // Process referral code if present (new user was referred)
          const storedRefCode = localStorage.getItem(REFERRAL_KEY);
          if (storedRefCode && supabase) {
            try {
              // Look up the referrer by their linked_username
              const { data: referrer } = await supabase
                .from('profiles')
                .select('id')
                .eq('linked_username', storedRefCode)
                .single();
              
              if (referrer && referrer.id !== created.id) {
                // Capture IP for abuse detection (best-effort, non-blocking)
                let signupIp: string | null = null;
                try {
                  const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
                  if (ipRes.ok) { signupIp = (await ipRes.json()).ip; }
                } catch { /* IP capture is best-effort */ }
                // Create the referral record (pending until referred user links account)
                const storedSource = localStorage.getItem(REFERRAL_SOURCE_KEY) || 'referral_link';
                await supabase.from('referrals').insert({
                  referrer_user_id: referrer.id,
                  referred_user_id: created.id,
                  referral_code: storedRefCode,
                  status: 'pending',
                  signup_ip: signupIp,
                  source: storedSource,
                });
                // Update profile with referred_by
                await supabase.from('profiles').update({ referred_by: storedRefCode }).eq('id', created.id);
                logger.info('Referral recorded:', { referrer: storedRefCode, referred: created.id });
              }
            } catch (refErr) {
              logger.error('Failed to process referral:', refErr);
            }
            localStorage.removeItem(REFERRAL_KEY);
            localStorage.removeItem(REFERRAL_SOURCE_KEY);
          }
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
        } else {
          // No cache available — create a minimal local profile so the user isn't stuck
          const fallbackProfile: UserProfile = {
            id: user.id,
            username: generateRandomUsername(),
            email: user.email || '',
            avatar_url: getCleanAvatarUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture),
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
          setProfile(fallbackProfile);
          localStorage.setItem(PROFILE_KEY, JSON.stringify(fallbackProfile));
          logger.warn('Using fallback profile due to fetch error — will retry on next load');
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
        
        // Auto-populate Discord info for Discord-authenticated users who don't have it set
        let discordData: { discord_id?: string | null; discord_username?: string | null; discord_linked_at?: string | null } = {};
        if (!data.discord_id) {
          const { discordId, discordUsername } = getDiscordInfoFromAuth(user);
          if (discordId) {
            discordData = {
              discord_id: discordId,
              discord_username: discordUsername,
              discord_linked_at: new Date().toISOString()
            };
            logger.info('Auto-populated Discord info from auth:', discordData);
            // Update the database with Discord info
            supabase.from('profiles').update(discordData).eq('id', user.id).then(({ error: updateError }) => {
              if (updateError) logger.error('Failed to save Discord info:', updateError);
            });
          }
        }
        
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
        
        const updatedProfile = { ...data, avatar_url: avatarUrl, ...linkedPlayerData, ...discordData };
        setProfile(updatedProfile);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
        logger.info('Profile loaded:', { hasAvatar: !!avatarUrl, hasLinkedPlayer: !!(updatedProfile.linked_username), hasDiscord: !!(updatedProfile.discord_id) });
      }
    } catch (err) {
      logger.error('Error fetching profile:', err);
      // Try cached profile on network error
      const cached = localStorage.getItem(PROFILE_KEY);
      if (cached) {
        setProfile(JSON.parse(cached));
      } else {
        // No cache — create minimal fallback so user isn't stuck on loading screen
        const fallbackProfile: UserProfile = {
          id: user.id,
          username: generateRandomUsername(),
          email: user.email || '',
          avatar_url: getCleanAvatarUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture),
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
        setProfile(fallbackProfile);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(fallbackProfile));
        logger.warn('Using fallback profile due to network error — will retry on next load');
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
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) logger.error('Google sign-in error:', error);
  };

  const signInWithDiscord = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
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
        emailRedirectTo: `${window.location.origin}/auth/callback`
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

  const updateProfile = async (updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not logged in' };

    if (updates.alliance_tag) {
      updates.alliance_tag = updates.alliance_tag.slice(0, 3).toUpperCase();
    }

    // Always update local state and localStorage first (optimistic update)
    const localUpdate = { ...profile, ...updates };
    setProfile(localUpdate as UserProfile);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(localUpdate));

    if (!supabase) {
      return { success: true }; // Local-only mode
    }

    // Send updates to Supabase, filtering out fields that don't exist in the database
    const dbFields = [
      'username', 'display_name', 'email', 'avatar_url', 'home_kingdom', 'alliance_tag',
      'language', 'region', 'bio', 'theme_color', 'badge_style',
      'linked_player_id', 'linked_username', 'linked_avatar_url',
      'linked_kingdom', 'linked_tc_level', 'subscription_tier',
      'stripe_customer_id', 'stripe_subscription_id',
      'referred_by', 'referral_count', 'referral_tier'
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
        logger.error('Profile update failed:', error.message);
        // Revert optimistic update on failure
        if (profile) {
          setProfile(profile);
          localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        }
        // Handle unique constraint violation on linked_player_id
        if (error.code === '23505' && error.message?.includes('linked_player_id')) {
          return { success: false, error: 'This Player ID is already linked to another Atlas account.' };
        }
        return { success: false, error: error.message };
      } else {
        logger.info('Profile updated in Supabase:', dbUpdates);
        return { success: true };
      }
    }
    
    return { success: true };
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
