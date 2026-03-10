import React from 'react';
import { inputBase, MIN_TIER, MAX_TIER, MIN_TG, MAX_TG } from './allianceCenterConstants';

// ─── Tier/TG select helper ───
const TroopSelect: React.FC<{
  label: string; color: string;
  tier: number | null; tg: number | null;
  onTierChange: (v: number | null) => void; onTgChange: (v: number | null) => void;
}> = ({ label, color, tier, tg, onTierChange, onTgChange }) => {
  const selStyle: React.CSSProperties = { ...inputBase, padding: '0.35rem 0.4rem', fontSize: '0.8rem', appearance: 'auto' as const };
  return (
    <div>
      <label style={{ color, fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>{label}</label>
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        <select value={tier ?? ''} onChange={e => onTierChange(e.target.value ? Number(e.target.value) : null)} style={{ ...selStyle, flex: 1 }}>
          <option value="">Tier</option>
          {Array.from({ length: MAX_TIER - MIN_TIER + 1 }, (_, i) => MIN_TIER + i).map(t => (
            <option key={t} value={t}>T{t}</option>
          ))}
        </select>
        <select value={tg ?? ''} onChange={e => onTgChange(e.target.value ? Number(e.target.value) : null)} style={{ ...selStyle, flex: 1 }}>
          <option value="">TG</option>
          {Array.from({ length: MAX_TG - MIN_TG + 1 }, (_, i) => MIN_TG + i).map(t => (
            <option key={t} value={t}>TG{t}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default TroopSelect;
