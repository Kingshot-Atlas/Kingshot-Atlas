import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import type { FundInfo, TransfereeProfile } from './types';
import { formatTCLevel } from './types';
import { getAnonAlias } from '../../utils/anonAlias';

type ScoredTransferee = TransfereeProfile & { _matchScore: number };

interface RecommendedSectionProps {
  transferees: TransfereeProfile[];
  fund: FundInfo | null;
  sentInviteIds: Set<string>;
  canInvite: boolean;
  onSelectForInvite: (id: string) => void;
}

function scoreTransferee(tp: TransfereeProfile, fund: FundInfo): number {
  let totalWeight = 0;
  let weightedSum = 0;
  // Power (30%)
  const minPower = fund.min_power_million || 0;
  if (minPower > 0 && tp.power_million) {
    totalWeight += 0.30;
    weightedSum += (tp.power_million >= minPower ? 1.0 : Math.min(1, tp.power_million / minPower)) * 0.30;
  }
  // TC Level (25%)
  const minTc = fund.min_tc_level || 0;
  if (minTc > 0 && tp.tc_level) {
    totalWeight += 0.25;
    const tcScore = tp.tc_level >= minTc ? 1.0 : (minTc - tp.tc_level <= 2 ? 0.7 : minTc - tp.tc_level <= 5 ? 0.3 : 0);
    weightedSum += tcScore * 0.25;
  }
  // Language (25%)
  if (fund.main_language && tp.main_language) {
    totalWeight += 0.25;
    const langScore = fund.main_language === tp.main_language ? 1.0 : (fund.secondary_languages || []).includes(tp.main_language) ? 0.6 : 0;
    weightedSum += langScore * 0.25;
  }
  // Vibe (20%)
  if (fund.kingdom_vibe?.length && tp.looking_for?.length) {
    totalWeight += 0.20;
    const overlap = tp.looking_for.filter((v: string) => fund.kingdom_vibe!.includes(v));
    const vibeScore = overlap.length > 0 ? Math.min(1, 0.5 + (overlap.length / Math.min(tp.looking_for.length, fund.kingdom_vibe!.length)) * 0.5) : 0;
    weightedSum += vibeScore * 0.20;
  }
  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}

const RecommendedSection: React.FC<RecommendedSectionProps> = ({
  transferees, fund, sentInviteIds, canInvite, onSelectForInvite,
}) => {
  const { t } = useTranslation();

  const recommended: ScoredTransferee[] = useMemo(() => {
    if (!fund || transferees.length === 0) return [];
    return transferees
      .map(tp => ({ ...tp, _matchScore: scoreTransferee(tp, fund) }))
      .filter(tp => tp._matchScore >= 50 && !sentInviteIds.has(tp.id))
      .sort((a, b) => b._matchScore - a._matchScore)
      .slice(0, 8);
  }, [transferees, fund, sentInviteIds]);

  if (recommended.length === 0) return null;

  return (
    <div style={{
      marginBottom: '0.75rem',
      padding: '0.6rem 0.75rem',
      backgroundColor: '#22c55e08',
      border: '1px solid #22c55e20',
      borderRadius: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem' }}>✨</span>
        <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: '700' }}>
          {t('recruiter.recommendedForYou', 'Recommended for You')}
        </span>
        <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
          {t('recruiter.basedOnListing', 'Based on your listing requirements')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {recommended.map(tp => (
          <div key={tp.id} style={{
            minWidth: '140px', maxWidth: '160px', flexShrink: 0,
            padding: '0.5rem',
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                {tp.is_anonymous ? <><span title={t('recruiter.anonTooltip', 'This candidate is anonymous. Their real identity will be revealed if accepted.')}>🔒</span> {getAnonAlias(tp.id)}</> : (tp.username || 'Unknown')}
              </span>
              <span style={{
                padding: '0.05rem 0.3rem',
                backgroundColor: '#22c55e15',
                border: '1px solid #22c55e30',
                borderRadius: '4px',
                fontSize: '0.55rem',
                fontWeight: 'bold',
                color: '#22c55e',
              }}>
                {tp._matchScore}%
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.55rem', color: colors.textMuted }}>K{tp.current_kingdom}</span>
              <span style={{ fontSize: '0.55rem', color: '#f97316' }}>{tp.power_million ? `${tp.power_million}M` : '—'}</span>
              <span style={{ fontSize: '0.55rem', color: '#eab308' }}>{formatTCLevel(tp.tc_level)}</span>
              <span style={{ fontSize: '0.55rem', color: '#22d3ee' }}>{tp.main_language}</span>
            </div>
            {canInvite && !sentInviteIds.has(tp.id) && (
              <button
                onClick={() => onSelectForInvite(tp.id)}
                style={{
                  width: '100%', padding: '0.2rem',
                  backgroundColor: '#a855f715', border: '1px solid #a855f730',
                  borderRadius: '5px', color: '#a855f7',
                  fontSize: '0.55rem', fontWeight: '600', cursor: 'pointer',
                }}
              >
                + {t('recruiter.invite', 'Invite')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendedSection;
