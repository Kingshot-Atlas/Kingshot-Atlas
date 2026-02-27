import { describe, it, expect, beforeEach } from 'vitest';
import {
  canCreateChannel,
  registerChannel,
  unregisterChannel,
  getActiveChannelCount,
  getActiveChannels,
} from './realtimeGuard';

// Clean up all channels before each test to avoid cross-test pollution
beforeEach(() => {
  getActiveChannels().forEach(ch => unregisterChannel(ch));
  expect(getActiveChannelCount()).toBe(0);
});

// ============================================================================
// BASIC OPERATIONS
// ============================================================================

describe('registerChannel / unregisterChannel', () => {
  it('registers a channel and increments count', () => {
    expect(registerChannel('messages')).toBe(true);
    expect(getActiveChannelCount()).toBe(1);
    expect(getActiveChannels()).toContain('messages');
  });

  it('unregisters a channel and decrements count', () => {
    registerChannel('messages');
    unregisterChannel('messages');
    expect(getActiveChannelCount()).toBe(0);
    expect(getActiveChannels()).not.toContain('messages');
  });

  it('is idempotent for duplicate registrations', () => {
    registerChannel('messages');
    registerChannel('messages');
    expect(getActiveChannelCount()).toBe(1);
  });

  it('does nothing when unregistering non-existent channel', () => {
    unregisterChannel('nonexistent');
    expect(getActiveChannelCount()).toBe(0);
  });
});

// ============================================================================
// canCreateChannel
// ============================================================================

describe('canCreateChannel', () => {
  it('returns true when under limit', () => {
    expect(canCreateChannel('new-channel')).toBe(true);
  });

  it('returns true for already-registered channel even at limit', () => {
    for (let i = 0; i < 12; i++) {
      registerChannel(`ch-${i}`);
    }
    expect(getActiveChannelCount()).toBe(12);
    expect(canCreateChannel('ch-0')).toBe(true);
  });

  it('returns false for new channel when at limit', () => {
    for (let i = 0; i < 12; i++) {
      registerChannel(`ch-${i}`);
    }
    expect(canCreateChannel('ch-new')).toBe(false);
  });
});

// ============================================================================
// CHANNEL LIMIT (MAX_REALTIME_CHANNELS = 12)
// ============================================================================

describe('channel limit enforcement', () => {
  it('allows registering up to 12 channels', () => {
    for (let i = 0; i < 12; i++) {
      expect(registerChannel(`ch-${i}`)).toBe(true);
    }
    expect(getActiveChannelCount()).toBe(12);
  });

  it('rejects the 13th channel', () => {
    for (let i = 0; i < 12; i++) {
      registerChannel(`ch-${i}`);
    }
    expect(registerChannel('ch-overflow')).toBe(false);
    expect(getActiveChannelCount()).toBe(12);
    expect(getActiveChannels()).not.toContain('ch-overflow');
  });

  it('allows new registration after unregistering at limit', () => {
    for (let i = 0; i < 12; i++) {
      registerChannel(`ch-${i}`);
    }
    unregisterChannel('ch-0');
    expect(registerChannel('ch-replacement')).toBe(true);
    expect(getActiveChannelCount()).toBe(12);
  });
});

// ============================================================================
// getActiveChannels
// ============================================================================

describe('getActiveChannels', () => {
  it('returns empty array initially', () => {
    expect(getActiveChannels()).toEqual([]);
  });

  it('returns all registered channel names', () => {
    registerChannel('alpha');
    registerChannel('beta');
    registerChannel('gamma');
    const channels = getActiveChannels();
    expect(channels).toHaveLength(3);
    expect(channels).toContain('alpha');
    expect(channels).toContain('beta');
    expect(channels).toContain('gamma');
  });
});
