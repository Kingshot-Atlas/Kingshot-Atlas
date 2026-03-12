import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getHeroesByTroopType,
  EG_BONUS_BY_LEVEL,
  calculateOffenseScore,
  calculateDefenseScore,
  calculateWeightedOffenseScore,
  calculateWeightedDefenseScore,
  recalculateAll,
  recalculateAllWeighted,
  isTroopWeightsDefault,
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

interface EditRow {
  id: string;
  playerName: string;
  infantryHero: string;
  infantryEGLevel: number;
  infantryAttack: string;
  infantryLethality: string;
  infantryDefense: string;
  infantryHealth: string;
  cavalryHero: string;
  cavalryEGLevel: number;
  cavalryAttack: string;
  cavalryLethality: string;
  cavalryDefense: string;
  cavalryHealth: string;
  archerHero: string;
  archerEGLevel: number;
  archerAttack: string;
  archerLethality: string;
  archerDefense: string;
  archerHealth: string;
  isNew: boolean;
}

const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ─── Props ──────────────────────────────────────────────────────────────────

interface BattleBulkEditProps {
  existingPlayers: BattlePlayerEntry[];
  onSave: (updatedPlayers: BattlePlayerEntry[]) => void;
  onClose: () => void;
  isMobile: boolean;
  tierOverridesOffense?: BattleTierOverrides | null;
  tierOverridesDefense?: BattleTierOverrides | null;
  offenseWeights?: BattleTroopWeights;
  defenseWeights?: BattleTroopWeights;
}

// ─── Component ──────────────────────────────────────────────────────────────

