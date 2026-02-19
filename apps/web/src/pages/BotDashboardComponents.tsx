import React, { useState, useEffect, useMemo, useRef } from 'react';
import { colors } from '../utils/styles';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GuildSettings {
  id: string;
  guild_id: string;
  guild_name: string;
  guild_icon_url: string | null;
  reminder_channel_id: string | null;
  gift_code_alerts: boolean;
  gift_code_channel_id: string | null;
  gift_code_custom_message: string | null;
  gift_code_role_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AllianceEvent {
  id: string;
  guild_id: string;
  event_type: EventType;
  enabled: boolean;
  time_slots: TimeSlot[];
  reminder_minutes_before: number;
  channel_id: string | null;
  role_id: string | null;
  custom_message: string | null;
  reference_date: string | null;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuildAdmin {
  id: string;
  guild_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'blocked';
  created_at: string;
  username?: string;
}

export interface EventHistoryRow {
  id: string;
  guild_id: string;
  event_type: string;
  sent_at: string;
  channel_id: string | null;
  status: 'sent' | 'failed' | 'skipped';
  error_message: string | null;
  reminder_minutes_before: number | null;
  time_slot: TimeSlot | null;
}

export type EventType = 'bear_hunt' | 'viking_vengeance' | 'swordland_showdown' | 'tri_alliance_clash' | 'arena';
export interface TimeSlot { hour: number; minute: number; day?: number; }
export type DashTab = 'notifications' | 'servers' | 'access' | 'history';

// ─── Constants ──────────────────────────────────────────────────────────────

export const EVENT_ORDER: EventType[] = ['arena', 'bear_hunt', 'viking_vengeance', 'swordland_showdown', 'tri_alliance_clash'];

export const EVENT_META: Record<EventType, { label: string; icon: string; color: string; tag: string; maxSlots: number; defaultMessage: string }> = {
  bear_hunt:          { label: 'Bear Hunt',          icon: '🐻', color: '#f59e0b', tag: 'Every 2 days',  maxSlots: 4, defaultMessage: 'Rally your alliance and hunt together!' },
  viking_vengeance:   { label: 'Viking Vengeance',   icon: '🪓', color: '#ef4444', tag: 'Tuesday & Thursday, every 2 weeks', maxSlots: 2, defaultMessage: 'Time to fight for glory!' },
  swordland_showdown: { label: 'Swordland Showdown', icon: '⚔️',  color: '#a855f7', tag: 'Sunday, every 2 weeks', maxSlots: 2, defaultMessage: 'Ready your blades and fight for dominance!' },
  tri_alliance_clash: { label: 'Tri-Alliance Clash', icon: '🛡️',  color: '#3b82f6', tag: 'Saturday, every 4 weeks',    maxSlots: 2, defaultMessage: 'Coordinate with your allies!' },
  arena:              { label: 'Arena',               icon: '🏟️', color: '#22d3ee', tag: 'Daily, before midnight reset', maxSlots: 1, defaultMessage: 'Use all your attempts before reset!' },
};

const FIXED_EVENT_TIMES: TimeSlot[] = [
  { hour: 2, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 21, minute: 0 },
];

export const DEFAULT_GIFT_CODE_MESSAGE = 'A new gift code has been released! Redeem it before it expires.';

export const getFixSteps = (error: string): string[] => {
  if (error.includes('Missing Access') || error.includes('50001'))
    return ['Ensure Atlas Bot has access to the channel', 'Channel Settings → Permissions → Atlas Bot → Send Messages ✅', 'Also enable Embed Links permission'];
  if (error.includes('Unknown Channel') || error.includes('10003'))
    return ['The channel may have been deleted or is invalid', 'Select a different channel from the dropdown'];
  if (error.includes('Missing Permissions') || error.includes('50013'))
    return ['Atlas Bot needs Send Messages + Embed Links in this channel', 'Go to Channel Settings → Permissions → Atlas Bot', 'Enable: Send Messages, Embed Links'];
  if (error.includes('not configured') || error.includes('503'))
    return ['The bot may be offline or restarting', 'Wait a few minutes and try again'];
  return ['Check that Atlas Bot is in your server', 'Verify bot permissions in the channel', 'Try again in a few minutes'];
};

export const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120];
export const ARENA_REMINDER_PRESETS = [3, 5, 10, 15];

// Fixed reference dates for non-Bear-Hunt events (known game schedule)
export const FIXED_REFERENCE_DATES: Partial<Record<EventType, string>> = {
  viking_vengeance: '2026-02-24T00:00:00Z',
  swordland_showdown: '2026-02-22T00:00:00Z',
  tri_alliance_clash: '2026-02-21T00:00:00Z',
};

// ─── Discord Data Types ────────────────────────────────────────────────────

export interface DiscordChannel { id: string; name: string; type: number; position: number; parent_id: string | null; }
export interface DiscordRole { id: string; name: string; color: number; position: number; }
export interface DiscordCategory { id: string; name: string; position: number; }

// ─── Helpers ────────────────────────────────────────────────────────────────

export const fmt = (s: TimeSlot) => `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
export const fmtLocal = (s: TimeSlot) => { const d = new Date(); d.setUTCHours(s.hour, s.minute, 0, 0); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

export const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime())/60000); return d < 1 ? 'just now' : d < 60 ? `${d}m ago` : d < 1440 ? `${Math.floor(d/60)}h ago` : `${Math.floor(d/1440)}d ago`; };

/** Helper: get UTC midnight for today */
export function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Compute next N event dates from reference_date for a given event type (all UTC) */
export function getNextEventDates(eventType: EventType, referenceDate: string | null, count: number = 5): Date[] {
  if (!referenceDate) return [];
  const ref = new Date(referenceDate);
  ref.setUTCHours(0, 0, 0, 0);
  const today = todayUTC();
  const dates: Date[] = [];

  if (eventType === 'bear_hunt') {
    // Every 2 days from reference (ref date itself is an event day)
    const diffDays = Math.floor((today.getTime() - ref.getTime()) / 86400000);
    const cycleStart = diffDays >= 0 ? diffDays - (diffDays % 2) : 0;
    for (let i = 0; dates.length < count; i++) {
      const d = new Date(ref);
      d.setUTCDate(d.getUTCDate() + cycleStart + i * 2);
      if (d >= today) dates.push(d);
      if (i > 365) break;
    }
  } else if (eventType === 'viking_vengeance') {
    // Tuesday(2) & Thursday(4), every 2 weeks from reference
    const refWeekStart = new Date(ref);
    refWeekStart.setUTCDate(refWeekStart.getUTCDate() - refWeekStart.getUTCDay());
    const diffWeeks = Math.floor((today.getTime() - refWeekStart.getTime()) / (7 * 86400000));
    const cycleWeek = diffWeeks >= 0 ? diffWeeks - (diffWeeks % 2) : 0;
    for (let w = cycleWeek; dates.length < count; w += 2) {
      for (const dayOff of [2, 4]) { // Tue, Thu
        const d = new Date(refWeekStart);
        d.setUTCDate(d.getUTCDate() + w * 7 + dayOff);
        if (d >= today) dates.push(d);
      }
      if (w > 200) break;
    }
    dates.sort((a, b) => a.getTime() - b.getTime());
    dates.splice(count);
  } else if (eventType === 'swordland_showdown') {
    // Sunday(0), every 2 weeks from reference
    const refSunday = new Date(ref);
    refSunday.setUTCDate(refSunday.getUTCDate() - refSunday.getUTCDay());
    const diffWeeks = Math.floor((today.getTime() - refSunday.getTime()) / (7 * 86400000));
    const cycleWeek = diffWeeks >= 0 ? diffWeeks - (diffWeeks % 2) : 0;
    for (let w = cycleWeek; dates.length < count; w += 2) {
      const d = new Date(refSunday);
      d.setUTCDate(d.getUTCDate() + w * 7);
      if (d >= today) dates.push(d);
      if (w > 200) break;
    }
  } else if (eventType === 'tri_alliance_clash') {
    // Saturday(6), every 4 weeks from reference
    const refSat = new Date(ref);
    refSat.setUTCDate(refSat.getUTCDate() - ((refSat.getUTCDay() + 1) % 7));
    const diffWeeks = Math.floor((today.getTime() - refSat.getTime()) / (7 * 86400000));
    const cycleWeek = diffWeeks >= 0 ? diffWeeks - (diffWeeks % 4) : 0;
    for (let w = cycleWeek; dates.length < count; w += 4) {
      const d = new Date(refSat);
      d.setUTCDate(d.getUTCDate() + w * 7);
      if (d >= today) dates.push(d);
      if (w > 200) break;
    }
  } else if (eventType === 'arena') {
    // Daily — next N days starting from today
    for (let i = 0; dates.length < count && i < 365; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d);
    }
  }
  return dates;
}

export const fmtDate = (d: Date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

/** Compute the next fire timestamp from event dates + time slots */
export function getNextFireTime(nextDates: Date[], timeSlots: TimeSlot[], eventType: EventType): Date | null {
  if (nextDates.length === 0 || timeSlots.length === 0) return null;
  const now = new Date();
  for (const date of nextDates) {
    const dayOfWeek = date.getUTCDay();
    const slots = eventType === 'viking_vengeance'
      ? timeSlots.filter(s => s.day === dayOfWeek)
      : timeSlots;
    const sorted = [...slots].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    for (const slot of sorted) {
      const fire = new Date(date);
      fire.setUTCHours(slot.hour, slot.minute, 0, 0);
      if (fire > now) return fire;
    }
  }
  return null;
}

/** Format a countdown in ms to human-readable */
export function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const iS: React.CSSProperties = { width: '100%', maxWidth: '300px', backgroundColor: '#1a1a1a', border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text, padding: '0.5rem 0.7rem', fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' as const };
export const lS: React.CSSProperties = { color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block' as const, marginBottom: '0.35rem' };

// ─── Sub-Components ─────────────────────────────────────────────────────────

export const Dot: React.FC<{ on: boolean }> = ({ on }) => (
  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: on ? colors.success : colors.textMuted, boxShadow: on ? `0 0 6px ${colors.success}` : 'none', flexShrink: 0 }} />
);

export const Tog: React.FC<{ on: boolean; set: (v: boolean) => void; c?: string }> = ({ on, set, c = colors.primary }) => (
  <button onClick={() => set(!on)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', backgroundColor: on ? c : '#333', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}>
    <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s' }} />
  </button>
);

const TimeChip: React.FC<{ s: TimeSlot; color: string; local: boolean; onRemove: () => void; dayLabel?: string }> = ({ s, color, local, onRemove, dayLabel }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', backgroundColor: `${color}15`, border: `1px solid ${color}40`, borderRadius: 6, fontSize: '0.85rem', fontFamily: "'JetBrains Mono', monospace", color, fontWeight: 600 }}>
    {dayLabel && <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>{dayLabel}</span>}
    {fmt(s)} UTC{local && <span style={{ color: colors.textMuted, fontSize: '0.7rem', fontWeight: 400 }}> ({fmtLocal(s)})</span>}
    <button onClick={onRemove} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px', lineHeight: 1 }}>✕</button>
  </div>
);

const TimeInput24h: React.FC<{ onAdd: (s: TimeSlot) => void; disabled?: boolean; color: string }> = ({ onAdd, disabled, color }) => {
  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const valid = h !== '' && m !== '' && !isNaN(+h) && !isNaN(+m) && +h >= 0 && +h <= 23 && +m >= 0 && +m <= 59;
  const add = () => { if (valid) { onAdd({ hour: parseInt(h), minute: parseInt(m) }); setH(''); setM(''); } };
  return (
    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
      <input type="number" min={0} max={23} placeholder="HH" value={h} onChange={e => setH(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }}
        style={{ ...iS, width: 50, maxWidth: 50, textAlign: 'center', fontSize: '0.8rem', padding: '0.35rem 0.2rem' }} />
      <span style={{ color: colors.textMuted, fontWeight: 700 }}>:</span>
      <input type="number" min={0} max={59} placeholder="MM" value={m} onChange={e => setM(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }}
        style={{ ...iS, width: 50, maxWidth: 50, textAlign: 'center', fontSize: '0.8rem', padding: '0.35rem 0.2rem' }} />
      <button onClick={add} disabled={!valid || disabled} style={{ padding: '0.35rem 0.7rem', backgroundColor: valid && !disabled ? color : colors.border, border: 'none', borderRadius: 6, color: valid && !disabled ? '#fff' : colors.textMuted, fontSize: '0.75rem', fontWeight: 600, cursor: valid && !disabled ? 'pointer' : 'default' }}>+ Add</button>
      <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>UTC</span>
    </div>
  );
};

const SlotEditor: React.FC<{ slots: TimeSlot[]; max: number; onChange: (s: TimeSlot[]) => void; color: string; local: boolean }> = ({ slots, max, onChange, color, local }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
      {slots.map((s, i) => <TimeChip key={i} s={s} color={color} local={local} onRemove={() => onChange(slots.filter((_, j) => j !== i))} />)}
    </div>
    {slots.length < max && (
      <TimeInput24h onAdd={p => { if (!slots.some(s => s.hour === p.hour && s.minute === p.minute)) onChange([...slots, p].sort((a, b) => a.hour*60+a.minute-(b.hour*60+b.minute))); }} color={color} />
    )}
  </div>
);

const VikingSlotEditor: React.FC<{ slots: TimeSlot[]; onChange: (s: TimeSlot[]) => void; color: string; local: boolean }> = ({ slots, onChange, color, local }) => {
  const tueSlot = slots.find(s => s.day === 2);
  const thuSlot = slots.find(s => s.day === 4);
  const setDay = (day: number, slot: TimeSlot | null) => {
    const others = slots.filter(s => s.day !== day);
    if (slot) onChange([...others, { ...slot, day }].sort((a, b) => (a.day || 0) - (b.day || 0)));
    else onChange(others);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {[{ day: 2, label: 'Tuesday', slot: tueSlot }, { day: 4, label: 'Thursday', slot: thuSlot }].map(({ day, label, slot }) => (
        <div key={day}>
          <div style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.25rem' }}>{label}</div>
          {slot ? (
            <TimeChip s={slot} color={color} local={local} onRemove={() => setDay(day, null)} />
          ) : (
            <TimeInput24h onAdd={s => setDay(day, s)} color={color} />
          )}
        </div>
      ))}
    </div>
  );
};

const FixedSlotSelector: React.FC<{ slots: TimeSlot[]; max: number; onChange: (s: TimeSlot[]) => void; color: string; local: boolean }> = ({ slots, max, onChange, color, local }) => {
  const available = FIXED_EVENT_TIMES.filter(ft => !slots.some(s => s.hour === ft.hour && s.minute === ft.minute));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {slots.map((s, i) => <TimeChip key={i} s={s} color={color} local={local} onRemove={() => onChange(slots.filter((_, j) => j !== i))} />)}
      </div>
      {slots.length < max && available.length > 0 && (
        <select value="" onChange={e => { const parts = e.target.value.split(':'); const h = Number(parts[0]), mi = Number(parts[1]); if (!isNaN(h) && !isNaN(mi)) onChange([...slots, { hour: h, minute: mi }].sort((a, b) => a.hour*60+a.minute-(b.hour*60+b.minute))); }}
          style={{ ...iS, width: 160, maxWidth: 160, cursor: 'pointer' }}>
          <option value="">+ Add time slot</option>
          {available.map(t => <option key={`${t.hour}:${t.minute}`} value={`${t.hour}:${t.minute}`}>{fmt(t)} UTC</option>)}
        </select>
      )}
    </div>
  );
};

export const SearchableSelect: React.FC<{
  value: string | null;
  onChange: (v: string | null) => void;
  options: { id: string; name: string; color?: number; category?: string }[];
  placeholder: string;
  loading?: boolean;
  accentColor?: string;
}> = ({ value, onChange, options, placeholder, loading, accentColor = colors.primary }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.name.toLowerCase().includes(q.toLowerCase()));
  const selected = options.find(o => o.id === value);

  return (
    <div ref={ref} style={{ position: 'relative', maxWidth: 300 }}>
      <button onClick={() => setOpen(!open)} style={{ ...iS, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', width: '100%', maxWidth: '100%', textAlign: 'left' }}>
        <span style={{ color: selected ? colors.text : colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {loading ? 'Loading...' : selected ? (selected.category ? `#${selected.name}` : selected.name) : placeholder}
        </span>
        {value && <span onClick={e => { e.stopPropagation(); onChange(null); }} style={{ color: colors.textMuted, marginLeft: 4, fontSize: '0.7rem', cursor: 'pointer' }}>✕</span>}
        <span style={{ color: colors.textMuted, fontSize: '0.6rem', marginLeft: 4 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, backgroundColor: '#1a1a1a', border: `1px solid ${colors.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', maxHeight: 220, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.4rem' }}>
            <input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." style={{ ...iS, width: '100%', maxWidth: '100%', fontSize: '0.75rem', padding: '0.35rem 0.5rem', borderColor: accentColor + '40' }} />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 170, padding: '0 0.25rem 0.25rem' }}>
            {filtered.length === 0 && <div style={{ padding: '0.5rem', color: colors.textMuted, fontSize: '0.75rem', textAlign: 'center' }}>{loading ? 'Loading...' : 'No results'}</div>}
            {filtered.map(o => (
              <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); setQ(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', padding: '0.35rem 0.5rem', border: 'none', borderRadius: 4, backgroundColor: o.id === value ? `${accentColor}15` : 'transparent', color: o.id === value ? accentColor : colors.text, fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left' }}>
                {o.color !== undefined && o.color > 0 && <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: `#${o.color.toString(16).padStart(6, '0')}`, flexShrink: 0 }} />}
                {o.category !== undefined && <span style={{ color: colors.textMuted }}>#{' '}</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const EvCard: React.FC<{
  ev: AllianceEvent;
  onUp: (u: Partial<AllianceEvent>) => void;
  mob: boolean;
  local: boolean;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  categories: DiscordCategory[];
  loadingDiscord: boolean;
  guildChannelId: string | null;
  onTest: (ev: AllianceEvent) => void;
  testing: boolean;
  testResult: { ok: boolean; msg: string; steps?: string[] } | null;
  guildId: string | null;
}> = ({ ev, onUp, mob, local, channels, roles, categories, loadingDiscord, guildChannelId, guildId, onTest, testing, testResult }) => {
  const m = EVENT_META[ev.event_type];
  const [open, setOpen] = useState(false);
  const [cMins, setCMins] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const isBearHunt = ev.event_type === 'bear_hunt';
  const isArena = ev.event_type === 'arena';
  const isViking = ev.event_type === 'viking_vengeance';
  const isFixedSlot = ev.event_type === 'swordland_showdown' || ev.event_type === 'tri_alliance_clash';
  const effectiveChannel = ev.channel_id || guildChannelId;
  const nextDates = useMemo(() => isArena
    ? getNextEventDates('arena', new Date().toISOString(), 5)
    : getNextEventDates(ev.event_type, ev.reference_date, 5),
    [ev.event_type, ev.reference_date, isArena]);
  const missingRefDate = !isBearHunt && !isArena && !ev.reference_date;

  // Live countdown: tick every 60s to update "fires in X"
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ev.enabled || nextDates.length === 0 || ev.time_slots.length === 0) return;
    const id = window.setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [ev.enabled, nextDates.length, ev.time_slots.length]);
  const nextFire = ev.enabled ? getNextFireTime(nextDates, ev.time_slots, ev.event_type) : null;
  const countdownMs = nextFire ? nextFire.getTime() - Date.now() : 0;

  const channelOpts = useMemo(() => {
    const catMap = new Map(categories.map(c => [c.id, c.name]));
    return channels.map(c => ({ id: c.id, name: c.name, category: catMap.get(c.parent_id || '') || '' }));
  }, [channels, categories]);

  const roleOpts = useMemo(() => [
    ...(guildId ? [{ id: guildId, name: '@everyone', color: 0 }] : []),
    ...roles.map(r => ({ id: r.id, name: r.name, color: r.color })),
  ], [roles, guildId]);

  const fmtSlotSummary = () => {
    if (ev.time_slots.length === 0) return null;
    if (isViking) {
      const tue = ev.time_slots.find(s => s.day === 2);
      const thu = ev.time_slots.find(s => s.day === 4);
      const parts: string[] = [];
      if (tue) parts.push(`Tuesday ${fmt(tue)}`);
      if (thu) parts.push(`Thursday ${fmt(thu)}`);
      return parts.length > 0 ? parts.join(', ') : ev.time_slots.map(s => fmt(s)).join(', ');
    }
    return ev.time_slots.map(s => fmt(s)).join(', ');
  };
  const slotSummary = fmtSlotSummary();

  return (
    <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${ev.enabled ? `${m.color}30` : colors.border}`, transition: 'border-color 0.2s' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mob ? '0.85rem' : '1rem 1.25rem', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: mob ? '1.25rem' : '1.5rem' }}>{m.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: mob ? '0.9rem' : '0.95rem' }}>{m.label}</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 600, color: m.color, backgroundColor: `${m.color}15`, padding: '0.1rem 0.4rem', borderRadius: 3, letterSpacing: '0.03em' }}>{m.tag}</span>
            </div>
            {slotSummary && (
              <div style={{ color: m.color, fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, marginTop: '0.15rem' }}>
                {slotSummary}
              </div>
            )}
            {nextDates.length > 0 && ev.enabled && (
              <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.15rem' }}>
                Next: <span style={{ color: m.color }}>{fmtDate(nextDates[0]!)}</span>
                {countdownMs > 0 && <span style={{ color: colors.textMuted }}> · fires in {fmtCountdown(countdownMs)}</span>}
              </div>
            )}
            {missingRefDate && ev.enabled && (
              <div style={{ color: colors.warning, fontSize: '0.65rem', marginTop: '0.15rem' }}>⚠️ Missing reference date</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Dot on={ev.enabled && ev.time_slots.length > 0} />
          <Tog on={ev.enabled} set={v => {
            if (v && missingRefDate) { setOpen(true); return; }
            onUp({ enabled: v });
          }} c={m.color} />
          <span style={{ color: colors.textMuted, fontSize: '0.8rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : '' }}>▼</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: mob ? '0 0.85rem 0.85rem' : '0 1.25rem 1.25rem', borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lS}>TIME SLOTS {!isViking && `(${ev.time_slots.length}/${m.maxSlots})`}</label>
            {isViking ? (
              <VikingSlotEditor slots={ev.time_slots} onChange={s => onUp({ time_slots: s })} color={m.color} local={local} />
            ) : isFixedSlot ? (
              <FixedSlotSelector slots={ev.time_slots} max={m.maxSlots} onChange={s => onUp({ time_slots: s })} color={m.color} local={local} />
            ) : (
              <SlotEditor slots={ev.time_slots} max={m.maxSlots} onChange={s => onUp({ time_slots: s })} color={m.color} local={local} />
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lS}>REMINDER MESSAGE</label>
            <textarea
              value={ev.custom_message || ''}
              onChange={e => onUp({ custom_message: e.target.value || null })}
              placeholder={m.defaultMessage}
              rows={2}
              style={{ ...iS, width: '100%', maxWidth: '100%', resize: 'vertical', minHeight: 48, fontFamily: 'inherit', fontSize: '0.8rem', lineHeight: 1.4 }}
            />
            {ev.custom_message && (
              <button onClick={() => onUp({ custom_message: null })} style={{ marginTop: '0.25rem', padding: '0.2rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 4, color: colors.textMuted, fontSize: '0.65rem', cursor: 'pointer' }}>Reset to Default</button>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lS}>REMIND BEFORE</label>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {(isArena ? ARENA_REMINDER_PRESETS : REMINDER_PRESETS).map(n => (
                <button key={n} onClick={() => onUp({ reminder_minutes_before: n })} style={{ padding: '0.3rem 0.6rem', borderRadius: 6, border: `1px solid ${ev.reminder_minutes_before === n ? m.color : colors.border}`, backgroundColor: ev.reminder_minutes_before === n ? `${m.color}15` : 'transparent', color: ev.reminder_minutes_before === n ? m.color : colors.textMuted, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>{`${n}m`}</button>
              ))}
              {!isArena && <>
                <input type="number" min={0} max={1440} placeholder="Custom" value={cMins} onChange={e => setCMins(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { const x = parseInt(cMins); if (!isNaN(x) && x >= 0 && x <= 1440) { onUp({ reminder_minutes_before: x }); setCMins(''); } } }}
                  style={{ ...iS, width: 72, maxWidth: 72, textAlign: 'center', fontSize: '0.75rem', padding: '0.3rem' }} />
                <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>min</span>
              </>}
            </div>
            {!(isArena ? ARENA_REMINDER_PRESETS : REMINDER_PRESETS).includes(ev.reminder_minutes_before) && ev.reminder_minutes_before > 0 && <div style={{ color: m.color, fontSize: '0.7rem', marginTop: '0.3rem' }}>Current: {ev.reminder_minutes_before}m before</div>}
          </div>
          {isBearHunt && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={lS}>REFERENCE DATE <span style={{ fontWeight: 400, color: colors.textMuted }}>(when cycle started)</span></label>
              <input type="date" value={ev.reference_date ? ev.reference_date.split('T')[0] : ''} onChange={e => onUp({ reference_date: e.target.value ? e.target.value + 'T00:00:00Z' : null })} style={{ ...iS, width: 160, maxWidth: 160 }} />
              <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.2rem' }}>
                Pick any Bear Hunt day. Bot counts every 2 days from here.
              </div>
            </div>
          )}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={lS}>REMINDER CHANNEL <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional override)</span></label>
            {channels.length > 0 || loadingDiscord ? (
              <SearchableSelect value={ev.channel_id} onChange={v => onUp({ channel_id: v })} options={channelOpts} placeholder="Uses default channel" loading={loadingDiscord} accentColor={m.color} />
            ) : (
              <input type="text" value={ev.channel_id || ''} onChange={e => onUp({ channel_id: e.target.value || null })} placeholder="Channel ID or select from dropdown" style={iS} />
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lS}>ROLE TO MENTION <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional)</span></label>
            {roles.length > 0 || loadingDiscord ? (
              <SearchableSelect value={ev.role_id} onChange={v => onUp({ role_id: v })} options={roleOpts} placeholder="No role mention" loading={loadingDiscord} accentColor={m.color} />
            ) : (
              <input type="text" value={ev.role_id || ''} onChange={e => onUp({ role_id: e.target.value || null })} placeholder="Role ID or select from dropdown" style={iS} />
            )}
          </div>
          {/* Verify Schedule */}
          {ev.reference_date && (
            <div style={{ marginBottom: '1rem' }}>
              <button onClick={() => setShowSchedule(!showSchedule)} style={{ padding: '0.4rem 0.8rem', backgroundColor: 'transparent', border: `1px solid ${m.color}40`, borderRadius: 6, color: m.color, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                📅 {showSchedule ? 'Hide' : 'Verify'} Schedule
              </button>
              {showSchedule && nextDates.length > 0 && (
                <div style={{ marginTop: '0.5rem', padding: '0.6rem', backgroundColor: `${m.color}08`, borderRadius: 8, border: `1px solid ${m.color}20` }}>
                  <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginBottom: '0.35rem', fontWeight: 600 }}>NEXT 5 EVENT DATES</div>
                  {nextDates.map((d, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: i === 0 ? m.color : colors.text, fontFamily: "'JetBrains Mono', monospace", padding: '0.15rem 0' }}>
                      {i === 0 ? '→ ' : '  '}{fmtDate(d)}
                    </div>
                  ))}
                </div>
              )}
              {showSchedule && nextDates.length === 0 && (
                <div style={{ marginTop: '0.4rem', color: colors.warning, fontSize: '0.75rem' }}>⚠️ No upcoming dates found. Check reference date.</div>
              )}
            </div>
          )}
          {missingRefDate && (
            <div style={{ marginBottom: '1rem', padding: '0.6rem', backgroundColor: `${colors.warning}10`, borderRadius: 8, border: `1px solid ${colors.warning}30` }}>
              <div style={{ color: colors.warning, fontSize: '0.75rem', fontWeight: 600 }}>⚠️ Reference date not set</div>
              <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.2rem' }}>This event cannot fire without a reference date. Contact admin to set it in the database.</div>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '0.75rem' }}>
            <button onClick={() => onTest(ev)} disabled={testing || !effectiveChannel}
              style={{ padding: '0.5rem 1rem', backgroundColor: testing ? colors.border : `${m.color}20`, border: `1px solid ${m.color}40`, borderRadius: 8, color: testing ? colors.textMuted : m.color, fontSize: '0.8rem', fontWeight: 600, cursor: testing || !effectiveChannel ? 'default' : 'pointer', width: '100%' }}>
              {testing ? '⏳ Sending...' : '🧪 Send Test Message'}
            </button>
            {!effectiveChannel && <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.3rem' }}>Set a reminder channel first (in Settings or above).</div>}
            {testResult && (
              <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: 8, backgroundColor: testResult.ok ? `${colors.success}10` : `${colors.error}10`, border: `1px solid ${testResult.ok ? colors.success : colors.error}30` }}>
                <div style={{ color: testResult.ok ? colors.success : colors.error, fontSize: '0.8rem', fontWeight: 600 }}>{testResult.ok ? '✅' : '❌'} {testResult.msg}</div>
                {testResult.steps && testResult.steps.length > 0 && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <div style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.2rem' }}>How to fix:</div>
                    {testResult.steps.map((s, i) => <div key={i} style={{ color: colors.textMuted, fontSize: '0.7rem', paddingLeft: '0.5rem' }}>{i + 1}. {s}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
          {ev.last_reminded_at && <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.75rem', borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '0.5rem' }}>Last reminder: {ago(ev.last_reminded_at)}</div>}
        </div>
      )}
    </div>
  );
};
