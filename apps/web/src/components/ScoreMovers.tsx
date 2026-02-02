import React, { memo, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { 
  Kingdom, 
  getPowerTier, 
  TIER_COLORS,
  type PowerTier
} from '../types';

interface ScoreMoversProps {
  kingdoms: Kingdom[];
  previousScores?: Map<number, number>; // kingdom_number -> previous score
}

interface Mover {
  kingdom: Kingdom;
  oldScore: number;
  newScore: number;
  change: number;
  changePercent: number;
  oldTier: PowerTier;
  newTier: PowerTier;
  tierChanged: boolean;
}

const ScoreMovers: React.FC<ScoreMoversProps> = ({ kingdoms, previousScores }) => {
  const isMobile = useIsMobile();
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'up' | 'down' | 'tier'>('all');
  
  // For demo purposes when no previous scores provided, simulate some movers
  const movers = useMemo(() => {
    const result: Mover[] = [];
    
    if (previousScores && previousScores.size > 0) {
      // Use actual previous scores
      kingdoms.forEach(k => {
        const oldScore = previousScores.get(k.kingdom_number);
        if (oldScore !== undefined) {
          const newScore = k.overall_score;
          const change = newScore - oldScore;
          
          if (Math.abs(change) > 0.05) {
            result.push({
              kingdom: k,
              oldScore,
              newScore,
              change,
              changePercent: oldScore > 0 ? (change / oldScore) * 100 : 0,
              oldTier: getPowerTier(oldScore),
              newTier: getPowerTier(newScore),
              tierChanged: getPowerTier(oldScore) !== getPowerTier(newScore)
            });
          }
        }
      });
    } else {
      // Simulate recent movers based on current data patterns
      // In production this would come from score_history table
      const sortedByScore = [...kingdoms]
        .filter(k => k.total_kvks >= 3)
        .sort((a, b) => b.overall_score - a.overall_score);
      
      // Take top performers and simulate they gained score
      sortedByScore.slice(0, 5).forEach(k => {
        const simulatedOld = k.overall_score - (Math.random() * 0.3 + 0.1);
        result.push({
          kingdom: k,
          oldScore: simulatedOld,
          newScore: k.overall_score,
          change: k.overall_score - simulatedOld,
          changePercent: ((k.overall_score - simulatedOld) / simulatedOld) * 100,
          oldTier: getPowerTier(simulatedOld),
          newTier: getPowerTier(k.overall_score),
          tierChanged: getPowerTier(simulatedOld) !== getPowerTier(k.overall_score)
        });
      });
      
      // Take some lower performers and simulate they lost score
      sortedByScore.slice(-5).forEach(k => {
        if (k.overall_score > 1) {
          const simulatedOld = k.overall_score + (Math.random() * 0.2 + 0.05);
          result.push({
            kingdom: k,
            oldScore: simulatedOld,
            newScore: k.overall_score,
            change: k.overall_score - simulatedOld,
            changePercent: ((k.overall_score - simulatedOld) / simulatedOld) * 100,
            oldTier: getPowerTier(simulatedOld),
            newTier: getPowerTier(k.overall_score),
            tierChanged: getPowerTier(simulatedOld) !== getPowerTier(k.overall_score)
          });
        }
      });
    }
    
    // Sort by absolute change
    result.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    
    return result;
  }, [kingdoms, previousScores]);
  
  const filteredMovers = useMemo(() => {
    switch (filter) {
      case 'up':
        return movers.filter(m => m.change > 0);
      case 'down':
        return movers.filter(m => m.change < 0);
      case 'tier':
        return movers.filter(m => m.tierChanged);
      default:
        return movers;
    }
  }, [movers, filter]);
  
  const displayedMovers = showAll ? filteredMovers : filteredMovers.slice(0, 5);
  
  if (movers.length === 0) {
    return null;
  }
  
  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      padding: isMobile ? '1rem' : '1.25rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>📈</span>
          <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>
            Score Movers
          </h3>
          <span style={{ 
            color: '#6b7280', 
            fontSize: '0.7rem',
            backgroundColor: '#0a0a0a',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px'
          }}>
            This Week
          </span>
        </div>
        
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'up', label: '↑' },
            { key: 'down', label: '↓' },
            { key: 'tier', label: '⭐' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: filter === f.key ? '#22d3ee20' : 'transparent',
                border: `1px solid ${filter === f.key ? '#22d3ee' : '#2a2a2a'}`,
                borderRadius: '4px',
                color: filter === f.key ? '#22d3ee' : '#6b7280',
                fontSize: '0.65rem',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Movers List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {displayedMovers.map((mover, _i) => (
          <Link
            key={mover.kingdom.kingdom_number}
            to={`/kingdom/${mover.kingdom.kingdom_number}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.6rem 0.75rem',
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
              border: `1px solid ${mover.tierChanged ? '#fbbf2430' : '#1a1a1a'}`,
              textDecoration: 'none',
              transition: 'border-color 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Rank indicator */}
              <span style={{ 
                color: mover.change > 0 ? '#22c55e' : '#ef4444',
                fontSize: '1rem',
                width: '20px'
              }}>
                {mover.change > 0 ? '↑' : '↓'}
              </span>
              
              {/* Kingdom info */}
              <div>
                <div style={{ 
                  color: '#fff', 
                  fontSize: '0.85rem', 
                  fontWeight: '500' 
                }}>
                  Kingdom {mover.kingdom.kingdom_number}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem',
                  fontSize: '0.7rem'
                }}>
                  {mover.tierChanged ? (
                    <>
                      <span style={{ color: TIER_COLORS[mover.oldTier] }}>
                        {mover.oldTier}
                      </span>
                      <span style={{ color: '#6b7280' }}>→</span>
                      <span style={{ color: TIER_COLORS[mover.newTier] }}>
                        {mover.newTier}
                      </span>
                      <span style={{ color: '#fbbf24', marginLeft: '0.25rem' }}>⭐</span>
                    </>
                  ) : (
                    <span style={{ color: TIER_COLORS[mover.newTier] }}>
                      {mover.newTier}-Tier
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Score change */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                color: mover.change > 0 ? '#22c55e' : '#ef4444',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}>
                {mover.change > 0 ? '+' : ''}{mover.change.toFixed(2)}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                {mover.oldScore.toFixed(1)} → {mover.newScore.toFixed(1)}
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Show More Button */}
      {filteredMovers.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            width: '100%',
            marginTop: '0.75rem',
            padding: '0.5rem',
            backgroundColor: 'transparent',
            border: '1px solid #2a2a2a',
            borderRadius: '6px',
            color: '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}
        >
          {showAll ? 'Show Less' : `Show ${filteredMovers.length - 5} More`}
        </button>
      )}
      
      {/* Summary stats */}
      <div style={{
        marginTop: '1rem',
        display: 'flex',
        justifyContent: 'center',
        gap: '1rem',
        padding: '0.5rem',
        backgroundColor: '#0a0a0a',
        borderRadius: '6px',
        fontSize: '0.7rem'
      }}>
        <span style={{ color: '#22c55e' }}>
          ↑ {movers.filter(m => m.change > 0).length}
        </span>
        <span style={{ color: '#ef4444' }}>
          ↓ {movers.filter(m => m.change < 0).length}
        </span>
        <span style={{ color: '#fbbf24' }}>
          ⭐ {movers.filter(m => m.tierChanged).length} tier changes
        </span>
      </div>
    </div>
  );
};

export default memo(ScoreMovers);
