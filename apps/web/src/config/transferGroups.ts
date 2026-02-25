/**
 * Transfer Groups Configuration
 * ==============================
 * During each Transfer Event, kingdoms are grouped into Transfer Groups.
 * Players can only transfer to kingdoms within their current group.
 *
 * HOW TO UPDATE:
 * 1. Update TRANSFER_GROUPS with new ranges when announced (usually a few days before the event)
 * 2. Set TRANSFER_GROUPS_UPDATED_AT to the current date
 * 3. The "outdated" disclaimer will automatically disappear once the date is recent
 *
 * The groups change every event — the amount of groups and ranges can both change.
 * Kingdoms not listed in any group are not eligible for transfers yet.
 */

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

/**
 * Current transfer groups — update with each new Transfer Event.
 * Each entry is [minKingdom, maxKingdom].
 * Last updated for: Transfer Event #4 (February 2026)
 */
export const TRANSFER_GROUPS: Array<[number, number]> = [
  [1, 25],
  [26, 175],
  [176, 417],
  [418, 758],
  [759, 927],
  [928, 1007],
  [1008, 1159],
];

/**
 * When the groups above were last updated (ISO date string).
 * Used to determine if the "groups may change" disclaimer should show.
 */
export const TRANSFER_GROUPS_UPDATED_AT = '2026-02-25';

/**
 * Transfer events happen every 8 weeks.
 * Reference: Transfer Event #3 started Sunday, January 4, 2026 at 00:00 UTC.
 * Next event ~= March 1, 2026.
 * Groups are usually announced 3-5 days before the event.
 *
 * If more than ~7 weeks have passed since the last update, the disclaimer shows.
 */
const TRANSFER_CYCLE_DAYS = 56; // 8 weeks
const DISCLAIMER_BUFFER_DAYS = 7; // Show disclaimer 7 days before expected new groups

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Returns true if the current transfer groups are likely outdated
 * (i.e., we're approaching or past the next Transfer Event without an update).
 */
export const areTransferGroupsOutdated = (): boolean => {
  const updatedAt = new Date(TRANSFER_GROUPS_UPDATED_AT).getTime();
  const now = Date.now();
  const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);
  return daysSinceUpdate >= (TRANSFER_CYCLE_DAYS - DISCLAIMER_BUFFER_DAYS);
};

/**
 * Find which transfer group a kingdom belongs to.
 * Returns the [min, max] tuple or null if not in any group.
 */
export const getTransferGroup = (kingdomNumber: number): [number, number] | null => {
  return TRANSFER_GROUPS.find(([min, max]) => kingdomNumber >= min && kingdomNumber <= max) || null;
};

/**
 * Get a human-readable label for a transfer group.
 * e.g., "K1–K6" or "K7–K115"
 */
export const getTransferGroupLabel = (group: [number, number]): string => {
  if (group[1] >= 99999) return `K${group[0]}+`;
  return `K${group[0]}\u2013K${group[1]}`;
};

/**
 * Get all transfer group labels for use in filter dropdowns.
 */
export const getTransferGroupOptions = (): Array<{ label: string; value: string; range: [number, number] }> => {
  return TRANSFER_GROUPS.map((range) => ({
    label: getTransferGroupLabel(range),
    value: `${range[0]}-${range[1]}`,
    range,
  }));
};

/**
 * Parse a transfer group value string ("min-max") back to a range tuple.
 */
export const parseTransferGroupValue = (value: string): [number, number] | null => {
  if (!value || value === 'all') return null;
  const parts = value.split('-');
  const min = parseInt(parts[0] || '', 10);
  const max = parseInt(parts[1] || '', 10);
  if (isNaN(min) || isNaN(max)) return null;
  return [min, max];
};

/**
 * Filter kingdoms by a transfer group range.
 */
export const filterByTransferGroup = <T extends { kingdom_number: number }>(
  items: T[],
  groupValue: string
): T[] => {
  const range = parseTransferGroupValue(groupValue);
  if (!range) return items;
  const [min, max] = range;
  return items.filter(item => item.kingdom_number >= min && item.kingdom_number <= max);
};

/**
 * The highest kingdom number covered by any transfer group.
 * Kingdoms above this are not yet eligible for transfers.
 */
export const MAX_TRANSFER_KINGDOM = TRANSFER_GROUPS.length > 0
  ? Math.max(...TRANSFER_GROUPS.filter(([, max]) => max < 99999).map(([, max]) => max))
  : 0;
