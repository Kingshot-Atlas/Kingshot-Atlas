import React, { useMemo, memo, useState, useRef, useEffect, useCallback } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { 
  KingdomProfile, 
  POWER_TIER_THRESHOLDS, 
  TIER_COLORS,
  extractStatsFromProfile,
  calculateAtlasScore,
  type PowerTier
} from '../types';

interface PathToNextTierProps {
  kingdom: KingdomProfile;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

interface TierRequirement {
  tier: PowerTier;
  threshold: number;
  pointsNeeded: number;
  kvksNeeded: number;
  description: string;
}

const PathToNextTier: React.FC<PathToNextTierProps> = ({ kingdom, isExpanded: externalExpanded, onToggle }) => {
  const isMobile = useIsMobile();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [hasShownConfetti, setHasShownConfetti] = useState(false);
  const confettiContainerRef = useRef<HTMLDivElement>(null);
  
  // Use external control if provided, otherwise internal state
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const setIsExpanded = (value: boolean) => {
    if (onToggle) {
      onToggle(value);
    } else {
      setInternalExpanded(value);
    }
  };
  
  // Confetti celebration effect for S-tier
  const triggerConfetti = useCallback(() => {
    if (!confettiContainerRef.current || hasShownConfetti) return;
    setHasShownConfetti(true);
    
    const container = confettiContainerRef.current;
    const colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#ffffff', '#22d3ee'];
    
    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: absolute;
        width: ${Math.random() * 8 + 4}px;
        height: ${Math.random() * 8 + 4}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%;
        top: 50%;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        pointer-events: none;
        opacity: 1;
        transform: rotate(${Math.random() * 360}deg);
        animation: confetti-fall ${1.5 + Math.random()}s ease-out forwards;
      `;
      container.appendChild(confetti);
      
      setTimeout(() => confetti.remove(), 2500);
    }
  }, [hasShownConfetti]);
  
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
    
    // S-tier specific calculations
    let sTierBuffer = 0;
    let sTierSinceKvK: number | null = null;
    
    if (currentTier === 'S' && kingdom.recent_kvks && kingdom.recent_kvks.length > 0) {
      // Calculate how many invasions until dropping to A-tier
      const aThreshold = POWER_TIER_THRESHOLDS.A;
      const buffer = currentScore - aThreshold;
      
      // Estimate invasions allowed (each invasion drops ~0.3-0.5 points on average)
      const avgScoreDropPerInvasion = 0.4;
      sTierBuffer = Math.max(0, Math.floor(buffer / avgScoreDropPerInvasion));
      
      // Find when kingdom became S-tier by walking back through KvK history
      const sortedKvKs = [...kingdom.recent_kvks].sort((a, b) => b.kvk_number - a.kvk_number);
      let simStats = extractStatsFromProfile(kingdom);
      
      // Walk backwards and simulate removing KvKs to find S-tier threshold
      for (const kvk of sortedKvKs) {
        const simBreakdown = calculateAtlasScore(simStats);
        if (simBreakdown.tier !== 'S') {
          // This KvK pushed them into S-tier
          sTierSinceKvK = kvk.kvk_number;
          break;
        }
        
        // Remove this KvK's contribution (approximate)
        simStats = { ...simStats };
        simStats.totalKvks = Math.max(0, simStats.totalKvks - 1);
        if (kvk.prep_result === 'W') simStats.prepWins = Math.max(0, simStats.prepWins - 1);
        else simStats.prepLosses = Math.max(0, simStats.prepLosses - 1);
        if (kvk.battle_result === 'W') simStats.battleWins = Math.max(0, simStats.battleWins - 1);
        else simStats.battleLosses = Math.max(0, simStats.battleLosses - 1);
        if (kvk.overall_result === 'Domination') simStats.dominations = Math.max(0, simStats.dominations - 1);
        if (kvk.overall_result === 'Invasion') simStats.invasions = Math.max(0, simStats.invasions - 1);
      }
    }
    
    return {
      currentScore,
      currentTier,
      requirements,
      projections,
      breakdown,
      sTierBuffer,
      sTierSinceKvK
    };
  }, [kingdom]);
  
  const isSTier = analysis.currentTier === 'S';
  
  // Trigger confetti when S-tier section is first expanded
  useEffect(() => {
    if (isExpanded && isSTier && !hasShownConfetti) {
      triggerConfetti();
    }
  }, [isExpanded, isSTier, hasShownConfetti, triggerConfetti]);
  
  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      marginBottom: isMobile ? '1.25rem' : '1.5rem',
      overflow: 'hidden'
    }}>
      {/* Header - Clickable to expand/collapse */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded); } }}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label="Toggle Path to Next Tier"
        style={{
          padding: isMobile ? '1rem' : '1.25rem',
          borderBottom: isExpanded ? '1px solid #2a2a2a' : 'none',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.35rem',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>📈</span>
          <h4 style={{ 
            color: '#fff', 
            fontSize: isMobile ? '0.95rem' : '1.1rem', 
            fontWeight: '600', 
            margin: 0 
          }}>
            Path to Next Tier
          </h4>
        </div>
        {!isExpanded && (
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            &quot;How do I reach the next tier?&quot;
          </span>
        )}
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#6b7280" 
          strokeWidth="2"
          style={{ 
            position: 'absolute',
            right: isMobile ? '1rem' : '1.25rem',
            top: '50%',
            transform: isExpanded ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
      <div style={{ padding: isMobile ? '1rem' : '1.25rem', paddingTop: 0 }}>
      
      {/* Confetti CSS Animation */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100px) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
      
      {/* S-Tier Achievement Message */}
      {isSTier ? (
        <div 
          ref={confettiContainerRef}
          style={{
            position: 'relative',
            padding: '1.5rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '10px',
            border: '1px solid #fbbf2430',
            textAlign: 'center',
            overflow: 'hidden'
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👑</div>
          <div style={{ 
            color: '#fbbf24', 
            fontWeight: '700', 
            fontSize: '1.2rem', 
            marginBottom: '0.5rem',
            textShadow: '0 0 10px #fbbf2440'
          }}>
            Already S-Tier!
          </div>
          
          {/* S-Tier Since Badge */}
          {analysis.sTierSinceKvK && (
            <div style={{ 
              display: 'inline-block',
              padding: '0.25rem 0.75rem',
              backgroundColor: '#fbbf2415',
              borderRadius: '20px',
              border: '1px solid #fbbf2430',
              color: '#fbbf24',
              fontSize: '0.75rem',
              fontWeight: '500',
              marginBottom: '1rem'
            }}>
              ⭐ S-Tier since KvK #{analysis.sTierSinceKvK}
            </div>
          )}
          
          {/* Maintenance Tips */}
          <div style={{ 
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#131318',
            borderRadius: '8px',
            border: '1px solid #2a2a2a'
          }}>
            <div style={{ 
              color: '#9ca3af', 
              fontSize: '0.7rem', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '0.5rem'
            }}>
              Elite Status Buffer
            </div>
            <div style={{ 
              color: analysis.sTierBuffer >= 2 ? '#22c55e' : analysis.sTierBuffer >= 1 ? '#eab308' : '#ef4444',
              fontSize: '1.1rem',
              fontWeight: '600',
              marginBottom: '0.25rem'
            }}>
              {analysis.sTierBuffer === 0 
                ? '⚠️ On the edge!' 
                : `${analysis.sTierBuffer} invasion${analysis.sTierBuffer !== 1 ? 's' : ''} before A-Tier`
              }
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
              {analysis.sTierBuffer >= 3 
                ? 'Comfortable buffer — keep dominating!' 
                : analysis.sTierBuffer >= 1 
                  ? 'Stay sharp — avoid consecutive losses'
                  : 'Critical! Next invasion drops you to A-Tier'
              }
            </div>
          </div>
          
          {/* Current Score Display */}
          <div style={{ 
            marginTop: '0.75rem',
            color: '#6b7280', 
            fontSize: '0.8rem' 
          }}>
            Current Score: <span style={{ color: '#fbbf24', fontWeight: '600' }}>{analysis.currentScore.toFixed(2)}</span>
            <span style={{ color: '#4b5563' }}> / {POWER_TIER_THRESHOLDS.S} threshold</span>
          </div>
        </div>
      ) : (
      <>
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
            Current: {analysis.currentScore.toFixed(1)}
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
                {proj.change >= 0 ? '+' : ''}{proj.change.toFixed(1)}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>
                → {proj.projectedScore.toFixed(1)}
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
                  +{req.pointsNeeded.toFixed(1)} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}
      </div>
      )}
    </div>
  );
};

export default memo(PathToNextTier);
