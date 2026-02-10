import { getPowerTier, POWER_TIER_THRESHOLDS } from './index';

describe('getPowerTier', () => {
  // Current scale: 0-100. Thresholds: S>=57, A>=47, B>=38, C>=29, D<29
  it('returns S tier for scores >= 57', () => {
    expect(getPowerTier(57)).toBe('S');
    expect(getPowerTier(70)).toBe('S');
    expect(getPowerTier(100)).toBe('S');
  });

  it('returns A tier for scores >= 47 and < 57', () => {
    expect(getPowerTier(47)).toBe('A');
    expect(getPowerTier(52)).toBe('A');
    expect(getPowerTier(56.99)).toBe('A');
  });

  it('returns B tier for scores >= 38 and < 47', () => {
    expect(getPowerTier(38)).toBe('B');
    expect(getPowerTier(42)).toBe('B');
    expect(getPowerTier(46.99)).toBe('B');
  });

  it('returns C tier for scores >= 29 and < 38', () => {
    expect(getPowerTier(29)).toBe('C');
    expect(getPowerTier(33)).toBe('C');
    expect(getPowerTier(37.99)).toBe('C');
  });

  it('returns D tier for scores < 29', () => {
    expect(getPowerTier(0)).toBe('D');
    expect(getPowerTier(15)).toBe('D');
    expect(getPowerTier(28.99)).toBe('D');
  });

  it('handles edge cases at thresholds', () => {
    expect(getPowerTier(POWER_TIER_THRESHOLDS.S)).toBe('S');
    expect(getPowerTier(POWER_TIER_THRESHOLDS.A)).toBe('A');
    expect(getPowerTier(POWER_TIER_THRESHOLDS.B)).toBe('B');
    expect(getPowerTier(POWER_TIER_THRESHOLDS.C)).toBe('C');
    expect(getPowerTier(POWER_TIER_THRESHOLDS.S - 0.01)).toBe('A');
  });

  it('handles negative scores', () => {
    expect(getPowerTier(-5)).toBe('D');
  });
});
