import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors, neonGlow, FONT_DISPLAY } from '../../utils/styles';
import {
  BattleRegistry, BattleRegistryEntry, RegistryView,
  TIME_SLOTS, TROOP_TYPES, TROOP_LABELS, TROOP_COLORS,
  MIN_TIER, MAX_TIER, MIN_TG, MAX_TG,
} from './types';

// ─── UTC → Local Time Helper ────────────────────────────────────────────
function utcToLocalLabel(utcTime: string): string {
  const [h, m] = utcTime.split(':').map(Number);
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h ?? 0, m ?? 0));
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatSlotLabel(slot: string): string {
  return `${slot} UTC (${utcToLocalLabel(slot)})`;
}

// ─── Searchable Time Slot Dropdown ──────────────────────────────────────
interface TimeSlotDropdownProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  isMobile: boolean;
  minSlot?: string;
}

const TimeSlotDropdown: React.FC<TimeSlotDropdownProps> = ({ value, onChange, disabled, isMobile, minSlot }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const minIndex = minSlot ? TIME_SLOTS.indexOf(minSlot) : 0;
  const availableSlots = TIME_SLOTS.filter((_, i) => i >= (minIndex >= 0 ? minIndex : 0));

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
    width: '100%', padding: '0.55rem 0.75rem', backgroundColor: disabled ? '#1a1a1a' : colors.bg,
    border: `1px solid ${open ? '#ef4444' : colors.border}`, borderRadius: '8px', color: colors.text,
    fontSize: isMobile ? '0.95rem' : '0.85rem', outline: 'none', boxSizing: 'border-box' as const,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    transition: 'border-color 0.15s ease', minHeight: '44px',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        readOnly={!open}
        value={open ? search : formatSlotLabel(value)}
        placeholder={formatSlotLabel(value)}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => { if (!disabled) { setOpen(true); setSearch(''); } }}
        onClick={() => { if (!disabled) { setOpen(true); setSearch(''); } }}
        style={dropdownInputStyle}
      />
      <span style={{
        position: 'absolute', right: '0.75rem', top: '50%', transform: `translateY(-50%) rotate(${open ? '180' : '0'}deg)`,
        color: colors.textMuted, fontSize: '0.6rem', pointerEvents: 'none', transition: 'transform 0.2s ease',
      }}>▼</span>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 50,
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px',
          maxHeight: '220px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '0.75rem', color: colors.textMuted, fontSize: '0.8rem', textAlign: 'center' }}>
              No matching time
            </div>
          ) : filtered.map(slot => (
            <button key={slot} onClick={() => handleSelect(slot)}
              style={{
                display: 'block', width: '100%', padding: '0.6rem 0.85rem', border: 'none',
                backgroundColor: slot === value ? '#ef444418' : 'transparent',
                color: slot === value ? '#ef4444' : colors.text, fontSize: isMobile ? '0.9rem' : '0.82rem',
                fontWeight: slot === value ? 700 : 400, cursor: 'pointer', textAlign: 'left',
                minHeight: '40px', transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={e => { if (slot !== value) e.currentTarget.style.backgroundColor = colors.bg; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = slot === value ? '#ef444418' : 'transparent'; }}>
              {formatSlotLabel(slot)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Form Component ────────────────────────────────────────────────
interface BattleRegistryFormProps {
  isMobile: boolean;
  registry: BattleRegistry;
  existingEntry: BattleRegistryEntry | null;
  saving: boolean;
  // Form fields
  formUsername: string;
  formAlliance: string; setFormAlliance: (v: string) => void;
  formTimeSlot: string; setFormTimeSlot: (v: string) => void;
  formTimeSlotTo: string; setFormTimeSlotTo: (v: string) => void;
  formInfantryTier: number | null; setFormInfantryTier: (v: number | null) => void;
  formInfantryTg: number | null; setFormInfantryTg: (v: number | null) => void;
  formCavalryTier: number | null; setFormCavalryTier: (v: number | null) => void;
  formCavalryTg: number | null; setFormCavalryTg: (v: number | null) => void;
  formArchersTier: number | null; setFormArchersTier: (v: number | null) => void;
  formArchersTg: number | null; setFormArchersTg: (v: number | null) => void;
  submitEntry: () => Promise<void>;
  navigate: (path: string) => void;
  isManager: boolean;
  setView: (v: RegistryView) => void;
}

const BattleRegistryForm: React.FC<BattleRegistryFormProps> = ({
  isMobile, registry, existingEntry, saving,
  formUsername, formAlliance, setFormAlliance,
  formTimeSlot, setFormTimeSlot, formTimeSlotTo, setFormTimeSlotTo,
  formInfantryTier, setFormInfantryTier, formInfantryTg, setFormInfantryTg,
  formCavalryTier, setFormCavalryTier, formCavalryTg, setFormCavalryTg,
  formArchersTier, setFormArchersTier, formArchersTg, setFormArchersTg,
  submitEntry, navigate: _navigate, isManager, setView,
}) => {
  const { t } = useTranslation();

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surface, borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem',
    border: `1px solid ${colors.border}`,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text,
    fontSize: isMobile ? '1rem' : '0.85rem', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem',
  };
  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer', appearance: 'auto' as const,
  };

  const isClosed = registry.status === 'closed' || registry.status === 'archived';

  const troopFields: Array<{
    type: typeof TROOP_TYPES[number];
    tier: number | null; setTier: (v: number | null) => void;
    tg: number | null; setTg: (v: number | null) => void;
  }> = [
    { type: 'infantry', tier: formInfantryTier, setTier: setFormInfantryTier, tg: formInfantryTg, setTg: setFormInfantryTg },
    { type: 'cavalry', tier: formCavalryTier, setTier: setFormCavalryTier, tg: formCavalryTg, setTg: setFormCavalryTg },
    { type: 'archers', tier: formArchersTier, setTier: setFormArchersTier, tg: formArchersTg, setTg: setFormArchersTg },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div style={{ padding: isMobile ? '1.5rem 1rem' : '2rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{ fontSize: isMobile ? '1.3rem' : '1.75rem', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
            <span style={{ color: '#fff' }}>BATTLE REGISTRY</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.5rem' }}>K{registry.kingdom_number}</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.9rem', lineHeight: 1.5 }}>
            {registry.kvk_number
              ? t('battleRegistry.formSubtitle', 'KvK #{{kvk}} — Register your availability and troop levels for the castle battle.', { kvk: registry.kvk_number })
              : t('battleRegistry.formSubtitleNoKvk', 'Register your availability and troop levels for the castle battle.')}
          </p>
          {registry.notes && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', backgroundColor: '#ef444408', border: '1px solid #ef444425' }}>
              <p style={{ color: '#d1d5db', fontSize: '0.8rem', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>{registry.notes}</p>
            </div>
          )}
          {isClosed && (
            <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', backgroundColor: '#6b728015', border: '1px solid #6b728030', borderRadius: '20px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6b7280' }}>🔒 {t('battleRegistry.registryClosed', 'REGISTRATION CLOSED')}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
        {existingEntry && (
          <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#22c55e30', backgroundColor: '#22c55e08', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem' }}>✅</span>
            <p style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>
              {t('battleRegistry.alreadyRegistered', 'You have already registered. You can update your submission below.')}
            </p>
          </div>
        )}

        {/* Username + Alliance */}
        <div style={{ ...cardStyle, marginBottom: '1rem' }}>
          <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>👤 {t('battleRegistry.playerInfo', 'Player Info')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>{t('battleRegistry.username', 'Username')} *</label>
              <input type="text" value={formUsername} readOnly style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed', backgroundColor: '#1a1a1a' }} />
              <p style={{ color: colors.textMuted, fontSize: '0.6rem', marginTop: '0.2rem' }}>{t('battleRegistry.usernameAutoFilled', 'Auto-filled from your profile.')}</p>
            </div>
            <div>
              <label style={labelStyle}>{t('battleRegistry.allianceTag', 'Alliance Tag')} *</label>
              <input type="text" value={formAlliance} maxLength={3} onChange={(e) => setFormAlliance(e.target.value.toUpperCase())}
                disabled={isClosed}
                style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.1em', ...(isClosed ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }} placeholder="e.g. ABC" />
              {formAlliance.length > 0 && formAlliance.length !== 3 && (
                <p style={{ color: colors.error, fontSize: '0.65rem', marginTop: '0.2rem' }}>⚠️ {t('battleRegistry.allianceMustBe3', 'Must be exactly 3 characters.')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Time Range */}
        <div style={{ ...cardStyle, marginBottom: '1rem' }}>
          <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>🕐 {t('battleRegistry.timeAvailability', 'Time Availability (UTC)')}</h3>
          <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            {t('battleRegistry.timeRangeDesc', 'Select the time range when you can be online for the castle battle.')}
          </p>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.5rem' : '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('battleRegistry.timeFrom', 'From')}</label>
              <TimeSlotDropdown value={formTimeSlot} onChange={(v) => { if (!isClosed) { setFormTimeSlot(v); const fi = TIME_SLOTS.indexOf(v); const ti = TIME_SLOTS.indexOf(formTimeSlotTo); if (fi > ti) setFormTimeSlotTo(v); } }} disabled={isClosed} isMobile={isMobile} />
            </div>
            <span style={{ color: colors.textMuted, fontSize: '0.8rem', fontWeight: 600, textAlign: 'center', paddingTop: isMobile ? '0' : '1.3rem', flexShrink: 0 }}>{t('battleRegistry.timeTo', 'to')}</span>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('battleRegistry.timeTo_label', 'To')}</label>
              <TimeSlotDropdown value={formTimeSlotTo} onChange={(v) => { if (!isClosed) setFormTimeSlotTo(v); }} disabled={isClosed} isMobile={isMobile} minSlot={formTimeSlot} />
            </div>
          </div>
        </div>

        {/* Troop Types */}
        <div style={{ ...cardStyle, marginBottom: '1rem' }}>
          <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>🗡️ {t('battleRegistry.troopLevels', 'Troop Levels')}</h3>
          <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.5 }}>
            {t('battleRegistry.troopLevelsDesc', 'For each troop type, select your highest Tier (T1–T11) and Truegold Level (TG1–TG8). Leave blank if you don\'t use that troop type.')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {troopFields.map(({ type, tier, setTier, tg, setTg }) => (
              <div key={type} style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: `${TROOP_COLORS[type]}08`, border: `1px solid ${TROOP_COLORS[type]}25` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: TROOP_COLORS[type], fontSize: '0.85rem', fontWeight: 700 }}>{TROOP_LABELS[type]}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ ...labelStyle, color: TROOP_COLORS[type] }}>{t('battleRegistry.tier', 'Tier')}</label>
                    <select value={tier ?? ''} onChange={(e) => setTier(e.target.value ? parseInt(e.target.value) : null)}
                      disabled={isClosed} style={{ ...selectStyle, ...(isClosed ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
                      <option value="">—</option>
                      {Array.from({ length: MAX_TIER - MIN_TIER + 1 }, (_, i) => MIN_TIER + i).map(n => (
                        <option key={n} value={n}>T{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: TROOP_COLORS[type] }}>{t('battleRegistry.truegoldLevel', 'Truegold Level')}</label>
                    <select value={tg ?? ''} onChange={(e) => setTg(e.target.value ? parseInt(e.target.value) : null)}
                      disabled={isClosed} style={{ ...selectStyle, ...(isClosed ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
                      <option value="">—</option>
                      {Array.from({ length: MAX_TG - MIN_TG + 1 }, (_, i) => MIN_TG + i).map(n => (
                        <option key={n} value={n}>TG{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        {!isClosed && (
          <button onClick={submitEntry} disabled={saving || !formUsername.trim() || formAlliance.trim().length !== 3}
            style={{
              width: '100%', padding: isMobile ? '0.9rem' : '0.75rem', borderRadius: '10px', border: 'none',
              minHeight: '48px',
              backgroundColor: formAlliance.trim().length === 3 ? '#ef4444' : `${colors.textMuted}20`,
              color: formAlliance.trim().length === 3 ? '#fff' : colors.textMuted,
              fontSize: '0.95rem', fontWeight: 700, cursor: formAlliance.trim().length === 3 ? 'pointer' : 'not-allowed',
              opacity: saving ? 0.6 : 1, transition: 'all 0.2s ease',
              boxShadow: formAlliance.trim().length === 3 ? '0 4px 15px rgba(239, 68, 68, 0.3)' : 'none',
            }}>
            {saving
              ? t('battleRegistry.submitting', 'Submitting...')
              : existingEntry
                ? `📝 ${t('battleRegistry.updateRegistration', 'Update Registration')}`
                : `⚔️ ${t('battleRegistry.submitRegistration', 'Submit Registration')}`}
          </button>
        )}

        {/* Navigation links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '0.75rem' : '1.5rem', marginTop: '1.5rem', paddingBottom: isMobile ? '1.5rem' : '0', flexWrap: 'wrap' }}>
          {isManager && (
            <button onClick={() => { setView('manage'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{ color: '#ef4444', textDecoration: 'none', fontSize: isMobile ? '0.85rem' : '0.8rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              📊 {t('battleRegistry.viewDashboard', 'View Dashboard')}
            </button>
          )}
          <Link to="/tools/battle-registry" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: isMobile ? '0.85rem' : '0.8rem', padding: '0.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>← {t('battleRegistry.backToRegistries', 'All Registries')}</Link>
          <Link to="/tools" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: isMobile ? '0.85rem' : '0.8rem', padding: '0.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>← {t('battleRegistry.backToTools', 'Back to Tools')}</Link>
        </div>
      </div>
    </div>
  );
};

export default BattleRegistryForm;
