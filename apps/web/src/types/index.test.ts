import { getPowerTier, POWER_TIER_THRESHOLDS } from './index';

describe('getPowerTier', () => {
  it('returns S tier for scores >= 12', () => {
    expect(getPowerTier(12)).toBe('S');
    expect(getPowerTier(15)).toBe('S');
    expect(getPowerTier(100)).toBe('S');
  });

  it('returns A tier for scores >= 8 and < 12', () => {
    expect(getPowerTier(8)).toBe('A');
    expect(getPowerTier(10)).toBe('A');
    expect(getPowerTier(11.9)).toBe('A');
  });

  it('returns B tier for scores >= 5 and < 8', () => {
    expect(getPowerTier(5)).toBe('B');
    expect(getPowerTier(6)).toBe('B');
    expect(getPowerTier(7.9)).toBe('B');
  });

  it('returns C tier for scores < 5', () => {
    expect(getPowerTier(0)).toBe('C');
    expect(getPowerTier(2)).toBe('C');
    expect(getPowerTier(4.9)).toBe('C');
  });

  it('handles edge cases at thresholds', () => {
    expect(getPowerTier(POWER_TIER_THRESHOLDS.S)).toBe('S');
    expect(getPowerTier(POWER_TIER_THRESHOLDS.A)).toBe('A');
    expect(getPowerTier(POWER_TIER_THRESHOLDS.B)).toBe('B');
    expect(getPowerTier(POWER_TIER_THRESHOLDS.S - 0.01)).toBe('A');
  });

  it('handles negative scores', () => {
    expect(getPowerTier(-5)).toBe('C');
  });
});
