// Shared time slot conversion utilities
// Extracted from AllianceEventCoordinator for testability and reuse

// 30-minute slots covering the full day (00:00 to 23:30)
export const TIME_SLOTS_30MIN: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = (i % 2 === 0) ? '00' : '30';
  return `${h}:${m}`;
});

export interface TimeRange {
  from: string;
  to: string;
}

/**
 * Convert time ranges → individual 30-min slots.
 * "to" is an exclusive boundary: 12:00→13:00 covers [12:00, 12:30].
 */
export function rangesToSlots(ranges: TimeRange[]): string[] {
  const result = new Set<string>();
  for (const r of ranges) {
    const fi = TIME_SLOTS_30MIN.indexOf(r.from);
    const ti = TIME_SLOTS_30MIN.indexOf(r.to);
    if (fi < 0 || ti < 0) continue;
    for (let i = fi; i < ti; i++) {
      const s = TIME_SLOTS_30MIN[i];
      if (s) result.add(s);
    }
  }
  return [...result].sort();
}

/**
 * Convert individual 30-min slots → merged time ranges.
 * "to" is set to the next slot AFTER the last included slot (exclusive end).
 */
export function slotsToRanges(slots: string[]): TimeRange[] {
  if (slots.length === 0) return [];
  const indices = slots.map(s => TIME_SLOTS_30MIN.indexOf(s)).filter(i => i >= 0).sort((a, b) => a - b);
  if (indices.length === 0) return [];
  const ranges: TimeRange[] = [];
  let start = indices[0]!;
  let end = indices[0]!;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === end + 1) {
      end = indices[i]!;
    } else {
      ranges.push({ from: TIME_SLOTS_30MIN[start]!, to: TIME_SLOTS_30MIN[end + 1] ?? TIME_SLOTS_30MIN[end]! });
      start = indices[i]!;
      end = indices[i]!;
    }
  }
  ranges.push({ from: TIME_SLOTS_30MIN[start]!, to: TIME_SLOTS_30MIN[end + 1] ?? TIME_SLOTS_30MIN[end]! });
  return ranges;
}
