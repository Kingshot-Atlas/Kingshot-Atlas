import { getPowerTier, POWER_TIER_THRESHOLDS } from './index';

describe('getPowerTier', () => {
  it('returns S tier for scores >= 10', () => {
    expect(getPowerTier(10)).toBe('S');
    expect(getPowerTier(12)).toBe('S');
    expect(getPowerTier(15)).toBe('S');
    expect(getPowerTier(100)).toBe('S');
  });

  it('returns A tier for scores >= 7 and < 10', () => {
    expect(getPowerTier(7)).toBe('A');
    expect(getPowerTier(8)).toBe('A');
    expect(getPowerTier(9.9)).toBe('A');
  });

  it('returns B tier for scores >= 4.5 and < 7', () => {
    expect(getPowerTier(4.5)).toBe('B');
    expect(getPowerTier(5)).toBe('B');
    expect(getPowerTier(6.9)).toBe('B');
  });

  it('returns C tier for scores >= 2.5 and < 4.5', () => {
    expect(getPowerTier(2.5)).toBe('C');
    expect(getPowerTier(3)).toBe('C');
    expect(getPowerTier(4.4)).toBe('C');
  });

  it('returns D tier for scores < 2.5', () => {
    expect(getPowerTier(0)).toBe('D');
    expect(getPowerTier(2)).toBe('D');
    expect(getPowerTier(2.4)).toBe('D');
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
