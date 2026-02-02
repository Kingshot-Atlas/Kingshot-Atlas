import React, { useMemo, memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { 
  Kingdom, 
  getPowerTier, 
  TIER_COLORS,
  type PowerTier
} from '../types';

interface AllianceScoringProps {
  kingdoms: Kingdom[];
  allianceIds?: number[];  // Optional subset of kingdom IDs to analyze
  title?: string;
}

interface AllianceStats {
  memberCount: number;
  totalKvks: number;
  avgScore: number;
  medianScore: number;
  totalDominations: number;
  totalInvasions: number;
  dominationRate: number;
  avgPrepWinRate: number;
  avgBattleWinRate: number;
  tierDistribution: Record<PowerTier, number>;
  topPerformers: Kingdom[];
  risers: Kingdom[];
}

const AllianceScoring: React.FC<AllianceScoringProps> = ({ 
  kingdoms, 
  allianceIds,
  title = 'Alliance Overview'
}) => {
  const isMobile = useIsMobile();
  const [showDetails, setShowDetails] = useState(false);
  const [selectedKingdoms, setSelectedKingdoms] = useState<Set<number>>(new Set(allianceIds || []));
  
  // Filter kingdoms if allianceIds provided, else use selection
  const allianceKingdoms = useMemo(() => {
    if (allianceIds && allianceIds.length > 0) {
      return kingdoms.filter(k => allianceIds.includes(k.kingdom_number));
    }
    if (selectedKingdoms.size > 0) {
      return kingdoms.filter(k => selectedKingdoms.has(k.kingdom_number));
    }
    return [];
  }, [kingdoms, allianceIds, selectedKingdoms]);
  
  const stats = useMemo((): AllianceStats | null => {
    if (allianceKingdoms.length === 0) return null;
    
    const scores = allianceKingdoms.map(k => k.overall_score).sort((a, b) => a - b);
    const totalKvks = allianceKingdoms.reduce((sum, k) => sum + (k.total_kvks || 0), 0);
    const totalDominations = allianceKingdoms.reduce((sum, k) => sum + (k.dominations || 0), 0);
    const totalInvasions = allianceKingdoms.reduce((sum, k) => sum + (k.invasions || k.defeats || 0), 0);
    
    const tierDistribution: Record<PowerTier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    allianceKingdoms.forEach(k => {
      tierDistribution[getPowerTier(k.overall_score)]++;
    });
    
    // Top performers by score
    const topPerformers = [...allianceKingdoms]
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, 5);
    
    // Risers - kingdoms with recent dominations
    const risers = [...allianceKingdoms]
      .filter(k => (k.dominations || 0) > 0)
      .sort((a, b) => (b.dominations || 0) - (a.dominations || 0))
      .slice(0, 5);
    
    return {
      memberCount: allianceKingdoms.length,
      totalKvks,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      medianScore: scores[Math.floor(scores.length / 2)],
      totalDominations,
      totalInvasions,
      dominationRate: totalKvks > 0 ? totalDominations / totalKvks : 0,
      avgPrepWinRate: allianceKingdoms.reduce((sum, k) => sum + (k.prep_win_rate || 0), 0) / allianceKingdoms.length,
      avgBattleWinRate: allianceKingdoms.reduce((sum, k) => sum + (k.battle_win_rate || 0), 0) / allianceKingdoms.length,
      tierDistribution,
      topPerformers,
      risers
    };
  }, [allianceKingdoms]);
  
  const toggleKingdom = (kingdomNumber: number) => {
    setSelectedKingdoms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(kingdomNumber)) {
        newSet.delete(kingdomNumber);
      } else {
        newSet.add(kingdomNumber);
      }
      return newSet;
    });
  };
  
  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        style={{
          width: '100%',
          padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>🏰</span>
          <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>
            {title}
          </span>
          {stats && (
            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
              ({stats.memberCount} kingdoms)
            </span>
          )}
        </div>
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#6b7280" 
          strokeWidth="2"
          style={{
            transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      
      {showDetails && (
        <div style={{ padding: '1rem', borderTop: '1px solid #2a2a2a' }}>
          {/* Kingdom Selector (if no preset allianceIds) */}
          {!allianceIds && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ 
                color: '#9ca3af', 
                fontSize: '0.7rem', 
                marginBottom: '0.5rem' 
              }}>
                Select kingdoms to analyze:
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.25rem',
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '0.5rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '8px'
              }}>
                {kingdoms.slice(0, 50).map(k => (
                  <button
                    key={k.kingdom_number}
                    onClick={() => toggleKingdom(k.kingdom_number)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: selectedKingdoms.has(k.kingdom_number) ? '#22d3ee20' : 'transparent',
                      border: `1px solid ${selectedKingdoms.has(k.kingdom_number) ? '#22d3ee' : '#2a2a2a'}`,
                      borderRadius: '4px',
                      color: selectedKingdoms.has(k.kingdom_number) ? '#22d3ee' : '#6b7280',
                      fontSize: '0.65rem',
                      cursor: 'pointer'
                    }}
                  >
                    K{k.kingdom_number}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {stats ? (
            <>
              {/* Aggregate Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                <div style={{
                  padding: '0.6rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>Avg Score</div>
                  <div style={{ 
                    color: TIER_COLORS[getPowerTier(stats.avgScore)], 
                    fontSize: '1.1rem', 
                    fontWeight: '700' 
                  }}>
                    {stats.avgScore.toFixed(2)}
                  </div>
                </div>
                <div style={{
                  padding: '0.6rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>Dom Rate</div>
                  <div style={{ color: '#22c55e', fontSize: '1.1rem', fontWeight: '700' }}>
                    {Math.round(stats.dominationRate * 100)}%
                  </div>
                </div>
                <div style={{
                  padding: '0.6rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>Total KvKs</div>
                  <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700' }}>
                    {stats.totalKvks}
                  </div>
                </div>
              </div>
              
              {/* Tier Distribution */}
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '8px'
              }}>
                <div style={{ 
                  color: '#9ca3af', 
                  fontSize: '0.65rem', 
                  marginBottom: '0.5rem' 
                }}>
                  Tier Distribution
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['S', 'A', 'B', 'C', 'D'] as PowerTier[]).map(tier => (
                    <div
                      key={tier}
                      style={{
                        flex: 1,
                        padding: '0.35rem',
                        backgroundColor: `${TIER_COLORS[tier]}15`,
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ 
                        color: TIER_COLORS[tier], 
                        fontWeight: '700', 
                        fontSize: '0.8rem' 
                      }}>
                        {tier}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '0.6rem' }}>
                        {stats.tierDistribution[tier]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Top Performers */}
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ 
                  color: '#9ca3af', 
                  fontSize: '0.65rem', 
                  marginBottom: '0.5rem' 
                }}>
                  Top Performers
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {stats.topPerformers.map((k, i) => (
                    <Link
                      key={k.kingdom_number}
                      to={`/kingdom/${k.kingdom_number}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.4rem 0.6rem',
                        backgroundColor: '#0a0a0a',
                        borderRadius: '6px',
                        textDecoration: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>#{i + 1}</span>
                        <span style={{ color: '#fff', fontSize: '0.75rem' }}>
                          K{k.kingdom_number}
                        </span>
                      </div>
                      <span style={{ 
                        color: TIER_COLORS[getPowerTier(k.overall_score)],
                        fontWeight: '600',
                        fontSize: '0.75rem'
                      }}>
                        {k.overall_score.toFixed(2)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
              
              {/* Win Rates */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.5rem'
              }}>
                <div style={{
                  padding: '0.5rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>Avg Prep WR</div>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>
                    {Math.round(stats.avgPrepWinRate * 100)}%
                  </div>
                </div>
                <div style={{
                  padding: '0.5rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>Avg Battle WR</div>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>
                    {Math.round(stats.avgBattleWinRate * 100)}%
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              color: '#6b7280', 
              fontSize: '0.8rem',
              padding: '2rem 0'
            }}>
              Select kingdoms above to view alliance statistics
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(AllianceScoring);
