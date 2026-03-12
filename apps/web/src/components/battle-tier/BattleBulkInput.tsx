import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getEGBonusDisplay,
  getHeroesByTroopType,
  calculateOffenseScore,
  calculateDefenseScore,
  calculateWeightedOffenseScore,
  calculateWeightedDefenseScore,
  recalculateAll,
  recalculateAllWeighted,
  isTroopWeightsDefault,
  TROOP_COLORS,
  type BattlePlayerEntry,
  type BattleTierOverrides,
  type BattleTroopWeights,
} from '../../data/battleTierData';

// ─── Constants ──────────────────────────────────────────────────────────────

const EG_LEVELS = Array.from({ length: 11 }, (_, i) => i);
const infantryHeroes = getHeroesByTroopType('infantry');
const cavalryHeroes = getHeroesByTroopType('cavalry');
const archerHeroes = getHeroesByTroopType('archer');

const ACCENT = '#f97316';

interface BulkRow {
  id: string;
  playerName: string;
  infantryHero: string;
  infantryEGLevel: number;
  cavalryHero: string;
  cavalryEGLevel: number;
  archerHero: string;
  archerEGLevel: number;
  infantryAttack: string;
  infantryLethality: string;
  infantryDefense: string;
  infantryHealth: string;
  cavalryAttack: string;
  cavalryLethality: string;
  cavalryDefense: string;
  cavalryHealth: string;
  archerAttack: string;
  archerLethality: string;
  archerDefense: string;
  archerHealth: string;
}

const createEmptyRow = (): BulkRow => ({
  id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
  playerName: '',
  infantryHero: '', infantryEGLevel: -1,
  cavalryHero: '', cavalryEGLevel: -1,
  archerHero: '', archerEGLevel: -1,
  infantryAttack: '', infantryLethality: '', infantryDefense: '', infantryHealth: '',
  cavalryAttack: '', cavalryLethality: '', cavalryDefense: '', cavalryHealth: '',
  archerAttack: '', archerLethality: '', archerDefense: '', archerHealth: '',
});

// ─── Props ──────────────────────────────────────────────────────────────────

interface BattleBulkInputProps {
  existingPlayers: BattlePlayerEntry[];
  onSave: (allPlayers: BattlePlayerEntry[]) => void;
  onClose: () => void;
  isMobile: boolean;
  rosterNames?: string[];
  tierOverridesOffense?: BattleTierOverrides | null;
  tierOverridesDefense?: BattleTierOverrides | null;
  offenseWeights?: BattleTroopWeights;
  defenseWeights?: BattleTroopWeights;
}

// ─── Component ──────────────────────────────────────────────────────────────

