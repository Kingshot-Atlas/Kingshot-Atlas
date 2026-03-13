// Event Calendar data types — Supabase-backed event calendar system

export interface EventMaterial {
  id: string;
  name: string;
  emoji: string;
  category: string;
  sort_order: number;
  is_active: boolean;
}

export interface GameEvent {
  id: string;
  name: string;
  event_kind: 'cyclical' | 'special';
  cadence_weeks: number | null;
  anchor_start_at: string; // ISO timestamp
  anchor_end_at: string;
  color: string;
  emoji: string;
  is_active: boolean;
  notes: string | null;
  windows: GameEventWindow[];
}

export interface GameEventWindow {
  id: string;
  event_id: string;
  label: string;
  start_offset_minutes: number;
  end_offset_minutes: number;
  display_order: number;
  material_ids: string[];
}

/** A projected occurrence of a window in absolute time */
export interface ProjectedWindow {
  windowId: string;
  eventId: string;
  eventName: string;
  eventColor: string;
  eventEmoji: string;
  windowLabel: string;
  startUtc: Date;
  endUtc: Date;
  materialIds: string[];
  occurrenceIndex: number; // which cycle this belongs to
}

/** A ranked opportunity for a given material */
export interface MaterialOpportunity {
  date: Date;
  dayLabel: string;
  windows: ProjectedWindow[];
  overlapCount: number; // how many events overlap for this material on this window
}

/** localStorage toggle state */
export interface EventToggles {
  [eventId: string]: boolean; // false = disabled by user
}

export const EVENT_TOGGLES_KEY = 'atlas_event_calendar_toggles';

export const PROJECTION_WEEKS = 12;
