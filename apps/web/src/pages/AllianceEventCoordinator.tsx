// ─── Alliance Event Coordinator ─────────────────────────────────────────
// Members select 30-min time slots per day (UTC). Managers see tallied heatmap.
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { useToolAccess } from '../hooks/useToolAccess';
import { useAllianceCenter } from '../hooks/useAllianceCenter';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { Button } from '../components/shared';
import {
  useAllianceEventCoordinator,
  DAYS_OF_WEEK,
  TIME_SLOTS_30MIN,
} from '../hooks/useAllianceEventCoordinator';
import type { DayTally } from '../hooks/useAllianceEventCoordinator';

const ACCENT = '#3b82f6'; // blue for alliance tools
const ACCENT_BORDER = '#3b82f630';

// Timezone helpers (same pattern as PrepScheduler)
const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const UTC_OFFSET_HOURS = -(new Date().getTimezoneOffset() / 60);
const TZ_ABBR = (() => {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || USER_TZ.split('/').pop()?.replace(/_/g, ' ') || USER_TZ;
  } catch { return USER_TZ; }
})();

const inputBase: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.6rem', backgroundColor: '#0d1117',
  border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff',
  fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
};

// ─── Access Gate ───
const EventCoordinatorGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasAccess, loading } = useToolAccess();
  const { accessRole, allianceLoading } = useAllianceCenter();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const isAllianceMember = accessRole === 'member' || accessRole === 'owner' || accessRole === 'manager' || accessRole === 'delegate';

  if (loading || allianceLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (!hasAccess && !isAllianceMember) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
        <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: isMobile ? '1.25rem' : '1.5rem', marginBottom: '0.75rem' }}>
          {t('eventCoordinator.gateTitle', 'Alliance Event Coordinator')}
        </h2>
        <p style={{ color: '#9ca3af', maxWidth: '420px', marginBottom: '1.5rem', lineHeight: 1.6, fontSize: isMobile ? '0.85rem' : '0.9rem' }}>
          {t('eventCoordinator.gateDesc', 'Available to Atlas Supporters, Ambassadors, Discord Server Boosters, and Admins. Coordinate the best times for your alliance events.')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/support" style={{ textDecoration: 'none' }}>
            <Button variant="primary">{t('allianceCenter.becomeSupporter', 'Become a Supporter')}</Button>
          </Link>
          <Link to="/tools" style={{ textDecoration: 'none' }}>
            <Button variant="ghost">{t('allianceCenter.backToTools', 'Back to Tools')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ─── Time Range type ───
interface TimeRange { from: string; to: string }

// ─── Convert time ranges → individual 30-min slots ───
function rangesToSlots(ranges: TimeRange[]): string[] {
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

// ─── Convert individual 30-min slots → merged time ranges ───
function slotsToRanges(slots: string[]): TimeRange[] {
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

// ─── UTC → Local Time Helper ───
function utcToLocalLabel(utcTime: string): string {
  const [h, m] = utcTime.split(':').map(Number);
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h ?? 0, m ?? 0));
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatSlotLabel(slot: string): string {
  if (slot === '24:00') return '00:00 UTC (Midnight)';
  return `${slot} UTC (${utcToLocalLabel(slot)})`;
}

function getSlotDuration(from: string, to: string, slots: string[]): string {
  const fi = slots.indexOf(from);
  const ti = slots.indexOf(to);
  if (fi < 0 || ti < 0 || ti <= fi) return '';
  const mins = (ti - fi) * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ─── Searchable Time Slot Dropdown ───
const ECTimeSlotDropdown: React.FC<{
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  isMobile: boolean;
  minSlot?: string;
}> = ({ value, onChange, disabled, isMobile, minSlot }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view when dropdown opens
  useEffect(() => {
    if (open && listRef.current) {
      requestAnimationFrame(() => {
        const el = listRef.current?.querySelector('[data-selected="true"]');
        if (el) el.scrollIntoView({ block: 'nearest' });
      });
    }
  }, [open]);

  const minIndex = minSlot ? TIME_SLOTS_30MIN.indexOf(minSlot) : 0;
  const availableSlots = TIME_SLOTS_30MIN.filter((s, i) => i >= (minIndex >= 0 ? minIndex : 0) && (minSlot || s !== '24:00'));

  const filtered = availableSlots.filter(slot =>
    formatSlotLabel(slot).toLowerCase().includes(search.toLowerCase())
  );

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
      setSearch('');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const handleSelect = (slot: string) => {
    onChange(slot);
    setOpen(false);
    setSearch('');
  };

  const dropdownInputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.65rem', backgroundColor: disabled ? '#1a1a1a' : '#0d1117',
    border: `1px solid ${open ? ACCENT : '#2a2a2a'}`, borderRadius: '8px', color: '#fff',
    fontSize: isMobile ? '1rem' : '0.8rem', outline: 'none', boxSizing: 'border-box' as const,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    transition: 'border-color 0.15s ease', minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }} role="combobox" aria-expanded={open} aria-haspopup="listbox">
      <input
        readOnly={!open}
        value={open ? search : formatSlotLabel(value)}
        placeholder={formatSlotLabel(value)}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => { if (!disabled) { setOpen(true); setSearch(''); } }}
        onClick={() => { if (!disabled) { setOpen(true); setSearch(''); } }}
        style={dropdownInputStyle}
        aria-label={minSlot ? 'End time' : 'Start time'}
        inputMode={open ? 'search' : 'none'}
      />
      <span style={{
        position: 'absolute', right: '0.65rem', top: '50%', transform: `translateY(-50%) rotate(${open ? '180' : '0'}deg)`,
        color: '#6b7280', fontSize: '0.55rem', pointerEvents: 'none', transition: 'transform 0.2s ease',
      }}>▼</span>
      {open && (
        <div ref={listRef} role="listbox" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 50,
          backgroundColor: '#111111', border: '1px solid #2a2a2a', borderRadius: '10px',
          maxHeight: isMobile ? '300px' : '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          WebkitOverflowScrolling: 'touch',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.8rem', textAlign: 'center' }}>
              No matching time
            </div>
          ) : filtered.map(slot => (
            <button key={slot} onClick={() => handleSelect(slot)}
              role="option" aria-selected={slot === value} data-selected={slot === value ? 'true' : undefined}
              style={{
                display: 'block', width: '100%', padding: isMobile ? '0.65rem 0.75rem' : '0.5rem 0.75rem', border: 'none',
                backgroundColor: slot === value ? ACCENT + '18' : 'transparent',
                color: slot === value ? ACCENT : '#e5e7eb', fontSize: isMobile ? '0.9rem' : '0.78rem',
                fontWeight: slot === value ? 700 : 400, cursor: 'pointer', textAlign: 'left',
                minHeight: isMobile ? '48px' : '44px', transition: 'background-color 0.1s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerEnter={e => { if (slot !== value) e.currentTarget.style.backgroundColor = '#1a1a20'; }}
              onPointerLeave={e => { e.currentTarget.style.backgroundColor = slot === value ? ACCENT + '18' : 'transparent'; }}
              onPointerDown={e => { e.currentTarget.style.backgroundColor = ACCENT + '25'; }}
              onPointerUp={e => { e.currentTarget.style.backgroundColor = slot === value ? ACCENT + '18' : 'transparent'; }}>
              {formatSlotLabel(slot)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Single Time Range Row (From → To) ───
const TimeRangeRow: React.FC<{
  range: TimeRange;
  index: number;
  total: number;
  onChange: (r: TimeRange) => void;
  onRemove: () => void;
  disabled?: boolean;
  isMobile: boolean;
}> = ({ range, index, total, onChange, onRemove, disabled, isMobile }) => {
  const { t } = useTranslation();
  const fromIdx = TIME_SLOTS_30MIN.indexOf(range.from);
  const toIdx = TIME_SLOTS_30MIN.indexOf(range.to);
  const isInvalid = fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx;
  const isZeroDuration = fromIdx >= 0 && toIdx >= 0 && fromIdx === toIdx;
  const duration = getSlotDuration(range.from, range.to, TIME_SLOTS_30MIN);

  return (
    <div style={{
      padding: '0.6rem 0.65rem', borderRadius: '8px',
      border: `1px solid ${isInvalid ? '#ef444460' : isZeroDuration ? '#f9731640' : '#1e1e24'}`,
      backgroundColor: isInvalid ? '#ef444408' : isZeroDuration ? '#f9731608' : '#0d1117',
    }}>
      {total > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.65rem', fontWeight: 600 }}>
            {t('eventCoordinator.timeSlotLabel', 'Time Slot {{n}}', { n: index + 1 })}
          </span>
          {!disabled && (
            <button onClick={onRemove}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', padding: isMobile ? '0.35rem 0.6rem' : '0.1rem 0.3rem', borderRadius: '4px', opacity: 0.7, minHeight: isMobile ? '36px' : 'auto', WebkitTapHighlightColor: 'transparent' }}
              onPointerEnter={e => { e.currentTarget.style.opacity = '1'; }}
              onPointerLeave={e => { e.currentTarget.style.opacity = '0.7'; }}>
              ✕ {t('eventCoordinator.removeSlot', 'Remove')}
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.4rem' : '0.6rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ color: '#9ca3af', fontSize: '0.65rem', fontWeight: 600, display: 'block', marginBottom: '0.15rem' }}>{t('eventCoordinator.timeFrom', 'From')}</label>
          <ECTimeSlotDropdown value={range.from} onChange={(v) => {
            const fi = TIME_SLOTS_30MIN.indexOf(v);
            const ti = TIME_SLOTS_30MIN.indexOf(range.to);
            if (fi > ti) onChange({ from: v, to: v });
            else onChange({ ...range, from: v });
          }} disabled={disabled} isMobile={isMobile} />
        </div>
        <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, textAlign: 'center', paddingTop: isMobile ? '0' : '1.1rem', flexShrink: 0 }}>{t('eventCoordinator.timeTo', 'to')}</span>
        <div style={{ flex: 1 }}>
          <label style={{ color: '#9ca3af', fontSize: '0.65rem', fontWeight: 600, display: 'block', marginBottom: '0.15rem' }}>{t('eventCoordinator.timeTo_label', 'To')} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.55rem' }} title={t('eventCoordinator.toTooltip', 'End time — your availability runs up to this time')}>ⓘ</span></label>
          <ECTimeSlotDropdown value={range.to} onChange={(v) => onChange({ ...range, to: v })} disabled={disabled} isMobile={isMobile} minSlot={range.from} />
        </div>
      </div>
      {duration && !isInvalid && !isZeroDuration && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
          <span style={{ color: ACCENT, fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap' }}>⏱ {duration}</span>
          <div style={{ flex: 1, height: '3px', borderRadius: '2px', backgroundColor: '#1e1e24', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(fromIdx / (TIME_SLOTS_30MIN.length - 1)) * 100}%`,
              width: `${((toIdx - fromIdx) / (TIME_SLOTS_30MIN.length - 1)) * 100}%`,
              backgroundColor: ACCENT + '60', borderRadius: '2px',
              transition: 'left 0.2s ease, width 0.2s ease',
            }} />
          </div>
        </div>
      )}
      {isZeroDuration && (
        <p style={{ color: '#f97316', fontSize: '0.6rem', marginTop: '0.3rem', fontWeight: 600 }}>
          ⚠️ {t('eventCoordinator.zeroDuration', 'From and To are the same — this range covers no time.')}
        </p>
      )}
      {isInvalid && (
        <p style={{ color: '#ef4444', fontSize: '0.6rem', marginTop: '0.3rem', fontWeight: 600 }}>
          ⚠️ {t('eventCoordinator.invalidRange', '"To" must be equal to or after "From".')}
        </p>
      )}
    </div>
  );
};

// ─── My Availability Form (member view) ───
const MyAvailabilityForm: React.FC<{
  ec: ReturnType<typeof useAllianceEventCoordinator>;
  isMobile: boolean;
}> = ({ ec, isMobile }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1])); // Mon expanded by default

  // Initialize from existing data — convert individual slots to ranges
  const [dayRanges, setDayRanges] = useState<Record<number, TimeRange[]>>(() => {
    const initial: Record<number, TimeRange[]> = {};
    DAYS_OF_WEEK.forEach(d => { initial[d.value] = []; });
    ec.myAvailability.forEach(row => {
      const existing = initial[row.day_of_week] || [];
      const newRanges = slotsToRanges(row.time_slots);
      initial[row.day_of_week] = [...existing, ...newRanges];
    });
    return initial;
  });

  const memberName = profile?.linked_username || profile?.username || 'Unknown';

  const toggleDay = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const updateRange = (day: number, index: number, range: TimeRange) => {
    setDayRanges(prev => {
      const ranges = [...(prev[day] || [])];
      ranges[index] = range;
      return { ...prev, [day]: ranges };
    });
  };

  const removeRange = (day: number, index: number) => {
    setDayRanges(prev => {
      const ranges = (prev[day] || []).filter((_, i) => i !== index);
      return { ...prev, [day]: ranges };
    });
  };

  const addRange = (day: number) => {
    setDayRanges(prev => {
      const existing = prev[day] || [];
      const lastRange = existing[existing.length - 1];
      const lastToIdx = lastRange ? TIME_SLOTS_30MIN.indexOf(lastRange.to) : -1;
      const newFromIdx = lastToIdx > 0 && lastToIdx < TIME_SLOTS_30MIN.length - 1 ? lastToIdx : 24;
      const newToIdx = Math.min(newFromIdx + 12, TIME_SLOTS_30MIN.length - 1);
      const ranges = [...existing, { from: TIME_SLOTS_30MIN[newFromIdx] ?? '12:00', to: TIME_SLOTS_30MIN[newToIdx] ?? '18:00' }];
      return { ...prev, [day]: ranges };
    });
  };

  const clearDay = (day: number) => {
    setDayRanges(prev => ({ ...prev, [day]: [] }));
  };

  const handleSave = async () => {
    setSaving(true);
    const days = DAYS_OF_WEEK.map(d => ({
      day: d.value,
      slots: rangesToSlots(dayRanges[d.value] || []),
    }));
    const result = await ec.saveMyAvailability(memberName, days);
    setSaving(false);
    if (result.success) {
      showToast(t('eventCoordinator.saved', 'Availability saved!'), 'success');
    } else {
      showToast(result.error || 'Failed to save', 'error');
    }
  };

  const totalSlots = Object.values(dayRanges).reduce((sum, ranges) => sum + rangesToSlots(ranges).length, 0);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ backgroundColor: '#111111', borderRadius: '12px', border: `1px solid ${ACCENT_BORDER}`, padding: isMobile ? '1rem' : '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>👤</span>
          <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
            {t('eventCoordinator.yourAvailability', 'Your Availability')}
          </h3>
          <span style={{ color: '#6b7280', fontSize: '0.7rem', marginLeft: 'auto' }}>{memberName}</span>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
          {t('eventCoordinator.selectRanges', 'Select your available time ranges for each day. Times are in UTC.')}
          {' '}<span style={{ color: '#a855f7' }}>{TZ_ABBR} (UTC{UTC_OFFSET_HOURS >= 0 ? '+' : ''}{UTC_OFFSET_HOURS})</span>
        </p>

        {ec.myAvailability.length > 0 && (
          <div style={{ padding: '0.5rem 0.6rem', marginBottom: '0.75rem', backgroundColor: '#22c55e08', border: '1px solid #22c55e30', borderRadius: '8px', fontSize: '0.75rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ✅ {t('eventCoordinator.alreadySubmitted', 'You have already submitted. Editing will overwrite your previous data.')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {DAYS_OF_WEEK.map(day => {
            const isExpanded = expandedDays.has(day.value);
            const ranges = dayRanges[day.value] || [];
            const slotCount = rangesToSlots(ranges).length;
            return (
              <div key={day.value} style={{ borderRadius: '8px', border: `1px solid ${isExpanded ? ACCENT_BORDER : '#1e1e24'}`, backgroundColor: isExpanded ? '#3b82f608' : '#111116' }}>
                <button onClick={() => toggleDay(day.value)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem', border: 'none', borderRadius: '8px',
                  backgroundColor: 'transparent', cursor: 'pointer', minHeight: '44px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <span style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 600 }}>{day.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {slotCount > 0 && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: '3px', backgroundColor: ACCENT + '20', color: ACCENT }}>
                        {ranges.length} {ranges.length === 1 ? 'range' : 'ranges'} · {slotCount} slots
                      </span>
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div style={{ padding: '0 0.75rem 0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>
                        {t('eventCoordinator.selectTimeRange', 'Select time ranges for {{day}}', { day: day.label })}
                      </span>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        {/* Copy from another day */}
                        {DAYS_OF_WEEK.some(d => d.value !== day.value && (dayRanges[d.value] || []).length > 0) && (
                          <select
                            value=""
                            onChange={e => {
                              const srcDay = Number(e.target.value);
                              if (srcDay && dayRanges[srcDay]) {
                                setDayRanges(prev => ({ ...prev, [day.value]: [...(prev[srcDay] || []).map(r => ({ ...r }))] }));
                              }
                            }}
                            style={{ padding: '0.1rem 0.2rem', border: '1px solid #2a2a2a', backgroundColor: '#1a1a20', color: '#6b7280', fontSize: '0.6rem', fontWeight: 600, borderRadius: '4px', cursor: 'pointer' }}
                          >
                            <option value="">{t('eventCoordinator.copyFrom', 'Copy from...')}</option>
                            {DAYS_OF_WEEK.filter(d => d.value !== day.value && (dayRanges[d.value] || []).length > 0).map(d => (
                              <option key={d.value} value={d.value}>{d.short}</option>
                            ))}
                          </select>
                        )}
                        {slotCount > 0 && (
                          <button onClick={() => clearDay(day.value)} style={{ padding: '0.15rem 0.3rem', border: 'none', backgroundColor: 'transparent', color: '#ef4444', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer' }}>
                            {t('eventCoordinator.clearDay', 'Clear')}
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {ranges.map((range, idx) => (
                        <TimeRangeRow key={idx} range={range} index={idx} total={ranges.length}
                          onChange={(r) => updateRange(day.value, idx, r)}
                          onRemove={() => removeRange(day.value, idx)}
                          isMobile={isMobile} />
                      ))}
                      {ranges.length < 4 && (
                        <button onClick={() => addRange(day.value)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            padding: '0.5rem', borderRadius: '8px', border: `1px dashed ${ranges.length === 0 ? ACCENT + '60' : '#2a2a2a'}`,
                            backgroundColor: 'transparent', color: ranges.length === 0 ? ACCENT : '#6b7280',
                            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', minHeight: isMobile ? '48px' : '40px',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                          onPointerEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
                          onPointerLeave={e => { e.currentTarget.style.borderColor = ranges.length === 0 ? ACCENT + '60' : '#2a2a2a'; e.currentTarget.style.color = ranges.length === 0 ? ACCENT : '#6b7280'; }}>
                          + {t('eventCoordinator.addTimeRange', 'Add Time Range')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{totalSlots} total slots selected</span>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving}
            style={{ backgroundColor: ACCENT, borderColor: ACCENT }}>
            {t('eventCoordinator.saveAvailability', 'Save Availability')}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Heatmap Bar (mini visualization of slot activity for one day) ───
const HeatmapBar: React.FC<{
  dayTally: DayTally;
  maxGlobal: number;
  isMobile: boolean;
  expanded: boolean;
  onToggle: () => void;
}> = ({ dayTally, maxGlobal, isMobile, expanded, onToggle }) => {
  const { t } = useTranslation();
  const activeSlots = dayTally.slots.filter(s => s.count > 0);

  return (
    <div style={{ borderRadius: '8px', border: `1px solid ${expanded ? ACCENT_BORDER : '#1e1e24'}`, backgroundColor: expanded ? '#3b82f608' : '#111116' }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.5rem 0.75rem', border: 'none', borderRadius: '8px',
        backgroundColor: 'transparent', cursor: 'pointer', minHeight: '44px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 600, width: isMobile ? '32px' : '80px' }}>
            {isMobile ? DAYS_OF_WEEK[dayTally.day]?.short : dayTally.dayLabel}
          </span>
        </div>
        {/* Mini heatmap bar */}
        <div style={{ flex: 1, display: 'flex', gap: '0.5px', height: '14px', marginLeft: '0.5rem', marginRight: '0.5rem' }}>
          {dayTally.slots.filter((_, i) => i % 2 === 0).map((slot, i) => {
            const nextSlot = dayTally.slots[i * 2 + 1];
            const maxCount = Math.max(slot.count, nextSlot?.count ?? 0);
            const intensity = maxGlobal > 0 ? maxCount / maxGlobal : 0;
            return (
              <div key={i} style={{
                flex: 1, borderRadius: '1px',
                backgroundColor: maxCount > 0 ? ACCENT : '#1a1a20',
                opacity: maxCount > 0 ? 0.3 + intensity * 0.7 : 0.3,
              }} />
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          {dayTally.peakSlot && (
            <span style={{ fontSize: '0.6rem', color: ACCENT, fontWeight: 600 }}>
              🔥 {dayTally.peakSlot} ({dayTally.peakCount})
            </span>
          )}
        </div>
      </button>
      {expanded && (
        <div style={{ padding: '0 0.75rem 0.75rem' }}>
          {activeSlots.length === 0 ? (
            <p style={{ color: '#4b5563', fontSize: '0.75rem', textAlign: 'center', padding: '0.5rem 0' }}>
              {t('eventCoordinator.noActivity', 'No availability submitted for this day.')}
            </p>
          ) : (
            <>
              {/* Daily summary stats */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.6rem', color: '#6b7280', padding: '0.15rem 0.4rem', backgroundColor: '#1a1a20', borderRadius: '4px' }}>
                  {t('eventCoordinator.uniqueMembers', 'Members')}: <strong style={{ color: ACCENT }}>{[...new Set(activeSlots.flatMap(s => s.members))].length}</strong>
                </span>
                <span style={{ fontSize: '0.6rem', color: '#6b7280', padding: '0.15rem 0.4rem', backgroundColor: '#1a1a20', borderRadius: '4px' }}>
                  {t('eventCoordinator.activeSlots', 'Active Slots')}: <strong style={{ color: '#e5e7eb' }}>{activeSlots.length}</strong>/48
                </span>
                {dayTally.peakSlot && (
                  <span style={{ fontSize: '0.6rem', color: '#fbbf24', padding: '0.15rem 0.4rem', backgroundColor: '#fbbf240c', borderRadius: '4px', border: '1px solid #fbbf2420' }}>
                    🔥 {dayTally.peakSlot} ({dayTally.peakCount})
                  </span>
                )}
              </div>
              {/* Vertical slot histogram */}
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', minWidth: `${activeSlots.length * (isMobile ? 14 : 18)}px`, height: isMobile ? '100px' : '120px' }}>
                  {activeSlots.map(slot => {
                    const pct = maxGlobal > 0 ? (slot.count / maxGlobal) * 100 : 0;
                    const isHour = slot.slot.endsWith(':00');
                    return (
                      <div key={slot.slot} title={`${slot.slot} — ${slot.count} member${slot.count !== 1 ? 's' : ''}: ${slot.members.join(', ')}`}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: isMobile ? '12px' : '16px', position: 'relative' }}>
                        <span style={{ color: ACCENT, fontSize: '0.5rem', fontWeight: 700, marginBottom: '2px', opacity: slot.count > 0 ? 1 : 0 }}>{slot.count}</span>
                        <div style={{
                          width: '100%', borderRadius: '2px 2px 0 0',
                          backgroundColor: slot.count > 0 ? ACCENT : '#1a1a20',
                          opacity: slot.count > 0 ? 0.4 + (pct / 100) * 0.6 : 0.3,
                          height: `${Math.max(pct, slot.count > 0 ? 4 : 2)}%`,
                          transition: 'height 0.3s ease',
                        }} />
                        {isHour && (
                          <span style={{ color: '#6b7280', fontSize: '0.45rem', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap' }}>
                            {slot.slot.replace(':00', '')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Manual Input Modal (managers input availability for a member) ───
const ManualInputModal: React.FC<{
  ec: ReturnType<typeof useAllianceEventCoordinator>;
  onClose: () => void;
  isMobile: boolean;
  editMember?: string;
}> = ({ ec, onClose, isMobile, editMember }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [memberName, setMemberName] = useState(editMember || '');
  const [saving, setSaving] = useState(false);
  const [activeDayTab, setActiveDayTab] = useState(1); // Monday default

  // Initialize from existing data if editing — convert slots to ranges
  const [dayRanges, setDayRanges] = useState<Record<number, TimeRange[]>>(() => {
    const initial: Record<number, TimeRange[]> = {};
    DAYS_OF_WEEK.forEach(d => { initial[d.value] = []; });
    if (editMember) {
      ec.allAvailability
        .filter(r => r.member_name === editMember)
        .forEach(row => {
          const existing = initial[row.day_of_week] || [];
          const newRanges = slotsToRanges(row.time_slots);
          initial[row.day_of_week] = [...existing, ...newRanges];
        });
    }
    return initial;
  });

  const updateRange = (day: number, index: number, range: TimeRange) => {
    setDayRanges(prev => {
      const ranges = [...(prev[day] || [])];
      ranges[index] = range;
      return { ...prev, [day]: ranges };
    });
  };

  const removeRange = (day: number, index: number) => {
    setDayRanges(prev => {
      const ranges = (prev[day] || []).filter((_, i) => i !== index);
      return { ...prev, [day]: ranges };
    });
  };

  const addRange = (day: number) => {
    setDayRanges(prev => {
      const existing = prev[day] || [];
      const lastRange = existing[existing.length - 1];
      const lastToIdx = lastRange ? TIME_SLOTS_30MIN.indexOf(lastRange.to) : -1;
      const newFromIdx = lastToIdx > 0 && lastToIdx < TIME_SLOTS_30MIN.length - 1 ? lastToIdx : 24;
      const newToIdx = Math.min(newFromIdx + 12, TIME_SLOTS_30MIN.length - 1);
      const ranges = [...existing, { from: TIME_SLOTS_30MIN[newFromIdx] ?? '12:00', to: TIME_SLOTS_30MIN[newToIdx] ?? '18:00' }];
      return { ...prev, [day]: ranges };
    });
  };

  const handleSave = async () => {
    if (!memberName.trim()) return;
    setSaving(true);
    const days = DAYS_OF_WEEK.map(d => ({
      day: d.value,
      slots: rangesToSlots(dayRanges[d.value] || []),
    }));
    const result = await ec.saveForMember(memberName.trim(), days);
    setSaving(false);
    if (result.success) {
      showToast(t('eventCoordinator.manualSaved', 'Availability saved for {{name}}', { name: memberName.trim() }), 'success');
      onClose();
    } else {
      showToast(result.error || 'Failed to save', 'error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '0' : '1rem' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: isMobile ? '100%' : '520px', maxWidth: '520px', backgroundColor: '#111111', borderRadius: isMobile ? '16px 16px 0 0' : '16px', border: '1px solid #2a2a2a', padding: isMobile ? '1.25rem 1rem' : '1.5rem', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', maxHeight: isMobile ? '90vh' : '85vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: isMobile ? 'max(1.5rem, env(safe-area-inset-bottom))' : '1.5rem' }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          {editMember ? t('eventCoordinator.editMember', 'Edit Availability') : t('eventCoordinator.manualInput', 'Manual Input')}
        </h3>

        {!editMember && (
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
              {t('eventCoordinator.memberNameLabel', 'Member Name')} *
            </label>
            <input type="text" value={memberName} onChange={e => setMemberName(e.target.value.slice(0, 30))}
              placeholder="e.g. LordCommander" maxLength={30} style={inputBase} autoFocus />
          </div>
        )}

        {/* Day tabs */}
        <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '0.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {DAYS_OF_WEEK.map(day => {
            const ranges = dayRanges[day.value] || [];
            const slotCount = rangesToSlots(ranges).length;
            return (
              <button key={day.value} onClick={() => setActiveDayTab(day.value)} style={{
                padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                border: 'none', whiteSpace: 'nowrap', minHeight: '32px',
                backgroundColor: activeDayTab === day.value ? ACCENT + '20' : '#1a1a20',
                color: activeDayTab === day.value ? ACCENT : '#6b7280',
                outline: activeDayTab === day.value ? `1px solid ${ACCENT}40` : '1px solid #2a2a2a',
              }}>
                {day.short}{slotCount > 0 ? ` (${slotCount})` : ''}
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>
              {t('eventCoordinator.selectTimeRange', 'Select time ranges for {{day}}', { day: DAYS_OF_WEEK[activeDayTab]?.label || '' })}
            </span>
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              {DAYS_OF_WEEK.some(d => d.value !== activeDayTab && (dayRanges[d.value] || []).length > 0) && (
                <select
                  value=""
                  onChange={e => {
                    const srcDay = Number(e.target.value);
                    if (srcDay && dayRanges[srcDay]) {
                      setDayRanges(prev => ({ ...prev, [activeDayTab]: [...(prev[srcDay] || []).map(r => ({ ...r }))] }));
                    }
                  }}
                  style={{ padding: '0.1rem 0.2rem', border: '1px solid #2a2a2a', backgroundColor: '#1a1a20', color: '#6b7280', fontSize: '0.6rem', fontWeight: 600, borderRadius: '4px', cursor: 'pointer' }}
                >
                  <option value="">{t('eventCoordinator.copyFrom', 'Copy from...')}</option>
                  {DAYS_OF_WEEK.filter(d => d.value !== activeDayTab && (dayRanges[d.value] || []).length > 0).map(d => (
                    <option key={d.value} value={d.value}>{d.short}</option>
                  ))}
                </select>
              )}
              {(dayRanges[activeDayTab] || []).length > 0 && (
                <button onClick={() => setDayRanges(prev => ({ ...prev, [activeDayTab]: [] }))}
                  style={{ padding: isMobile ? '0.35rem 0.5rem' : '0.15rem 0.3rem', border: 'none', backgroundColor: 'transparent', color: '#ef4444', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', minHeight: isMobile ? '36px' : 'auto', WebkitTapHighlightColor: 'transparent' }}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(dayRanges[activeDayTab] || []).map((range, idx) => (
              <TimeRangeRow key={idx} range={range} index={idx} total={(dayRanges[activeDayTab] || []).length}
                onChange={(r) => updateRange(activeDayTab, idx, r)}
                onRemove={() => removeRange(activeDayTab, idx)}
                isMobile={isMobile} />
            ))}
            {(dayRanges[activeDayTab] || []).length < 4 && (
              <button onClick={() => addRange(activeDayTab)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  padding: '0.5rem', borderRadius: '8px',
                  border: `1px dashed ${(dayRanges[activeDayTab] || []).length === 0 ? ACCENT + '60' : '#2a2a2a'}`,
                  backgroundColor: 'transparent',
                  color: (dayRanges[activeDayTab] || []).length === 0 ? ACCENT : '#6b7280',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', minHeight: isMobile ? '48px' : '40px',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onPointerEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
                onPointerLeave={e => {
                  const empty = (dayRanges[activeDayTab] || []).length === 0;
                  e.currentTarget.style.borderColor = empty ? ACCENT + '60' : '#2a2a2a';
                  e.currentTarget.style.color = empty ? ACCENT : '#6b7280';
                }}>
                + {t('eventCoordinator.addTimeRange', 'Add Time Range')}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !memberName.trim()} loading={saving}
            style={{ flex: 1, backgroundColor: ACCENT, borderColor: ACCENT }}>
            {t('common.save', 'Save')}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Manager Dashboard ───
const ManagerDashboard: React.FC<{
  ec: ReturnType<typeof useAllianceEventCoordinator>;
  isMobile: boolean;
}> = ({ ec, isMobile }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [showManualInput, setShowManualInput] = useState(false);
  const [editMember, setEditMember] = useState<string | undefined>(undefined);

  const maxGlobal = useMemo(() => {
    let m = 0;
    ec.tallyByDay.forEach(d => d.slots.forEach(s => { if (s.count > m) m = s.count; }));
    return Math.max(1, m);
  }, [ec.tallyByDay]);

  const toggleExpandAll = () => {
    if (expandedDays.size >= 7) setExpandedDays(new Set());
    else setExpandedDays(new Set(DAYS_OF_WEEK.map(d => d.value)));
  };

  const handleDeleteMember = async (name: string) => {
    const result = await ec.deleteForMember(name);
    if (result.success) showToast(t('eventCoordinator.memberDeleted', '{{name}} availability removed', { name }), 'success');
    else showToast(result.error || 'Failed', 'error');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ padding: '0.6rem 0.9rem', backgroundColor: '#111111', borderRadius: '10px', border: '1px solid #1e1e24', flex: 1, minWidth: '120px' }}>
          <div style={{ color: '#6b7280', fontSize: '0.65rem', fontWeight: 600 }}>{t('eventCoordinator.members', 'Members')}</div>
          <div style={{ color: ACCENT, fontSize: '1.1rem', fontWeight: 700 }}>{ec.submittedMembers.length}</div>
        </div>
        <div style={{ padding: '0.6rem 0.9rem', backgroundColor: '#111111', borderRadius: '10px', border: '1px solid #1e1e24', flex: 'none', minWidth: isMobile ? '100%' : '320px' }}>
          <div style={{ color: '#6b7280', fontSize: '0.65rem', fontWeight: 600, marginBottom: '0.3rem' }}>
            {t('eventCoordinator.topPeakSlots', 'Top Peak Slots')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {(() => {
              // Collect all (day, slot, count) tuples, sort by count desc
              const all: { day: string; slot: string; count: number; slotIdx: number; dayIdx: number }[] = [];
              ec.tallyByDay.forEach(d => {
                d.slots.forEach((s, si) => {
                  if (s.count > 0) all.push({ day: d.dayLabel, slot: s.slot, count: s.count, slotIdx: si, dayIdx: d.day });
                });
              });
              all.sort((a, b) => b.count - a.count);
              // Pick top 4 that are well-separated (>= 4 slots = 2 hours apart, or different day)
              const picked: typeof all = [];
              for (const candidate of all) {
                if (picked.length >= 4) break;
                const tooClose = picked.some(p =>
                  p.dayIdx === candidate.dayIdx && Math.abs(p.slotIdx - candidate.slotIdx) < 4
                );
                if (!tooClose) picked.push(candidate);
              }
              if (picked.length === 0) return <span style={{ color: '#4b5563', fontSize: '0.8rem' }}>—</span>;
              return picked.map((p, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                  padding: '0.15rem 0.45rem', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 700,
                  backgroundColor: i === 0 ? '#fbbf2418' : '#fbbf240c',
                  border: `1px solid ${i === 0 ? '#fbbf2440' : '#fbbf2420'}`,
                  color: i === 0 ? '#fbbf24' : '#d4a520',
                }}>
                  {i === 0 && <span style={{ fontSize: '0.65rem' }}>🔥</span>}
                  {p.day.slice(0, 3)} {p.slot} ({p.count})
                </span>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Heatmap section */}
      <div style={{ backgroundColor: '#111111', borderRadius: '12px', border: `1px solid ${ACCENT_BORDER}`, padding: isMobile ? '1rem' : '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>🔥 {t('eventCoordinator.activityHeatmap', 'Activity Heatmap')}</h3>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button onClick={toggleExpandAll} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', backgroundColor: 'transparent', color: '#6b7280', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', minHeight: '32px' }}>
              {expandedDays.size >= 7 ? t('eventCoordinator.collapseAll', 'Collapse All') : t('eventCoordinator.expandAll', 'Expand All')}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {ec.tallyByDay.map(day => (
            <HeatmapBar key={day.day} dayTally={day} maxGlobal={maxGlobal} isMobile={isMobile}
              expanded={expandedDays.has(day.day)}
              onToggle={() => setExpandedDays(prev => {
                const next = new Set(prev);
                if (next.has(day.day)) next.delete(day.day); else next.add(day.day);
                return next;
              })} />
          ))}
        </div>
      </div>

      {/* Submitted members + manual input */}
      <div style={{ backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #1e1e24', padding: isMobile ? '1rem' : '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>👥 {t('eventCoordinator.submittedMembers', 'Submitted Members')}</h3>
          {ec.canManage && (
            <button onClick={() => { setEditMember(undefined); setShowManualInput(true); }}
              style={{ padding: '0.25rem 0.6rem', backgroundColor: ACCENT + '15', border: `1px solid ${ACCENT}30`, borderRadius: '6px', color: ACCENT, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', minHeight: '32px' }}>
              + {t('eventCoordinator.manualInput', 'Manual Input')}
            </button>
          )}
        </div>
        {ec.submittedMembers.length === 0 ? (
          <p style={{ color: '#4b5563', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
            {t('eventCoordinator.noSubmissions', 'No members have submitted their availability yet.')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '300px', overflowY: 'auto' }}>
            {ec.submittedMembers.map(name => {
              const rows = ec.allAvailability.filter(r => r.member_name === name);
              const dayCount = rows.length;
              const totalSlots = rows.reduce((sum, r) => sum + r.time_slots.length, 0);
              const isManualEntry = rows.some(r => r.added_by !== null);
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.6rem', backgroundColor: '#0d1117', borderRadius: '6px', border: '1px solid #1e1e24' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span style={{ color: '#e5e7eb', fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    {isManualEntry && (
                      <span style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', backgroundColor: '#f59e0b20', color: '#f59e0b', borderRadius: '3px', fontWeight: 700, flexShrink: 0 }}>MANUAL</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{dayCount}d / {totalSlots}s</span>
                    {ec.canManage && (
                      <>
                        <button onClick={() => { setEditMember(name); setShowManualInput(true); }}
                          style={{ padding: '0.15rem 0.3rem', border: 'none', backgroundColor: 'transparent', color: '#6b7280', fontSize: '0.6rem', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => handleDeleteMember(name)}
                          style={{ padding: '0.15rem 0.3rem', border: 'none', backgroundColor: 'transparent', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer' }}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showManualInput && (
        <ManualInputModal ec={ec} onClose={() => { setShowManualInput(false); setEditMember(undefined); }}
          isMobile={isMobile} editMember={editMember} />
      )}
    </div>
  );
};

// ─── Main Content ───
const EventCoordinatorContent: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const ec = useAllianceEventCoordinator();
  const [tab, setTab] = useState<'my' | 'overview'>('my');

  if (ec.allianceLoading || ec.availabilityLoading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (!ec.alliance) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📅</div>
        <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
          {t('eventCoordinator.noAlliance', 'No Alliance Center Found')}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', maxWidth: '400px', marginBottom: '1rem' }}>
          {t('eventCoordinator.noAllianceDesc', 'Create or join an Alliance Center first to use the Alliance Event Coordinator.')}
        </p>
        <Link to="/alliance-center" style={{ textDecoration: 'none' }}>
          <Button variant="primary">{t('eventCoordinator.goToAllianceCenter', 'Go to Alliance Center')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '0.5rem' : '1rem' }}>
      {/* Alliance info bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ padding: '0.2rem 0.5rem', backgroundColor: '#3b82f620', border: '1px solid #3b82f640', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace' }}>
          [{ec.alliance.tag}]
        </span>
        <span style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 600 }}>{ec.alliance.name}</span>
        <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>K{ec.alliance.kingdom_number}</span>
        <Link to="/alliance-center" style={{ color: '#6b7280', fontSize: '0.7rem', marginLeft: 'auto', textDecoration: 'none' }}>
          ← {t('eventCoordinator.backToAlliance', 'Alliance Center')}
        </Link>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.25rem' }}>
        {([
          { key: 'my' as const, label: t('eventCoordinator.myAvailTab', '📅 My Availability') },
          { key: 'overview' as const, label: ec.canManage ? t('eventCoordinator.dashboardTab', '📊 Manager Dashboard') : t('eventCoordinator.overviewTab', '📊 Overview') },
        ]).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: isMobile ? '0.5rem 0.75rem' : '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            border: 'none', minHeight: '44px',
            backgroundColor: tab === key ? ACCENT + '20' : '#111116',
            color: tab === key ? ACCENT : '#6b7280',
            outline: tab === key ? `1px solid ${ACCENT}40` : '1px solid #1e1e24',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'my' ? (
        <MyAvailabilityForm ec={ec} isMobile={isMobile} />
      ) : (
        <ManagerDashboard ec={ec} isMobile={isMobile} />
      )}
    </div>
  );
};

// ─── Main Page ───
const AllianceEventCoordinator: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  useDocumentTitle(t('eventCoordinator.pageTitle', 'Alliance Event Coordinator'));
  useStructuredData({
    type: 'BreadcrumbList',
    data: [
      ...(PAGE_BREADCRUMBS.tools || []),
      { name: 'Alliance Center', url: 'https://ks-atlas.com/alliance-center' },
      { name: 'Alliance Event Coordinator', url: 'https://ks-atlas.com/tools/event-coordinator' },
    ],
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div style={{ padding: isMobile ? '1.25rem 1rem 1rem' : '1.5rem 2rem 1.25rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <h1 style={{ fontSize: isMobile ? '1.3rem' : '1.75rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
          <span style={{ color: '#fff' }}>ALLIANCE EVENT </span>
          <span style={neonGlow('#3b82f6')}>COORDINATOR</span>
        </h1>
        <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
          {t('eventCoordinator.subtitle', 'Find the best times for your alliance events by collecting member availability.')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <Link to="/tools" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.75rem' }}>← {t('common.allTools', 'All Tools')}</Link>
        </div>
      </div>
      <EventCoordinatorGate>
        <EventCoordinatorContent />
      </EventCoordinatorGate>
    </div>
  );
};

export default AllianceEventCoordinator;
