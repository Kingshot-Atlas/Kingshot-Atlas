/**
 * API Client Utilities
 * Handles all communication with the Kingshot Atlas API
 */

const config = require('../config');

/**
 * Fetch kingdom data by number
 */
async function fetchKingdom(number) {
  try {
    const res = await fetch(`${config.apiUrl}/api/kingdoms/${number}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('API Error (fetchKingdom):', e.message);
    return null;
  }
}

/**
 * Fetch leaderboard
 */
async function fetchLeaderboard(limit = 10, sortBy = 'overall_score') {
  try {
    const res = await fetch(`${config.apiUrl}/api/leaderboard?limit=${limit}&sort_by=${sortBy}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('API Error (fetchLeaderboard):', e.message);
    return [];
  }
}

/**
 * Fetch kingdoms by tier
 */
async function fetchKingdomsByTier(tier) {
  try {
    const res = await fetch(`${config.apiUrl}/api/leaderboard?limit=100`);
    if (!res.ok) return [];
    const kingdoms = await res.json();
    
    // Filter by tier based on score
    // IMPORTANT: Keep in sync with apps/web/src/types/index.ts POWER_TIER_THRESHOLDS
    const tierRanges = {
      S: { min: 10, max: Infinity },    // Top 10%: Score 10+
      A: { min: 7, max: 10 },           // Top 25%: Score 7-9.9
      B: { min: 4.5, max: 7 },          // Top 50%: Score 4.5-6.9
      C: { min: 2.5, max: 4.5 },        // Top 75%: Score 2.5-4.4
      D: { min: -Infinity, max: 2.5 },  // Bottom 25%: Score below 2.5
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
    const res = await fetch(`${config.apiUrl}/api/leaderboard?limit=100`);
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
    const res = await fetch(`${config.apiUrl}/api/leaderboard?limit=${limit}&sort_by=${sortBy}`);
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
