/**
 * Client-side caching utilities for Kingshot Atlas.
 */
import { Kingdom } from '../types';
import { logger } from '../utils/logger';

const CACHE_KEY = 'kingshot_kingdom_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export interface CacheData {
  kingdoms: Kingdom[];
  timestamp: number;
}

/**
 * Load cached data from localStorage.
 */
export function loadCache(): CacheData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached) as CacheData;
      if (Date.now() - data.timestamp < CACHE_EXPIRY_MS) {
        return data;
      }
    }
  } catch (e) {
    logger.warn('Failed to load cache:', e);
  }
  return null;
}

/**
 * Save data to localStorage cache.
 */
export function saveCache(kingdoms: Kingdom[]): CacheData {
  const data: CacheData = { kingdoms, timestamp: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    logger.warn('Failed to save cache:', e);
  }
  return data;
}

/**
 * Clear the cache.
 */
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Check if cache is valid (not expired).
 */
export function isCacheValid(cache: CacheData | null): cache is CacheData {
  if (!cache) return false;
  return Date.now() - cache.timestamp < CACHE_EXPIRY_MS;
}
