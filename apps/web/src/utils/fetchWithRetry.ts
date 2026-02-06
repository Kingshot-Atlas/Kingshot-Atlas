/**
 * Fetch with exponential backoff retry logic.
 * Used for admin API calls that may transiently fail.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 2,
  baseDelayMs = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Don't retry on auth errors (401/403) — those won't resolve with retries
      if (response.ok || response.status === 401 || response.status === 403) {
        return response;
      }
      // Retry on 5xx server errors and 429 rate limits
      if (response.status >= 500 || response.status === 429) {
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Fetch failed after ${maxRetries + 1} attempts`);
}
