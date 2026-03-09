import { describe, it, expect } from 'vitest';
import {
  rangesToSlots,
  slotsToRanges,
  type TimeRange,
} from './timeSlotConversion';

describe('rangesToSlots', () => {
  it('converts a single range to the correct slots (exclusive end)', () => {
    const slots = rangesToSlots([{ from: '12:00', to: '13:00' }]);
    expect(slots).toEqual(['12:00', '12:30']);
  });

  it('returns empty for zero-duration range (from === to)', () => {
    const slots = rangesToSlots([{ from: '14:00', to: '14:00' }]);
    expect(slots).toEqual([]);
  });

  it('handles multiple non-overlapping ranges', () => {
    const slots = rangesToSlots([
      { from: '12:00', to: '13:00' },
      { from: '15:00', to: '16:00' },
    ]);
    expect(slots).toEqual(['12:00', '12:30', '15:00', '15:30']);
  });

  it('deduplicates overlapping ranges', () => {
    const slots = rangesToSlots([
      { from: '12:00', to: '14:00' },
      { from: '13:00', to: '15:00' },
    ]);
    expect(slots).toEqual(['12:00', '12:30', '13:00', '13:30', '14:00', '14:30']);
  });

  it('returns empty for invalid slot values', () => {
    const slots = rangesToSlots([{ from: '99:99', to: '12:00' }]);
    expect(slots).toEqual([]);
  });

  it('handles full day range', () => {
    const slots = rangesToSlots([{ from: '00:00', to: '23:30' }]);
    expect(slots).toHaveLength(47); // 00:00 through 23:00, exclusive of 23:30
    expect(slots[0]).toBe('00:00');
    expect(slots[slots.length - 1]).toBe('23:00');
  });

  it('single 30-min slot', () => {
    const slots = rangesToSlots([{ from: '18:00', to: '18:30' }]);
    expect(slots).toEqual(['18:00']);
  });
});

describe('slotsToRanges', () => {
  it('converts contiguous slots into a single range with exclusive end', () => {
    const ranges = slotsToRanges(['12:00', '12:30']);
    expect(ranges).toEqual([{ from: '12:00', to: '13:00' }]);
  });

  it('returns empty for empty input', () => {
    expect(slotsToRanges([])).toEqual([]);
  });

  it('splits non-contiguous slots into multiple ranges', () => {
    const ranges = slotsToRanges(['12:00', '12:30', '15:00', '15:30']);
    expect(ranges).toEqual([
      { from: '12:00', to: '13:00' },
      { from: '15:00', to: '16:00' },
    ]);
  });

  it('handles a single slot', () => {
    const ranges = slotsToRanges(['14:00']);
    expect(ranges).toEqual([{ from: '14:00', to: '14:30' }]);
  });

  it('handles unsorted input', () => {
    const ranges = slotsToRanges(['15:30', '15:00', '12:30', '12:00']);
    expect(ranges).toEqual([
      { from: '12:00', to: '13:00' },
      { from: '15:00', to: '16:00' },
    ]);
  });

  it('handles the last slot (23:30) — to falls back to same slot', () => {
    const ranges = slotsToRanges(['23:00', '23:30']);
    // 23:30 is the last slot (index 47), so to = TIME_SLOTS_30MIN[48] which is undefined
    // fallback: to = TIME_SLOTS_30MIN[47] = '23:30'
    expect(ranges).toEqual([{ from: '23:00', to: '23:30' }]);
  });
});

describe('round-trip: rangesToSlots → slotsToRanges', () => {
  const testCases: { name: string; ranges: TimeRange[] }[] = [
    {
      name: 'single range',
      ranges: [{ from: '12:00', to: '14:00' }],
    },
    {
      name: 'two adjacent ranges',
      ranges: [
        { from: '12:00', to: '13:00' },
        { from: '13:00', to: '14:00' },
      ],
    },
    {
      name: 'two non-adjacent ranges',
      ranges: [
        { from: '12:00', to: '13:00' },
        { from: '15:00', to: '16:00' },
      ],
    },
    {
      name: 'three ranges with gaps',
      ranges: [
        { from: '00:00', to: '01:00' },
        { from: '10:00', to: '12:00' },
        { from: '20:00', to: '22:00' },
      ],
    },
  ];

  testCases.forEach(({ name, ranges }) => {
    it(`round-trips correctly for: ${name}`, () => {
      const slots = rangesToSlots(ranges);
      const reconstructed = slotsToRanges(slots);
      const slotsAgain = rangesToSlots(reconstructed);
      // Slots should be identical after round-trip
      expect(slotsAgain).toEqual(slots);
    });
  });

  it('adjacent ranges merge into one after round-trip', () => {
    const ranges: TimeRange[] = [
      { from: '12:00', to: '13:00' },
      { from: '13:00', to: '14:00' },
    ];
    const slots = rangesToSlots(ranges);
    const reconstructed = slotsToRanges(slots);
    // Adjacent ranges should merge into a single range
    expect(reconstructed).toEqual([{ from: '12:00', to: '14:00' }]);
    // But the covered slots remain identical
    expect(rangesToSlots(reconstructed)).toEqual(slots);
  });
});
