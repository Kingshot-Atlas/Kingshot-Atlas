import React, { useState, useRef, useEffect } from 'react';
import { DAY_SHORT } from './allianceCenterConstants';

/** Renders a visual per-day availability bar chart inside a hover/click popover */
const AvailTooltip: React.FC<{
  avail: { days: number; slots: number; byDay: { day: number; slots: string[] }[] };
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string;
}> = ({ avail, t }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sort byDay and build bar data — 48 half-hour slots per day (0-47)
  const sortedDays = [...avail.byDay].sort((a, b) => a.day - b.day);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: '#10b981', fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
        }}
      >
        {t('allianceCenter.availYes', 'Yes')} <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: '6px', zIndex: 50, backgroundColor: '#111827', border: '1px solid #22d3ee40',
          borderRadius: '8px', padding: '0.5rem 0.6rem', boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          minWidth: '180px', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9ca3af', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {t('allianceCenter.availSchedule', 'Availability')}
          </div>
          {sortedDays.map(d => {
            // Convert slot strings to indices for the bar visualization
            const slotSet = new Set(d.slots.map(s => {
              const parts = s.split(':').map(Number);
              return (parts[0] ?? 0) * 2 + ((parts[1] ?? 0) >= 30 ? 1 : 0);
            }));
            return (
              <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.6rem', color: '#6b7280', width: '26px', flexShrink: 0, fontWeight: 600 }}>{DAY_SHORT[d.day]}</span>
                <div style={{ display: 'flex', flex: 1, height: '8px', borderRadius: '2px', overflow: 'hidden', backgroundColor: '#1a1a24' }}>
                  {Array.from({ length: 48 }, (_, i) => (
                    <div key={i} style={{
                      flex: 1, backgroundColor: slotSet.has(i) ? '#10b981' : 'transparent',
                      borderRight: i % 4 === 3 ? '1px solid #0d111720' : 'none',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '0.5rem', color: '#4b5563', width: '20px', textAlign: 'right', flexShrink: 0 }}>{d.slots.length}</span>
              </div>
            );
          })}
          <div style={{ fontSize: '0.5rem', color: '#4b5563', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>00:00</span><span>12:00</span><span>24:00</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailTooltip;
