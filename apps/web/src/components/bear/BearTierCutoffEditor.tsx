import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BEAR_TIER_COLORS,
  type BearTier,
  type BearTierOverrides,
  type BearPlayerEntry,
  isPlayerComplete,
} from '../../data/bearHuntData';
import { FONT_DISPLAY } from '../../utils/styles';

const ACCENT = '#3b82f6';
type EditableTier = 'SS' | 'S' | 'A' | 'B' | 'C';
const TIERS: EditableTier[] = ['SS', 'S', 'A', 'B', 'C'];

interface BearTierCutoffEditorProps {
  rankedPlayers: (BearPlayerEntry & { rank: number })[];
  tierOverrides: BearTierOverrides | null;
  autoBoundaries: { SS: number; S: number; A: number; B: number; C: number } | null;
  onSetOverrides: (overrides: BearTierOverrides | null) => void;
  canEdit: boolean;
  isMobile: boolean;
}

const BearTierCutoffEditor: React.FC<BearTierCutoffEditorProps> = ({
  rankedPlayers,
  tierOverrides,
  autoBoundaries,
  onSetOverrides,
  canEdit,
  isMobile,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Current active boundaries (overrides or auto)
  const activeBoundaries = tierOverrides ?? autoBoundaries;

  // Player counts per tier
  const tierCounts = useMemo(() => {
    const counts: Record<BearTier, number> = { SS: 0, S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const p of rankedPlayers) {
      if (isPlayerComplete(p)) counts[p.tier]++;
    }
    return counts;
  }, [rankedPlayers]);

  // First player in each tier (for context)
  const tierFirstPlayer = useMemo(() => {
    const first: Partial<Record<BearTier, string>> = {};
    for (const p of rankedPlayers) {
      if (!first[p.tier] && isPlayerComplete(p)) {
        first[p.tier] = p.playerName;
      }
    }
    return first;
  }, [rankedPlayers]);

  const handleDraftChange = useCallback((tier: string, value: string) => {
    setDraft(prev => ({ ...prev, [tier]: value }));
  }, []);

  const handleApply = useCallback(() => {
    if (!activeBoundaries) return;
    const newOverrides: BearTierOverrides = {
      SS: parseFloat(draft.SS ?? '') || activeBoundaries.SS,
      S: parseFloat(draft.S ?? '') || activeBoundaries.S,
      A: parseFloat(draft.A ?? '') || activeBoundaries.A,
      B: parseFloat(draft.B ?? '') || activeBoundaries.B,
      C: parseFloat(draft.C ?? '') || activeBoundaries.C,
    };
    onSetOverrides(newOverrides);
    setDraft({});
  }, [draft, activeBoundaries, onSetOverrides]);

  const handleReset = useCallback(() => {
    onSetOverrides(null);
    setDraft({});
  }, [onSetOverrides]);

  if (!canEdit || rankedPlayers.length < 2) return null;

  return (
    <div style={{
      margin: '1rem 0',
      backgroundColor: '#111',
      border: '1px solid #222',
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Header toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0.65rem 0.85rem' : '0.75rem 1rem',
          background: 'none',
          border: 'none',
          color: '#aaa',
          fontSize: '0.78rem',
          fontFamily: FONT_DISPLAY,
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem' }}>⚙️</span>
          {t('bearRally.tierCutoffs', 'Tier Cutoffs')}
          {tierOverrides && (
            <span style={{
              fontSize: '0.6rem',
              padding: '0.1rem 0.35rem',
              backgroundColor: `${ACCENT}20`,
              border: `1px solid ${ACCENT}40`,
              borderRadius: '4px',
              color: ACCENT,
              fontWeight: 600,
            }}>
              {t('bearRally.customLabel', 'CUSTOM')}
            </span>
          )}
        </span>
        <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {/* Collapsed summary */}
      {!isOpen && activeBoundaries && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          padding: '0 0.85rem 0.65rem',
        }}>
          {TIERS.map(tier => {
            const color = BEAR_TIER_COLORS[tier];
            return (
              <span key={tier} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.65rem',
                color: '#888',
              }}>
                <span style={{ color, fontWeight: 700, fontFamily: FONT_DISPLAY }}>{tier}</span>
                <span>≥{activeBoundaries[tier].toFixed(0)}</span>
                <span style={{ color: '#555' }}>({tierCounts[tier]})</span>
              </span>
            );
          })}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.65rem',
            color: '#888',
          }}>
            <span style={{ color: BEAR_TIER_COLORS.D, fontWeight: 700, fontFamily: FONT_DISPLAY }}>D</span>
            <span style={{ color: '#555' }}>({tierCounts.D})</span>
          </span>
        </div>
      )}

      {/* Expanded editor */}
      {isOpen && (
        <div style={{ padding: '0 0.85rem 0.85rem' }}>
          <p style={{ fontSize: '0.68rem', color: '#666', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
            {t('bearRally.tierCutoffsDesc', 'Set the minimum Bear Score for each tier. Players below the C threshold are placed in D tier.')}
          </p>

          {/* Tier rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {TIERS.map(tier => {
              const color = BEAR_TIER_COLORS[tier];
              const current = activeBoundaries?.[tier] ?? 0;
              const autoVal = autoBoundaries?.[tier];
              const draftVal = draft[tier];
              const isModified = tierOverrides !== null;
              const firstPlayer = tierFirstPlayer[tier];

              return (
                <div key={tier} style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '36px 1fr 60px' : '40px 1fr 80px 1fr',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.5rem',
                  backgroundColor: `${color}08`,
                  borderRadius: '6px',
                  border: `1px solid ${color}15`,
                }}>
                  {/* Tier badge */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '24px',
                    backgroundColor: `${color}18`,
                    border: `1px solid ${color}40`,
                    borderRadius: '5px',
                    color,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    fontFamily: FONT_DISPLAY,
                  }}>
                    {tier}
                  </span>

                  {/* Score input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.65rem', color: '#666', whiteSpace: 'nowrap' }}>≥</span>
                    <input
                      type="number"
                      step="0.1"
                      value={draftVal ?? current.toFixed(1)}
                      onChange={(e) => handleDraftChange(tier, e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '90px',
                        padding: '0.3rem 0.4rem',
                        backgroundColor: '#1a1a1a',
                        border: `1px solid ${isModified ? `${color}40` : '#333'}`,
                        borderRadius: '5px',
                        color: '#ddd',
                        fontSize: '0.72rem',
                        fontFamily: 'monospace',
                        outline: 'none',
                      }}
                      onFocus={(e) => e.target.style.borderColor = color}
                      onBlur={(e) => e.target.style.borderColor = isModified ? `${color}40` : '#333'}
                    />
                  </div>

                  {/* Count */}
                  <span style={{
                    fontSize: '0.65rem',
                    color: '#888',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}>
                    {tierCounts[tier]} {tierCounts[tier] === 1 ? 'player' : 'players'}
                  </span>

                  {/* First player hint (desktop only) */}
                  {!isMobile && (
                    <span style={{
                      fontSize: '0.6rem',
                      color: '#555',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {firstPlayer ? `#1: ${firstPlayer}` : ''}
                      {autoVal !== undefined && autoVal !== current ? ` (auto: ${autoVal.toFixed(0)})` : ''}
                    </span>
                  )}
                </div>
              );
            })}

            {/* D tier (read-only) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '36px 1fr 60px' : '40px 1fr 80px 1fr',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.5rem',
              backgroundColor: `${BEAR_TIER_COLORS.D}08`,
              borderRadius: '6px',
              border: `1px solid ${BEAR_TIER_COLORS.D}15`,
              opacity: 0.7,
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '32px',
                height: '24px',
                backgroundColor: `${BEAR_TIER_COLORS.D}18`,
                border: `1px solid ${BEAR_TIER_COLORS.D}40`,
                borderRadius: '5px',
                color: BEAR_TIER_COLORS.D,
                fontSize: '0.65rem',
                fontWeight: 800,
                fontFamily: FONT_DISPLAY,
              }}>
                D
              </span>
              <span style={{ fontSize: '0.65rem', color: '#666' }}>
                {t('bearRally.belowC', 'Below C threshold')}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#888', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {tierCounts.D} {tierCounts.D === 1 ? 'player' : 'players'}
              </span>
              {!isMobile && <span />}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '0.75rem',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}>
            {tierOverrides && (
              <button
                onClick={handleReset}
                style={{
                  padding: '0.4rem 0.75rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#aaa',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontFamily: FONT_DISPLAY,
                }}
              >
                {t('bearRally.resetToAuto', 'Reset to Auto')}
              </button>
            )}
            <button
              onClick={handleApply}
              style={{
                padding: '0.4rem 0.85rem',
                backgroundColor: `${ACCENT}20`,
                border: `1px solid ${ACCENT}50`,
                borderRadius: '6px',
                color: ACCENT,
                fontSize: '0.7rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: FONT_DISPLAY,
              }}
            >
              {t('bearRally.applyCutoffs', 'Apply Cutoffs')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BearTierCutoffEditor;
