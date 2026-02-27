import { describe, it, expect } from 'vitest';
import { getDisplayName, type UserProfile } from '../AuthContext';

// ============================================================================
// getDisplayName — pure function, no provider needed
// ============================================================================

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-123',
  username: 'testuser',
  email: 'test@ks-atlas.com',
  avatar_url: '',
  home_kingdom: null,
  alliance_tag: '',
  language: 'en',
  region: '',
  bio: '',
  theme_color: '',
  badge_style: '',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('getDisplayName', () => {
  it('returns display_name when set', () => {
    const profile = makeProfile({ display_name: 'Cool Name' });
    expect(getDisplayName(profile)).toBe('Cool Name');
  });

  it('falls back to username when display_name is null', () => {
    const profile = makeProfile({ display_name: null, username: 'player42' });
    expect(getDisplayName(profile)).toBe('player42');
  });

  it('falls back to username when display_name is empty string', () => {
    const profile = makeProfile({ display_name: '', username: 'player42' });
    // empty string is falsy, falls back to username
    expect(getDisplayName(profile)).toBe('player42');
  });

  it('returns "User" when profile is null', () => {
    expect(getDisplayName(null)).toBe('User');
  });

  it('returns "User" when both display_name and username are empty', () => {
    const profile = makeProfile({ display_name: '', username: '' });
    expect(getDisplayName(profile)).toBe('User');
  });

  it('prefers display_name over username', () => {
    const profile = makeProfile({ display_name: 'Display', username: 'Username' });
    expect(getDisplayName(profile)).toBe('Display');
  });
});
