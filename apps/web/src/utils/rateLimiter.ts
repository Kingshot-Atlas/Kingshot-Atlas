/**
 * Client-side rate limiter for API calls.
 * 
 * Prevents excessive API requests from the frontend.
 * Uses a sliding window algorithm with configurable limits.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RequestRecord {
  timestamps: number[];
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,  // 60 requests
  windowMs: 60000,  // per minute
};

class RateLimiter {
  private requests: Map<string, RequestRecord> = new Map();
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a request is allowed for the given key.
   * Returns true if allowed, false if rate limited.
   */
  isAllowed(key: string = 'default'): boolean {
    const now = Date.now();
    const record = this.requests.get(key) || { timestamps: [] };
    
    // Remove timestamps outside the window
    const windowStart = now - this.config.windowMs;
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);
    
    // Check if under limit
    if (record.timestamps.length >= this.config.maxRequests) {
      return false;
    }
    
    // Add current timestamp
    record.timestamps.push(now);
    this.requests.set(key, record);
    
    return true;
  }

  /**
   * Get remaining requests for the given key.
   */
  getRemaining(key: string = 'default'): number {
    const now = Date.now();
    const record = this.requests.get(key);
    
    if (!record) {
      return this.config.maxRequests;
    }
    
    const windowStart = now - this.config.windowMs;
    const validTimestamps = record.timestamps.filter(ts => ts > windowStart);
    
    return Math.max(0, this.config.maxRequests - validTimestamps.length);
  }

  /**
   * Get time until the rate limit resets (in ms).
   */
  getResetTime(key: string = 'default'): number {
    const record = this.requests.get(key);
    
    if (!record || record.timestamps.length === 0) {
      return 0;
    }
    
    const oldestTimestamp = Math.min(...record.timestamps);
    const resetTime = oldestTimestamp + this.config.windowMs - Date.now();
    
    return Math.max(0, resetTime);
  }

  /**
   * Clear rate limit data for a key.
   */
  clear(key: string = 'default'): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limit data.
   */
  clearAll(): void {
    this.requests.clear();
  }
}

// Pre-configured rate limiters for different use cases
export const apiRateLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60000, // 60 requests per minute
});

export const searchRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60000, // 20 searches per minute
});

export const submissionRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 300000, // 5 submissions per 5 minutes
});

/**
 * Higher-order function to wrap API calls with rate limiting.
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  limiter: RateLimiter = apiRateLimiter,
  key?: string
): T {
  return (async (...args: Parameters<T>) => {
    const limitKey = key || fn.name || 'anonymous';
    
    if (!limiter.isAllowed(limitKey)) {
      const resetTime = limiter.getResetTime(limitKey);
      throw new Error(`Rate limited. Try again in ${Math.ceil(resetTime / 1000)} seconds.`);
    }
    
    return fn(...args);
  }) as T;
}

export { RateLimiter };
export type { RateLimitConfig };
