import type { GameEvent, ProjectedWindow } from './eventCalendarTypes';
import { PROJECTION_WEEKS } from './eventCalendarTypes';

/**
 * Project all future occurrences of event windows for the next N weeks.
 * For cyclical events, repeats windows at cadence_weeks intervals.
 * For special events, only shows the anchor occurrence if it falls in range.
 */
export function projectEventWindows(
  events: GameEvent[],
  fromDate: Date = new Date(),
  weeks: number = PROJECTION_WEEKS
): ProjectedWindow[] {
  const results: ProjectedWindow[] = [];
  const rangeEnd = new Date(fromDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

  for (const event of events) {
    if (!event.is_active) continue;

    const anchorStart = new Date(event.anchor_start_at);

    if (event.event_kind === 'special') {
      // Special events: single occurrence
      for (const win of event.windows) {
        const startUtc = new Date(anchorStart.getTime() + win.start_offset_minutes * 60000);
        const endUtc = new Date(anchorStart.getTime() + win.end_offset_minutes * 60000);
        if (endUtc >= fromDate && startUtc <= rangeEnd) {
          results.push({
            windowId: win.id,
            eventId: event.id,
            eventName: event.name,
            eventColor: event.color,
            eventEmoji: event.emoji,
            windowLabel: win.label,
            startUtc,
            endUtc,
            materialIds: win.material_ids,
            occurrenceIndex: 0,
          });
        }
      }
    } else if (event.event_kind === 'cyclical' && event.cadence_weeks) {
      // Cyclical events: project from anchor forward
      const cadenceMs = event.cadence_weeks * 7 * 24 * 60 * 60 * 1000;

      // Find the first occurrence start that could be in range
      let cycleOffset = 0;
      if (anchorStart.getTime() < fromDate.getTime()) {
        // Anchor is in the past — jump forward to the most recent cycle before fromDate
        const diff = fromDate.getTime() - anchorStart.getTime();
        cycleOffset = Math.floor(diff / cadenceMs);
        // Step back one cycle to catch windows that might still be active
        if (cycleOffset > 0) cycleOffset -= 1;
      } else if (anchorStart.getTime() > fromDate.getTime()) {
        // Anchor is in the future — project backward to catch past cycles in range
        const diff = anchorStart.getTime() - fromDate.getTime();
        cycleOffset = -Math.ceil(diff / cadenceMs);
      }

      // Project forward until we exceed rangeEnd
      for (let i = cycleOffset; ; i++) {
        const occurrenceStart = new Date(anchorStart.getTime() + i * cadenceMs);

        // If the occurrence start is beyond the range end, stop
        if (occurrenceStart.getTime() > rangeEnd.getTime()) break;

        for (const win of event.windows) {
          const startUtc = new Date(occurrenceStart.getTime() + win.start_offset_minutes * 60000);
          const endUtc = new Date(occurrenceStart.getTime() + win.end_offset_minutes * 60000);

          if (endUtc >= fromDate && startUtc <= rangeEnd) {
            results.push({
              windowId: win.id,
              eventId: event.id,
              eventName: event.name,
              eventColor: event.color,
              eventEmoji: event.emoji,
              windowLabel: win.label,
              startUtc,
              endUtc,
              materialIds: win.material_ids,
              occurrenceIndex: i,
            });
          }
        }
      }
    }
  }

  // Sort by start time
  results.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  return results;
}

/**
 * Given projected windows and a material ID, find all windows that include that material
 * and group them by day (UTC date string).
 */
export function rankWindowsByMaterial(
  projectedWindows: ProjectedWindow[],
  materialId: string,
  enabledEventIds?: Set<string>
): { date: string; windows: ProjectedWindow[]; overlapCount: number }[] {
  const filtered = projectedWindows.filter(w => {
    if (enabledEventIds && !enabledEventIds.has(w.eventId)) return false;
    return w.materialIds.includes(materialId);
  });

  // Group by UTC date
  const byDate = new Map<string, ProjectedWindow[]>();
  for (const w of filtered) {
    const dateKey = w.startUtc.toISOString().slice(0, 10);
    const existing = byDate.get(dateKey) || [];
    existing.push(w);
    byDate.set(dateKey, existing);
  }

  // Convert to sorted array, ranked by overlap count descending
  const ranked = Array.from(byDate.entries()).map(([date, windows]) => ({
    date,
    windows,
    overlapCount: new Set(windows.map(w => w.eventId)).size,
  }));

  ranked.sort((a, b) => {
    // Primary: more overlapping events first
    if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount;
    // Secondary: sooner date first
    return a.date.localeCompare(b.date);
  });

  return ranked;
}

/**
 * Build a heatmap of material overlap counts per day across a date range.
 */
export function buildMaterialHeatmap(
  projectedWindows: ProjectedWindow[],
  materialId: string,
  days: number,
  fromDate: Date = new Date(),
  enabledEventIds?: Set<string>
): { date: string; count: number }[] {
  const heatmap: { date: string; count: number }[] = [];

  for (let d = 0; d < days; d++) {
    const day = new Date(fromDate.getTime() + d * 24 * 60 * 60 * 1000);
    const dateKey = day.toISOString().slice(0, 10);

    const matchingEvents = new Set<string>();
    for (const w of projectedWindows) {
      if (enabledEventIds && !enabledEventIds.has(w.eventId)) continue;
      if (!w.materialIds.includes(materialId)) continue;

      const wStart = w.startUtc.toISOString().slice(0, 10);
      const wEnd = new Date(w.endUtc.getTime() - 60000).toISOString().slice(0, 10);
      if (dateKey >= wStart && dateKey <= wEnd) {
        matchingEvents.add(w.eventId);
      }
    }

    heatmap.push({ date: dateKey, count: matchingEvents.size });
  }

  return heatmap;
}

/**
 * Get all projected windows active on a specific UTC date.
 */
export function getWindowsForDate(
  projectedWindows: ProjectedWindow[],
  dateKey: string,
  enabledEventIds?: Set<string>
): ProjectedWindow[] {
  return projectedWindows.filter(w => {
    if (enabledEventIds && !enabledEventIds.has(w.eventId)) return false;
    const wStart = w.startUtc.toISOString().slice(0, 10);
    const wEnd = new Date(w.endUtc.getTime() - 60000).toISOString().slice(0, 10);
    return dateKey >= wStart && dateKey <= wEnd;
  });
}
