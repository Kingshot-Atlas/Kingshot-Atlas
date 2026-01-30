import { getPowerTier, POWER_TIER_THRESHOLDS } from './index';

describe('getPowerTier', () => {
  it('returns S tier for scores >= 8.90', () => {
    expect(getPowerTier(8.90)).toBe('S');
    expect(getPowerTier(9)).toBe('S');
    expect(getPowerTier(10)).toBe('S');
    expect(getPowerTier(15)).toBe('S');
  });

  it('returns A tier for scores >= 7.79 and < 8.90', () => {
    expect(getPowerTier(7.79)).toBe('A');
    expect(getPowerTier(8.5)).toBe('A');
    expect(getPowerTier(8.89)).toBe('A');
  });

  it('returns B tier for scores >= 6.42 and < 7.79', () => {
    expect(getPowerTier(6.42)).toBe('B');
    expect(getPowerTier(7)).toBe('B');
    expect(getPowerTier(7.78)).toBe('B');
  });

  it('returns C tier for scores >= 4.72 and < 6.42', () => {
    expect(getPowerTier(4.72)).toBe('C');
    expect(getPowerTier(5)).toBe('C');
    expect(getPowerTier(6.41)).toBe('C');
  });

  it('returns D tier for scores < 4.72', () => {
    expect(getPowerTier(0)).toBe('D');
    expect(getPowerTier(3)).toBe('D');
    expect(getPowerTier(4.71)).toBe('D');
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
