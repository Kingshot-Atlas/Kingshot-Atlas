/**
 * Config Service
 * 
 * Fetches application configuration from the API with fallback to constants.
 * Caches values to minimize API calls.
 */

import { CURRENT_KVK as DEFAULT_CURRENT_KVK } from '../constants';
import { logger } from '../utils/logger';
import { getAuthHeaders } from './authHeaders';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface KvKConfigResponse {
  current_kvk: number;
  source: 'database' | 'default';
  note?: string;
}

// Cache for current KvK value
let cachedCurrentKvK: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the current KvK number from the API.
 * Falls back to the constant if API is unavailable.
 * Caches the result for 5 minutes.
 */
export async function getCurrentKvK(): Promise<number> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (cachedCurrentKvK !== null && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedCurrentKvK;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/v1/admin/config/current-kvk`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      logger.warn('[ConfigService] Failed to fetch current KvK, using default');
      return DEFAULT_CURRENT_KVK;
    }
    
    const data: KvKConfigResponse = await response.json();
    
    // Cache the result
    cachedCurrentKvK = data.current_kvk;
    cacheTimestamp = now;
    
    return data.current_kvk;
  } catch (error) {
    logger.warn('[ConfigService] Error fetching current KvK:', error);
    return DEFAULT_CURRENT_KVK;
  }
}

/**
 * Get the current KvK synchronously (from cache or constant).
 * Use this when you need the value immediately without async.
 * The value will be the cached value or the fallback constant.
 */
export function getCurrentKvKSync(): number {
  if (cachedCurrentKvK !== null) {
    return cachedCurrentKvK;
  }
  return DEFAULT_CURRENT_KVK;
}

/**
 * Invalidate the KvK cache.
 * Call this after updating the KvK number.
 */
export function invalidateKvKCache(): void {
  cachedCurrentKvK = null;
  cacheTimestamp = 0;
}

/**
 * Increment the current KvK number (admin only).
 * Requires admin authentication.
 */
export async function incrementKvK(adminApiKey?: string): Promise<{
  success: boolean;
  old_kvk?: number;
  new_kvk?: number;
  message?: string;
  error?: string;
}> {
  try {
    const authHeaders = await getAuthHeaders({ requireAuth: false });
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders,
    };
    
    if (adminApiKey) {
      headers['X-Admin-Key'] = adminApiKey;
    }
    
    const response = await fetch(`${API_BASE}/api/v1/admin/config/increment-kvk`, {
      method: 'POST',
      headers,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.detail || 'Failed to increment KvK' };
    }
    
    // Invalidate cache so next fetch gets new value
    invalidateKvKCache();
    
    return data;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Pre-fetch current KvK on module load (fire and forget)
getCurrentKvK().catch(() => {});
