import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

let mockPremiumReturn = { isAdmin: false, isSupporter: false };
let mockAuthReturn = { profile: null as Record<string, unknown> | null, user: null as { id: string } | null };

vi.mock('../../contexts/PremiumContext', () => ({
  usePremium: () => mockPremiumReturn,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

// ============================================================================
// DIRECT ACCESS
// ============================================================================

describe('useToolAccess — direct access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { profile: null, user: null };
    mockPremiumReturn = { isAdmin: false, isSupporter: false };
  });

  it('grants access to admins', async () => {
    mockPremiumReturn = { isAdmin: true, isSupporter: false };
    mockAuthReturn = { profile: { referral_tier: null, is_discord_booster: false }, user: { id: 'admin-1' } };

    const { useToolAccess } = await import('../useToolAccess');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useToolAccess(), { wrapper });

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.reason).toBe('admin');
    expect(result.current.loading).toBe(false);
  });

  it('grants access to supporters', async () => {
    mockPremiumReturn = { isAdmin: false, isSupporter: true };
    mockAuthReturn = { profile: { referral_tier: null, is_discord_booster: false }, user: { id: 'sup-1' } };

    const { useToolAccess } = await import('../useToolAccess');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useToolAccess(), { wrapper });

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.reason).toBe('supporter');
  });

  it('grants access to ambassadors', async () => {
    mockPremiumReturn = { isAdmin: false, isSupporter: false };
    mockAuthReturn = { profile: { referral_tier: 'ambassador', is_discord_booster: false }, user: { id: 'amb-1' } };

    const { useToolAccess } = await import('../useToolAccess');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useToolAccess(), { wrapper });

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.reason).toBe('ambassador');
  });

  it('grants access to discord boosters', async () => {
    mockPremiumReturn = { isAdmin: false, isSupporter: false };
    mockAuthReturn = { profile: { referral_tier: null, is_discord_booster: true }, user: { id: 'boost-1' } };

    const { useToolAccess } = await import('../useToolAccess');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useToolAccess(), { wrapper });

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.reason).toBe('booster');
  });

  it('denies access to regular users without delegation', async () => {
    mockPremiumReturn = { isAdmin: false, isSupporter: false };
    mockAuthReturn = { profile: { referral_tier: null, is_discord_booster: false }, user: { id: 'user-1' } };

    const { useToolAccess } = await import('../useToolAccess');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useToolAccess(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.reason).toBe('none');
  });

  it('denies access when no user is logged in', async () => {
    mockPremiumReturn = { isAdmin: false, isSupporter: false };
    mockAuthReturn = { profile: null, user: null };

    const { useToolAccess } = await import('../useToolAccess');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useToolAccess(), { wrapper });

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.reason).toBe('none');
  });

  it('prioritizes admin over supporter in reason', async () => {
    mockPremiumReturn = { isAdmin: true, isSupporter: true };
    mockAuthReturn = { profile: { referral_tier: 'ambassador', is_discord_booster: true }, user: { id: 'super-1' } };

    const { useToolAccess } = await import('../useToolAccess');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useToolAccess(), { wrapper });

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.reason).toBe('admin');
  });
});
