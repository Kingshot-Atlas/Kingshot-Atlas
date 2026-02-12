/**
 * API Client Utilities
 * Handles all communication with the Kingshot Atlas API
 * 
 * Note: Render's free tier services sleep after 15 min of inactivity.
 * Cold starts can take 30-60 seconds, so we use a longer timeout
 * and retry logic to handle this.
 */

const config = require('../config');

// Timeout for API requests - 60 seconds to handle Render cold starts
const API_TIMEOUT = 60000;

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch with retry logic for handling cold starts
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      return response;
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's not a timeout/network error
      if (error.name !== 'AbortError' && !error.message.includes('fetch')) {
        throw error;
      }
      
      // Log retry attempt
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`API retry ${attempt + 1}/${retries} for ${url} (waiting ${delay}ms)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Fetch kingdom data by number
 */
async function fetchKingdom(number) {
  const url = `${config.apiUrl}/api/v1/kingdoms/${number}`;
  console.log(`[API] Fetching kingdom from: ${url}`);
  
  try {
    const res = await fetchWithRetry(url);
    console.log(`[API] Kingdom ${number} response status: ${res.status}`);
    
    if (!res.ok) {
      console.error(`[API] Kingdom ${number} failed with status ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`[API] Kingdom ${number} error: ${e.name} - ${e.message}`);
    return null;
  }
}

/**
 * Fetch leaderboard
 * Returns { data: [], error: null } on success, { data: [], error: "message" } on failure
 */
async function fetchLeaderboard(limit = 10, sortBy = 'overall_score') {
  const url = `${config.apiUrl}/api/v1/leaderboard?limit=${limit}&sort_by=${sortBy}`;
  console.log(`[API] Fetching leaderboard from: ${url}`);
  console.log(`[API] Config apiUrl: ${config.apiUrl}`);
  
  try {
    const res = await fetchWithRetry(url);
    console.log(`[API] Leaderboard response status: ${res.status}`);
    
    if (!res.ok) {
      const errorMsg = `API returned ${res.status}: ${res.statusText}`;
      console.error(`[API] Leaderboard failed: ${errorMsg}`);
      return { data: [], error: errorMsg };
    }
    
    const data = await res.json();
    console.log(`[API] Leaderboard returned ${data.length} kingdoms`);
    return { data, error: null };
  } catch (e) {
    const errorMsg = `${e.name}: ${e.message}`;
    console.error(`[API] Leaderboard error: ${errorMsg}`);
    return { data: [], error: errorMsg };
  }
}

/**
 * Fetch kingdoms by tier
 */
async function fetchKingdomsByTier(tier) {
  try {
    const res = await fetchWithRetry(`${config.apiUrl}/api/v1/leaderboard?limit=100`);
    if (!res.ok) return [];
    const kingdoms = await res.json();
    
    // Filter by tier based on score
    // IMPORTANT: Keep in sync with apps/web/src/types/index.ts POWER_TIER_THRESHOLDS
    const tierRanges = {
      S: { min: 57, max: Infinity },     // Top 2.9%: Score 57+ (v3.1, 0-100 scale)
      A: { min: 47, max: 57 },           // Top 9.6%: Score 47-56.99
      B: { min: 38, max: 47 },           // Top 24.3%: Score 38-46.99
      C: { min: 29, max: 38 },           // Top 48.9%: Score 29-37.99
      D: { min: -Infinity, max: 29 },    // Bottom 51.1%: Score below 29
    };
    
    const range = tierRanges[tier.toUpperCase()];
    if (!range) return [];
    
    return kingdoms.filter(k => 
      k.overall_score >= range.min && k.overall_score < range.max
    );
  } catch (e) {
    console.error('API Error (fetchKingdomsByTier):', e.message);
    return [];
  }
}

/**
 * Fetch random kingdom
 */
async function fetchRandomKingdom() {
  try {
    const res = await fetchWithRetry(`${config.apiUrl}/api/v1/leaderboard?limit=100`);
    if (!res.ok) return null;
    const kingdoms = await res.json();
    if (kingdoms.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * kingdoms.length);
    return kingdoms[randomIndex];
  } catch (e) {
    console.error('API Error (fetchRandomKingdom):', e.message);
    return null;
  }
}

/**
 * Fetch top kingdoms by specific stat
 */
async function fetchTopByPhase(phase, limit = 10) {
  try {
    const sortBy = phase === 'prep' ? 'prep_win_rate' : 'battle_win_rate';
    const res = await fetchWithRetry(`${config.apiUrl}/api/v1/leaderboard?limit=${limit}&sort_by=${sortBy}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('API Error (fetchTopByPhase):', e.message);
    return [];
  }
}

/**
 * Check /multirally credits for a Discord user via backend API.
 * Returns { allowed, remaining, is_supporter } or null on failure.
 */
async function checkMultirallyCredits(discordUserId, isSupporter) {
  try {
    const res = await fetchWithTimeout(`${config.apiUrl}/api/v1/bot/multirally-credits/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.DISCORD_API_KEY || '',
      },
      body: JSON.stringify({ discord_user_id: discordUserId, is_supporter: isSupporter }),
    }, 5000); // 5s timeout — don't block command on slow API
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`[API] checkMultirallyCredits error: ${e.message}`);
    return null;
  }
}

/**
 * Increment /multirally usage for a Discord user via backend API.
 * Returns { success, usage_count, remaining } or null on failure.
 */
async function incrementMultirallyCredits(discordUserId, isSupporter) {
  try {
    const res = await fetchWithTimeout(`${config.apiUrl}/api/v1/bot/multirally-credits/increment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.DISCORD_API_KEY || '',
      },
      body: JSON.stringify({ discord_user_id: discordUserId, is_supporter: isSupporter }),
    }, 5000);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`[API] incrementMultirallyCredits error: ${e.message}`);
    return null;
  }
}

/**
 * Fetch active gift codes from backend API (merged: Supabase + kingshot.net)
 */
async function fetchGiftCodes() {
  try {
    const res = await fetchWithRetry(`${config.apiUrl}/api/v1/player-link/gift-codes`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.codes || [];
  } catch (e) {
    console.error('[API] fetchGiftCodes error:', e.message);
    return [];
  }
}

/**
 * Redeem a single gift code for a player via backend proxy
 */
async function redeemGiftCode(playerId, code) {
  try {
    const res = await fetchWithTimeout(`${config.apiUrl}/api/v1/player-link/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, code }),
    }, 30000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData.detail?.error || `HTTP ${res.status}`, err_code: null };
    }
    return await res.json();
  } catch (e) {
    console.error(`[API] redeemGiftCode error (${code}):`, e.message);
    return { success: false, message: e.message, err_code: null };
  }
}

/**
 * Look up an Atlas user profile by Discord ID
 */
async function lookupUserByDiscordId(discordId) {
  try {
    const res = await fetchWithTimeout(`${config.apiUrl}/api/v1/bot/user-by-discord/${discordId}`, {
      headers: { 'X-API-Key': process.env.DISCORD_API_KEY || '' },
    }, 15000);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`[API] lookupUserByDiscordId error:`, e.message);
    return null;
  }
}

module.exports = {
  fetchKingdom,
  fetchLeaderboard,
  fetchKingdomsByTier,
  fetchRandomKingdom,
  fetchTopByPhase,
  checkMultirallyCredits,
  incrementMultirallyCredits,
  fetchGiftCodes,
  redeemGiftCode,
  lookupUserByDiscordId,
};
