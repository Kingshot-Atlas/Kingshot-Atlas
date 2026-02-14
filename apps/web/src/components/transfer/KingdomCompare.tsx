import React from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { colors, FONT_DISPLAY } from '../../utils/styles';
import { KingdomData, KingdomFund, formatTCLevel } from '../KingdomListingCard';

// =============================================
// KINGDOM COMPARISON WIDGET
// =============================================

interface KingdomCompareProps {
  kingdoms: KingdomData[];
  funds: Map<number, KingdomFund>;
  onClose: () => void;
  onRemove: (kingdomNumber: number) => void;
  onApply?: (kingdomNumber: number) => void;
}

const TIER_ORDER: Record<string, number> = { gold: 4, silver: 3, bronze: 2, standard: 1 };
const TIER_COLORS: Record<string, string> = { gold: colors.gold, silver: '#d1d5db', bronze: colors.bronze, standard: colors.textMuted };

const KingdomCompare: React.FC<KingdomCompareProps> = ({ kingdoms, funds, onClose, onRemove, onApply }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (kingdoms.length === 0) return null;

  const getBest = (values: (number | null)[], higherIsBetter = true): number => {
    const valid = values.map((v, i) => ({ v: v ?? -Infinity, i })).filter(x => x.v !== -Infinity);
    if (valid.length === 0) return -1;
    return valid.reduce((best, cur) => (higherIsBetter ? cur.v > best.v : cur.v < best.v) ? cur : best).i;
  };

  const rows: { label: string; icon: string; values: string[]; rawValues: (number | null)[]; higherIsBetter: boolean }[] = [
    {
      label: 'Atlas Score',
      icon: '💎',
      values: kingdoms.map(k => k.atlas_score ? k.atlas_score.toFixed(1) : '—'),
      rawValues: kingdoms.map(k => k.atlas_score || null),
      higherIsBetter: true,
    },
    {
      label: 'Rank',
      icon: '🏆',
      values: kingdoms.map(k => k.current_rank ? `#${k.current_rank}` : '—'),
      rawValues: kingdoms.map(k => k.current_rank || null),
      higherIsBetter: false,
    },
    {
      label: 'Total KvKs',
      icon: '⚡',
      values: kingdoms.map(k => String(k.total_kvks || 0)),
      rawValues: kingdoms.map(k => k.total_kvks || 0),
      higherIsBetter: true,
    },
    {
      label: 'Prep Win Rate',
      icon: '🛡️',
      values: kingdoms.map(k => k.prep_win_rate != null ? `${(k.prep_win_rate * 100).toFixed(0)}%` : '—'),
      rawValues: kingdoms.map(k => k.prep_win_rate ?? null),
      higherIsBetter: true,
    },
    {
      label: 'Battle Win Rate',
      icon: '⚔️',
      values: kingdoms.map(k => k.battle_win_rate != null ? `${(k.battle_win_rate * 100).toFixed(0)}%` : '—'),
      rawValues: kingdoms.map(k => k.battle_win_rate ?? null),
      higherIsBetter: true,
    },
    {
      label: 'Dominations',
      icon: '👑',
      values: kingdoms.map(k => String(k.dominations || 0)),
      rawValues: kingdoms.map(k => k.dominations || 0),
      higherIsBetter: true,
    },
    {
      label: 'Fund Tier',
      icon: '💰',
      values: kingdoms.map(k => {
        const f = funds.get(k.kingdom_number);
        return f ? (f.tier.charAt(0).toUpperCase() + f.tier.slice(1)) : 'None';
      }),
      rawValues: kingdoms.map(k => {
        const f = funds.get(k.kingdom_number);
        return f ? (TIER_ORDER[f.tier] || 0) : 0;
      }),
      higherIsBetter: true,
    },
    {
      label: 'Recruiting',
      icon: '📢',
      values: kingdoms.map(k => {
        const f = funds.get(k.kingdom_number);
        return f?.is_recruiting ? 'Yes' : 'No';
      }),
      rawValues: kingdoms.map(k => {
        const f = funds.get(k.kingdom_number);
        return f?.is_recruiting ? 1 : 0;
      }),
      higherIsBetter: true,
    },
    {
      label: 'Language',
      icon: '🌐',
      values: kingdoms.map(k => {
        const f = funds.get(k.kingdom_number);
        return f?.main_language || '—';
      }),
      rawValues: [null, null, null],
      higherIsBetter: true,
    },
    {
      label: 'Min TC Level',
      icon: '🏰',
      values: kingdoms.map(k => {
        const f = funds.get(k.kingdom_number);
        return f?.min_tc_level ? formatTCLevel(f.min_tc_level) : '—';
      }),
      rawValues: kingdoms.map(k => {
        const f = funds.get(k.kingdom_number);
        return f?.min_tc_level || null;
      }),
      higherIsBetter: false,
    },
    {
      label: 'Min Power',
      icon: '🔥',
      values: kingdoms.map(k => {
        const f = funds.get(k.kingdom_number);
        const mp = f?.min_power_million || (f?.min_power_range ? parseInt(f.min_power_range, 10) || 0 : 0);
        return mp > 0 ? `${mp}M` : '—';
      }),
      rawValues: kingdoms.map(k => {
        const f = funds.get(k.kingdom_number);
        return f?.min_power_million || (f?.min_power_range ? parseInt(f.min_power_range, 10) || 0 : 0);
      }),
      higherIsBetter: false,
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: isMobile ? '1rem' : '1.5rem',
          paddingBottom: isMobile ? 'max(1rem, env(safe-area-inset-bottom))' : '1.5rem',
          maxWidth: '700px',
          width: '100%',
          maxHeight: isMobile ? '85vh' : '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: '1rem', color: colors.text, margin: 0 }}>
            ⚖️ {t('transferHub.compare.title', 'Kingdom Comparison')}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: colors.textMuted,
              cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Kingdom Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `100px repeat(${kingdoms.length}, 1fr)`,
          gap: '0.25rem',
          marginBottom: '0.5rem',
        }}>
          <div />
          {kingdoms.map(k => {
            const f = funds.get(k.kingdom_number);
            const tierColor = f ? (TIER_COLORS[f.tier] || '#6b7280') : '#6b7280';
            return (
              <div key={k.kingdom_number} style={{ textAlign: 'center', position: 'relative' }}>
                <button
                  onClick={() => onRemove(k.kingdom_number)}
                  style={{
                    position: 'absolute', top: '-4px', right: '0',
                    background: 'none', border: 'none', color: '#ef4444',
                    cursor: 'pointer', fontSize: '0.7rem', padding: '0.15rem 0.3rem',
                  }}
                  title="Remove"
                >
                  ✕
                </button>
                <div style={{
                  fontSize: '1.1rem', fontWeight: 700, color: tierColor,
                  textShadow: f?.tier === 'gold' ? '0 0 6px #fbbf2440' : undefined,
                }}>
                  K{k.kingdom_number}
                </div>
                <div style={{
                  fontSize: '0.55rem', color: tierColor, textTransform: 'uppercase',
                  fontWeight: 600, letterSpacing: '0.04em',
                }}>
                  {f?.tier || 'standard'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {rows.map((row, ri) => {
            const bestIdx = getBest(row.rawValues, row.higherIsBetter);
            return (
              <div key={ri} style={{
                display: 'grid',
                gridTemplateColumns: `100px repeat(${kingdoms.length}, 1fr)`,
                gap: '0.25rem',
                padding: '0.4rem 0',
                backgroundColor: ri % 2 === 0 ? colors.bg : 'transparent',
                borderRadius: '4px',
              }}>
                <div style={{
                  fontSize: '0.65rem', color: colors.textSecondary,
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  paddingLeft: '0.25rem',
                }}>
                  <span>{row.icon}</span> {row.label}
                </div>
                {row.values.map((val, vi) => (
                  <div key={vi} style={{
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    fontWeight: vi === bestIdx && bestIdx >= 0 ? 700 : 400,
                    color: vi === bestIdx && bestIdx >= 0 ? '#22c55e' : colors.text,
                  }}>
                    {val}
                    {vi === bestIdx && bestIdx >= 0 && row.rawValues.filter(v => v !== null).length > 1 && (
                      <span style={{ fontSize: '0.5rem', marginLeft: '0.15rem', color: '#22c55e' }}>★</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Kingdom Vibes Row */}
        <div style={{
          marginTop: '0.75rem',
          display: 'grid',
          gridTemplateColumns: `100px repeat(${kingdoms.length}, 1fr)`,
          gap: '0.25rem',
          padding: '0.5rem 0',
        }}>
          <div style={{
            fontSize: '0.65rem', color: colors.textSecondary,
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            paddingLeft: '0.25rem',
          }}>
            <span>✨</span> Vibes
          </div>
          {kingdoms.map(k => {
            const f = funds.get(k.kingdom_number);
            const vibes = f?.kingdom_vibe || [];
            return (
              <div key={k.kingdom_number} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem', justifyContent: 'center' }}>
                {vibes.length > 0 ? vibes.slice(0, 3).map(v => (
                  <span key={v} style={{
                    padding: '0.05rem 0.3rem',
                    backgroundColor: `${colors.primary}10`,
                    border: `1px solid ${colors.primary}25`,
                    borderRadius: '10px',
                    fontSize: '0.5rem',
                    color: colors.text,
                  }}>
                    {v.replace(/_/g, ' ')}
                  </span>
                )) : (
                  <span style={{ fontSize: '0.6rem', color: colors.textMuted }}>—</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Apply Buttons */}
        {onApply && (
          <div style={{
            marginTop: '1rem',
            display: 'grid',
            gridTemplateColumns: `100px repeat(${kingdoms.length}, 1fr)`,
            gap: '0.5rem',
            paddingTop: '0.75rem',
            borderTop: `1px solid ${colors.border}`,
          }}>
            <div />
            {kingdoms.map(k => (
              <button
                key={k.kingdom_number}
                onClick={() => onApply(k.kingdom_number)}
                style={{
                  padding: '0.4rem 0.5rem',
                  backgroundColor: `${colors.primary}15`,
                  border: `1px solid ${colors.primary}40`,
                  borderRadius: '8px',
                  color: colors.primary,
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minHeight: '36px',
                }}
              >
                {t('listing.applyToTransfer', 'Apply')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KingdomCompare;
