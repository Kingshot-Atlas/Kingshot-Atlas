import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../utils/styles';

// =============================================
// ALLIANCE INFORMATION GRID
// =============================================

const EVENT_TYPE_LABELS: Record<string, string> = {
  bear_hunt: 'Bear Hunt',
  viking_vengeance: 'Viking Vengeance',
  swordland_showdown: 'Swordland Showdown',
  tri_alliance_clash: 'Tri-Alliance Clash',
};

const EVENT_TYPES_ORDER = ['bear_hunt', 'viking_vengeance', 'swordland_showdown', 'tri_alliance_clash'];

const convertUtcToLocal = (utcTime: string): string => {
  const parts = utcTime.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) return utcTime;
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes));
  return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const AllianceDetailsGrid: React.FC<{
  alliances: string[];
  allianceDetails: Record<string, { language?: string; secondary_language?: string; spots?: number; power_million?: number; is_recruiting?: boolean }>;
}> = ({ alliances, allianceDetails }) => {
  const { t } = useTranslation();

  type AllianceDetail = { language?: string; secondary_language?: string; spots?: number; power_million?: number; is_recruiting?: boolean };
  const DETAIL_ROWS: { key: string; label: string; render: (detail: AllianceDetail | undefined) => string; color?: (detail: AllianceDetail | undefined) => string }[] = [
    { key: 'power_million', label: t('listing.alliancePower', 'Power'), render: (d) => {
      if (d?.power_million == null) return '—';
      return d.power_million >= 1000 ? `${(d.power_million / 1000).toFixed(d.power_million % 1000 === 0 ? 0 : 1)}B` : `${d.power_million.toLocaleString()}M`;
    }},
    { key: 'language', label: t('listing.mainLanguage', 'Main Language'), render: (d) => d?.language || '—' },
    { key: 'secondary_language', label: t('listing.secondaryLanguage', 'Secondary Language'), render: (d) => d?.secondary_language || '—' },
    { key: 'spots', label: t('listing.availableSlots', 'Available Slots'), render: (d) => d?.spots != null ? String(d.spots) : '—' },
    { key: 'is_recruiting', label: t('listing.recruiting', 'Recruiting'), render: (d) => d?.is_recruiting === true ? 'Yes' : d?.is_recruiting === false ? 'No' : '—', color: (d) => d?.is_recruiting === true ? '#22c55e' : d?.is_recruiting === false ? '#ef4444' : '' },
  ];

  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `1fr ${alliances.map(() => '1fr').join(' ')}`,
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ padding: '0.3rem 0.4rem', fontSize: '0.55rem', color: colors.textMuted, fontWeight: '600' }}>
            {t('listing.detail', 'Detail')}
          </div>
          {alliances.map((tag, i) => (
            <div key={i} style={{
              padding: '0.3rem 0.4rem',
              fontSize: '0.55rem',
              color: colors.primary,
              fontWeight: '700',
              textAlign: 'center',
              borderLeft: `1px solid ${colors.border}`,
            }}>
              {tag}
            </div>
          ))}
        </div>
        {/* Data rows */}
        {DETAIL_ROWS.map((row, rowIdx) => (
          <div key={row.key} style={{
            display: 'grid',
            gridTemplateColumns: `1fr ${alliances.map(() => '1fr').join(' ')}`,
            borderBottom: rowIdx < DETAIL_ROWS.length - 1 ? `1px solid ${colors.border}` : 'none',
          }}>
            <div style={{
              padding: '0.3rem 0.4rem',
              fontSize: '0.55rem',
              color: colors.textSecondary,
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
            }}>
              {row.label}
            </div>
            {alliances.map((tag, aIdx) => {
              const detail = allianceDetails[tag];
              const value = row.render(detail);
              const customColor = row.color ? row.color(detail) : '';
              return (
                <div key={aIdx} style={{
                  padding: '0.25rem 0.3rem',
                  fontSize: '0.6rem',
                  color: customColor || (value !== '—' ? colors.text : colors.textMuted),
                  fontWeight: row.key === 'power_million' || row.key === 'is_recruiting' ? '700' : '500',
                  textAlign: 'center',
                  borderLeft: `1px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {value}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const AllianceInfoGrid: React.FC<{
  allianceEvents: {
    alliances: string[];
    schedule: Record<string, string[][]>;
  };
}> = ({ allianceEvents }) => {
  const { t } = useTranslation();
  const [showLocal, setShowLocal] = useState(false);
  const { alliances, schedule } = allianceEvents;

  if (alliances.length === 0) return null;

  const formatSlots = (slots: string[] | undefined): string => {
    if (!slots || slots.length === 0 || slots.every(s => !s)) return '—';
    const filtered = slots.filter(s => s);
    return filtered.map(s => showLocal ? convertUtcToLocal(s) : s).join(' & ');
  };

  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('listing.allianceInfo', 'Alliance Information')}
        </span>
        <button
          onClick={() => setShowLocal(!showLocal)}
          style={{
            background: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: '4px',
            padding: '0.1rem 0.4rem',
            fontSize: '0.55rem',
            color: showLocal ? '#22d3ee' : colors.textMuted,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {showLocal ? `🕐 ${t('listing.localTime', 'Local Time')}` : `🌐 ${t('listing.utc', 'UTC')}`}
        </button>
      </div>
      <div style={{
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `1fr ${alliances.map(() => '1fr').join(' ')}`,
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ padding: '0.3rem 0.4rem', fontSize: '0.55rem', color: colors.textMuted, fontWeight: '600' }}>
            {t('listing.event', 'Event')}
          </div>
          {alliances.map((tag, i) => (
            <div key={i} style={{
              padding: '0.3rem 0.4rem',
              fontSize: '0.55rem',
              color: colors.primary,
              fontWeight: '700',
              textAlign: 'center',
              borderLeft: `1px solid ${colors.border}`,
            }}>
              {tag}
            </div>
          ))}
        </div>
        {/* Data rows */}
        {EVENT_TYPES_ORDER.map((eventType, rowIdx) => (
          <div key={eventType} style={{
            display: 'grid',
            gridTemplateColumns: `1fr ${alliances.map(() => '1fr').join(' ')}`,
            borderBottom: rowIdx < EVENT_TYPES_ORDER.length - 1 ? `1px solid ${colors.border}` : 'none',
          }}>
            <div style={{
              padding: '0.3rem 0.4rem',
              fontSize: '0.55rem',
              color: colors.textSecondary,
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
            }}>
              {EVENT_TYPE_LABELS[eventType]}
            </div>
            {alliances.map((_, aIdx) => {
              const slots = schedule[eventType]?.[aIdx];
              return (
                <div key={aIdx} style={{
                  padding: '0.25rem 0.3rem',
                  fontSize: '0.6rem',
                  color: slots && slots.some(s => s) ? colors.text : colors.textMuted,
                  fontWeight: '500',
                  textAlign: 'center',
                  borderLeft: `1px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {formatSlots(slots)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
