import {
  calculateStreaks,
  calculateOutcomeStats,
  calculateWinRates,
  getTierDescription,
  formatPercent,
  getWinRateColor,
  countActiveFilters,
  isDefaultFilters,
  DEFAULT_FILTERS,
} from './kingdomStats';
import { KVKRecord } from '../types';

describe('calculateStreaks', () => {
  it('returns zeros for empty array', () => {
    const result = calculateStreaks([]);
    expect(result.prepWinStreak).toBe(0);
    expect(result.battleWinStreak).toBe(0);
    expect(result.prepLossStreak).toBe(0);
    expect(result.battleLossStreak).toBe(0);
  });

  it('calculates win streaks correctly', () => {
    const records: KVKRecord[] = [
      { id: 1, kingdom_number: 1, kvk_number: 3, opponent_kingdom: 2, prep_result: 'win', battle_result: 'win', overall_result: 'W', date_or_order_index: '3', created_at: '3' },
      { id: 2, kingdom_number: 1, kvk_number: 2, opponent_kingdom: 3, prep_result: 'win', battle_result: 'win', overall_result: 'W', date_or_order_index: '2', created_at: '2' },
      { id: 3, kingdom_number: 1, kvk_number: 1, opponent_kingdom: 4, prep_result: 'loss', battle_result: 'win', overall_result: 'L', date_or_order_index: '1', created_at: '1' },
    ];
    const result = calculateStreaks(records);
    expect(result.prepWinStreak).toBe(2);
    expect(result.battleWinStreak).toBe(3);
  });

  it('calculates current streaks from most recent', () => {
    const records: KVKRecord[] = [
      { id: 1, kingdom_number: 1, kvk_number: 3, opponent_kingdom: 2, prep_result: 'win', battle_result: 'loss', overall_result: 'L', date_or_order_index: '3', created_at: '3' },
      { id: 2, kingdom_number: 1, kvk_number: 2, opponent_kingdom: 3, prep_result: 'win', battle_result: 'loss', overall_result: 'L', date_or_order_index: '2', created_at: '2' },
      { id: 3, kingdom_number: 1, kvk_number: 1, opponent_kingdom: 4, prep_result: 'loss', battle_result: 'win', overall_result: 'W', date_or_order_index: '1', created_at: '1' },
    ];
    const result = calculateStreaks(records);
    expect(result.currentPrepStreak.type).toBe('win');
    expect(result.currentPrepStreak.count).toBe(2);
    expect(result.currentBattleStreak.type).toBe('loss');
    expect(result.currentBattleStreak.count).toBe(2);
  });
});

describe('calculateOutcomeStats', () => {
  it('returns zeros for empty array', () => {
    const result = calculateOutcomeStats([]);
    expect(result.dominations).toBe(0);
    expect(result.defeats).toBe(0);
    expect(result.comebacks).toBe(0);
    expect(result.reversals).toBe(0);
  });

  it('counts dominations (win both)', () => {
    const records: KVKRecord[] = [
      { id: 1, kingdom_number: 1, kvk_number: 1, opponent_kingdom: 2, prep_result: 'win', battle_result: 'win', overall_result: 'W', date_or_order_index: '1', created_at: '1' },
    ];
    const result = calculateOutcomeStats(records);
    expect(result.dominations).toBe(1);
  });

  it('counts defeats (lose both)', () => {
    const records: KVKRecord[] = [
      { id: 1, kingdom_number: 1, kvk_number: 1, opponent_kingdom: 2, prep_result: 'loss', battle_result: 'loss', overall_result: 'L', date_or_order_index: '1', created_at: '1' },
    ];
    const result = calculateOutcomeStats(records);
    expect(result.defeats).toBe(1);
  });

  it('counts comebacks (lose prep, win battle)', () => {
    const records: KVKRecord[] = [
      { id: 1, kingdom_number: 1, kvk_number: 1, opponent_kingdom: 2, prep_result: 'loss', battle_result: 'win', overall_result: 'W', date_or_order_index: '1', created_at: '1' },
    ];
    const result = calculateOutcomeStats(records);
    expect(result.comebacks).toBe(1);
  });

  it('counts reversals (win prep, lose battle)', () => {
    const records: KVKRecord[] = [
      { id: 1, kingdom_number: 1, kvk_number: 1, opponent_kingdom: 2, prep_result: 'win', battle_result: 'loss', overall_result: 'L', date_or_order_index: '1', created_at: '1' },
    ];
    const result = calculateOutcomeStats(records);
    expect(result.reversals).toBe(1);
  });
});

