import React from 'react';
import { useTranslation } from 'react-i18next';
import { getEGBonusDisplay, getHeroesByTroopType } from '../../data/bearHuntData';
import type { FormState } from '../../hooks/useBearRallyState';

const ACCENT = '#3b82f6';
const EG_LEVELS = Array.from({ length: 11 }, (_, i) => i);
const infantryHeroes = getHeroesByTroopType('infantry');
const cavalryHeroes = getHeroesByTroopType('cavalry');
const archerHeroes = getHeroesByTroopType('archer');

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
    padding: '0.6rem 0.75rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    paddingRight: '2rem',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: '0.3rem',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };

  const renderHeroRow = (
    label: string,
    emoji: string,
    heroList: { name: string }[],
    heroKey: 'infantryHero' | 'cavalryHero' | 'archerHero',
    egKey: 'infantryEGLevel' | 'cavalryEGLevel' | 'archerEGLevel',
    accentHex: string,
  ) => (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '10px',
      border: `1px solid ${accentHex}20`,
      padding: isMobile ? '0.7rem' : '0.85rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        marginBottom: '0.5rem',
        fontSize: isMobile ? '0.8rem' : '0.85rem',
        fontWeight: 700, color: accentHex,
      }}>
        <span>{emoji}</span> {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={labelStyle}>{t('bearRally.hero', 'Hero')} <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={form[heroKey]}
            onChange={(e) => updateForm(heroKey, e.target.value)}
            style={{ ...selectStyle, ...(formError && !form[heroKey] ? { borderColor: '#ef444480' } : {}) }}
          >
            <option value="" disabled>{t('bearRally.selectHero', '— Select hero —')}</option>
            {heroList.map(h => (
              <option key={h.name} value={h.name}>{h.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {t('bearRally.egLevel', 'Gear Level')} <span style={{ color: '#ef4444' }}>*</span>
            <span
              title={t('bearRally.egTooltip', 'Exclusive Gear (EG) — each hero\'s unique equipment that boosts specific stats. Levels range from 0 to 10.')}
              style={{ cursor: 'help', color: '#6b7280', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', border: '1px solid #4b5563', lineHeight: 1 }}
            >?</span>
          </label>
          <select
            value={form[egKey]}
            onChange={(e) => updateForm(egKey, parseInt(e.target.value))}
            style={{ ...selectStyle, ...(formError && form[egKey] < 0 ? { borderColor: '#ef444480' } : {}) }}
          >
            <option value={-1} disabled>{t('bearRally.selectEG', '— Select EG level —')}</option>
            {EG_LEVELS.map(lvl => (
              <option key={lvl} value={lvl}>
                Lv {lvl} ({getEGBonusDisplay(lvl)}%)
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStatsRow = (
    label: string,
    emoji: string,
    atkKey: 'infantryAttack' | 'cavalryAttack' | 'archerAttack',
    lethKey: 'infantryLethality' | 'cavalryLethality' | 'archerLethality',
    accentHex: string,
  ) => (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '10px',
      border: `1px solid ${accentHex}20`,
      padding: isMobile ? '0.7rem' : '0.85rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        marginBottom: '0.5rem',
        fontSize: isMobile ? '0.8rem' : '0.85rem',
        fontWeight: 700, color: accentHex,
      }}>
        <span>{emoji}</span> {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={labelStyle}>{t('bearRally.attack', 'Attack %')} <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 250"
            value={form[atkKey]}
            onChange={(e) => updateForm(atkKey, e.target.value)}
            style={{ ...inputStyle, ...(formError && !form[atkKey] ? { borderColor: '#ef444480' } : {}) }}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('bearRally.lethality', 'Lethality %')} <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 180"
            value={form[lethKey]}
            onChange={(e) => updateForm(lethKey, e.target.value)}
            style={{ ...inputStyle, ...(formError && !form[lethKey] ? { borderColor: '#ef444480' } : {}) }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      marginBottom: '1.5rem',
      backgroundColor: '#0d0d0d',
      borderRadius: '16px',
      border: `1px solid ${ACCENT}30`,
      padding: isMobile ? '1rem' : '1.5rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <h2 style={{
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 700,
          color: '#fff',
        }}>
          {editingId
            ? t('bearRally.editPlayer', 'Edit Player')
            : t('bearRally.addNewPlayer', 'Add New Player')}
        </h2>
        <button
          onClick={handleCancelForm}
          style={{
            background: 'none', border: 'none', color: '#6b7280',
            cursor: 'pointer', fontSize: '0.85rem', padding: '0.3rem 0.6rem',
          }}
        >
          {t('common.cancel', 'Cancel')}
        </button>
      </div>

      {/* Player Name (with roster autocomplete) */}
      <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
        <label style={labelStyle}>
          {t('bearRally.playerName', 'Player Name')} <span style={{ color: '#ef4444' }}>*</span>
          {rosterNames.length > 0 && (
            <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.65rem', marginLeft: '0.5rem', textTransform: 'none' }}>
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
          <div
            ref={suggestionsRef}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
              marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {nameSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  updateForm('playerName', name);
                  setShowSuggestions(false);
                }}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left',
                  background: 'none', border: 'none', borderBottom: '1px solid #2a2a2a',
                  color: '#d1d5db', fontSize: '0.85rem', cursor: 'pointer',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span style={{ color: '#fff', fontWeight: 600 }}>{name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Section 1: Heroes & Gear */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', paddingLeft: '0.25rem' }}>
          {t('bearRally.formSectionHeroes', '① Heroes & Exclusive Gear')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {renderHeroRow(t('bearRally.infantry', 'Infantry'), '🛡️', infantryHeroes, 'infantryHero', 'infantryEGLevel', '#3b82f6')}
          {renderHeroRow(t('bearRally.cavalry', 'Cavalry'), '🐎', cavalryHeroes, 'cavalryHero', 'cavalryEGLevel', '#f97316')}
          {renderHeroRow(t('bearRally.archer', 'Archer'), '🏹', archerHeroes, 'archerHero', 'archerEGLevel', '#ef4444')}
        </div>
      </div>

      {/* Section 2: Troop Stats */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', paddingLeft: '0.25rem' }}>
          {t('bearRally.formSectionStats', '② Troop Bonus Stats')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {renderStatsRow(t('bearRally.infantry', 'Infantry'), '🛡️', 'infantryAttack', 'infantryLethality', '#3b82f6')}
          {renderStatsRow(t('bearRally.cavalry', 'Cavalry'), '🐎', 'cavalryAttack', 'cavalryLethality', '#f97316')}
          {renderStatsRow(t('bearRally.archer', 'Archer'), '🏹', 'archerAttack', 'archerLethality', '#ef4444')}
        </div>
      </div>

      {/* Error */}
      {formError && (
        <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          {formError}
        </p>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleSubmit}
          style={{
            flex: 1,
            padding: '0.7rem',
            backgroundColor: ACCENT,
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {editingId
            ? t('bearRally.updatePlayer', 'Update Player')
            : t('bearRally.savePlayer', 'Save Player')}
        </button>
      </div>
    </div>
  );
};

export default BearPlayerForm;
