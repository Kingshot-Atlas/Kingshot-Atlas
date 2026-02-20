import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock localStorage for jsdom environment
const localStorageStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value; },
  removeItem: (key: string) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); },
});

// Mock dependencies before imports
vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

const mockUser = {
  id: 'test-user-123',
  email: 'player@example.com',
  user_metadata: { preferred_username: 'testplayer' },
};

const mockProfile = {
  username: 'testplayer',
  linked_username: null as string | null,
  linked_player_id: null as string | null,
};

let mockAuthReturn = { user: null as typeof mockUser | null, profile: null as typeof mockProfile | null, signOut: vi.fn() };

vi.mock('../AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

function renderPremium() {
  // Dynamic import to pick up mock state
  return import('../PremiumContext').then(({ PremiumProvider, usePremium }) => {
    const { Wrapper, queryClient } = createWrapper();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Wrapper, null,
        React.createElement(PremiumProvider, null, children)
      );
    return { wrapper, queryClient, usePremium };
  });
}

// ============================================================================
// TIER FEATURES (static data tests)
// ============================================================================

describe('PremiumContext - Anonymous User', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: null, profile: null, signOut: vi.fn() };
    localStorage.removeItem('kingshot_premium_tier');
  });

  it('returns anonymous tier for unauthenticated user', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('anonymous');
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.isSupporter).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.tierName).toBe('Guest');
  });

  it('anonymous can compare 2 kingdoms', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('anonymous');
    });

    expect(result.current.features.multiCompare).toBe(2);
  });

  it('anonymous cannot submit data', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('anonymous');
    });

    expect(result.current.features.submitData).toBe(false);
  });

  it('anonymous can view kingdom profiles and full history', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('anonymous');
    });

    expect(result.current.features.viewKingdomProfiles).toBe(true);
    expect(result.current.features.fullKvkHistory).toBe(true);
  });
});

describe('PremiumContext - Free User', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: mockUser, profile: mockProfile, signOut: vi.fn() };
    localStorage.removeItem('kingshot_premium_tier');
  });

  it('returns free tier for logged-in user without subscription', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.isSupporter).toBe(false);
    expect(result.current.tierName).toBe('Free');
  });

  it('free user can compare 3 kingdoms', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.features.multiCompare).toBe(3);
  });

  it('free user can submit data', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.features.submitData).toBe(true);
  });

  it('free user does not have supporter badge', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.features.supporterBadge).toBe(false);
    expect(result.current.features.earlyAccess).toBe(false);
  });
});

// ============================================================================
// FEATURE CHECKING
// ============================================================================

describe('PremiumContext - checkFeature & getFeatureLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: mockUser, profile: mockProfile, signOut: vi.fn() };
    localStorage.removeItem('kingshot_premium_tier');
  });

  it('checkFeature returns boolean for boolean features', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.checkFeature('submitData')).toBe(true);
    expect(result.current.checkFeature('supporterBadge')).toBe(false);
  });

  it('checkFeature returns true for numeric features > 0', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.checkFeature('multiCompare')).toBe(true);
    expect(result.current.checkFeature('kvkHistoryLimit')).toBe(true);
  });

  it('getFeatureLimit returns numeric values', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.getFeatureLimit('multiCompare')).toBe(3);
    expect(result.current.getFeatureLimit('kvkHistoryLimit')).toBe(999);
  });

  it('getFeatureLimit returns 0 for boolean features', async () => {
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.getFeatureLimit('submitData')).toBe(0);
  });
});

// ============================================================================
// UPGRADE MESSAGING
// ============================================================================

describe('PremiumContext - getUpgradeMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('kingshot_premium_tier');
  });

  it('prompts anonymous users to sign in', async () => {
    mockAuthReturn = { user: null, profile: null, signOut: vi.fn() };
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('anonymous');
    });

    const msg = result.current.getUpgradeMessage('advanced compare');
    expect(msg.title).toContain('Sign in');
    expect(msg.cta).toContain('Sign In');
  });

  it('prompts free users to become supporter', async () => {
    mockAuthReturn = { user: mockUser, profile: mockProfile, signOut: vi.fn() };
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    const msg = result.current.getUpgradeMessage('early access');
    expect(msg.title).toContain('Supporter');
    expect(msg.cta).toContain('Support Atlas');
  });

  it('getUpgradeUrl always returns /support', async () => {
    mockAuthReturn = { user: mockUser, profile: mockProfile, signOut: vi.fn() };
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.getUpgradeUrl()).toBe('/support');
  });
});

// ============================================================================
// LINKED USER OVERRIDE
// ============================================================================

describe('PremiumContext - Linked User', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('kingshot_premium_tier');
  });

  it('linked free users get 5 compare slots', async () => {
    mockAuthReturn = {
      user: mockUser,
      profile: { ...mockProfile, linked_username: 'InGameName', linked_player_id: '12345' },
      signOut: vi.fn(),
    };
    const { wrapper, usePremium } = await renderPremium();
    const { result } = renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.tier).toBe('free');
    });

    expect(result.current.features.multiCompare).toBe(5);
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

describe('usePremium outside provider', () => {
  it('throws when used outside PremiumProvider', async () => {
    const { usePremium } = await import('../PremiumContext');
    const { Wrapper } = createWrapper();

    expect(() => {
      renderHook(() => usePremium(), { wrapper: Wrapper });
    }).toThrow('usePremium must be used within a PremiumProvider');
  });
});
