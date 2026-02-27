import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

import { reviewService } from './reviewService';
import type { UserProfile } from '../contexts/AuthContext';

// ============================================================================
// canUserReview — pure validation, no DB needed
// ============================================================================

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  avatar_url: '',
  home_kingdom: null,
  alliance_tag: '',
  language: 'en',
  region: '',
  bio: '',
  theme_color: '',
  badge_style: '',
  created_at: new Date().toISOString(),
  linked_username: 'InGameName',
  linked_tc_level: 25,
  ...overrides,
});

describe('reviewService.canUserReview', () => {
  it('returns false for null profile', () => {
    const result = reviewService.canUserReview(null);
    expect(result.canReview).toBe(false);
    expect(result.reason).toBe('not_authenticated');
  });

  it('returns false for unlinked profile', () => {
    const profile = makeProfile({ linked_username: null });
    const result = reviewService.canUserReview(profile);
    expect(result.canReview).toBe(false);
    expect(result.reason).toBe('not_linked');
  });

  it('returns false for low TC level', () => {
    const profile = makeProfile({ linked_tc_level: 15 });
    const result = reviewService.canUserReview(profile);
    expect(result.canReview).toBe(false);
    expect(result.reason).toContain('tc_level_low');
    expect(result.reason).toContain('15');
  });

  it('returns false for TC level 0', () => {
    const profile = makeProfile({ linked_tc_level: 0 });
    const result = reviewService.canUserReview(profile);
    expect(result.canReview).toBe(false);
    expect(result.reason).toContain('tc_level_low');
  });

  it('returns false for undefined TC level', () => {
    const profile = makeProfile({ linked_tc_level: undefined });
    const result = reviewService.canUserReview(profile);
    expect(result.canReview).toBe(false);
    expect(result.reason).toContain('tc_level_low');
  });

  it('returns true for TC level exactly at minimum (20)', () => {
    const profile = makeProfile({ linked_tc_level: 20 });
    const result = reviewService.canUserReview(profile);
    expect(result.canReview).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('returns true for TC level above minimum', () => {
    const profile = makeProfile({ linked_tc_level: 30 });
    const result = reviewService.canUserReview(profile);
    expect(result.canReview).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('returns true for valid linked user with sufficient TC', () => {
    const result = reviewService.canUserReview(makeProfile());
    expect(result.canReview).toBe(true);
    expect(result.reason).toBeNull();
  });
});

// ============================================================================
// DB-dependent methods — verify they throw when Supabase not configured
// ============================================================================

describe('reviewService — Supabase-dependent methods', () => {
  it('getReviewsForKingdom throws when Supabase not configured', async () => {
    await expect(reviewService.getReviewsForKingdom(172)).rejects.toThrow('Supabase is not configured');
  });

  it('getTopHelpfulReviews throws when Supabase not configured', async () => {
    await expect(reviewService.getTopHelpfulReviews(172)).rejects.toThrow('Supabase is not configured');
  });

  it('createReview validates min comment length before DB call', async () => {
    const profile = makeProfile();
    const result = await reviewService.createReview(172, 4, 'short', profile, 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least');
  });

  it('createReview validates max comment length before DB call', async () => {
    const profile = makeProfile();
    const longComment = 'x'.repeat(201);
    const result = await reviewService.createReview(172, 4, longComment, profile, 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('under');
  });

  it('createReview validates rating range before DB call', async () => {
    const profile = makeProfile();
    const result = await reviewService.createReview(172, 0, 'Valid comment text here', profile, 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Rating');
  });

  it('createReview validates rating upper bound', async () => {
    const profile = makeProfile();
    const result = await reviewService.createReview(172, 6, 'Valid comment text here', profile, 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Rating');
  });

  it('createReview rejects ineligible users before DB call', async () => {
    const profile = makeProfile({ linked_username: null });
    const result = await reviewService.createReview(172, 4, 'Valid comment text here', profile, 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not eligible');
  });
});
