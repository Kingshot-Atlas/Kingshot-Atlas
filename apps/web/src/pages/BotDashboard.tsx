import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { supabase } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { usePremium } from '../contexts/PremiumContext';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GuildSettings {
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

interface AllianceEvent {
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

interface GuildAdmin {
  id: string;
  guild_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'blocked';
  created_at: string;
  username?: string;
}

interface EventHistoryRow {
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

type EventType = 'bear_hunt' | 'viking_vengeance' | 'swordland_showdown' | 'tri_alliance_clash';
interface TimeSlot { hour: number; minute: number; day?: number; }
type DashTab = 'events' | 'settings' | 'access' | 'history';

// ─── Constants ──────────────────────────────────────────────────────────────

const EVENT_ORDER: EventType[] = ['bear_hunt', 'viking_vengeance', 'swordland_showdown', 'tri_alliance_clash'];

const EVENT_META: Record<EventType, { label: string; icon: string; color: string; tag: string; maxSlots: number; defaultMessage: string }> = {
  bear_hunt:          { label: 'Bear Hunt',          icon: '🐻', color: '#f59e0b', tag: 'Every 2 days',  maxSlots: 4, defaultMessage: 'Rally your alliance and hunt together!' },
  viking_vengeance:   { label: 'Viking Vengeance',   icon: '🪓', color: '#ef4444', tag: 'Tuesday & Thursday, every 2 weeks', maxSlots: 2, defaultMessage: 'Time to fight for glory!' },
  swordland_showdown: { label: 'Swordland Showdown', icon: '⚔️',  color: '#a855f7', tag: 'Sunday, every 2 weeks', maxSlots: 2, defaultMessage: 'Ready your blades and fight for dominance!' },
  tri_alliance_clash: { label: 'Tri-Alliance Clash', icon: '🛡️',  color: '#3b82f6', tag: 'Saturday, every 4 weeks',    maxSlots: 2, defaultMessage: 'Coordinate with your allies!' },
};

const FIXED_EVENT_TIMES: TimeSlot[] = [
  { hour: 2, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 21, minute: 0 },
];

const DEFAULT_GIFT_CODE_MESSAGE = 'A new gift code has been released! Redeem it before it expires.';

const getFixSteps = (error: string): string[] => {
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

const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120];

// Fixed reference dates for non-Bear-Hunt events (known game schedule)
const FIXED_REFERENCE_DATES: Partial<Record<EventType, string>> = {
  viking_vengeance: '2026-02-24T00:00:00Z',
  swordland_showdown: '2026-02-22T00:00:00Z',
  tri_alliance_clash: '2026-02-21T00:00:00Z',
};

// ─── Discord Data Types ────────────────────────────────────────────────────

interface DiscordChannel { id: string; name: string; type: number; position: number; parent_id: string | null; }
interface DiscordRole { id: string; name: string; color: number; position: number; }
interface DiscordCategory { id: string; name: string; position: number; }

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (s: TimeSlot) => `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
const fmtLocal = (s: TimeSlot) => { const d = new Date(); d.setUTCHours(s.hour, s.minute, 0, 0); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime())/60000); return d < 1 ? 'just now' : d < 60 ? `${d}m ago` : d < 1440 ? `${Math.floor(d/60)}h ago` : `${Math.floor(d/1440)}d ago`; };

const iS: React.CSSProperties = { width: '100%', maxWidth: '300px', backgroundColor: '#1a1a1a', border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text, padding: '0.5rem 0.7rem', fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' as const };
const lS: React.CSSProperties = { color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block' as const, marginBottom: '0.35rem' };

// ─── Sub-Components ─────────────────────────────────────────────────────────

const Dot: React.FC<{ on: boolean }> = ({ on }) => (
  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: on ? colors.success : colors.textMuted, boxShadow: on ? `0 0 6px ${colors.success}` : 'none', flexShrink: 0 }} />
);

const Tog: React.FC<{ on: boolean; set: (v: boolean) => void; c?: string }> = ({ on, set, c = colors.primary }) => (
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

const SearchableSelect: React.FC<{
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

const EvCard: React.FC<{
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
}> = ({ ev, onUp, mob, local, channels, roles, categories, loadingDiscord, guildChannelId, onTest, testing, testResult }) => {
  const m = EVENT_META[ev.event_type];
  const [open, setOpen] = useState(false);
  const [cMins, setCMins] = useState('');
  const isBearHunt = ev.event_type === 'bear_hunt';
  const isViking = ev.event_type === 'viking_vengeance';
  const isFixedSlot = ev.event_type === 'swordland_showdown' || ev.event_type === 'tri_alliance_clash';
  const effectiveChannel = ev.channel_id || guildChannelId;

  const channelOpts = useMemo(() => {
    const catMap = new Map(categories.map(c => [c.id, c.name]));
    return channels.map(c => ({ id: c.id, name: c.name, category: catMap.get(c.parent_id || '') || '' }));
  }, [channels, categories]);

  const roleOpts = useMemo(() =>
    roles.map(r => ({ id: r.id, name: r.name, color: r.color })),
  [roles]);

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
    <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${ev.enabled ? `${m.color}30` : colors.border}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
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
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Dot on={ev.enabled && ev.time_slots.length > 0} />
          <Tog on={ev.enabled} set={v => onUp({ enabled: v })} c={m.color} />
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
              {REMINDER_PRESETS.map(n => (
                <button key={n} onClick={() => onUp({ reminder_minutes_before: n })} style={{ padding: '0.3rem 0.6rem', borderRadius: 6, border: `1px solid ${ev.reminder_minutes_before === n ? m.color : colors.border}`, backgroundColor: ev.reminder_minutes_before === n ? `${m.color}15` : 'transparent', color: ev.reminder_minutes_before === n ? m.color : colors.textMuted, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>{`${n}m`}</button>
              ))}
              <input type="number" min={0} max={1440} placeholder="Custom" value={cMins} onChange={e => setCMins(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const x = parseInt(cMins); if (!isNaN(x) && x >= 0 && x <= 1440) { onUp({ reminder_minutes_before: x }); setCMins(''); } } }}
                style={{ ...iS, width: 72, maxWidth: 72, textAlign: 'center', fontSize: '0.75rem', padding: '0.3rem' }} />
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>min</span>
            </div>
            {!REMINDER_PRESETS.includes(ev.reminder_minutes_before) && ev.reminder_minutes_before > 0 && <div style={{ color: m.color, fontSize: '0.7rem', marginTop: '0.3rem' }}>Current: {ev.reminder_minutes_before}m before</div>}
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

// ─── Main Component ─────────────────────────────────────────────────────────

const BotDashboard: React.FC = () => {
  useDocumentTitle('Bot Dashboard — Atlas');
  const { user, profile } = useAuth();
  const mob = useIsMobile();
  const { isSupporter, isAdmin } = usePremium();
  const canMultiServer = isSupporter || isAdmin;

  const [loading, setLoading] = useState(true);
  const [guilds, setGuilds] = useState<GuildSettings[]>([]);
  const [selGuild, setSelGuild] = useState<string | null>(null);
  const [events, setEvents] = useState<AllianceEvent[]>([]);
  const [admins, setAdmins] = useState<GuildAdmin[]>([]);
  const [hist, setHist] = useState<EventHistoryRow[]>([]);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<DashTab>('events');
  const [showLocal, setShowLocal] = useState(false);
  const [discordGuilds, setDiscordGuilds] = useState<{guild_id: string; guild_name: string; guild_icon: string | null}[]>([]);
  const [fetchingGuilds, setFetchingGuilds] = useState(false);
  const [setupErr, setSetupErr] = useState('');
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [blockInput, setBlockInput] = useState('');
  const [blockingUser, setBlockingUser] = useState(false);
  const [blockSuggestions, setBlockSuggestions] = useState<{ id: string; discord_username: string; username: string; discord_id: string }[]>([]);
  const [blockSearchOpen, setBlockSearchOpen] = useState(false);
  const blockSearchRef = useRef<HTMLDivElement>(null);
  const [removingGuild, setRemovingGuild] = useState<string | null>(null);
  const [dChannels, setDChannels] = useState<DiscordChannel[]>([]);
  const [dRoles, setDRoles] = useState<DiscordRole[]>([]);
  const [dCategories, setDCategories] = useState<DiscordCategory[]>([]);
  const [loadingDiscord, setLoadingDiscord] = useState(false);
  const [testingEvent, setTestingEvent] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string; steps?: string[] }>>({});
  const [testingGiftCode, setTestingGiftCode] = useState(false);
  const [giftCodeTestResult, setGiftCodeTestResult] = useState<{ ok: boolean; msg: string; steps?: string[] } | null>(null);

  const guild = useMemo(() => guilds.find(g => g.guild_id === selGuild) || null, [guilds, selGuild]);
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  // Sort events in the correct display order
  const sortedEvents = useMemo(() => {
    const order = new Map(EVENT_ORDER.map((t, i) => [t, i]));
    return [...events].sort((a, b) => (order.get(a.event_type) ?? 99) - (order.get(b.event_type) ?? 99));
  }, [events]);

  // ─── Data Loading ───────────────────────────────────────────────────────

  const loadGuilds = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const { data: ar } = await supabase.from('bot_guild_admins').select('guild_id').eq('user_id', user.id);
      const { data: og } = await supabase.from('bot_guild_settings').select('*').eq('created_by', user.id);
      const ids = new Set([...(ar || []).map(r => r.guild_id), ...(og || []).map(g => g.guild_id)]);
      if (ids.size === 0) { setGuilds([]); setLoading(false); return; }
      const { data } = await supabase.from('bot_guild_settings').select('*').in('guild_id', Array.from(ids));
      const gs = data || [];
      setGuilds(gs);
      if (gs.length > 0 && !selGuild) setSelGuild(gs[0].guild_id);
    } catch (e) { console.error('Load guilds failed:', e); }
    finally { setLoading(false); }
  }, [user, selGuild]);

  const loadEv = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_alliance_events').select('*').eq('guild_id', gid).order('event_type');
    if (data) setEvents(data);
  }, []);

  const loadAdm = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_guild_admins').select('*').eq('guild_id', gid).order('role');
    if (data) {
      const uids = data.map(a => a.user_id);
      const { data: ps } = await supabase.from('profiles').select('id, username, discord_username').in('id', uids);
      const pm = new Map((ps || []).map(p => [p.id, p.discord_username || p.username]));
      setAdmins(data.map(a => ({ ...a, username: pm.get(a.user_id) || 'Unknown' })));
    }
  }, []);

  const loadHist = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_event_history').select('*').eq('guild_id', gid).order('sent_at', { ascending: false }).limit(50);
    if (data) setHist(data);
  }, []);

  useEffect(() => { if (selGuild) { loadEv(selGuild); loadAdm(selGuild); loadHist(selGuild); } }, [selGuild, loadEv, loadAdm, loadHist]);
  useEffect(() => { loadGuilds(); }, [loadGuilds]);

  // ─── Fetch Discord Channels & Roles for searchable dropdowns ────────
  const fetchDiscordData = useCallback(async (gid: string) => {
    if (!supabase || !profile?.discord_id) return;
    setLoadingDiscord(true);
    try {
      const [chRes, roRes] = await Promise.all([
        supabase.functions.invoke('verify-guild-permissions', {
          body: { action: 'list-channels', guild_id: gid, discord_id: profile.discord_id },
        }),
        supabase.functions.invoke('verify-guild-permissions', {
          body: { action: 'list-roles', guild_id: gid, discord_id: profile.discord_id },
        }),
      ]);
      setDChannels(chRes.data?.channels || []);
      setDCategories(chRes.data?.categories || []);
      setDRoles(roRes.data?.roles || []);
    } catch (e) { console.error('Failed to fetch Discord data:', e); }
    finally { setLoadingDiscord(false); }
  }, [profile?.discord_id]);

  useEffect(() => { if (selGuild) fetchDiscordData(selGuild); }, [selGuild, fetchDiscordData]);

  // Auto-set fixed reference dates for non-Bear-Hunt events that have none
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    events.forEach(ev => {
      if (ev.event_type !== 'bear_hunt' && !ev.reference_date && FIXED_REFERENCE_DATES[ev.event_type]) {
        const fixedDate = FIXED_REFERENCE_DATES[ev.event_type]!;
        setEvents(p => p.map(e => e.id === ev.id ? { ...e, reference_date: fixedDate } : e));
        sb.from('bot_alliance_events').update({ reference_date: fixedDate, updated_at: new Date().toISOString() }).eq('id', ev.id).then(() => {});
      }
    });
  }, [events.length]); // Only when events array length changes (initial load)

  // ─── Auto-detect Discord Guilds ──────────────────────────────────────────

  const fetchDiscordGuilds = useCallback(async () => {
    if (!supabase || !profile?.discord_id) return;
    setFetchingGuilds(true); setSetupErr('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-guild-permissions', {
        body: { action: 'list-guilds', discord_id: profile.discord_id },
      });
      if (error) { setSetupErr('Could not fetch servers. Try again later.'); return; }
      setDiscordGuilds(data?.guilds || []);
      if ((data?.guilds || []).length === 0) setSetupErr('No servers found where you have Manage Server permission and Atlas Bot is present.');
    } catch { setSetupErr('Could not connect to Discord. Try again.'); }
    finally { setFetchingGuilds(false); }
  }, [profile?.discord_id]);

  const registerGuild = async (g: {guild_id: string; guild_name: string; guild_icon: string | null}) => {
    if (!supabase || !user) return;
    setRegisteringId(g.guild_id);
    try {
      const { data, error } = await supabase.from('bot_guild_settings')
        .insert({ guild_id: g.guild_id, guild_name: g.guild_name, guild_icon_url: g.guild_icon, created_by: user.id })
        .select().single();
      if (error) { flash(error.code === '23505' ? 'Server already registered.' : error.message, false); return; }
      setGuilds(p => [...p, data]); setSelGuild(data.guild_id);
      await loadEv(data.guild_id); await loadAdm(data.guild_id);
      flash('Server registered!');
    } catch { flash('Registration failed', false); }
    finally { setRegisteringId(null); }
  };

  // ─── Updates ────────────────────────────────────────────────────────────

  const upEv = async (eid: string, u: Partial<AllianceEvent>) => {
    if (!supabase) return;
    setEvents(p => p.map(e => e.id === eid ? { ...e, ...u } : e));
    const { error } = await supabase.from('bot_alliance_events').update({ ...u, updated_at: new Date().toISOString() }).eq('id', eid);
    if (error) { flash('Save failed', false); if (guild) loadEv(guild.guild_id); }
  };

  const upGuild = async (u: Partial<GuildSettings>) => {
    if (!supabase || !guild) return;
    setGuilds(p => p.map(g => g.guild_id === guild.guild_id ? { ...g, ...u } : g));
    const { error } = await supabase.from('bot_guild_settings').update({ ...u, updated_at: new Date().toISOString() }).eq('id', guild.id);
    if (error) { flash('Save failed', false); loadGuilds(); }
  };

  const searchBlockUsers = useCallback(async (q: string) => {
    if (!supabase || q.length < 2) { setBlockSuggestions([]); return; }
    const { data } = await supabase.from('profiles')
      .select('id, username, discord_username, discord_id')
      .not('discord_id', 'is', null)
      .ilike('discord_username', `%${q}%`)
      .limit(10);
    setBlockSuggestions((data || []).filter(p => !admins.some(a => a.user_id === p.id)) as typeof blockSuggestions);
  }, [admins]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (blockSearchRef.current && !blockSearchRef.current.contains(e.target as Node)) setBlockSearchOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const blockUser = async (userId?: string) => {
    if (!supabase || !guild) return;
    const targetId = userId;
    if (!targetId && !blockInput.trim()) return;
    setBlockingUser(true);
    try {
      let p: { id: string; username: string; discord_id: string | null; discord_username: string | null } | null = null;
      if (targetId) {
        const { data } = await supabase.from('profiles').select('id, username, discord_id, discord_username').eq('id', targetId).single();
        p = data;
      } else {
        const { data } = await supabase.from('profiles').select('id, username, discord_id, discord_username').ilike('discord_username', blockInput.trim()).single();
        p = data;
      }
      if (!p) { flash('User not found.', false); return; }
      if (!p.discord_id) { flash('User has no Discord linked.', false); return; }
      if (admins.some(a => a.user_id === p!.id && a.role === 'owner')) { flash('Cannot block the owner.', false); return; }
      if (admins.some(a => a.user_id === p!.id && a.role === 'blocked')) { flash('Already blocked.', false); return; }
      // Remove any existing admin entry first, then insert as blocked
      const existing = admins.find(a => a.user_id === p!.id);
      if (existing) await supabase.from('bot_guild_admins').delete().eq('id', existing.id);
      const { error } = await supabase.from('bot_guild_admins').insert({ guild_id: guild.guild_id, user_id: p.id, role: 'blocked' });
      if (error) { flash(error.message, false); return; }
      flash(`Blocked ${p.discord_username || p.username}`); setBlockInput(''); setBlockSuggestions([]); setBlockSearchOpen(false); await loadAdm(guild.guild_id);
    } catch { flash('Failed', false); }
    finally { setBlockingUser(false); }
  };

  const unblockUser = async (aid: string) => {
    if (!supabase || !guild) return;
    const { error } = await supabase.from('bot_guild_admins').delete().eq('id', aid);
    if (error) { flash('Failed', false); return; }
    flash('Unblocked'); await loadAdm(guild.guild_id);
  };

  const removeGuild = async (gid: string) => {
    if (!supabase || !user) return;
    setRemovingGuild(gid);
    try {
      // Delete admins, events, history, then settings
      await supabase.from('bot_guild_admins').delete().eq('guild_id', gid);
      await supabase.from('bot_event_history').delete().eq('guild_id', gid);
      await supabase.from('bot_alliance_events').delete().eq('guild_id', gid);
      const { error } = await supabase.from('bot_guild_settings').delete().eq('guild_id', gid);
      if (error) { flash('Failed to remove server', false); return; }
      setGuilds(p => p.filter(g => g.guild_id !== gid));
      if (selGuild === gid) setSelGuild(guilds.find(g => g.guild_id !== gid)?.guild_id || null);
      flash('Server removed');
    } catch { flash('Failed', false); }
    finally { setRemovingGuild(null); }
  };

  // ─── Test Messages ──────────────────────────────────────────────────────

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const sendTestEvent = async (ev: AllianceEvent) => {
    const m = EVENT_META[ev.event_type];
    const channelId = ev.channel_id || guild?.reminder_channel_id;
    if (!channelId) { flash('No channel configured.', false); return; }
    setTestingEvent(ev.id);
    setTestResults(p => { const n = { ...p }; delete n[ev.id]; return n; });
    try {
      const { getAuthHeaders } = await import('../services/authHeaders');
      const auth = await getAuthHeaders();
      const firstSlot = ev.time_slots.length > 0 ? ev.time_slots[0] : null;
      const timeStr = firstSlot ? `${fmt(firstSlot)} UTC` : 'TBD';
      const customMsg = ev.custom_message;
      const description = customMsg
        ? `${customMsg}\nJoin us at **${timeStr}**.`
        : `${m.defaultMessage}\nJoin us at **${timeStr}**.`;
      const res = await fetch(`${API_URL}/api/v1/bot/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          channel_id: channelId,
          embed: {
            title: `${m.icon} ${m.label} starting soon!`,
            url: 'https://ks-atlas.com',
            description,
            color: parseInt(m.color.replace('#', ''), 16),
            footer: { text: 'Brought to you by Atlas · ks-atlas.com' },
          },
        }),
      });
      if (res.ok) {
        setTestResults(p => ({ ...p, [ev.id]: { ok: true, msg: 'Test message sent! Check your Discord channel.' } }));
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const detail = typeof err.detail === 'string' ? err.detail : 'Unknown error';
        setTestResults(p => ({ ...p, [ev.id]: { ok: false, msg: `Failed: ${detail}`, steps: getFixSteps(detail) } }));
      }
    } catch {
      setTestResults(p => ({ ...p, [ev.id]: { ok: false, msg: 'Could not reach server.', steps: getFixSteps('503') } }));
    } finally { setTestingEvent(null); }
  };

  const sendTestGiftCode = async () => {
    const channelId = guild?.gift_code_channel_id || guild?.reminder_channel_id;
    if (!channelId) { flash('No channel configured for gift codes.', false); return; }
    setTestingGiftCode(true);
    setGiftCodeTestResult(null);
    try {
      const { getAuthHeaders } = await import('../services/authHeaders');
      const auth = await getAuthHeaders();
      const msg = guild?.gift_code_custom_message || DEFAULT_GIFT_CODE_MESSAGE;
      const res = await fetch(`${API_URL}/api/v1/bot/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          channel_id: channelId,
          embed: {
            title: '🎁 New Gift Code!',
            url: 'https://ks-atlas.com/tools/gift-codes',
            description: `${msg}\n\nNew gift code released: \`TESTCODE123\`\n\n[Redeem with 1 click in Atlas!](https://ks-atlas.com/tools/gift-codes)\n\n*This is a test — not a real code.*`,
            color: 0x22c55e,
            footer: { text: 'Brought to you by Atlas · ks-atlas.com' },
          },
        }),
      });
      if (res.ok) {
        setGiftCodeTestResult({ ok: true, msg: 'Test gift code alert sent! Check your Discord channel.' });
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const detail = typeof err.detail === 'string' ? err.detail : 'Unknown error';
        setGiftCodeTestResult({ ok: false, msg: `Failed: ${detail}`, steps: getFixSteps(detail) });
      }
    } catch {
      setGiftCodeTestResult({ ok: false, msg: 'Could not reach server.', steps: getFixSteps('503') });
    } finally { setTestingGiftCode(false); }
  };

  // ─── Auth Gates ─────────────────────────────────────────────────────────

  if (!user) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
        <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>Sign In Required</h2>
        <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Sign in with your Atlas account to manage bot settings.</p>
        <Link to="/profile" style={{ display: 'inline-block', padding: '0.7rem 1.5rem', backgroundColor: colors.primary, color: colors.bg, borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Sign In</Link>
      </div>
    </div>
  );

  if (!profile?.discord_id) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 450 }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔗</span>
        <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>Link Your Discord</h2>
        <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Link your Discord account in your profile first.</p>
        <Link to="/profile" style={{ display: 'inline-block', padding: '0.7rem 1.5rem', backgroundColor: colors.discord, color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Go to Profile</Link>
      </div>
    </div>
  );

  if (!isSupporter && !isAdmin) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <img src="/AtlasBotAvatar.webp" alt="Atlas Bot" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1rem', display: 'block', border: '2px solid #FF6B8A30' }} />
        <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>
          <span style={{ color: '#fff' }}>BOT</span><span style={{ color: '#FF6B8A', marginLeft: '0.3rem' }}>DASHBOARD</span>
        </h2>
        <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.6 }}>The Bot Dashboard is available to Atlas Supporters.</p>
        <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
          <div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem' }}>What you get:</div>
          {['Set up Alliance Event reminders for your server', 'Auto-post new gift codes to your Discord', 'Test messages before they go live', 'Manage multiple servers'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ color: '#FF6B8A', fontSize: '0.75rem' }}>✓</span>
              <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{f}</span>
            </div>
          ))}
        </div>
        <Link to="/support" style={{ display: 'inline-block', padding: '0.7rem 1.5rem', background: 'linear-gradient(135deg, #FF6B8A 0%, #FF8FA3 100%)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Become a Supporter →</Link>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'pulse 1.5s infinite' }}>⚙️</div>
        <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Loading dashboard...</p>
      </div>
    </div>
  );

  // ─── Setup View ─────────────────────────────────────────────────────────

  if (guilds.length === 0) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      <div style={{ padding: mob ? '2rem 1rem 1rem' : '2.5rem 2rem 1.5rem', textAlign: 'center', background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)' }}>
        <img src="/AtlasBotAvatar.webp" alt="Atlas Bot" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1rem', display: 'block', border: '2px solid #22d3ee30' }} />
        <h1 style={{ fontSize: mob ? '1.5rem' : '2rem', fontWeight: 'bold', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>
          <span style={{ color: '#fff' }}>BOT</span><span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.4rem' }}>DASHBOARD</span>
        </h1>
        <p style={{ color: colors.textSecondary, fontSize: mob ? '0.85rem' : '0.95rem', maxWidth: 500, margin: '0 auto' }}>Manage Alliance Event Reminders and Gift Code alerts.</p>
      </div>
      <div style={{ maxWidth: 550, margin: '2rem auto', padding: mob ? '0 1rem' : '0 2rem' }}>
        <div style={{ backgroundColor: colors.surface, borderRadius: 16, border: `1px solid ${colors.border}`, padding: mob ? '1.25rem' : '1.75rem' }}>
          <h2 style={{ color: colors.text, fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Select Your Server</h2>
          <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Servers where <strong style={{ color: colors.text }}>Atlas Bot</strong> is present and you have <strong style={{ color: colors.text }}>Manage Server</strong> permission will appear below.
          </p>

          {discordGuilds.length === 0 && !fetchingGuilds && (
            <button onClick={fetchDiscordGuilds} disabled={fetchingGuilds}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: colors.primary, border: 'none', borderRadius: 8, color: colors.bg, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
              Detect My Servers
            </button>
          )}

          {fetchingGuilds && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', animation: 'pulse 1.5s infinite' }}>🔍</div>
              <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>Checking your Discord servers...</p>
            </div>
          )}

          {discordGuilds.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {discordGuilds.map(g => (
                <div key={g.guild_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#0f0f0f', borderRadius: 10, border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    {g.guild_icon ? <img src={g.guild_icon} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: colors.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: colors.textMuted, flexShrink: 0 }}>{g.guild_name.charAt(0)}</div>}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.guild_name}</div>
                      <div style={{ color: colors.textMuted, fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace" }}>{g.guild_id}</div>
                    </div>
                  </div>
                  <button onClick={() => registerGuild(g)} disabled={registeringId === g.guild_id}
                    style={{ padding: '0.4rem 0.9rem', backgroundColor: colors.primary, border: 'none', borderRadius: 6, color: colors.bg, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {registeringId === g.guild_id ? '...' : 'Register'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {setupErr && <div style={{ padding: '0.6rem 0.8rem', borderRadius: 8, backgroundColor: `${colors.error}15`, border: `1px solid ${colors.error}30`, color: colors.error, fontSize: '0.8rem', marginTop: '0.75rem' }}>{setupErr}</div>}

          {discordGuilds.length > 0 && (
            <button onClick={fetchDiscordGuilds} disabled={fetchingGuilds}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.textMuted, fontSize: '0.75rem', cursor: 'pointer' }}>
              ↻ Refresh List
            </button>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/atlas-bot" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Atlas Bot</Link>
        </div>
      </div>
    </div>
  );

  // ─── Dashboard View ─────────────────────────────────────────────────────

  const activeEv = events.filter(e => e.enabled && e.time_slots.length > 0).length;
  const tabs: { id: DashTab; label: string; icon: string }[] = [
    { id: 'events', label: 'Events', icon: '⚔️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'access', label: 'Access', icon: '�' },
    { id: 'history', label: 'History', icon: '📋' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {toast && <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, padding: '0.6rem 1.2rem', borderRadius: 8, backgroundColor: toast.ok ? colors.success : colors.error, color: '#fff', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ padding: mob ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem', background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)', borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/AtlasBotAvatar.webp" alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #22d3ee30' }} />
            <div>
              <h1 style={{ fontSize: mob ? '1.1rem' : '1.35rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, margin: 0 }}>
                <span style={{ color: '#fff' }}>BOT</span><span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.35rem' }}>DASHBOARD</span>
              </h1>
              {guilds.length > 1 ? (
                <select value={selGuild || ''} onChange={e => setSelGuild(e.target.value)} style={{ backgroundColor: 'transparent', border: 'none', color: colors.textMuted, fontSize: '0.75rem', outline: 'none', cursor: 'pointer', padding: 0 }}>
                  {guilds.map(g => <option key={g.guild_id} value={g.guild_id}>{g.guild_name}</option>)}
                </select>
              ) : <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>{guild?.guild_name}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {canMultiServer && (
              <button onClick={() => { setTab('settings'); fetchDiscordGuilds(); }} style={{ color: colors.textMuted, fontSize: '0.7rem', padding: '0.35rem 0.6rem', borderRadius: 6, border: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: 'transparent' }}>+ Server</button>
            )}
            <button onClick={() => setShowLocal(!showLocal)} style={{ color: colors.textMuted, fontSize: '0.7rem', padding: '0.35rem 0.6rem', borderRadius: 6, border: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: showLocal ? `${colors.primary}15` : 'transparent' }}>{showLocal ? '🕐 Local' : '🌐 UTC'}</button>
            <Link to="/atlas-bot" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.75rem', padding: '0.4rem 0.7rem', borderRadius: 6, border: `1px solid ${colors.border}` }}>← Bot</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: mob ? '1rem' : '1.5rem 2rem 2rem' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: mob ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { l: 'Active Reminders', v: String(activeEv), c: colors.success },
            { l: 'Configured', v: `${events.filter(e => e.time_slots.length > 0).length}/4`, c: colors.primary },
            { l: 'Gift Codes', v: guild?.gift_code_alerts ? 'ON' : 'OFF', c: guild?.gift_code_alerts ? colors.success : colors.textMuted },
            { l: 'Blocked', v: String(admins.filter(a => a.role === 'blocked').length), c: admins.some(a => a.role === 'blocked') ? colors.error : colors.textMuted },
          ].map(s => (
            <div key={s.l} style={{ backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.border}`, padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ color: s.c, fontSize: '1.1rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
              <div style={{ color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '0.2rem' }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: `1px solid ${colors.border}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: mob ? '0.5rem 0.75rem' : '0.6rem 1rem', backgroundColor: tab === t.id ? colors.surface : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? colors.primary : 'transparent'}`, color: tab === t.id ? colors.text : colors.textMuted, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: -1 }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* Events Tab */}
        {tab === 'events' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
                <span style={{ color: '#fff' }}>ALLIANCE</span><span style={{ ...neonGlow(colors.orange), marginLeft: '0.3rem' }}>EVENTS</span>
              </h2>
              <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Auto-saves</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sortedEvents.map(ev => <EvCard key={ev.id} ev={ev} onUp={u => upEv(ev.id, u)} mob={mob} local={showLocal} channels={dChannels} roles={dRoles} categories={dCategories} loadingDiscord={loadingDiscord} guildChannelId={guild?.reminder_channel_id || null} onTest={sendTestEvent} testing={testingEvent === ev.id} testResult={testResults[ev.id] || null} />)}
              {events.length === 0 && <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>No events configured. Try refreshing.</div>}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && guild && (
          <div>
            <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: FONT_DISPLAY }}>
              <span style={{ color: '#fff' }}>GENERAL</span><span style={{ ...neonGlow(colors.primary), marginLeft: '0.3rem' }}>SETTINGS</span>
            </h2>
            <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={lS}>DEFAULT REMINDER CHANNEL</label>
                  {dChannels.length > 0 || loadingDiscord ? (
                    <SearchableSelect value={guild.reminder_channel_id} onChange={v => upGuild({ reminder_channel_id: v })} options={dChannels.map(c => ({ id: c.id, name: c.name, category: '' }))} placeholder="Select a channel" loading={loadingDiscord} />
                  ) : (
                    <input type="text" value={guild.reminder_channel_id || ''} onChange={e => upGuild({ reminder_channel_id: e.target.value || null })} placeholder="Channel ID" style={iS} />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#0f0f0f', borderRadius: 8, border: `1px solid ${colors.borderSubtle}` }}>
                  <div><div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600 }}>🎁 Gift Code Alerts</div><div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.15rem' }}>Auto-post new gift codes</div></div>
                  <Tog on={guild.gift_code_alerts} set={v => upGuild({ gift_code_alerts: v })} c={colors.success} />
                </div>
                {guild.gift_code_alerts && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={lS}>GIFT CODE CHANNEL <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional)</span></label>
                      {dChannels.length > 0 || loadingDiscord ? (
                        <SearchableSelect value={guild.gift_code_channel_id} onChange={v => upGuild({ gift_code_channel_id: v })} options={dChannels.map(c => ({ id: c.id, name: c.name, category: '' }))} placeholder="Uses default channel" loading={loadingDiscord} accentColor={colors.success} />
                      ) : (
                        <input type="text" value={guild.gift_code_channel_id || ''} onChange={e => upGuild({ gift_code_channel_id: e.target.value || null })} placeholder="Uses default channel" style={iS} />
                      )}
                    </div>
                    <div>
                      <label style={lS}>GIFT CODE MESSAGE</label>
                      <textarea
                        value={guild.gift_code_custom_message || ''}
                        onChange={e => upGuild({ gift_code_custom_message: e.target.value || null })}
                        placeholder={DEFAULT_GIFT_CODE_MESSAGE}
                        rows={2}
                        style={{ ...iS, width: '100%', maxWidth: '100%', resize: 'vertical', minHeight: 48, fontFamily: 'inherit', fontSize: '0.8rem', lineHeight: 1.4 }}
                      />
                      {guild.gift_code_custom_message && (
                        <button onClick={() => upGuild({ gift_code_custom_message: null })} style={{ marginTop: '0.25rem', padding: '0.2rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 4, color: colors.textMuted, fontSize: '0.65rem', cursor: 'pointer' }}>Reset to Default</button>
                      )}
                    </div>
                    <div>
                      <button onClick={sendTestGiftCode} disabled={testingGiftCode || !(guild.gift_code_channel_id || guild.reminder_channel_id)}
                        style={{ padding: '0.45rem 0.9rem', backgroundColor: testingGiftCode ? colors.border : `${colors.success}20`, border: `1px solid ${colors.success}40`, borderRadius: 8, color: testingGiftCode ? colors.textMuted : colors.success, fontSize: '0.8rem', fontWeight: 600, cursor: testingGiftCode || !(guild.gift_code_channel_id || guild.reminder_channel_id) ? 'default' : 'pointer', width: '100%' }}>
                        {testingGiftCode ? '⏳ Sending...' : '🧪 Send Test Gift Code Alert'}
                      </button>
                      {giftCodeTestResult && (
                        <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: 8, backgroundColor: giftCodeTestResult.ok ? `${colors.success}10` : `${colors.error}10`, border: `1px solid ${giftCodeTestResult.ok ? colors.success : colors.error}30` }}>
                          <div style={{ color: giftCodeTestResult.ok ? colors.success : colors.error, fontSize: '0.8rem', fontWeight: 600 }}>{giftCodeTestResult.ok ? '✅' : '❌'} {giftCodeTestResult.msg}</div>
                          {giftCodeTestResult.steps && giftCodeTestResult.steps.length > 0 && (
                            <div style={{ marginTop: '0.4rem' }}>
                              <div style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.2rem' }}>How to fix:</div>
                              {giftCodeTestResult.steps.map((s, i) => <div key={i} style={{ color: colors.textMuted, fontSize: '0.7rem', paddingLeft: '0.5rem' }}>{i + 1}. {s}</div>)}
                            </div>
                          )}
                        </div>
                      )}
                    <div>
                      <label style={lS}>ROLE TO MENTION <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional)</span></label>
                      {dRoles.length > 0 || loadingDiscord ? (
                        <SearchableSelect value={guild.gift_code_role_id} onChange={v => upGuild({ gift_code_role_id: v })} options={dRoles.map(r => ({ id: r.id, name: r.name, color: r.color }))} placeholder="No role mention" loading={loadingDiscord} accentColor={colors.success} />
                      ) : (
                        <input type="text" value={guild.gift_code_role_id || ''} onChange={e => upGuild({ gift_code_role_id: e.target.value || null })} placeholder="Role ID (optional)" style={iS} />
                      )}
                    </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Connected Servers */}
            <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem', marginTop: '1.25rem' }}>
              <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>🖥️ Connected Servers</h3>
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.75rem' }}>Servers registered with Atlas Bot. Remove a server to disconnect it completely.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {guilds.map(g => (
                  <div key={g.guild_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', backgroundColor: g.guild_id === selGuild ? `${colors.primary}08` : '#0f0f0f', borderRadius: 8, border: `1px solid ${g.guild_id === selGuild ? colors.primary + '30' : colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      {g.guild_icon_url ? <img src={g.guild_icon_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: colors.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: colors.textMuted, flexShrink: 0 }}>{g.guild_name.charAt(0)}</div>}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.guild_name}</div>
                        <div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>{g.guild_id === selGuild ? 'Currently viewing' : ''}</div>
                      </div>
                    </div>
                    {g.created_by === user?.id && (
                      <button onClick={() => { if (confirm(`Remove ${g.guild_name}? This deletes all events, settings, and history for this server.`)) removeGuild(g.guild_id); }}
                        disabled={removingGuild === g.guild_id}
                        style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: `1px solid ${colors.error}40`, borderRadius: 6, color: colors.error, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {removingGuild === g.guild_id ? '...' : '✕ Remove'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.primary}20`, padding: mob ? '1rem' : '1.25rem', marginTop: '1.25rem', background: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.primary}05 100%)` }}>
              <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.6rem' }}>💡 How It Works</h3>
              <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(3,1fr)', gap: '0.75rem' }}>
                {[{ t: 'Set Times', d: 'Add event times (UTC).', i: '⏰' }, { t: 'Choose Channel', d: 'Set reminder channel.', i: '📢' }, { t: 'Get Reminded', d: 'Bot pings before events.', i: '🔔' }].map(x => (
                  <div key={x.t} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{x.i}</span>
                    <div><div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>{x.t}</div><div style={{ color: colors.textMuted, fontSize: '0.7rem', lineHeight: 1.4 }}>{x.d}</div></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Multi-server: Add Another Server (Supporters & Admins) */}
            {canMultiServer && (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem', marginTop: '1.25rem' }}>
                <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem' }}>🌐 Manage Multiple Servers</h3>
                <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.75rem' }}>As a Supporter, you can manage bot settings for multiple Discord servers.</p>

                {discordGuilds.length === 0 && !fetchingGuilds && (
                  <button onClick={fetchDiscordGuilds} style={{ padding: '0.5rem 1rem', backgroundColor: colors.primary, border: 'none', borderRadius: 8, color: colors.bg, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                    Detect More Servers
                  </button>
                )}

                {fetchingGuilds && <p style={{ color: colors.textMuted, fontSize: '0.75rem' }}>🔍 Checking your Discord servers...</p>}

                {discordGuilds.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {discordGuilds.filter(dg => !guilds.some(g => g.guild_id === dg.guild_id)).map(g => (
                      <div key={g.guild_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem', backgroundColor: '#0f0f0f', borderRadius: 8, border: `1px solid ${colors.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          {g.guild_icon ? <img src={g.guild_icon} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: colors.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: colors.textMuted, flexShrink: 0 }}>{g.guild_name.charAt(0)}</div>}
                          <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.guild_name}</span>
                        </div>
                        <button onClick={() => registerGuild(g)} disabled={registeringId === g.guild_id}
                          style={{ padding: '0.3rem 0.7rem', backgroundColor: colors.primary, border: 'none', borderRadius: 6, color: colors.bg, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {registeringId === g.guild_id ? '...' : '+ Add'}
                        </button>
                      </div>
                    ))}
                    {discordGuilds.filter(dg => !guilds.some(g => g.guild_id === dg.guild_id)).length === 0 && (
                      <p style={{ color: colors.textMuted, fontSize: '0.75rem' }}>All available servers are already registered.</p>
                    )}
                  </div>
                )}

                {setupErr && <div style={{ padding: '0.5rem 0.7rem', borderRadius: 6, backgroundColor: `${colors.error}15`, border: `1px solid ${colors.error}30`, color: colors.error, fontSize: '0.75rem', marginTop: '0.5rem' }}>{setupErr}</div>}
              </div>
            )}

            {!canMultiServer && guilds.length >= 1 && (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid #FF6B8A20`, padding: mob ? '1rem' : '1.25rem', marginTop: '1.25rem' }}>
                <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem' }}>🌐 Multiple Servers</h3>
                <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.5rem' }}>Manage bot settings across multiple Discord servers.</p>
                <Link to="/support" style={{ color: '#FF6B8A', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>Become a Supporter →</Link>
              </div>
            )}
          </div>
        )}

        {/* Access Control Tab */}
        {tab === 'access' && guild && (
          <div>
            <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: FONT_DISPLAY }}>
              <span style={{ color: '#fff' }}>ACCESS</span><span style={{ ...neonGlow('#a855f7'), marginLeft: '0.3rem' }}>CONTROL</span>
            </h2>
            <div style={{ backgroundColor: `${colors.primary}08`, borderRadius: 10, border: `1px solid ${colors.primary}20`, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>🔓 Who can access this dashboard?</div>
              <div style={{ color: colors.textMuted, fontSize: '0.75rem', lineHeight: 1.5 }}>
                Anyone with <strong style={{ color: colors.text }}>Manage Server</strong> permission in your Discord server can access this dashboard — no setup needed. The server owner can block specific users below.
              </div>
            </div>
            {guild.created_by === user?.id && (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem', marginBottom: '1rem' }}>
                <label style={lS}>BLOCK A USER</label>
                <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>Blocked users cannot access this server's dashboard even if they have Manage Server permission.</p>
                <div ref={blockSearchRef} style={{ position: 'relative', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input type="text" value={blockInput} onChange={e => { setBlockInput(e.target.value); setBlockSearchOpen(true); searchBlockUsers(e.target.value); }}
                      onFocus={() => { if (blockInput.length >= 2) setBlockSearchOpen(true); }}
                      onKeyDown={e => { if (e.key === 'Enter') blockUser(); }} placeholder="Discord username" style={iS} />
                    {blockSearchOpen && blockSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, backgroundColor: '#1a1a1a', border: `1px solid ${colors.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', maxHeight: 180, overflowY: 'auto' }}>
                        {blockSuggestions.map(s => (
                          <button key={s.id} onClick={() => { blockUser(s.id); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.6rem', border: 'none', borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: 'transparent', color: colors.text, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}>
                            <span style={{ fontSize: '0.85rem' }}>🎮</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{s.discord_username}</div>
                              <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Atlas: {s.username}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => blockUser()} disabled={!blockInput.trim() || blockingUser} style={{ padding: '0.5rem 1rem', backgroundColor: blockInput.trim() ? colors.error : colors.border, border: 'none', borderRadius: 8, color: blockInput.trim() ? '#fff' : colors.textMuted, fontSize: '0.8rem', fontWeight: 600, cursor: blockInput.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>{blockingUser ? '...' : '🚫 Block'}</button>
                </div>
              </div>
            )}
            {admins.filter(a => a.role === 'blocked').length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={lS}>BLOCKED USERS</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {admins.filter(a => a.role === 'blocked').map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.error}20`, padding: '0.65rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>�</span>
                        <div><div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>{a.username}</div><div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>Blocked • {ago(a.created_at)}</div></div>
                      </div>
                      {guild.created_by === user?.id && (
                        <button onClick={() => unblockUser(a.id)} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: `1px solid ${colors.success}40`, borderRadius: 6, color: colors.success, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Unblock</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.border}`, padding: '0.85rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>👑</span>
                <div><div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>Server Owner</div><div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>{admins.find(a => a.role === 'owner')?.username || 'You'}</div></div>
              </div>
              <div style={{ color: colors.textMuted, fontSize: '0.7rem', lineHeight: 1.4 }}>The owner who registered this server. Only the owner can block/unblock users and remove the server.</div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
                <span style={{ color: '#fff' }}>REMINDER</span><span style={{ ...neonGlow(colors.success), marginLeft: '0.3rem' }}>HISTORY</span>
              </h2>
              <button onClick={() => { if (selGuild) loadHist(selGuild); }} style={{ color: colors.textMuted, fontSize: '0.7rem', padding: '0.3rem 0.6rem', borderRadius: 6, border: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: 'transparent' }}>↻ Refresh</button>
            </div>
            {hist.length === 0 ? (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>No reminders sent yet. History appears after the first reminder fires.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {hist.map(h => {
                  const em = EVENT_META[h.event_type as EventType];
                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', backgroundColor: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}`, padding: '0.6rem 0.85rem' }}>
                      <span style={{ fontSize: '1rem' }}>{em?.icon || '📢'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>{em?.label || h.event_type}</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '0.05rem 0.35rem', borderRadius: 3, backgroundColor: h.status === 'sent' ? `${colors.success}20` : `${colors.error}20`, color: h.status === 'sent' ? colors.success : colors.error }}>{h.status}</span>
                          {h.time_slot && <span style={{ color: colors.textMuted, fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace" }}>{fmt(h.time_slot)} UTC</span>}
                        </div>
                        {h.error_message && <div style={{ color: colors.error, fontSize: '0.65rem', marginTop: '0.1rem' }}>{h.error_message}</div>}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: '0.65rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{ago(h.sent_at)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingTop: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/atlas-bot" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>← Atlas Bot</Link>
          <Link to="/tools" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.8rem' }}>All Tools</Link>
          <Link to="/" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.8rem' }}>Home</Link>
        </div>
      </div>
    </div>
  );
};

export default BotDashboard;
