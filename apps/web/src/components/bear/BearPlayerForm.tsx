import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getEGBonusDisplay, getHeroesByTroopType } from '../../data/bearHuntData';
import type { FormState } from '../../hooks/useBearRallyState';

const ACCENT = '#3b82f6';
const EG_LEVELS = Array.from({ length: 11 }, (_, i) => i);
const infantryHeroes = getHeroesByTroopType('infantry');
const cavalryHeroes = getHeroesByTroopType('cavalry');
const archerHeroes = getHeroesByTroopType('archer');

// ─── Searchable Select Component ─────────────────────────────────────────────
const SearchableSelect: React.FC<{
  options: { label: string; value: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  hasError?: boolean;
  inputStyle: React.CSSProperties;
}> = ({ options, value, onChange, placeholder = '— Select —', hasError, inputStyle }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
      setOpen(false);
      setSearch('');
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        onClick={() => { setOpen(true); setSearch(''); setTimeout(() => inputRef.current?.focus(), 0); }}
        style={{
          ...inputStyle,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: '2.4rem',
          ...(hasError ? { borderColor: '#ef444480' } : {}),
        }}
      >
        <span style={{ color: value ? '#fff' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value ? selectedLabel : placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ flexShrink: 0, marginLeft: '0.25rem' }}><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <div style={{ padding: '0.35rem', borderBottom: '1px solid #2a2a2a', position: 'sticky', top: 0, backgroundColor: '#1a1a1a', zIndex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              style={{
                width: '100%', padding: '0.4rem 0.5rem', backgroundColor: '#111', border: '1px solid #333',
                borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setSearch(''); }
                if (e.key === 'Enter' && filtered.length === 1 && filtered[0]) {
                  onChange(filtered[0].value); setOpen(false); setSearch('');
                }
              }}
            />
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '0.5rem 0.75rem', color: '#6b7280', fontSize: '0.8rem' }}>No results</div>
          )}
          {filtered.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
              style={{
                width: '100%', padding: '0.45rem 0.75rem', textAlign: 'left',
                background: opt.value === value ? '#3b82f620' : 'none',
                border: 'none', borderBottom: '1px solid #222',
                color: opt.value === value ? '#3b82f6' : '#d1d5db',
                fontSize: '0.82rem', cursor: 'pointer', fontWeight: opt.value === value ? 700 : 400,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = opt.value === value ? '#3b82f620' : 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface BearPlayerFormProps {
  isMobile: boolean;
  form: FormState;
  editingId: string | null;
  formError: string;
  showSuggestions: boolean;
  setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  nameSuggestions: string[];
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  suggestionsRef: React.RefObject<HTMLDivElement | null>;
  rosterNames: string[];
  updateForm: (field: keyof FormState, value: string | number) => void;
  handleSubmit: () => void;
  handleCancelForm: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const BearPlayerForm: React.FC<BearPlayerFormProps> = ({
  isMobile,
  form,
  editingId,
  formError,
  showSuggestions,
  setShowSuggestions,
  nameSuggestions,
  nameInputRef,
  suggestionsRef,
  rosterNames,
  updateForm,
  handleSubmit,
  handleCancelForm,
}) => {
  const { t } = useTranslation();

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.45rem 0.6rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.82rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.5rem center',
    paddingRight: '1.5rem',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: '0.2rem',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '0.65rem', fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: '0.35rem', paddingLeft: '0.15rem',
  };

  const heroOptions = (heroes: { name: string }[]) =>
    heroes.map(h => ({ label: h.name, value: h.name }));

  return (
    <div style={{
      marginBottom: '1.5rem',
      backgroundColor: '#0d0d0d',
      borderRadius: '14px',
      border: `1px solid ${ACCENT}30`,
      padding: isMobile ? '0.85rem' : '1.25rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: isMobile ? '0.95rem' : '1.05rem', fontWeight: 700, color: '#fff', margin: 0 }}>
          {editingId ? t('bearRally.editPlayer', 'Edit Player') : t('bearRally.addNewPlayer', 'Add New Player')}
        </h2>
        <button onClick={handleCancelForm} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
          {t('common.cancel', 'Cancel')}
        </button>
      </div>

      {/* Player Name */}
      <div style={{ marginBottom: '0.6rem', position: 'relative' }}>
        <label style={labelStyle}>
          {t('bearRally.playerName', 'Player Name')} <span style={{ color: '#ef4444' }}>*</span>
          {rosterNames.length > 0 && (
            <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.6rem', marginLeft: '0.4rem', textTransform: 'none' }}>
              {t('bearRally.rosterHint', '(suggestions from alliance roster)')}
            </span>
          )}
        </label>
        <input
          ref={nameInputRef}
          type="text"
          placeholder={t('bearRally.playerNamePlaceholder', 'e.g. LordCommander')}
          value={form.playerName}
          onChange={(e) => { updateForm('playerName', e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          style={inputStyle}
          autoFocus
          autoComplete="off"
        />
        {showSuggestions && nameSuggestions.length > 0 && (
          <div ref={suggestionsRef} style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {nameSuggestions.map((name) => (
              <button
                key={name} type="button"
                onClick={() => { updateForm('playerName', name); setShowSuggestions(false); }}
                style={{ width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #2a2a2a', color: '#d1d5db', fontSize: '0.82rem', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span style={{ color: '#fff', fontWeight: 600 }}>{name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Section 1: Heroes & Exclusive Gear Levels — single row on desktop */}
      <div style={{ marginBottom: '0.6rem' }}>
        <div style={sectionHeaderStyle}>
          {t('bearRally.formSectionHeroes', 'Heroes & Exclusive Gear Levels')}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
          gap: '0.35rem',
        }}>
          {/* Infantry Hero */}
          <div>
            <label style={{ ...labelStyle, color: '#3b82f6' }}>
              {t('bearRally.infantryHeroLabel', 'Infantry Hero')}
            </label>
            <SearchableSelect
              options={heroOptions(infantryHeroes)}
              value={form.infantryHero}
              onChange={(val) => updateForm('infantryHero', val)}
              placeholder={t('bearRally.selectHero', '— Select —')}
              hasError={!!formError && !form.infantryHero}
              inputStyle={inputStyle}
            />
          </div>
          {/* Infantry EG */}
          <div>
            <label style={{ ...labelStyle, color: '#3b82f6' }}>
              {t('bearRally.infantryEGLabel', 'Infantry Gear')}
            </label>
            <select
              value={form.infantryEGLevel}
              onChange={(e) => updateForm('infantryEGLevel', parseInt(e.target.value))}
              style={{ ...selectStyle, ...(formError && form.infantryEGLevel < 0 ? { borderColor: '#ef444480' } : {}) }}
            >
              <option value={-1} disabled>— EG —</option>
              {EG_LEVELS.map(lvl => <option key={lvl} value={lvl}>Lv {lvl} ({getEGBonusDisplay(lvl)}%)</option>)}
            </select>
          </div>
          {/* Cavalry Hero */}
          <div>
            <label style={{ ...labelStyle, color: '#f97316' }}>
              {t('bearRally.cavalryHeroLabel', 'Cavalry Hero')}
            </label>
            <SearchableSelect
              options={heroOptions(cavalryHeroes)}
              value={form.cavalryHero}
              onChange={(val) => updateForm('cavalryHero', val)}
              placeholder={t('bearRally.selectHero', '— Select —')}
              hasError={!!formError && !form.cavalryHero}
              inputStyle={inputStyle}
            />
          </div>
          {/* Cavalry EG */}
          <div>
            <label style={{ ...labelStyle, color: '#f97316' }}>
              {t('bearRally.cavalryEGLabel', 'Cavalry Gear')}
            </label>
            <select
              value={form.cavalryEGLevel}
              onChange={(e) => updateForm('cavalryEGLevel', parseInt(e.target.value))}
              style={{ ...selectStyle, ...(formError && form.cavalryEGLevel < 0 ? { borderColor: '#ef444480' } : {}) }}
            >
              <option value={-1} disabled>— EG —</option>
              {EG_LEVELS.map(lvl => <option key={lvl} value={lvl}>Lv {lvl} ({getEGBonusDisplay(lvl)}%)</option>)}
            </select>
          </div>
          {/* Archer Hero */}
          <div>
            <label style={{ ...labelStyle, color: '#ef4444' }}>
              {t('bearRally.archerHeroLabel', 'Archer Hero')}
            </label>
            <SearchableSelect
              options={heroOptions(archerHeroes)}
              value={form.archerHero}
              onChange={(val) => updateForm('archerHero', val)}
              placeholder={t('bearRally.selectHero', '— Select —')}
              hasError={!!formError && !form.archerHero}
              inputStyle={inputStyle}
            />
          </div>
          {/* Archer EG */}
          <div>
            <label style={{ ...labelStyle, color: '#ef4444' }}>
              {t('bearRally.archerEGLabel', 'Archer Gear')}
            </label>
            <select
              value={form.archerEGLevel}
              onChange={(e) => updateForm('archerEGLevel', parseInt(e.target.value))}
              style={{ ...selectStyle, ...(formError && form.archerEGLevel < 0 ? { borderColor: '#ef444480' } : {}) }}
            >
              <option value={-1} disabled>— EG —</option>
              {EG_LEVELS.map(lvl => <option key={lvl} value={lvl}>Lv {lvl} ({getEGBonusDisplay(lvl)}%)</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Troop Bonus Stats — single row on desktop */}
      <div style={{ marginBottom: '0.6rem' }}>
        <div style={sectionHeaderStyle}>
          {t('bearRally.formSectionStats', 'Troop Bonus Stats')}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
          gap: '0.35rem',
        }}>
          <div>
            <label style={{ ...labelStyle, color: '#3b82f6' }}>{t('bearRally.infAtkLabel', 'Infantry Atk %')}</label>
            <input type="number" step="0.1" placeholder="250" value={form.infantryAttack} onChange={(e) => updateForm('infantryAttack', e.target.value)} style={{ ...inputStyle, ...(formError && !form.infantryAttack ? { borderColor: '#ef444480' } : {}) }} />
          </div>
          <div>
            <label style={{ ...labelStyle, color: '#3b82f6' }}>{t('bearRally.infLethLabel', 'Infantry Leth %')}</label>
            <input type="number" step="0.1" placeholder="180" value={form.infantryLethality} onChange={(e) => updateForm('infantryLethality', e.target.value)} style={{ ...inputStyle, ...(formError && !form.infantryLethality ? { borderColor: '#ef444480' } : {}) }} />
          </div>
          <div>
            <label style={{ ...labelStyle, color: '#f97316' }}>{t('bearRally.cavAtkLabel', 'Cavalry Atk %')}</label>
            <input type="number" step="0.1" placeholder="250" value={form.cavalryAttack} onChange={(e) => updateForm('cavalryAttack', e.target.value)} style={{ ...inputStyle, ...(formError && !form.cavalryAttack ? { borderColor: '#ef444480' } : {}) }} />
          </div>
          <div>
            <label style={{ ...labelStyle, color: '#f97316' }}>{t('bearRally.cavLethLabel', 'Cavalry Leth %')}</label>
            <input type="number" step="0.1" placeholder="180" value={form.cavalryLethality} onChange={(e) => updateForm('cavalryLethality', e.target.value)} style={{ ...inputStyle, ...(formError && !form.cavalryLethality ? { borderColor: '#ef444480' } : {}) }} />
          </div>
          <div>
            <label style={{ ...labelStyle, color: '#ef4444' }}>{t('bearRally.arcAtkLabel', 'Archer Atk %')}</label>
            <input type="number" step="0.1" placeholder="250" value={form.archerAttack} onChange={(e) => updateForm('archerAttack', e.target.value)} style={{ ...inputStyle, ...(formError && !form.archerAttack ? { borderColor: '#ef444480' } : {}) }} />
          </div>
          <div>
            <label style={{ ...labelStyle, color: '#ef4444' }}>{t('bearRally.arcLethLabel', 'Archer Leth %')}</label>
            <input type="number" step="0.1" placeholder="180" value={form.archerLethality} onChange={(e) => updateForm('archerLethality', e.target.value)} style={{ ...inputStyle, ...(formError && !form.archerLethality ? { borderColor: '#ef444480' } : {}) }} />
          </div>
        </div>
      </div>

      {/* Error */}
      {formError && (
        <p style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.4rem' }}>{formError}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        style={{
          width: '100%', padding: '0.6rem',
          backgroundColor: ACCENT, border: 'none', borderRadius: '8px',
          color: '#fff', fontWeight: 700, fontSize: '0.85rem',
          cursor: 'pointer', transition: 'background-color 0.2s',
        }}
      >
        {editingId ? t('bearRally.updatePlayer', 'Update Player') : t('bearRally.savePlayer', 'Save Player')}
      </button>
    </div>
  );
};

export default BearPlayerForm;
