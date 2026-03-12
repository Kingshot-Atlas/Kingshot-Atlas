import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Kingdom, getPowerTier } from '../types';
import { getTierColor, colors } from '../utils/styles';
import SmartTooltip from './shared/SmartTooltip';
import { useTranslation } from 'react-i18next';
import { getTransferGroup, getTransferGroupLabel } from '../config/transferGroups';

interface NearbyTopKingdomsProps {
  currentKingdom: Kingdom;
  allKingdoms: Kingdom[];
  limit?: number;
}

const NearbyTopKingdoms: React.FC<NearbyTopKingdomsProps> = ({ 
  currentKingdom, 
  allKingdoms, 
  limit = 5 
}) => {
  const { t } = useTranslation();
  
  const transferGroup = useMemo(() => getTransferGroup(currentKingdom.kingdom_number), [currentKingdom.kingdom_number]);

  const topKingdoms = useMemo(() => {
    // Only compare with kingdoms within the same transfer group
    const inGroup = allKingdoms
      .filter(k => k.kingdom_number !== currentKingdom.kingdom_number)
      .filter(k => {
        if (!transferGroup) return false;
        return k.kingdom_number >= transferGroup[0] && k.kingdom_number <= transferGroup[1];
      })
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, limit);

    return inGroup;
  }, [currentKingdom, allKingdoms, limit, transferGroup]);

  if (topKingdoms.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}>
        <SmartTooltip
          accentColor={colors.primary}
          maxWidth={240}
          content={
            <div style={{ fontSize: '0.7rem' }}>
              <div style={{ color: colors.primary, fontWeight: 'bold', marginBottom: '2px' }}>{t('nearbyTopKingdoms.howItWorks', 'How it works')}</div>
              <div style={{ color: '#9ca3af' }}>{transferGroup ? t('nearbyTopKingdoms.tooltipDesc', 'Top kingdoms by Atlas Score in transfer group {{group}}', { group: getTransferGroupLabel(transferGroup) }) : t('nearbyTopKingdoms.noGroup', 'No transfer group found for this kingdom')}</div>
            </div>
          }
        >
          <h3 style={{ 
            color: '#fff', 
            fontSize: '0.95rem', 
            fontWeight: '600', 
            margin: 0,
            cursor: 'help'
          }}>
            {t('nearbyTopKingdoms.title', 'Nearby Top Kingdoms')}
          </h3>
        </SmartTooltip>
      </div>
      
      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr auto 1.5fr auto',
        gap: '0.75rem',
        padding: '0 0.75rem 0.5rem',
        borderBottom: '1px solid #2a2a2a',
        marginBottom: '0.5rem'
      }}>
        <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '500', textAlign: 'left' }}>{t('common.kingdom', 'Kingdom')}</span>
        <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '500', textAlign: 'left', paddingLeft: '0.25rem' }}>Tier</span>
        <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '500', textAlign: 'center' }}>Atlas Score</span>
        <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '500', textAlign: 'center' }}>{t('common.rank', 'Rank')}</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {topKingdoms.map((kingdom) => {
          const tier = getPowerTier(kingdom.overall_score);
          const tierColor = getTierColor(tier);
          return (
            <Link
              key={kingdom.kingdom_number}
              to={`/kingdom/${kingdom.kingdom_number}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr auto 1.5fr auto',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '0.4rem 0.75rem',
                backgroundColor: '#1a1a20',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#222230';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1a20';
              }}
            >
              {/* Kingdom */}
              <span style={{ 
                color: '#fff', 
                fontWeight: '600',
                fontSize: '0.85rem',
                textAlign: 'left'
              }}>
                {t('common.kingdom', 'Kingdom')} {kingdom.kingdom_number}
              </span>
              
              {/* Tier */}
              <span style={{
                padding: '0.15rem 0.35rem',
                backgroundColor: `${tierColor}20`,
                color: tierColor,
                fontSize: '0.65rem',
                fontWeight: '600',
                borderRadius: '3px',
                textAlign: 'center',
                marginLeft: '0.25rem'
              }}>
                {tier}
              </span>
              
              {/* Atlas Score */}
              <span style={{ 
                color: '#22d3ee', 
                fontSize: '0.85rem', 
                fontWeight: '600',
                textShadow: '0 0 8px rgba(34, 211, 238, 0.5)',
                textAlign: 'center',
                whiteSpace: 'nowrap'
              }}>
                {kingdom.overall_score.toFixed(2)}
              </span>
              
              {/* Rank */}
              <span style={{ 
                color: '#fbbf24', 
                fontSize: '0.75rem',
                fontWeight: '500',
                textAlign: 'center'
              }}>
                #{kingdom.rank || '—'}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default NearbyTopKingdoms;
