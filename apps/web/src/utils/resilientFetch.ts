/**
 * Resilient fetch wrapper for mobile browsers.
 *
 * Supabase JS v2.39+ uses the Web Locks API with an internal AbortController
 * for session management. On mobile browsers (especially Android Chrome),
 * the lock acquisition can be aborted, causing fetch calls that depend on
 * auth headers to throw "signal is aborted without reason".
 *
 * This utility:
 * 1. Catches AbortError / network errors from fetch
 * 2. Auto-retries once after a short delay
 * 3. Returns a user-friendly error message instead of the raw browser error
 */

/**
 * Check if an error is an abort/network error that should be retried.
 */
export function isAbortOrNetworkError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('signal is aborted') || msg.includes('aborterror') || msg.includes('network')) {
      return true;
    }
  }
  return false;
}

/**
 * Return a user-friendly error message for abort/network errors.
 */
export function friendlyAbortMessage(action = 'Request'): string {
  return `${action} interrupted. Please try again.`;
}

/**
 * Wrap a fetch call with automatic retry on abort/network errors.
 * Returns the Response on success, throws a user-friendly Error on failure.
 *
 * @param fetchFn - A function that performs the fetch (called on each attempt)
 * @param options.retries - Number of retries (default: 1)
 * @param options.delayMs - Delay between retries in ms (default: 500)
 * @param options.action  - Action label for error message (default: 'Request')
 */
export async function resilientFetch(
  fetchFn: () => Promise<Response>,
  options: { retries?: number; delayMs?: number; action?: string } = {}
): Promise<Response> {
  const { retries = 1, delayMs = 500, action = 'Request' } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchFn();
    } catch (err) {
      if (attempt < retries && isAbortOrNetworkError(err)) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      // Final attempt failed — throw friendly message
      if (isAbortOrNetworkError(err)) {
        throw new Error(friendlyAbortMessage(action));
      }
      throw err;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error(friendlyAbortMessage(action));
}