const BattleBulkEdit: React.FC<BattleBulkEditProps> = ({
  existingPlayers, onSave, onClose, isMobile,
  tierOverridesOffense, tierOverridesDefense,
  offenseWeights, defenseWeights,
}) => {
  const { t } = useTranslation();

  const [rows, setRows] = useState<EditRow[]>(() => {
    return existingPlayers.map(p => ({
      id: p.id,
      playerName: p.playerName,
      infantryHero: p.infantryHero,
      infantryEGLevel: p.infantryEGLevel,
      infantryAttack: p.infantryAttack ? p.infantryAttack.toString() : '',
      infantryLethality: p.infantryLethality ? p.infantryLethality.toString() : '',
      infantryDefense: p.infantryDefense ? p.infantryDefense.toString() : '',
      infantryHealth: p.infantryHealth ? p.infantryHealth.toString() : '',
      cavalryHero: p.cavalryHero,
      cavalryEGLevel: p.cavalryEGLevel,
      cavalryAttack: p.cavalryAttack ? p.cavalryAttack.toString() : '',
      cavalryLethality: p.cavalryLethality ? p.cavalryLethality.toString() : '',
      cavalryDefense: p.cavalryDefense ? p.cavalryDefense.toString() : '',
      cavalryHealth: p.cavalryHealth ? p.cavalryHealth.toString() : '',
      archerHero: p.archerHero,
      archerEGLevel: p.archerEGLevel,
      archerAttack: p.archerAttack ? p.archerAttack.toString() : '',
      archerLethality: p.archerLethality ? p.archerLethality.toString() : '',
      archerDefense: p.archerDefense ? p.archerDefense.toString() : '',
      archerHealth: p.archerHealth ? p.archerHealth.toString() : '',
      isNew: false,
    }));
  });

  const [error, setError] = useState('');

  const updateRow = useCallback((rowId: string, field: keyof EditRow, value: string | number | boolean) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    setError('');
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, {
      id: genId(),
      playerName: '',
      infantryHero: '', infantryEGLevel: -1,
      infantryAttack: '', infantryLethality: '', infantryDefense: '', infantryHealth: '',
      cavalryHero: '', cavalryEGLevel: -1,
      cavalryAttack: '', cavalryLethality: '', cavalryDefense: '', cavalryHealth: '',
      archerHero: '', archerEGLevel: -1,
      archerAttack: '', archerLethality: '', archerDefense: '', archerHealth: '',
      isNew: true,
    }]);
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== rowId));
  }, []);

  const completeRows = useMemo(() =>
    rows.filter(r =>
      r.playerName.trim() &&
      r.infantryHero && r.cavalryHero && r.archerHero &&
      r.infantryEGLevel >= 0 && r.cavalryEGLevel >= 0 && r.archerEGLevel >= 0 &&
      r.infantryAttack && r.infantryLethality && r.infantryDefense && r.infantryHealth &&
      r.cavalryAttack && r.cavalryLethality && r.cavalryDefense && r.cavalryHealth &&
      r.archerAttack && r.archerLethality && r.archerDefense && r.archerHealth
    ),
    [rows]
  );

  const handleSave = useCallback(() => {
    const namedRows = rows.filter(r => r.playerName.trim());
    if (namedRows.length === 0) {
      setError(t('battleTier.bulkErrorEmpty', 'Add at least one player to save.'));
      return;
    }

    const hasAnyData = (r: EditRow) =>
      !!(r.infantryHero || r.cavalryHero || r.archerHero ||
         r.infantryAttack || r.infantryLethality || r.infantryDefense || r.infantryHealth ||
         r.cavalryAttack || r.cavalryLethality || r.cavalryDefense || r.cavalryHealth ||
         r.archerAttack || r.archerLethality || r.archerDefense || r.archerHealth);

    for (const r of namedRows) {
      if (!hasAnyData(r)) continue;
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
      if (statFields.some(f => !f)) {
        setError(t('battleTier.bulkErrorStats', 'Row "{{name}}": All stat values are required.', { name: r.playerName }));
        return;
      }
    }

    const entries: BattlePlayerEntry[] = namedRows.map(r => {
      const playerData = {
        infantryHero: r.infantryHero, infantryEGLevel: r.infantryEGLevel >= 0 ? r.infantryEGLevel : 0,
        infantryAttack: parseFloat(r.infantryAttack) || 0, infantryLethality: parseFloat(r.infantryLethality) || 0,
        infantryDefense: parseFloat(r.infantryDefense) || 0, infantryHealth: parseFloat(r.infantryHealth) || 0,
        cavalryHero: r.cavalryHero, cavalryEGLevel: r.cavalryEGLevel >= 0 ? r.cavalryEGLevel : 0,
        cavalryAttack: parseFloat(r.cavalryAttack) || 0, cavalryLethality: parseFloat(r.cavalryLethality) || 0,
        cavalryDefense: parseFloat(r.cavalryDefense) || 0, cavalryHealth: parseFloat(r.cavalryHealth) || 0,
        archerHero: r.archerHero, archerEGLevel: r.archerEGLevel >= 0 ? r.archerEGLevel : 0,
        archerAttack: parseFloat(r.archerAttack) || 0, archerLethality: parseFloat(r.archerLethality) || 0,
        archerDefense: parseFloat(r.archerDefense) || 0, archerHealth: parseFloat(r.archerHealth) || 0,
      };

      const complete = hasAnyData(r);
      const hasCustomWeights = (offenseWeights && !isTroopWeightsDefault(offenseWeights)) || (defenseWeights && !isTroopWeightsDefault(defenseWeights));
      return {
        id: r.id,
        playerName: r.playerName.trim(),
        ...playerData,
        offenseScore: complete
          ? (hasCustomWeights && offenseWeights ? calculateWeightedOffenseScore(playerData, offenseWeights) : calculateOffenseScore(playerData))
          : 0,
        defenseScore: complete
          ? (hasCustomWeights && defenseWeights ? calculateWeightedDefenseScore(playerData, defenseWeights) : calculateDefenseScore(playerData))
          : 0,
        offenseTier: 'D' as const,
        defenseTier: 'D' as const,
      };
    });

    const hasCustomWeights = (offenseWeights && !isTroopWeightsDefault(offenseWeights)) || (defenseWeights && !isTroopWeightsDefault(defenseWeights));
    if (hasCustomWeights && offenseWeights && defenseWeights) {
      onSave(recalculateAllWeighted(entries, tierOverridesOffense, tierOverridesDefense, offenseWeights, defenseWeights));
    } else {
      onSave(recalculateAll(entries, tierOverridesOffense, tierOverridesDefense));
    }
  }, [rows, onSave, t, tierOverridesOffense, tierOverridesDefense, offenseWeights, defenseWeights]);

  // ── Shared styles ──
  const cellInput: React.CSSProperties = {
    width: '100%', padding: '0.35rem 0.4rem',
    backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: '6px', color: '#fff', fontSize: '0.75rem',
    outline: 'none', minWidth: 0, boxSizing: 'border-box',
  };
  const numInput: React.CSSProperties = { ...cellInput, minWidth: '58px' };
  const cellSelect: React.CSSProperties = {
    ...cellInput, cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.3rem center',
    paddingRight: '1.2rem',
  };
  const headerCell: React.CSSProperties = {
    fontSize: '0.55rem', fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    padding: '0.2rem 0.1rem', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis',
  };

  // ── Mobile: card-per-row layout ──
  if (isMobile) {
    return (
      <div style={{
        backgroundColor: '#0d0d0d', borderRadius: '16px',
        border: `1px solid ${ACCENT}30`, padding: '1rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
            ✏️ {t('battleTier.bulkEditTitle', 'Edit All Players')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}>
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          {t('battleTier.bulkEditDesc', 'Edit data for all players. Empty name rows will be skipped on save.')}
        </p>

        {rows.map((row, idx) => (
          <div key={row.id} style={{
            backgroundColor: row.isNew ? '#0a1628' : '#111111',
            borderRadius: '12px', border: `1px solid ${row.isNew ? `${ACCENT}20` : '#2a2a2a'}`,
            padding: '0.75rem', marginBottom: '0.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: row.isNew ? '#6b7280' : '#fff' }}>
                {idx + 1}. {row.isNew ? (
                  <input
                    placeholder={t('battleTier.enterName', 'Player name')}
                    value={row.playerName}
                    onChange={e => updateRow(row.id, 'playerName', e.target.value)}
                    style={{ ...cellInput, display: 'inline', width: '140px' }}
                  />
                ) : row.playerName}
              </span>
              {rows.length > 1 && (
                <button onClick={() => removeRow(row.id)} style={{ background: 'none', border: 'none', color: '#6b728060', cursor: 'pointer', padding: '0.2rem' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            {/* Heroes & Gear */}
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              ① {t('battleTier.bulkHeroesEG', 'Heroes & EG')}
            </div>
            {([
              ['infantry', '🛡️', infantryHeroes, 'infantryHero', 'infantryEGLevel'] as const,
              ['cavalry', '🐎', cavalryHeroes, 'cavalryHero', 'cavalryEGLevel'] as const,
              ['archer', '🏹', archerHeroes, 'archerHero', 'archerEGLevel'] as const,
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
                    {EG_LEVELS.map(l => <option key={l} value={l}>Lv {l} {(EG_BONUS_BY_LEVEL[l] ?? 0) > 0 ? `(+${((EG_BONUS_BY_LEVEL[l] ?? 0) * 100).toFixed(0)}%)` : ''}</option>)}
                  </select>
                </div>
              </div>
            ))}
            {/* Stats */}
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginTop: '0.4rem', marginBottom: '0.25rem' }}>
              ② {t('battleTier.bulkTroopStatsShort', 'Troop Stats')}
            </div>
            {([
              ['infantry', '🛡️', 'infantryAttack', 'infantryLethality', 'infantryDefense', 'infantryHealth'] as const,
              ['cavalry', '🐎', 'cavalryAttack', 'cavalryLethality', 'cavalryDefense', 'cavalryHealth'] as const,
              ['archer', '🏹', 'archerAttack', 'archerLethality', 'archerDefense', 'archerHealth'] as const,
            ] as const).map(([troop, emoji, aKey, lKey, dKey, hKey]) => (
              <div key={troop} style={{ marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 600 }}>{emoji} {troop.charAt(0).toUpperCase() + troop.slice(1)}</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', marginTop: '0.15rem' }}>
                  <input type="number" step="0.1" placeholder="Atk" value={row[aKey]} onChange={e => updateRow(row.id, aKey, e.target.value)} style={numInput} />
                  <input type="number" step="0.1" placeholder="Lth" value={row[lKey]} onChange={e => updateRow(row.id, lKey, e.target.value)} style={numInput} />
                  <input type="number" step="0.1" placeholder="Def" value={row[dKey]} onChange={e => updateRow(row.id, dKey, e.target.value)} style={numInput} />
                  <input type="number" step="0.1" placeholder="HP" value={row[hKey]} onChange={e => updateRow(row.id, hKey, e.target.value)} style={numInput} />
                </div>
              </div>
            ))}
          </div>
        ))}

        <button onClick={addRow} style={{
          width: '100%', padding: '0.5rem', backgroundColor: '#1a1a1a', border: '1px dashed #333',
          borderRadius: '8px', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '0.75rem',
        }}>
          + {t('battleTier.bulkAddRow', 'Add Player')}
        </button>

        {error && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{error}</p>}

        <button onClick={handleSave} style={{
          width: '100%', padding: '0.7rem', backgroundColor: ACCENT, border: 'none',
          borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
        }}>
          {t('battleTier.bulkEditSave', 'Save Changes ({{count}} complete)', { count: completeRows.length })}
        </button>
      </div>
    );
  }

  // ── Desktop: spreadsheet table layout ──
  return (
    <div style={{
      backgroundColor: '#0d0d0d', borderRadius: '16px',
      border: `1px solid ${ACCENT}30`, padding: '1.25rem', marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
          ✏️ {t('battleTier.bulkEditTitle', 'Edit All Players')}
        </h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}>
          {t('common.cancel', 'Cancel')}
        </button>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
        {t('battleTier.bulkEditDesc', 'Edit data for all players. Empty name rows will be skipped on save.')}
      </p>

      <div style={{ overflowX: 'auto', marginBottom: '0.75rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1400px' }}>
          <thead>
            {/* Group header row */}
            <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
              <th colSpan={2} style={{ padding: 0 }} />
              <th colSpan={6} style={{ ...headerCell, textAlign: 'center', color: '#9ca3af', fontSize: '0.5rem', padding: '0.25rem 0', borderBottom: '1px solid #9ca3af20' }}>
                {t('battleTier.bulkHeroesGear', 'Heroes & Gear')}
              </th>
              <th colSpan={12} style={{ ...headerCell, textAlign: 'center', color: '#9ca3af', fontSize: '0.5rem', padding: '0.25rem 0', borderBottom: '1px solid #9ca3af20' }}>
                {t('battleTier.bulkTroopStats', 'Troop Stats (ATK / LTH / DEF / HP)')}
              </th>
              <th style={{ padding: 0 }} />
            </tr>
            {/* Column header row */}
            <tr style={{ borderBottom: '2px solid #2a2a2a' }}>
              <th style={{ ...headerCell, width: '24px' }}>#</th>
              <th style={{ ...headerCell, minWidth: '100px' }}>{t('battleTier.player', 'Player')}</th>
              {/* Heroes & Gear */}
              <th style={{ ...headerCell, minWidth: '72px', color: '#3b82f6' }}>🛡️ Hero</th>
              <th style={{ ...headerCell, minWidth: '52px', color: '#3b82f6' }}>🛡️ EG</th>
              <th style={{ ...headerCell, minWidth: '72px', color: '#f97316' }}>🐎 Hero</th>
              <th style={{ ...headerCell, minWidth: '52px', color: '#f97316' }}>🐎 EG</th>
              <th style={{ ...headerCell, minWidth: '72px', color: '#ef4444' }}>🏹 Hero</th>
              <th style={{ ...headerCell, minWidth: '52px', color: '#ef4444' }}>🏹 EG</th>
              {/* INF stats */}
              <th style={{ ...headerCell, minWidth: '54px', color: '#3b82f6' }}>🛡️Atk</th>
              <th style={{ ...headerCell, minWidth: '54px', color: '#3b82f6' }}>🛡️Lth</th>
              <th style={{ ...headerCell, minWidth: '54px', color: '#3b82f6' }}>🛡️Def</th>
              <th style={{ ...headerCell, minWidth: '54px', color: '#3b82f6' }}>🛡️HP</th>
              {/* CAV stats */}
              <th style={{ ...headerCell, minWidth: '54px', color: '#f97316' }}>🐎Atk</th>
              <th style={{ ...headerCell, minWidth: '54px', color: '#f97316' }}>🐎Lth</th>
              <th style={{ ...headerCell, minWidth: '54px', color: '#f97316' }}>🐎Def</th>
              <th style={{ ...headerCell, minWidth: '54px', color: '#f97316' }}>🐎HP</th>
              {/* ARC stats */}
              <th style={{ ...headerCell, minWidth: '54px', color: '#ef4444' }}>🏹Atk</th>
              <th style={{ ...headerCell, minWidth: '54px', color: '#ef4444' }}>🏹Lth</th>
              <th style={{ ...headerCell, minWidth: '54px', color: '#ef4444' }}>🏹Def</th>
              <th style={{ ...headerCell, minWidth: '54px', color: '#ef4444' }}>🏹HP</th>
              <th style={{ ...headerCell, width: '28px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{
                borderBottom: '1px solid #1a1a1a',
                backgroundColor: row.isNew ? '#0a162808' : 'transparent',
              }}>
                <td style={{ padding: '0.25rem 0.1rem', fontSize: '0.65rem', color: '#4b5563', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ padding: '0.25rem 0.1rem' }}>
                  {row.isNew ? (
                    <input
                      placeholder="Name"
                      value={row.playerName}
                      onChange={e => updateRow(row.id, 'playerName', e.target.value)}
                      style={cellInput}
                    />
                  ) : (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {row.playerName}
                    </span>
                  )}
                </td>
                {/* Heroes & Gear */}
                <td style={{ padding: '0.25rem 0.1rem' }}>
                  <select value={row.infantryHero} onChange={e => updateRow(row.id, 'infantryHero', e.target.value)} style={cellSelect}>
                    <option value="" disabled>—</option>
                    {infantryHeroes.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.25rem 0.1rem' }}>
                  <select value={row.infantryEGLevel} onChange={e => updateRow(row.id, 'infantryEGLevel', parseInt(e.target.value))} style={cellSelect}>
                    <option value={-1} disabled>—</option>
                    {EG_LEVELS.map(l => <option key={l} value={l}>Lv{l}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.25rem 0.1rem' }}>
                  <select value={row.cavalryHero} onChange={e => updateRow(row.id, 'cavalryHero', e.target.value)} style={cellSelect}>
                    <option value="" disabled>—</option>
                    {cavalryHeroes.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.25rem 0.1rem' }}>
                  <select value={row.cavalryEGLevel} onChange={e => updateRow(row.id, 'cavalryEGLevel', parseInt(e.target.value))} style={cellSelect}>
                    <option value={-1} disabled>—</option>
                    {EG_LEVELS.map(l => <option key={l} value={l}>Lv{l}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.25rem 0.1rem' }}>
                  <select value={row.archerHero} onChange={e => updateRow(row.id, 'archerHero', e.target.value)} style={cellSelect}>
                    <option value="" disabled>—</option>
                    {archerHeroes.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0.25rem 0.1rem' }}>
                  <select value={row.archerEGLevel} onChange={e => updateRow(row.id, 'archerEGLevel', parseInt(e.target.value))} style={cellSelect}>
                    <option value={-1} disabled>—</option>
                    {EG_LEVELS.map(l => <option key={l} value={l}>Lv{l}</option>)}
                  </select>
                </td>
                {/* INF stats */}
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="Atk" value={row.infantryAttack} onChange={e => updateRow(row.id, 'infantryAttack', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="Lth" value={row.infantryLethality} onChange={e => updateRow(row.id, 'infantryLethality', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="Def" value={row.infantryDefense} onChange={e => updateRow(row.id, 'infantryDefense', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="HP" value={row.infantryHealth} onChange={e => updateRow(row.id, 'infantryHealth', e.target.value)} style={numInput} /></td>
                {/* CAV stats */}
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="Atk" value={row.cavalryAttack} onChange={e => updateRow(row.id, 'cavalryAttack', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="Lth" value={row.cavalryLethality} onChange={e => updateRow(row.id, 'cavalryLethality', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="Def" value={row.cavalryDefense} onChange={e => updateRow(row.id, 'cavalryDefense', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="HP" value={row.cavalryHealth} onChange={e => updateRow(row.id, 'cavalryHealth', e.target.value)} style={numInput} /></td>
                {/* ARC stats */}
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="Atk" value={row.archerAttack} onChange={e => updateRow(row.id, 'archerAttack', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="Lth" value={row.archerLethality} onChange={e => updateRow(row.id, 'archerLethality', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="Def" value={row.archerDefense} onChange={e => updateRow(row.id, 'archerDefense', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem' }}><input type="number" step="0.1" placeholder="HP" value={row.archerHealth} onChange={e => updateRow(row.id, 'archerHealth', e.target.value)} style={numInput} /></td>
                <td style={{ padding: '0.25rem 0.1rem', textAlign: 'center' }}>
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

      <button onClick={addRow} style={{
        width: '100%', padding: '0.45rem', backgroundColor: '#1a1a1a', border: '1px dashed #333',
        borderRadius: '8px', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '0.75rem',
      }}>
        + {t('battleTier.bulkAddRow', 'Add Player')}
      </button>

      {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button onClick={handleSave} style={{
          flex: 1, padding: '0.7rem', backgroundColor: ACCENT, border: 'none',
          borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          boxShadow: `0 4px 20px ${ACCENT}35`,
        }}>
          {t('battleTier.bulkEditSave', 'Save Changes ({{count}} complete)', { count: completeRows.length })}
        </button>
      </div>
    </div>
  );
};

export default BattleBulkEdit;
