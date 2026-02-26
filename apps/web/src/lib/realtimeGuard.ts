/**
 * Realtime Connection Guard (2026-02-25 incident mitigation)
 * 
 * Problem: Unlimited realtime subscriptions exhausted Supabase Nano instance
 * (CPU 100%, Disk IO budget depleted, auth timeouts, 3-hour outage).
 * 
 * Solution: Central registry that limits total concurrent realtime channels.
 * Only authenticated users on specific pages should use realtime.
 * Global/unauthenticated realtime is BANNED — use React Query polling instead.
 */

const MAX_REALTIME_CHANNELS = 12; // Hard cap per browser tab (Messages page needs ~5-8)
const activeChannels = new Set<string>();

/**
 * Check if a new realtime channel can be created.
 * Returns false if the limit is reached.
 */
export function canCreateChannel(channelName: string): boolean {
  if (activeChannels.has(channelName)) return true; // Already registered
  return activeChannels.size < MAX_REALTIME_CHANNELS;
}

/**
 * Register a channel as active. Returns false if limit exceeded.
 */
export function registerChannel(channelName: string): boolean {
  if (activeChannels.size >= MAX_REALTIME_CHANNELS && !activeChannels.has(channelName)) {
    console.warn(
      `[RealtimeGuard] Channel limit reached (${MAX_REALTIME_CHANNELS}). ` +
      `Rejecting "${channelName}". Active: ${Array.from(activeChannels).join(', ')}`
    );
    return false;
  }
  activeChannels.add(channelName);
  return true;
}

/**
 * Unregister a channel when it's removed.
 */
export function unregisterChannel(channelName: string): void {
  activeChannels.delete(channelName);
}

/**
 * Get current channel count (for monitoring/debugging).
 */
export function getActiveChannelCount(): number {
  return activeChannels.size;
}

/**
 * Get list of active channel names (for debugging).
 */
export function getActiveChannels(): string[] {
  return Array.from(activeChannels);
}
