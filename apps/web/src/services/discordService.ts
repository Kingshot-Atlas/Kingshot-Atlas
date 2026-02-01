// Discord OAuth2 Integration Service
import { supabase } from '../lib/supabase';

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

      // Call backend to exchange code for user info and store it
      const API_URL = import.meta.env.VITE_API_URL || 'https://kingshot-atlas.onrender.com';
      const session = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/api/v1/discord/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ code, redirect_uri: getDiscordRedirectUri() }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || 'Failed to link Discord' };
      }

      return { success: true };
    } catch (error) {
      console.error('Discord callback error:', error);
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
      console.error('Discord unlink error:', error);
      return { success: false, error: 'Failed to unlink Discord account' };
    }
  }

  /**
   * Check if Discord is configured
   */
  isConfigured(): boolean {
    return !!DISCORD_CLIENT_ID;
  }
}

export const discordService = new DiscordService();
