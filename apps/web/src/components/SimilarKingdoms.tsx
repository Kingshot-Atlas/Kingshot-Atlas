import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Kingdom, getPowerTier } from '../types';
import { getTierColor } from '../utils/styles';

interface SimilarKingdomsProps {
  currentKingdom: Kingdom;
  allKingdoms: Kingdom[];
  limit?: number;
}

const SimilarKingdoms: React.FC<SimilarKingdomsProps> = ({ 
  currentKingdom, 
  allKingdoms, 
  limit = 5 
}) => {
  const similarKingdoms = useMemo(() => {
    // Calculate similarity score based on multiple factors
    const scored = allKingdoms
      .filter(k => k.kingdom_number !== currentKingdom.kingdom_number)
      .map(k => {
        // Score similarity (lower = more similar)
        const scoreDiff = Math.abs(k.overall_score - currentKingdom.overall_score);
        const prepWRDiff = Math.abs(k.prep_win_rate - currentKingdom.prep_win_rate) * 10;
        const battleWRDiff = Math.abs(k.battle_win_rate - currentKingdom.battle_win_rate) * 10;
        const kvkDiff = Math.abs(k.total_kvks - currentKingdom.total_kvks) * 0.5;
        const sameTier = getPowerTier(k.overall_score) === getPowerTier(currentKingdom.overall_score) ? -2 : 0;
        const sameStatus = k.most_recent_status === currentKingdom.most_recent_status ? -1 : 0;
        
        const similarity = scoreDiff + prepWRDiff + battleWRDiff + kvkDiff + sameTier + sameStatus;
        
        return { kingdom: k, similarity };
      })
      .sort((a, b) => a.similarity - b.similarity)
      .slice(0, limit);

    return scored;
  }, [currentKingdom, allKingdoms, limit]);

  if (similarKingdoms.length === 0) return null;

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
        <span style={{ fontSize: '1rem' }}>🎯</span>
        Kingdoms Like This
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {similarKingdoms.map(({ kingdom, similarity }) => {
          const tier = getPowerTier(kingdom.overall_score);
          const tierColor = getTierColor(tier);
          
          return (
            <Link
              key={kingdom.kingdom_number}
              to={`/kingdom/${kingdom.kingdom_number}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 0.75rem',
                backgroundColor: '#1a1a20',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#222230';
                e.currentTarget.style.borderColor = '#3a3a3a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1a20';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ 
                  color: '#fff', 
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}>
                  K{kingdom.kingdom_number}
                </span>
                <span style={{
                  padding: '0.15rem 0.35rem',
                  backgroundColor: `${tierColor}20`,
                  color: tierColor,
                  fontSize: '0.65rem',
                  fontWeight: '600',
                  borderRadius: '3px'
                }}>
                  {tier}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: '#22d3ee', fontSize: '0.85rem', fontWeight: '600' }}>
                  {kingdom.overall_score.toFixed(1)}
                </span>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {Math.round(similarity * 10) / 10}% match
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SimilarKingdoms;
