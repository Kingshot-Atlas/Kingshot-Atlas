import React, { useMemo, memo, useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { 
  KingdomProfile, 
  POWER_TIER_THRESHOLDS, 
  TIER_COLORS,
  extractStatsFromProfile,
  calculateAtlasScore,
  type PowerTier
} from '../types';
import { getTierRange, TIER_PERCENTILES } from '../utils/atlasScoreFormula';

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
  const { t } = useTranslation();
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
    // Use Supabase score if available, otherwise fall back to calculated score
    // This ensures pointsNeeded calculation matches the displayed score
    const currentScore = kingdom.overall_score ?? breakdown.finalScore;
    const currentTier = breakdown.tier;
    
    // Get tiers above current
    const tierOrder: PowerTier[] = ['D', 'C', 'B', 'A', 'S'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    // First, calculate a single domination simulation to get actual score gain
    const domSimStats = { ...stats };
    domSimStats.totalKvks += 1;
    domSimStats.prepWins += 1;
    domSimStats.battleWins += 1;
    domSimStats.dominations += 1;
    domSimStats.currentPrepStreak = Math.max(1, domSimStats.currentPrepStreak + 1);
    domSimStats.currentBattleStreak = Math.max(1, domSimStats.currentBattleStreak + 1);
    domSimStats.recentOutcomes = ['Domination', ...domSimStats.recentOutcomes.slice(0, 4)];
    const singleDomScore = calculateAtlasScore(domSimStats).finalScore;
    const actualScorePerDomination = Math.max(0.1, singleDomScore - currentScore);
    
    // Calculate requirements for each higher tier
    const requirements: TierRequirement[] = [];
    
    const descriptions: Record<PowerTier, string> = {
      S: t('pathToTier.descS', 'Elite status - Top 3% of all kingdoms'),
      A: t('pathToTier.descA', 'Formidable - Serious contender status'),
      B: t('pathToTier.descB', 'Competitive - Above average performance'),
      C: t('pathToTier.descC', 'Developing - Average kingdom tier'),
      D: t('pathToTier.descD', 'Rebuilding - Growth opportunity')
    };

    for (let i = currentIndex + 1; i < tierOrder.length; i++) {
      const targetTier = tierOrder[i] as PowerTier;
      const threshold = POWER_TIER_THRESHOLDS[targetTier];
      const pointsNeeded = Math.max(0, threshold - currentScore);
      
      // Use actual simulated score gain for more accurate estimation
      const kvksNeeded = Math.ceil(pointsNeeded / actualScorePerDomination);
      
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
        name: t('pathToTier.domination', 'Domination'),
        description: t('pathToTier.dominationDesc', 'Win both Prep and Battle'),
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
        name: t('pathToTier.comeback', 'Comeback'),
        description: t('pathToTier.comebackDesc', 'Lose Prep, Win Battle'),
        icon: '💪',
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
        name: t('pathToTier.reversal', 'Reversal'),
        description: t('pathToTier.reversalDesc', 'Win Prep, Lose Battle'),
        icon: '🔄',
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
        name: t('pathToTier.invasion', 'Invasion'),
        description: t('pathToTier.invasionDesc', 'Lose both phases'),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: 0, textAlign: 'center' }}>
          {t('pathToTier.title', 'Path to Next Tier')}
        </h4>
        {!isExpanded && (
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            {t('pathToTier.subtitle', '"How do I reach the next tier?"')}
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
      <div style={{ padding: isMobile ? '1rem' : '1.25rem', paddingTop: '1rem' }}>
      
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
            {t('pathToTier.alreadySTier', 'Already S-Tier!')}
          </div>
          
          {/* Motivational Message */}
          <div style={{ 
            color: '#9ca3af',
            fontSize: '0.85rem',
            fontStyle: 'italic',
            marginBottom: '1rem',
            maxWidth: '280px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            {t('pathToTier.keepDominating', 'The top 3% fear no matchup. Keep dominating.')}
          </div>
          
          {/* Current Score Display */}
          <div style={{ 
            marginTop: '0.75rem',
            color: '#6b7280', 
            fontSize: '0.8rem' 
          }}>
            {t('pathToTier.currentScore', 'Current Score')}: <span style={{ color: '#fbbf24', fontWeight: '600' }}>{(kingdom.overall_score ?? analysis.currentScore).toFixed(2)}</span>
            <span style={{ color: '#4b5563' }}> / {POWER_TIER_THRESHOLDS.S} {t('pathToTier.threshold', 'threshold')}</span>
          </div>
        </div>
      ) : (
      <>
      {/* Current Tier and Next Tier - 2 Column Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        {/* Current Tier Box */}
        <div 
          style={{
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px',
            border: `1px solid ${TIER_COLORS[analysis.currentTier]}30`,
            textAlign: 'center',
            cursor: 'help'
          }}
          title={`${TIER_PERCENTILES[analysis.currentTier].description} (${TIER_PERCENTILES[analysis.currentTier].label}) • Score Range: ${getTierRange(analysis.currentTier)}`}
        >
          <div style={{ 
            color: '#6b7280', 
            fontSize: '0.65rem', 
            marginBottom: '0.5rem',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {t('pathToTier.currentTier', 'Current Tier')}
          </div>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: `${TIER_COLORS[analysis.currentTier]}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: TIER_COLORS[analysis.currentTier],
            fontWeight: '700',
            fontSize: '1.1rem',
            margin: '0 auto 0.5rem'
          }}>
            {analysis.currentTier}
          </div>
          <div style={{ 
            color: '#22d3ee', 
            fontSize: '1rem', 
            fontWeight: '600',
            textShadow: '0 0 8px #22d3ee40'
          }}>
            {(kingdom.overall_score ?? analysis.currentScore).toFixed(2)}
          </div>
        </div>
        
        {/* Next Tier Box */}
        {analysis.requirements.length > 0 && (() => {
          const nextTier = analysis.requirements[0]!;
          return (
            <div 
              style={{
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '8px',
                border: `1px solid ${TIER_COLORS[nextTier.tier]}30`,
                textAlign: 'center',
                cursor: 'help'
              }}
              title={`${TIER_PERCENTILES[nextTier.tier].description} (${TIER_PERCENTILES[nextTier.tier].label}) • Score Range: ${getTierRange(nextTier.tier)}`}
            >
              <div style={{ 
                color: '#6b7280', 
                fontSize: '0.65rem', 
                marginBottom: '0.5rem',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {t('pathToTier.nextTier', 'Next Tier')}
              </div>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: `${TIER_COLORS[nextTier.tier]}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: TIER_COLORS[nextTier.tier],
                fontWeight: '700',
                fontSize: '1.1rem',
                margin: '0 auto 0.5rem'
              }}>
                {nextTier.tier}
              </div>
              <div style={{ 
                color: '#22d3ee', 
                fontSize: '0.85rem',
                fontWeight: '600'
              }}>
                {nextTier.threshold}+ <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '400' }}>(+{nextTier.pointsNeeded.toFixed(2)} pts)</span>
              </div>
            </div>
          );
        })()}
      </div>
      
      {/* Progress to Next Tier */}
      {analysis.requirements.length > 0 && (() => {
        const nextReq = analysis.requirements[0]!;
        return (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px'
          }}>
            <div style={{ 
              color: '#6b7280', 
              fontSize: '0.65rem', 
              marginBottom: '0.5rem',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              textAlign: 'center'
            }}>
              {t('pathToTier.progressTo', 'Progress to')} {nextReq.tier}-Tier
            </div>
            
            {/* Progress bar */}
            <div style={{
              height: '8px',
              backgroundColor: '#1a1a1a',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, ((kingdom.overall_score ?? analysis.currentScore) / nextReq.threshold) * 100)}%`,
                backgroundColor: TIER_COLORS[nextReq.tier],
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            <div style={{ 
              color: '#6b7280', 
              fontSize: '0.7rem', 
              marginTop: '0.5rem',
              textAlign: 'center'
            }}>
              {t('pathToTier.dominationsNeeded', '~{{count}} domination(s) needed (estimated)', { count: nextReq.kvksNeeded })}
            </div>
          </div>
        );
      })()}
      
      {/* Next KvK Impact - 4 Column Layout */}
      <div>
        <div style={{ 
          color: '#6b7280', 
          fontSize: '0.65rem', 
          marginBottom: '0.5rem',
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          textAlign: 'center'
        }}>
          {t('pathToTier.nextKvkImpact', 'Next KvK Impact')}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '0.5rem'
        }}>
          {analysis.projections.map((proj, i) => (
            <div
              key={i}
              style={{
                padding: '0.5rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '6px',
                border: `1px solid ${proj.change >= 0 ? '#22c55e20' : '#ef444420'}`,
                textAlign: 'center'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                marginBottom: '0.35rem'
              }}>
                <span style={{ fontSize: '0.85rem' }}>{proj.icon}</span>
                <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: '500' }}>
                  {proj.name}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}>
                <span style={{
                  color: proj.change >= 0 ? '#22c55e' : '#ef4444',
                  fontSize: '0.85rem',
                  fontWeight: '700'
                }}>
                  {proj.change >= 0 ? '+' : ''}{proj.change.toFixed(2)}
                </span>
                <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                  →
                </span>
                <span style={{ color: '#22d3ee', fontSize: '0.85rem', fontWeight: '600' }}>
                  {proj.projectedScore.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}
      </div>
      )}
    </div>
  );
};

export default memo(PathToNextTier);