describe('calculateWinRates', () => {
  it('returns zeros for empty array', () => {
    const result = calculateWinRates([]);
    expect(result.prepWinRate).toBe(0);
    expect(result.battleWinRate).toBe(0);
  });

  it('calculates correct win rates', () => {
    const records: KVKRecord[] = [
      { id: 1, kingdom_number: 1, kvk_number: 1, opponent_kingdom: 2, prep_result: 'win', battle_result: 'win', overall_result: 'W', date_or_order_index: '1', created_at: '1' },
      { id: 2, kingdom_number: 1, kvk_number: 2, opponent_kingdom: 3, prep_result: 'win', battle_result: 'loss', overall_result: 'L', date_or_order_index: '2', created_at: '2' },
      { id: 3, kingdom_number: 1, kvk_number: 3, opponent_kingdom: 4, prep_result: 'loss', battle_result: 'win', overall_result: 'W', date_or_order_index: '3', created_at: '3' },
      { id: 4, kingdom_number: 1, kvk_number: 4, opponent_kingdom: 5, prep_result: 'loss', battle_result: 'loss', overall_result: 'L', date_or_order_index: '4', created_at: '4' },
    ];
    const result = calculateWinRates(records);
    expect(result.prepWinRate).toBe(0.5); // 2/4
    expect(result.battleWinRate).toBe(0.5); // 2/4
    expect(result.prepWins).toBe(2);
    expect(result.prepLosses).toBe(2);
    expect(result.battleWins).toBe(2);
    expect(result.battleLosses).toBe(2);
  });
});

describe('getTierDescription', () => {
  it('returns correct descriptions for each tier', () => {
    expect(getTierDescription('S')).toContain('Elite');
    expect(getTierDescription('A')).toContain('Strong');
    expect(getTierDescription('B')).toContain('Developing');
    expect(getTierDescription('C')).toContain('Newer');
    expect(getTierDescription('X')).toContain('tier');
  });
});

describe('formatPercent', () => {
  it('formats percentages correctly', () => {
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(0.755, 1)).toBe('75.5%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('getWinRateColor', () => {
  it('returns green for high win rates', () => {
    expect(getWinRateColor(0.8)).toBe('#22c55e');
    expect(getWinRateColor(1)).toBe('#22c55e');
  });

  it('returns yellow for medium win rates', () => {
    expect(getWinRateColor(0.6)).toBe('#eab308');
    expect(getWinRateColor(0.79)).toBe('#eab308');
  });

  it('returns orange for low-medium win rates', () => {
    expect(getWinRateColor(0.4)).toBe('#f97316');
    expect(getWinRateColor(0.59)).toBe('#f97316');
  });

  it('returns red for low win rates', () => {
    expect(getWinRateColor(0.39)).toBe('#ef4444');
    expect(getWinRateColor(0)).toBe('#ef4444');
  });
});

describe('countActiveFilters', () => {
  it('returns 0 for default filters', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });

  it('counts active filters correctly', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, tier: 'S' })).toBe(1);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, minKvKs: 5, minPrepWinRate: 0.5 })).toBe(2);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, status: 'Leading', tier: 'A', minBattleWinRate: 0.8 })).toBe(3);
  });
});

describe('isDefaultFilters', () => {
  it('returns true for default filters', () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
  });

  it('returns false when any filter is active', () => {
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, tier: 'S' })).toBe(false);
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, minKvKs: 1 })).toBe(false);
  });
});
