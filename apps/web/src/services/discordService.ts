// Discord OAuth2 Integration Service
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';

// Dynamic redirect URI - uses current origin for localhost, production URL otherwise
const getDiscordRedirectUri = () => {
  if (import.meta.env.VITE_DISCORD_REDIRECT_URI) {
    return import.meta.env.VITE_DISCORD_REDIRECT_URI;
  }
  // Use current origin for any localhost port
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${window.location.origin}/auth/discord/callback`;
  }
  return 'https://ks-atlas.com/auth/discord/callback';
};

// Discord OAuth2 scopes - only need identify for user info
const DISCORD_SCOPES = ['identify'].join(' ');

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
}

class DiscordService {
  /**
   * Generate Discord OAuth2 authorization URL
   */
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: getDiscordRedirectUri(),
      response_type: 'code',
      scope: DISCORD_SCOPES,
    });
    
    if (state) {
      params.append('state', state);
    }
    
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for Discord user info
   * This should be called from the callback page
   */
  async handleCallback(code: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Call Supabase Edge Function for Discord code exchange
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      if (!SUPABASE_URL) {
        return { success: false, error: 'Supabase not configured for Discord linking.' };
      }

      const MAX_RETRIES = 2;
      let lastError = 'Failed to link Discord';

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, attempt * 1000));
          logger.info(`Discord callback retry attempt ${attempt}/${MAX_RETRIES}`);
        }

        const session = await supabase.auth.getSession();
        const response = await fetch(`${SUPABASE_URL}/functions/v1/discord-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({ code, redirect_uri: getDiscordRedirectUri() }),
        });

        if (response.ok) {
          return { success: true };
        }

        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        lastError = error.error || error.detail || 'Failed to link Discord';

        // Don't retry on auth errors (401) or config errors (503) — only transient failures
        if (response.status === 401 || response.status === 503) {
          return { success: false, error: lastError };
        }
      }

      return { success: false, error: lastError };
    } catch (error) {
      logger.error('Discord callback error:', error);
      return { success: false, error: 'Failed to link Discord account' };
    }
  }

  /**
   * Unlink Discord account
   */
  async unlinkDiscord(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          discord_id: null,
          discord_username: null,
          discord_linked_at: null,
        })
        .eq('id', user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Discord unlink error:', error);
      return { success: false, error: 'Failed to unlink Discord account' };
    }
  }

  /**
   * Check if Discord is configured
   */
  isConfigured(): boolean {
    return !!DISCORD_CLIENT_ID;
  }

  /**
   * Sync Settler Discord role when Kingshot account is linked/unlinked
   * This assigns the "Settler" role to users who have linked their Kingshot account
   */
  async syncSettlerRole(userId: string, isLinking: boolean = true): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      if (!API_URL) {
        // Bot handles settler role sync on a 30-min schedule; skip real-time sync
        logger.info('Settler role sync skipped: no backend API URL configured');
        return { success: true, skipped: true };
      }
      
      const { getAuthHeaders } = await import('./authHeaders');
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      
      const response = await fetch(`${API_URL}/api/v1/bot/sync-settler-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ 
          user_id: userId, 
          is_linking: isLinking 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        logger.warn('Settler role sync failed:', error);
        // Don't fail the linking process if role sync fails
        return { success: false, error: error.detail || 'Failed to sync Discord role' };
      }

      const result = await response.json();
      
      if (result.skipped) {
        logger.info('Settler role sync skipped:', result.reason);
        return { success: true, skipped: true };
      }

      logger.info('Settler role synced:', result);
      return { success: result.success };
    } catch (error) {
      logger.error('Settler role sync error:', error);
      // Don't fail the linking process if role sync fails
      return { success: false, error: 'Failed to sync Discord role' };
    }
  }
}

export const discordService = new DiscordService();
