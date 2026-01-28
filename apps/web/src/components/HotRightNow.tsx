import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Kingdom, getPowerTier } from '../types';
import { getTierColor } from '../utils/styles';

interface HotRightNowProps {
  kingdoms: Kingdom[];
  recentlyViewed?: number[];
  limit?: number;
}

const HotRightNow: React.FC<HotRightNowProps> = ({ 
  kingdoms, 
  recentlyViewed = [],
  limit = 6 
}) => {
  const hotKingdoms = useMemo(() => {
    // Calculate "hotness" based on various factors
    const scored = kingdoms.map(k => {
      let hotScore = 0;
      
      // S-tier kingdoms are hot
      if (getPowerTier(k.overall_score) === 'S') hotScore += 5;
      
      // High win rates are hot
      if (k.prep_win_rate >= 0.7) hotScore += 2;
      if (k.battle_win_rate >= 0.7) hotScore += 2;
      
      // Recently active (more KvKs = more relevant)
      if (k.total_kvks >= 5) hotScore += 1;
      
      // Leading status is desirable
      if (k.most_recent_status === 'Leading') hotScore += 3;
      
      // Recently viewed by user indicates interest
      if (recentlyViewed.includes(k.kingdom_number)) hotScore += 2;
      
      // Add some randomness for variety (seeded by kingdom number for consistency)
      hotScore += (k.kingdom_number % 10) * 0.1;
      
      return { kingdom: k, hotScore };
    })
    .filter(k => k.hotScore > 3) // Only show actually "hot" kingdoms
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, limit);

    return scored;
  }, [kingdoms, recentlyViewed, limit]);

  if (hotKingdoms.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      <h3 style={{ 
        color: '#fff', 
        fontSize: '0.95rem', 
        fontWeight: '600', 
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span style={{ color: '#ef4444' }}>🔥</span>
        Hot Right Now
      </h3>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '0.5rem' 
      }}>
        {hotKingdoms.map(({ kingdom }) => {
          const tier = getPowerTier(kingdom.overall_score);
          const tierColor = getTierColor(tier);
          
          return (
            <Link
              key={kingdom.kingdom_number}
              to={`/kingdom/${kingdom.kingdom_number}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '0.6rem',
                backgroundColor: '#1a1a20',
                borderRadius: '8px',
                textDecoration: 'none',
                border: '1px solid transparent',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#222230';
                e.currentTarget.style.borderColor = '#ef444440';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1a20';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.85rem' }}>
                  K{kingdom.kingdom_number}
                </span>
                <span style={{
                  padding: '0.1rem 0.3rem',
                  backgroundColor: `${tierColor}20`,
                  color: tierColor,
                  fontSize: '0.6rem',
                  fontWeight: '600',
                  borderRadius: '3px'
                }}>
                  {tier}
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginTop: '0.35rem'
              }}>
                <span style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: '600' }}>
                  {kingdom.overall_score.toFixed(1)}
                </span>
                {kingdom.most_recent_status === 'Leading' && (
                  <span style={{ color: '#fbbf24', fontSize: '0.65rem' }}>Leading</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default HotRightNow;
