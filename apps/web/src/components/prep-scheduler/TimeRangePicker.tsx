import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import { TIME_SLOTS } from './types';
import { utcSlotToLocal } from './utils';

interface TimeRangePickerProps {
  ranges: string[][];
  onChange: (ranges: string[][]) => void;
  maxRanges?: number;
  accentColor: string;
  isMobile?: boolean;
}

const TimeRangePicker: React.FC<TimeRangePickerProps> = ({ ranges, onChange, maxRanges = 3, accentColor, isMobile = false }) => {
  const { t } = useTranslation();
  const addRange = () => { if (ranges.length < maxRanges) onChange([...ranges, ['10:00', '12:00']]); };
  const removeRange = (idx: number) => { onChange(ranges.filter((_, i) => i !== idx)); };
  const updateRange = (idx: number, pos: 0 | 1, value: string) => {
    const updated = [...ranges]; const current = updated[idx];
    if (!current) return; updated[idx] = [...current]; updated[idx]![pos] = value; onChange(updated);
  };

  const selectStyle: React.CSSProperties = {
    padding: isMobile ? '0.6rem 0.5rem' : '0.4rem 0.5rem',
    backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px',
    color: colors.text, fontSize: isMobile ? '1rem' : '0.8rem',
    flex: isMobile ? 1 : undefined, minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {ranges.map((range, idx) => (
        <div key={idx} style={{
          display: 'flex', alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? '0.4rem' : '0.5rem',
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '0.6rem' : 0,
          backgroundColor: isMobile ? `${accentColor}08` : 'transparent',
          borderRadius: isMobile ? '8px' : 0,
          border: isMobile ? `1px solid ${accentColor}15` : 'none',
        }}>
          {isMobile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: accentColor, fontSize: '0.7rem', fontWeight: 600, minWidth: '36px' }}>{t('prepScheduler.from', 'From')}</span>
                <select value={range[0] || '10:00'} onChange={(e) => updateRange(idx, 0, e.target.value)} style={selectStyle}>
                  {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot} UTC ({utcSlotToLocal(slot)})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: accentColor, fontSize: '0.7rem', fontWeight: 600, minWidth: '36px' }}>{t('prepScheduler.to', 'to')}</span>
                <select value={range[1] || '12:00'} onChange={(e) => updateRange(idx, 1, e.target.value)} style={selectStyle}>
                  {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot} UTC ({utcSlotToLocal(slot)})</option>)}
                </select>
              </div>
              <button onClick={() => removeRange(idx)} style={{
                alignSelf: 'flex-end', background: 'none', border: `1px solid ${colors.error}30`,
                borderRadius: '6px', color: colors.error, cursor: 'pointer', fontSize: '0.75rem',
                padding: '0.3rem 0.6rem', minHeight: '36px',
              }}>✕ {t('prepScheduler.remove', 'Remove')}</button>
            </>
          ) : (
            <>
              <select value={range[0] || '10:00'} onChange={(e) => updateRange(idx, 0, e.target.value)} style={selectStyle}>
                {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot} UTC ({utcSlotToLocal(slot)})</option>)}
              </select>
              <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{t('prepScheduler.to', 'to')}</span>
              <select value={range[1] || '12:00'} onChange={(e) => updateRange(idx, 1, e.target.value)} style={selectStyle}>
                {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot} UTC ({utcSlotToLocal(slot)})</option>)}
              </select>
              <button onClick={() => removeRange(idx)} style={{ background: 'none', border: 'none', color: colors.error, cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem' }}>×</button>
            </>
          )}
        </div>
      ))}
      {ranges.length < maxRanges && (
        <button onClick={addRange} style={{
          padding: isMobile ? '0.6rem 0.8rem' : '0.3rem 0.6rem',
          backgroundColor: `${accentColor}15`, border: `1px solid ${accentColor}30`, borderRadius: '6px',
          color: accentColor, fontSize: isMobile ? '0.85rem' : '0.75rem', cursor: 'pointer',
          width: isMobile ? '100%' : 'fit-content', minHeight: isMobile ? '44px' : undefined,
        }}>+ {t('prepScheduler.addTimeRange', 'Add Time Range')}</button>
      )}
    </div>
  );
};

export default TimeRangePicker;
