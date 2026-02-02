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
 */
async function fetchLeaderboard(limit = 10, sortBy = 'overall_score') {
  const url = `${config.apiUrl}/api/v1/leaderboard?limit=${limit}&sort_by=${sortBy}`;
  console.log(`[API] Fetching leaderboard from: ${url}`);
  
  try {
    const res = await fetchWithRetry(url);
    console.log(`[API] Leaderboard response status: ${res.status}`);
    
    if (!res.ok) {
      console.error(`[API] Leaderboard failed with status ${res.status}: ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    console.log(`[API] Leaderboard returned ${data.length} kingdoms`);
    return data;
  } catch (e) {
    console.error(`[API] Leaderboard error: ${e.name} - ${e.message}`);
    return [];
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
      S: { min: 8.90, max: Infinity },   // Top 3%: Score 8.90+
      A: { min: 7.79, max: 8.90 },       // Top 10%: Score 7.79-8.89
      B: { min: 6.42, max: 7.79 },       // Top 25%: Score 6.42-7.78
      C: { min: 4.72, max: 6.42 },       // Top 50%: Score 4.72-6.41
      D: { min: -Infinity, max: 4.72 },  // Bottom 50%: Score below 4.72
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

module.exports = {
  fetchKingdom,
  fetchLeaderboard,
  fetchKingdomsByTier,
  fetchRandomKingdom,
  fetchTopByPhase,
};