const BattleBulkInput: React.FC<BattleBulkInputProps> = ({
  existingPlayers, onSave, onClose, isMobile, rosterNames = [],
  tierOverridesOffense, tierOverridesDefense,
  offenseWeights, defenseWeights,
}) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<BulkRow[]>(() => [createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  const [error, setError] = useState('');
  const [activeAutofill, setActiveAutofill] = useState<string | null>(null);
  const autofillRef = useRef<HTMLDivElement>(null);

  // Close autofill dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (autofillRef.current && !autofillRef.current.contains(e.target as Node)) {
        setActiveAutofill(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getSuggestions = useCallback((query: string) => {
    if (!query.trim() || rosterNames.length === 0) return [];
    const q = query.trim().toLowerCase();
    return rosterNames.filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 6);
  }, [rosterNames]);

  const updateRow = useCallback((rowId: string, field: keyof BulkRow, value: string | number) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    setError('');
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, createEmptyRow()]);
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== rowId));
  }, []);

  const filledRows = useMemo(() =>
    rows.filter(r => r.playerName.trim()),
    [rows]
  );

  const handleSave = useCallback(() => {
    const toProcess = rows.filter(r => r.playerName.trim());
    if (toProcess.length === 0) {
      setError(t('battleTier.bulkErrorEmpty', 'Add at least one player to save.'));
      return;
    }

    // Validate each filled row
    for (const r of toProcess) {
      if (!r.infantryHero || !r.cavalryHero || !r.archerHero) {
        setError(t('battleTier.bulkErrorHero', 'Row "{{name}}": All 3 heroes must be selected.', { name: r.playerName }));
        return;
      }
      if (r.infantryEGLevel < 0 || r.cavalryEGLevel < 0 || r.archerEGLevel < 0) {
        setError(t('battleTier.bulkErrorEG', 'Row "{{name}}": All Exclusive Gear levels must be selected.', { name: r.playerName }));
        return;
      }
      const statFields = [
        r.infantryAttack, r.infantryLethality, r.infantryDefense, r.infantryHealth,
        r.cavalryAttack, r.cavalryLethality, r.cavalryDefense, r.cavalryHealth,
        r.archerAttack, r.archerLethality, r.archerDefense, r.archerHealth,
      ];
      if (statFields.some(v => !v)) {
        setError(t('battleTier.bulkErrorStats', 'Row "{{name}}": All troop stat values are required.', { name: r.playerName }));
        return;
      }
    }

    // Build entries
    const newEntries: BattlePlayerEntry[] = toProcess.map(r => {
      const entry = {
        id: r.id,
        playerName: r.playerName.trim(),
        infantryHero: r.infantryHero,
        infantryEGLevel: r.infantryEGLevel,
        infantryAttack: parseFloat(r.infantryAttack) || 0,
        infantryLethality: parseFloat(r.infantryLethality) || 0,
        infantryDefense: parseFloat(r.infantryDefense) || 0,
        infantryHealth: parseFloat(r.infantryHealth) || 0,
        cavalryHero: r.cavalryHero,
        cavalryEGLevel: r.cavalryEGLevel,
        cavalryAttack: parseFloat(r.cavalryAttack) || 0,
        cavalryLethality: parseFloat(r.cavalryLethality) || 0,
        cavalryDefense: parseFloat(r.cavalryDefense) || 0,
        cavalryHealth: parseFloat(r.cavalryHealth) || 0,
        archerHero: r.archerHero,
        archerEGLevel: r.archerEGLevel,
        archerAttack: parseFloat(r.archerAttack) || 0,
        archerLethality: parseFloat(r.archerLethality) || 0,
        archerDefense: parseFloat(r.archerDefense) || 0,
        archerHealth: parseFloat(r.archerHealth) || 0,
        offenseScore: 0,
        defenseScore: 0,
        offenseTier: 'D' as const,
        defenseTier: 'D' as const,
      };
      const hasCustomWeights = (offenseWeights && !isTroopWeightsDefault(offenseWeights)) || (defenseWeights && !isTroopWeightsDefault(defenseWeights));
      entry.offenseScore = hasCustomWeights && offenseWeights ? calculateWeightedOffenseScore(entry, offenseWeights) : calculateOffenseScore(entry);
      entry.defenseScore = hasCustomWeights && defenseWeights ? calculateWeightedDefenseScore(entry, defenseWeights) : calculateDefenseScore(entry);
      return entry;
    });

    // Merge with existing and recalculate tiers
    const combined = [...existingPlayers, ...newEntries];
    const hasCustomWeights = (offenseWeights && !isTroopWeightsDefault(offenseWeights)) || (defenseWeights && !isTroopWeightsDefault(defenseWeights));
    if (hasCustomWeights && offenseWeights && defenseWeights) {
      onSave(recalculateAllWeighted(combined, tierOverridesOffense, tierOverridesDefense, offenseWeights, defenseWeights));
    } else {
      onSave(recalculateAll(combined, tierOverridesOffense, tierOverridesDefense));
    }
  }, [rows, existingPlayers, onSave, t, tierOverridesOffense, tierOverridesDefense, offenseWeights, defenseWeights]);

  // ── Shared styles ──
  const cellInput: React.CSSProperties = {
    width: '100%',
    padding: '0.4rem 0.5rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.8rem',
    outline: 'none',
    minWidth: 0,
    boxSizing: 'border-box',
  };
  const numInput: React.CSSProperties = { ...cellInput, minWidth: '54px' };
  const cellSelect: React.CSSProperties = {
    ...cellInput,
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.4rem center',
    paddingRight: '1.4rem',
  };
  const headerCell: React.CSSProperties = {
    fontSize: '0.6rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '0.25rem 0.15rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  // ── Autofill dropdown renderer ──
  const renderAutofill = (row: BulkRow) => (
    activeAutofill === row.id && getSuggestions(row.playerName).length > 0 && (
      <div style={{
        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
        backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px',
        marginTop: '2px', maxHeight: '150px', overflowY: 'auto',
        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
      }}>
        {getSuggestions(row.playerName).map(name => (
          <button key={name} type="button" onClick={() => { updateRow(row.id, 'playerName', name); setActiveAutofill(null); }} style={{
            width: '100%', padding: '0.35rem 0.6rem', textAlign: 'left',
            background: 'none', border: 'none', borderBottom: '1px solid #2a2a2a',
            color: '#d1d5db', fontSize: '0.78rem', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span style={{ color: '#fff', fontWeight: 600 }}>{name}</span>
          </button>
        ))}
      </div>
    )
  );

  // ── Mobile: card-per-row layout ──
  if (isMobile) {
    return (
      <div style={{
        backgroundColor: '#0d0d0d',
        borderRadius: '16px',
        border: `1px solid ${ACCENT}30`,
        padding: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
            📋 {t('battleTier.bulkAddTitle', 'Bulk Add Players')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}>
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          {t('battleTier.bulkAddDesc', 'Fill in each row with player data. Empty rows are skipped.')}
        </p>

        {rows.map((row, idx) => (
          <div key={row.id} style={{
            backgroundColor: '#111111',
            borderRadius: '12px',
            border: '1px solid #2a2a2a',
            padding: '0.75rem',
            marginBottom: '0.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280' }}>#{idx + 1}</span>
              {rows.length > 1 && (
                <button onClick={() => removeRow(row.id)} style={{ background: 'none', border: 'none', color: '#6b728060', cursor: 'pointer', padding: '0.2rem' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            {/* Name with autofill */}
            <div style={{ position: 'relative', marginBottom: '0.4rem' }} ref={activeAutofill === row.id ? autofillRef : undefined}>
              <input
                placeholder={t('battleTier.enterName', 'Player name')}
                value={row.playerName}
                onChange={e => { updateRow(row.id, 'playerName', e.target.value); setActiveAutofill(row.id); }}
                onFocus={() => setActiveAutofill(row.id)}
                style={cellInput}
                autoComplete="off"
              />
              {renderAutofill(row)}
            </div>
            {/* ① Heroes & Exclusive Gear */}
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              {t('battleTier.sectionHeroesGear', '① Heroes & Exclusive Gear')}
            </div>
            {([
              ['infantry', '🛡️', infantryHeroes, 'infantryHero', 'infantryEGLevel', TROOP_COLORS.infantry] as const,
              ['cavalry', '🐎', cavalryHeroes, 'cavalryHero', 'cavalryEGLevel', TROOP_COLORS.cavalry] as const,
              ['archer', '🏹', archerHeroes, 'archerHero', 'archerEGLevel', TROOP_COLORS.archer] as const,
            ] as const).map(([troop, emoji, heroes, hKey, eKey]) => (
              <div key={troop} style={{ marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 600 }}>{emoji} {troop.charAt(0).toUpperCase() + troop.slice(1)}</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginTop: '0.15rem' }}>
                  <select value={row[hKey]} onChange={e => updateRow(row.id, hKey, e.target.value)} style={cellSelect}>
                    <option value="" disabled>Hero</option>
                    {heroes.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                  </select>
                  <select value={row[eKey]} onChange={e => updateRow(row.id, eKey, parseInt(e.target.value))} style={cellSelect}>
                    <option value={-1} disabled>EG Lv</option>
                    {EG_LEVELS.map(l => <option key={l} value={l}>Lv {l} ({getEGBonusDisplay(l)}%)</option>)}
                  </select>
                </div>
              </div>
            ))}
            {/* ② Troop Bonus Stats */}
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginTop: '0.4rem', marginBottom: '0.25rem' }}>
              {t('battleTier.sectionTroopBonuses', '② Troop Bonus Stats')}
            </div>
            {([
              ['infantry', '🛡️', 'infantryAttack', 'infantryLethality', 'infantryDefense', 'infantryHealth'] as const,
              ['cavalry', '🐎', 'cavalryAttack', 'cavalryLethality', 'cavalryDefense', 'cavalryHealth'] as const,
              ['archer', '🏹', 'archerAttack', 'archerLethality', 'archerDefense', 'archerHealth'] as const,
            ] as const).map(([troop, emoji, aKey, lKey, dKey, hKey]) => (
              <div key={troop} style={{ marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 600 }}>{emoji} {troop.charAt(0).toUpperCase() + troop.slice(1)}</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.3rem', marginTop: '0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Atk %" value={row[aKey]} onChange={e => updateRow(row.id, aKey, e.target.value)} style={numInput} />
                  <input type="number" step="0.1" placeholder="Lth %" value={row[lKey]} onChange={e => updateRow(row.id, lKey, e.target.value)} style={numInput} />
                  <input type="number" step="0.1" placeholder="Def %" value={row[dKey]} onChange={e => updateRow(row.id, dKey, e.target.value)} style={numInput} />
                  <input type="number" step="0.1" placeholder="HP %" value={row[hKey]} onChange={e => updateRow(row.id, hKey, e.target.value)} style={numInput} />
                </div>
              </div>
            ))}
          </div>
        ))}

        <button onClick={addRow} style={{
          width: '100%', padding: '0.5rem', backgroundColor: '#1a1a1a', border: '1px dashed #333',
          borderRadius: '8px', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '0.75rem',
        }}>
          + {t('battleTier.bulkAddRow', 'Add Row')}
        </button>

        {error && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{error}</p>}

        <button onClick={handleSave} style={{
          width: '100%', padding: '0.7rem', backgroundColor: ACCENT, border: 'none',
          borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
        }}>
          {t('battleTier.bulkSave', 'Save {{count}} Players', { count: filledRows.length })}
        </button>
      </div>
    );
  }

  // ── Desktop: spreadsheet table layout ──
  return (
    <div style={{
      backgroundColor: '#0d0d0d',
      borderRadius: '16px',
      border: `1px solid ${ACCENT}30`,
      padding: '1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
          📋 {t('battleTier.bulkAddTitle', 'Bulk Add Players')}
        </h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}>
          {t('common.cancel', 'Cancel')}
        </button>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
        {t('battleTier.bulkAddDesc', 'Fill in each row with player data. Empty rows are skipped.')}
      </p>

      <div style={{ overflowX: 'auto', marginBottom: '0.75rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1400px' }}>
          <thead>
            {/* Group header row */}
            <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
              <th colSpan={2} style={{ padding: 0 }} />
              <th colSpan={6} style={{ ...headerCell, textAlign: 'center', color: '#9ca3af', fontSize: '0.5rem', padding: '0.25rem 0', borderBottom: '1px solid #9ca3af20' }}>
                {t('battleTier.sectionHeroesGearShort', 'Heroes & Gear')}
              </th>
              <th colSpan={12} style={{ ...headerCell, textAlign: 'center', color: '#9ca3af', fontSize: '0.5rem', padding: '0.25rem 0', borderBottom: '1px solid #9ca3af20' }}>
                {t('battleTier.sectionTroopStatsShort', 'Troop Stats (ATK / LTH / DEF / HP)')}
              </th>
              <th style={{ padding: 0 }} />
            </tr>
            {/* Column header row */}
            <tr style={{ borderBottom: '2px solid #2a2a2a' }}>
              <th style={{ ...headerCell, width: '24px' }}>#</th>
              <th style={{ ...headerCell, minWidth: '100px' }}>{t('battleTier.player', 'Player')}</th>
              {/* Heroes & Gear */}
              <th style={{ ...headerCell, minWidth: '72px', color: TROOP_COLORS.infantry }}>🛡️ Hero</th>
              <th style={{ ...headerCell, minWidth: '52px', color: TROOP_COLORS.infantry }}>🛡️ EG</th>
              <th style={{ ...headerCell, minWidth: '72px', color: TROOP_COLORS.cavalry }}>🐎 Hero</th>
              <th style={{ ...headerCell, minWidth: '52px', color: TROOP_COLORS.cavalry }}>🐎 EG</th>
              <th style={{ ...headerCell, minWidth: '72px', color: TROOP_COLORS.archer }}>🏹 Hero</th>
              <th style={{ ...headerCell, minWidth: '52px', color: TROOP_COLORS.archer }}>🏹 EG</th>
              {/* INF stats */}
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.infantry }}>🛡️Atk</th>
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.infantry }}>🛡️Lth</th>
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.infantry }}>🛡️Def</th>
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.infantry }}>🛡️HP</th>
              {/* CAV stats */}
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.cavalry }}>🐎Atk</th>
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.cavalry }}>🐎Lth</th>
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.cavalry }}>🐎Def</th>
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.cavalry }}>🐎HP</th>
              {/* ARC stats */}
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.archer }}>🏹Atk</th>
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.archer }}>🏹Lth</th>
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.archer }}>🏹Def</th>
              <th style={{ ...headerCell, minWidth: '54px', color: TROOP_COLORS.archer }}>🏹HP</th>
              <th style={{ ...headerCell, width: '28px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={{ padding: '0.3rem 0.15rem', fontSize: '0.7rem', color: '#4b5563', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <div style={{ position: 'relative' }} ref={activeAutofill === row.id ? autofillRef : undefined}>
                    <input
                      placeholder={t('battleTier.enterName', 'Name')}
                      value={row.playerName}
                      onChange={e => { updateRow(row.id, 'playerName', e.target.value); setActiveAutofill(row.id); }}
                      onFocus={() => setActiveAutofill(row.id)}
                      style={cellInput}
                      autoComplete="off"
                    />
                    {renderAutofill(row)}
                  </div>
                </td>
                {/* ── Heroes & Gear: INF → CAV → ARC ── */}
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <select value={row.infantryHero} onChange={e => updateRow(row.id, 'infantryHero', e.target.value)} style={cellSelect}>
                    <option value="" disabled>—</option>
                    {infantryHeroes.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <select value={row.infantryEGLevel} onChange={e => updateRow(row.id, 'infantryEGLevel', parseInt(e.target.value))} style={cellSelect}>
                    <option value={-1} disabled>—</option>
                    {EG_LEVELS.map(l => <option key={l} value={l}>Lv{l}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <select value={row.cavalryHero} onChange={e => updateRow(row.id, 'cavalryHero', e.target.value)} style={cellSelect}>
                    <option value="" disabled>—</option>
                    {cavalryHeroes.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <select value={row.cavalryEGLevel} onChange={e => updateRow(row.id, 'cavalryEGLevel', parseInt(e.target.value))} style={cellSelect}>
                    <option value={-1} disabled>—</option>
                    {EG_LEVELS.map(l => <option key={l} value={l}>Lv{l}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <select value={row.archerHero} onChange={e => updateRow(row.id, 'archerHero', e.target.value)} style={cellSelect}>
                    <option value="" disabled>—</option>
                    {archerHeroes.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <select value={row.archerEGLevel} onChange={e => updateRow(row.id, 'archerEGLevel', parseInt(e.target.value))} style={cellSelect}>
                    <option value={-1} disabled>—</option>
                    {EG_LEVELS.map(l => <option key={l} value={l}>Lv{l}</option>)}
                  </select>
                </td>
                {/* ── Troop Stats: INF → CAV → ARC ── */}
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Atk" value={row.infantryAttack} onChange={e => updateRow(row.id, 'infantryAttack', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Lth" value={row.infantryLethality} onChange={e => updateRow(row.id, 'infantryLethality', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Def" value={row.infantryDefense} onChange={e => updateRow(row.id, 'infantryDefense', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="HP" value={row.infantryHealth} onChange={e => updateRow(row.id, 'infantryHealth', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Atk" value={row.cavalryAttack} onChange={e => updateRow(row.id, 'cavalryAttack', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Lth" value={row.cavalryLethality} onChange={e => updateRow(row.id, 'cavalryLethality', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Def" value={row.cavalryDefense} onChange={e => updateRow(row.id, 'cavalryDefense', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="HP" value={row.cavalryHealth} onChange={e => updateRow(row.id, 'cavalryHealth', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Atk" value={row.archerAttack} onChange={e => updateRow(row.id, 'archerAttack', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Lth" value={row.archerLethality} onChange={e => updateRow(row.id, 'archerLethality', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Def" value={row.archerDefense} onChange={e => updateRow(row.id, 'archerDefense', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem' }}>
                  <input type="number" step="0.1" placeholder="HP" value={row.archerHealth} onChange={e => updateRow(row.id, 'archerHealth', e.target.value)} style={numInput} />
                </td>
                <td style={{ padding: '0.3rem 0.15rem', textAlign: 'center' }}>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(row.id)} style={{ background: 'none', border: 'none', color: '#6b728060', cursor: 'pointer', padding: '0.2rem' }} title="Remove row">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <button onClick={addRow} style={{
        width: '100%', padding: '0.45rem', backgroundColor: '#1a1a1a', border: '1px dashed #333',
        borderRadius: '8px', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '0.75rem',
        transition: 'border-color 0.2s',
      }}>
        + {t('battleTier.bulkAddRow', 'Add Row')}
      </button>

      {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{error}</p>}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={handleSave} style={{
          flex: 1, padding: '0.7rem', backgroundColor: ACCENT, border: 'none',
          borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          boxShadow: `0 4px 20px ${ACCENT}35`,
        }}>
          {t('battleTier.bulkSave', 'Save {{count}} Players', { count: filledRows.length })}
        </button>
      </div>
    </div>
  );
};

export default BattleBulkInput;
