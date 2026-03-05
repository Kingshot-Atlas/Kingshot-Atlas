// ─── Alliance Event Coordinator ─────────────────────────────────────────
// Members select 30-min time slots per day (UTC). Managers see tallied heatmap.
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { useToolAccess } from '../hooks/useToolAccess';
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

const ACCENT = '#10b981'; // emerald for event coordinator
const ACCENT_BORDER = '#10b98130';

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
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (!hasAccess) {
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

// ─── Slot Grid Picker (multi-select 30-min slots for one day) ───
const SlotGridPicker: React.FC<{
  slots: string[];
  onToggle: (slot: string) => void;
  onRangeSelect: (from: number, to: number) => void;
  disabled?: boolean;
  isMobile: boolean;
}> = ({ slots, onToggle, onRangeSelect, disabled, isMobile }) => {
  const selectedSet = useMemo(() => new Set(slots), [slots]);
  const [dragStart, setDragStart] = useState<number | null>(null);

  // Group into 2-hour blocks for a compact grid (4 slots per block)
  const blocks = useMemo(() => {
    const b: { label: string; slotsInBlock: string[] }[] = [];
    for (let h = 0; h < 24; h++) {
      const s1 = `${String(h).padStart(2, '0')}:00`;
      const s2 = `${String(h).padStart(2, '0')}:30`;
      b.push({ label: `${String(h).padStart(2, '0')}`, slotsInBlock: [s1, s2] });
    }
    return b;
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(6, 1fr)' : 'repeat(8, 1fr)', gap: '2px' }}>
      {blocks.map((block) => (
        <div key={block.label} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '0.55rem', color: '#6b7280', textAlign: 'center', padding: '0.1rem 0', fontWeight: 600 }}>
            {block.label}
          </div>
          <div style={{ display: 'flex', gap: '1px' }}>
            {block.slotsInBlock.map((slot) => {
              const idx = TIME_SLOTS_30MIN.indexOf(slot);
              const isSelected = selectedSet.has(slot);
              return (
                <button
                  key={slot}
                  disabled={disabled}
                  title={slot}
                  onMouseDown={() => setDragStart(idx)}
                  onMouseUp={() => {
                    if (dragStart !== null && dragStart !== idx) {
                      const from = Math.min(dragStart, idx);
                      const to = Math.max(dragStart, idx);
                      onRangeSelect(from, to);
                    } else {
                      onToggle(slot);
                    }
                    setDragStart(null);
                  }}
                  onMouseEnter={(e) => {
                    if (e.buttons === 1 && dragStart === null) setDragStart(idx);
                  }}
                  style={{
                    flex: 1,
                    height: isMobile ? '22px' : '20px',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    backgroundColor: isSelected ? ACCENT : '#1a1a20',
                    opacity: disabled ? 0.4 : isSelected ? 1 : 0.6,
                    transition: 'background-color 0.1s',
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
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

  // Initialize from existing data
  const [daySlots, setDaySlots] = useState<Record<number, string[]>>(() => {
    const initial: Record<number, string[]> = {};
    DAYS_OF_WEEK.forEach(d => { initial[d.value] = []; });
    ec.myAvailability.forEach(row => {
      initial[row.day_of_week] = [...(initial[row.day_of_week] || []), ...row.time_slots];
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

  const toggleSlot = (day: number, slot: string) => {
    setDaySlots(prev => {
      const current = prev[day] || [];
      const next = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
      return { ...prev, [day]: next };
    });
  };

  const handleRangeSelect = (day: number, from: number, to: number) => {
    setDaySlots(prev => {
      const current = new Set(prev[day] || []);
      for (let i = from; i <= to; i++) {
        const slot = TIME_SLOTS_30MIN[i];
        if (slot) current.add(slot);
      }
      return { ...prev, [day]: [...current] };
    });
  };

  const clearDay = (day: number) => {
    setDaySlots(prev => ({ ...prev, [day]: [] }));
  };

  const handleSave = async () => {
    setSaving(true);
    const days = DAYS_OF_WEEK.map(d => ({ day: d.value, slots: daySlots[d.value] || [] }));
    const result = await ec.saveMyAvailability(memberName, days);
    setSaving(false);
    if (result.success) {
      showToast(t('eventCoordinator.saved', 'Availability saved!'), 'success');
    } else {
      showToast(result.error || 'Failed to save', 'error');
    }
  };

  const totalSlots = Object.values(daySlots).reduce((sum, arr) => sum + arr.length, 0);

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
          {t('eventCoordinator.selectSlots', 'Select your available 30-minute time slots for each day in UTC.')}
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
            const slotCount = (daySlots[day.value] || []).length;
            return (
              <div key={day.value} style={{ borderRadius: '8px', border: `1px solid ${isExpanded ? ACCENT_BORDER : '#1e1e24'}`, backgroundColor: isExpanded ? '#10b98108' : '#111116' }}>
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
                        {slotCount} slots
                      </span>
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div style={{ padding: '0 0.75rem 0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>
                        {t('eventCoordinator.tapOrDrag', 'Tap slots or drag to select a range')}
                      </span>
                      {slotCount > 0 && (
                        <button onClick={() => clearDay(day.value)} style={{ padding: '0.15rem 0.3rem', border: 'none', backgroundColor: 'transparent', color: '#ef4444', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer' }}>
                          Clear
                        </button>
                      )}
                    </div>
                    <SlotGridPicker
                      slots={daySlots[day.value] || []}
                      onToggle={(slot) => toggleSlot(day.value, slot)}
                      onRangeSelect={(from, to) => handleRangeSelect(day.value, from, to)}
                      isMobile={isMobile}
                    />
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
    <div style={{ borderRadius: '8px', border: `1px solid ${expanded ? ACCENT_BORDER : '#1e1e24'}`, backgroundColor: expanded ? '#10b98108' : '#111116' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {activeSlots.map(slot => {
                const pct = maxGlobal > 0 ? (slot.count / maxGlobal) * 100 : 0;
                return (
                  <div key={slot.slot} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0' }}>
                    <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 600, width: '40px', textAlign: 'right', flexShrink: 0 }}>{slot.slot}</span>
                    <div style={{ flex: 1, height: '16px', backgroundColor: '#1a1a20', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: ACCENT, borderRadius: '3px', opacity: 0.8, minWidth: slot.count > 0 ? '2px' : '0', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ color: ACCENT, fontSize: '0.7rem', fontWeight: 600, width: '20px', textAlign: 'right', flexShrink: 0 }}>{slot.count}</span>
                    <span style={{ color: '#4b5563', fontSize: '0.55rem', width: isMobile ? '60px' : '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}
                      title={slot.members.join(', ')}>
                      {slot.members.join(', ')}
                    </span>
                  </div>
                );
              })}
            </div>
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

  // Initialize from existing data if editing
  const [daySlots, setDaySlots] = useState<Record<number, string[]>>(() => {
    const initial: Record<number, string[]> = {};
    DAYS_OF_WEEK.forEach(d => { initial[d.value] = []; });
    if (editMember) {
      ec.allAvailability
        .filter(r => r.member_name === editMember)
        .forEach(row => {
          initial[row.day_of_week] = [...(initial[row.day_of_week] || []), ...row.time_slots];
        });
    }
    return initial;
  });

  const toggleSlot = (day: number, slot: string) => {
    setDaySlots(prev => {
      const current = prev[day] || [];
      const next = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
      return { ...prev, [day]: next };
    });
  };

  const handleRangeSelect = (day: number, from: number, to: number) => {
    setDaySlots(prev => {
      const current = new Set(prev[day] || []);
      for (let i = from; i <= to; i++) {
        const slot = TIME_SLOTS_30MIN[i];
        if (slot) current.add(slot);
      }
      return { ...prev, [day]: [...current] };
    });
  };

  const handleSave = async () => {
    if (!memberName.trim()) return;
    setSaving(true);
    const days = DAYS_OF_WEEK.map(d => ({ day: d.value, slots: daySlots[d.value] || [] }));
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px', backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #2a2a2a', padding: isMobile ? '1rem' : '1.5rem', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', maxHeight: '85vh', overflowY: 'auto' }}>
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
            const slotCount = (daySlots[day.value] || []).length;
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>UTC slots for {DAYS_OF_WEEK[activeDayTab]?.label}</span>
            {(daySlots[activeDayTab] || []).length > 0 && (
              <button onClick={() => setDaySlots(prev => ({ ...prev, [activeDayTab]: [] }))}
                style={{ padding: '0.15rem 0.3rem', border: 'none', backgroundColor: 'transparent', color: '#ef4444', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer' }}>
                Clear
              </button>
            )}
          </div>
          <SlotGridPicker
            slots={daySlots[activeDayTab] || []}
            onToggle={(slot) => toggleSlot(activeDayTab, slot)}
            onRangeSelect={(from, to) => handleRangeSelect(activeDayTab, from, to)}
            isMobile={isMobile}
          />
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
        <div style={{ padding: '0.6rem 0.9rem', backgroundColor: '#111111', borderRadius: '10px', border: '1px solid #1e1e24', flex: 1, minWidth: '120px' }}>
          <div style={{ color: '#6b7280', fontSize: '0.65rem', fontWeight: 600 }}>{t('eventCoordinator.totalEntries', 'Total Entries')}</div>
          <div style={{ color: '#e5e7eb', fontSize: '1.1rem', fontWeight: 700 }}>{ec.allAvailability.length}</div>
        </div>
        <div style={{ padding: '0.6rem 0.9rem', backgroundColor: '#111111', borderRadius: '10px', border: '1px solid #1e1e24', flex: 1, minWidth: '120px' }}>
          <div style={{ color: '#6b7280', fontSize: '0.65rem', fontWeight: 600 }}>{t('eventCoordinator.peakSlot', 'Peak Slot')}</div>
          <div style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700 }}>
            {(() => {
              let peak = { day: '', slot: '', count: 0 };
              ec.tallyByDay.forEach(d => {
                if (d.peakCount > peak.count) {
                  peak = { day: d.dayLabel, slot: d.peakSlot || '', count: d.peakCount };
                }
              });
              return peak.count > 0 ? `${peak.day.slice(0, 3)} ${peak.slot} (${peak.count})` : '—';
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
          {t('eventCoordinator.noAllianceDesc', 'Create or join an Alliance Center first to use the Event Coordinator.')}
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
      { name: 'Alliance Event Coordinator', url: 'https://ks-atlas.com/tools/event-coordinator' },
    ],
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div style={{ padding: isMobile ? '1.25rem 1rem 1rem' : '1.5rem 2rem 1.25rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <h1 style={{ fontSize: isMobile ? '1.3rem' : '1.75rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
          <span style={{ color: '#fff' }}>EVENT </span>
          <span style={neonGlow(ACCENT)}>COORDINATOR</span>
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
