import React, { useMemo, memo } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { 
  KingdomProfile, 
  getPowerTier, 
  POWER_TIER_THRESHOLDS, 
  TIER_COLORS,
  extractStatsFromProfile,
  calculateAtlasScore,
  type PowerTier
} from '../types';

interface PathToNextTierProps {
  kingdom: KingdomProfile;
}

interface TierRequirement {
  tier: PowerTier;
  threshold: number;
  pointsNeeded: number;
  kvksNeeded: number;
  description: string;
}

const PathToNextTier: React.FC<PathToNextTierProps> = ({ kingdom }) => {
  const isMobile = useIsMobile();
  
  const analysis = useMemo(() => {
    const stats = extractStatsFromProfile(kingdom);
    const breakdown = calculateAtlasScore(stats);
    const currentScore = breakdown.finalScore;
    const currentTier = breakdown.tier;
    
    // Get tiers above current
    const tierOrder: PowerTier[] = ['D', 'C', 'B', 'A', 'S'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    // Calculate requirements for each higher tier
    const requirements: TierRequirement[] = [];
    
    for (let i = currentIndex + 1; i < tierOrder.length; i++) {
      const targetTier = tierOrder[i];
      const threshold = POWER_TIER_THRESHOLDS[targetTier];
      const pointsNeeded = Math.max(0, threshold - currentScore);
      
      // Estimate KvKs needed based on average score gain per domination
      // Assuming each domination adds ~0.3-0.5 points on average
      const avgScorePerDomination = 0.35;
      const kvksNeeded = Math.ceil(pointsNeeded / avgScorePerDomination);
      
      const descriptions: Record<PowerTier, string> = {
        S: 'Elite status - Top 3% of all kingdoms',
        A: 'Formidable - Serious contender status',
        B: 'Competitive - Above average performance',
        C: 'Developing - Average kingdom tier',
        D: 'Rebuilding - Growth opportunity'
      };
      
      requirements.push({
        tier: targetTier,
        threshold,
        pointsNeeded: Math.round(pointsNeeded * 100) / 100,
        kvksNeeded,
        description: descriptions[targetTier]
      });
    }
    
    // What-if scenarios
    const scenarios = [
      {
        name: 'Domination',
        description: 'Win both Prep and Battle',
        icon: '👑',
        simulate: () => {
          const simStats = { ...stats };
          simStats.totalKvks += 1;
          simStats.prepWins += 1;
          simStats.battleWins += 1;
          simStats.dominations += 1;
          simStats.currentPrepStreak = Math.max(1, simStats.currentPrepStreak + 1);
          simStats.currentBattleStreak = Math.max(1, simStats.currentBattleStreak + 1);
          simStats.recentOutcomes = ['Domination', ...simStats.recentOutcomes.slice(0, 4)];
          return calculateAtlasScore(simStats).finalScore;
        }
      },
      {
        name: 'Comeback',
        description: 'Lose Prep, Win Battle',
        icon: '🔄',
        simulate: () => {
          const simStats = { ...stats };
          simStats.totalKvks += 1;
          simStats.prepLosses += 1;
          simStats.battleWins += 1;
          simStats.currentPrepStreak = 0;
          simStats.currentBattleStreak = Math.max(1, simStats.currentBattleStreak + 1);
          simStats.recentOutcomes = ['Comeback', ...simStats.recentOutcomes.slice(0, 4)];
          return calculateAtlasScore(simStats).finalScore;
        }
      },
      {
        name: 'Reversal',
        description: 'Win Prep, Lose Battle',
        icon: '↩️',
        simulate: () => {
          const simStats = { ...stats };
          simStats.totalKvks += 1;
          simStats.prepWins += 1;
          simStats.battleLosses += 1;
          simStats.currentPrepStreak = Math.max(1, simStats.currentPrepStreak + 1);
          simStats.currentBattleStreak = 0;
          simStats.recentOutcomes = ['Reversal', ...simStats.recentOutcomes.slice(0, 4)];
          return calculateAtlasScore(simStats).finalScore;
        }
      },
      {
        name: 'Invasion',
        description: 'Lose both phases',
        icon: '💀',
        simulate: () => {
          const simStats = { ...stats };
          simStats.totalKvks += 1;
          simStats.prepLosses += 1;
          simStats.battleLosses += 1;
          simStats.invasions += 1;
          simStats.currentPrepStreak = 0;
          simStats.currentBattleStreak = 0;
          simStats.recentOutcomes = ['Invasion', ...simStats.recentOutcomes.slice(0, 4)];
          return calculateAtlasScore(simStats).finalScore;
        }
      }
    ];
    
    // Calculate projected scores for each scenario
    const projections = scenarios.map(s => ({
      ...s,
      projectedScore: s.simulate(),
      change: s.simulate() - currentScore
    }));
    
    return {
      currentScore,
      currentTier,
      requirements,
      projections,
      breakdown
    };
  }, [kingdom]);
  
  if (analysis.currentTier === 'S') {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: '#131318',
        borderRadius: '10px',
        border: '1px solid #fbbf2430',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👑</div>
        <div style={{ color: '#fbbf24', fontWeight: '600', fontSize: '0.9rem' }}>
          Already S-Tier!
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          Maintain your elite status with consistent dominations
        </div>
      </div>
    );
  }
  
  return (
    <div style={{
      padding: isMobile ? '1rem' : '1.25rem',
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a'
    }}>
      <h4 style={{
        color: '#fff',
        fontSize: isMobile ? '0.9rem' : '0.95rem',
        fontWeight: '600',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        📈 Path to Next Tier
      </h4>
      
      {/* Current Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1rem',
        padding: '0.75rem',
        backgroundColor: '#0a0a0a',
        borderRadius: '8px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          backgroundColor: `${TIER_COLORS[analysis.currentTier]}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: TIER_COLORS[analysis.currentTier],
          fontWeight: '700',
          fontSize: '1.1rem'
        }}>
          {analysis.currentTier}
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '500' }}>
            Current: {analysis.currentScore.toFixed(2)}
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>
            {analysis.currentTier}-Tier Kingdom
          </div>
        </div>
      </div>
      
      {/* Next Tier Target */}
      {analysis.requirements.length > 0 && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
          border: `1px solid ${TIER_COLORS[analysis.requirements[0].tier]}30`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '500' }}>
              Next: {analysis.requirements[0].tier}-Tier ({analysis.requirements[0].threshold}+)
            </span>
            <span style={{ 
              color: TIER_COLORS[analysis.requirements[0].tier], 
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              +{analysis.requirements[0].pointsNeeded} pts
            </span>
          </div>
          
          {/* Progress bar */}
          <div style={{
            height: '6px',
            backgroundColor: '#1a1a1a',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (analysis.currentScore / analysis.requirements[0].threshold) * 100)}%`,
              backgroundColor: TIER_COLORS[analysis.requirements[0].tier],
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          
          <div style={{ 
            color: '#6b7280', 
            fontSize: '0.65rem', 
            marginTop: '0.5rem',
            textAlign: 'center'
          }}>
            ~{analysis.requirements[0].kvksNeeded} dominations needed (estimated)
          </div>
        </div>
      )}
      
      {/* What-If Scenarios */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ 
          color: '#9ca3af', 
          fontSize: '0.7rem', 
          marginBottom: '0.5rem',
          fontWeight: '500'
        }}>
          Next KvK Impact
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.5rem'
        }}>
          {analysis.projections.map((proj, i) => (
            <div
              key={i}
              style={{
                padding: '0.5rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '6px',
                border: `1px solid ${proj.change >= 0 ? '#22c55e20' : '#ef444420'}`
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                marginBottom: '0.25rem'
              }}>
                <span style={{ fontSize: '0.9rem' }}>{proj.icon}</span>
                <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: '500' }}>
                  {proj.name}
                </span>
              </div>
              <div style={{
                color: proj.change >= 0 ? '#22c55e' : '#ef4444',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}>
                {proj.change >= 0 ? '+' : ''}{proj.change.toFixed(2)}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>
                → {proj.projectedScore.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Higher tiers preview */}
      {analysis.requirements.length > 1 && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ 
            color: '#6b7280', 
            fontSize: '0.65rem', 
            marginBottom: '0.5rem' 
          }}>
            Higher Tier Goals
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {analysis.requirements.slice(1).map((req, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  color: TIER_COLORS[req.tier],
                  fontWeight: '700',
                  fontSize: '0.9rem'
                }}>
                  {req.tier}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>
                  +{req.pointsNeeded} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(PathToNextTier);
