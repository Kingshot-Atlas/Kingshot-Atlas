// ─── KvK Prep Scheduler — Types & Constants ───────────────────────────

export interface PrepSchedule {
  id: string;
  kingdom_number: number;
  created_by: string;
  prep_manager_id: string | null;
  kvk_number: number | null;
  status: 'active' | 'closed' | 'archived';
  is_locked: boolean;
  monday_buff: string;
  tuesday_buff: string;
  thursday_buff: string;
  notes: string | null;
  deadline: string | null;
  stagger_enabled: boolean;
  disabled_days: string[];
  created_at: string;
}

export interface PrepSubmission {
  id: string;
  schedule_id: string;
  user_id: string;
  username: string;
  alliance_tag: string | null;
  monday_availability: string[][];
  tuesday_availability: string[][];
  thursday_availability: string[][];
  general_speedups: number;
  training_speedups: number;
  construction_speedups: number;
  research_speedups: number;
  general_speedup_target: string | null;
  screenshot_url: string | null;
  skip_monday: boolean;
  skip_tuesday: boolean;
  skip_thursday: boolean;
  general_speedup_allocation: { construction: number; training: number; research: number } | null;
  speedup_changed_at: string | null;
  previous_speedups: { general: number; training: number; construction: number; research: number; changed_at: string } | null;
  created_at: string;
}

export interface ChangeRequest {
  id: string;
  schedule_id: string;
  submission_id: string;
  user_id: string;
  request_type: 'cant_attend' | 'change_slot' | 'other';
  day: Day | null;
  message: string | null;
  status: 'pending' | 'acknowledged' | 'resolved';
  created_at: string;
}

export interface SlotAssignment {
  id: string;
  schedule_id: string;
  submission_id: string;
  day: 'monday' | 'tuesday' | 'thursday';
  slot_time: string;
  assigned_by: string | null;
}

export interface EditorRecord {
  user_id: string;
  role: string;
  status: string;
  kingdom_number: number;
}

export interface ManagerEntry {
  id: string;
  user_id: string;
  username: string;
}

export interface ManagerSearchResult {
  id: string;
  linked_username: string;
  username: string;
  linked_player_id: string | null;
}

export interface PendingConfirm {
  message: string;
  onConfirm: () => void;
}

export type SchedulerView = 'landing' | 'form' | 'manage' | 'gate';
export type Day = 'monday' | 'tuesday' | 'thursday';

export const DAYS: Day[] = ['monday', 'tuesday', 'thursday'];
export const DAY_LABELS: Record<Day, string> = { monday: 'Monday', tuesday: 'Tuesday', thursday: 'Thursday' };
export const DAY_BUFF_LABELS: Record<string, string> = {
  construction: '🏗️ Construction', research: '🔬 Research', training: '⚔️ Soldier Training',
};
export const DAY_COLORS: Record<Day, string> = { monday: '#f97316', tuesday: '#3b82f6', thursday: '#a855f7' };

// i18n-aware label helpers (use these for UI rendering)
// The `t` parameter is the i18next translation function
export function getDayLabel(day: Day, t: (key: string, fallback: string) => string): string {
  const keys: Record<Day, string> = {
    monday: 'prepScheduler.dayMonday',
    tuesday: 'prepScheduler.dayTuesday',
    thursday: 'prepScheduler.dayThursday',
  };
  return t(keys[day], DAY_LABELS[day]);
}

const DAY_LABELS_SHORT: Record<Day, string> = { monday: 'Mon', tuesday: 'Tue', thursday: 'Thu' };
export function getDayLabelShort(day: Day, t: (key: string, fallback: string) => string): string {
  const keys: Record<Day, string> = {
    monday: 'prepScheduler.dayMondayShort',
    tuesday: 'prepScheduler.dayTuesdayShort',
    thursday: 'prepScheduler.dayThursdayShort',
  };
  return t(keys[day], DAY_LABELS_SHORT[day]);
}

export function getBuffLabel(buff: string, t: (key: string, fallback: string) => string): string {
  const keys: Record<string, string> = {
    construction: 'prepScheduler.buffConstruction',
    research: 'prepScheduler.buffResearch',
    training: 'prepScheduler.buffTraining',
  };
  return t(keys[buff] || buff, DAY_BUFF_LABELS[buff] || buff);
}

// Generate 30-min time slots (00:00 to 23:30 UTC)
export const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

// Stagger slots: 30-min intervals on :15/:45 grid starting at 23:45 UTC
// Pattern: 23:45 A, 00:15, 00:45, ..., 23:15, 23:45 B (49 slots)
// A = previous day's 23:45, B = current day's 23:45 (distinct keys)
export const STAGGER_SLOTS: string[] = [];
{
  let minutes = 23 * 60 + 45; // Start at 23:45
  for (let i = 0; i < 49; i++) {
    const wrapped = minutes % 1440;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    let label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (i === 0) label += ' A';
    else if (i === 48) label += ' B';
    STAGGER_SLOTS.push(label);
    minutes += 30;
  }
}

export function getEffectiveSlots(staggerEnabled: boolean): string[] {
  if (!staggerEnabled) return TIME_SLOTS;
  return STAGGER_SLOTS;
}

export function getMaxSlots(staggerEnabled: boolean): number {
  return staggerEnabled ? 49 : 48;
}

// Timezone Helpers
export const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const UTC_OFFSET_HOURS = -(new Date().getTimezoneOffset() / 60);
export const TZ_ABBR = (() => {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || USER_TZ.split('/').pop()?.replace(/_/g, ' ') || USER_TZ;
  } catch { return USER_TZ.split('/').pop()?.replace(/_/g, ' ') || USER_TZ; }
})();
