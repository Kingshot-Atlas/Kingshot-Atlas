import React, { memo, Suspense, lazy, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { KingdomProfile } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';
import DonutChart from './DonutChart';
import SmartTooltip from './shared/SmartTooltip';
import {
  calculateAtlasScore,
  extractStatsFromProfile,
  TIER_COLORS,
  DISPLAY_SCALE_FACTOR,
} from '../utils/atlasScoreFormula';

// Lazy load RadarChart - only loaded when user expands the breakdown
const RadarChart = lazy(() => import('./RadarChart'));

interface AtlasScoreBreakdownProps {
  kingdom: KingdomProfile;
  rank?: number;
  totalKingdoms?: number;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

// Tooltip descriptions for score components
const SCORE_TOOLTIPS: Record<string, string> = {
  'Base Score': 'Combined win rate: Prep (45%) + Battle (55%) with Bayesian adjustment to prevent small sample bias.',
  'Dom/Inv': 'Dominations boost your score; Invasions hurt it equally. Rewards consistent double-phase performance.',
  'Recent Form': 'Performance trend in your last 5 KvKs. Recent results weigh more heavily.',
  'Streaks': 'Current win streaks provide a boost. Battle: +1.1% per win. Prep: +1% per win.',
  'Experience': 'Full experience credit achieved—no penalty applied.',
  'Experience Penalty': 'Kingdoms with 7+ KvKs get full credit. Newer kingdoms face a graduated penalty until they prove themselves.',
  'History': 'Bonus for extensive track record. Grows with each KvK completed.',
};

const AtlasScoreBreakdown: React.FC<AtlasScoreBreakdownProps> = ({ kingdom, rank, totalKingdoms, isExpanded: externalExpanded, onToggle }) => {
  const location = useLocation();
  const breakdownRef = useRef<HTMLDivElement>(null);
  
  // Calculate percentile if rank and total are provided
  const percentile = useMemo(() => {
    if (!rank || !totalKingdoms || totalKingdoms === 0) return null;
    return Math.round(((totalKingdoms - rank) / totalKingdoms) * 100);
  }, [rank, totalKingdoms]);
  const [internalExpanded, setInternalExpanded] = useState(false);
  
  // Use external control if provided, otherwise internal state
  const showChart = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const setShowChart = useCallback((value: boolean) => {
    if (onToggle) {
      onToggle(value);
    } else {
      setInternalExpanded(value);
    }
  }, [onToggle]);
  
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { trackFeature } = useAnalytics();
  
  // Auto-expand and scroll when navigating from spider chart
  useEffect(() => {
    if (location.hash === '#atlas-breakdown' || location.hash === '#performance') {
      setShowChart(true);
      // Small delay to allow render before scrolling
      setTimeout(() => {
        breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [location.hash, setShowChart]);
  
  // Track radar chart toggle with analytics
  const handleToggle = useCallback(() => {
    const newState = !showChart;
    setShowChart(newState);
    if (newState) {
      trackFeature('Radar Chart Opened', { 
        kingdom: kingdom.kingdom_number,
        atlasScore: kingdom.overall_score,
        tier: kingdom.power_tier || 'Unknown'
      });
    }
  }, [showChart, setShowChart, trackFeature, kingdom.kingdom_number, kingdom.overall_score, kingdom.power_tier]);
  
  // Calculate score components using centralized Atlas Score formula
  // Option B: Convert multipliers to sequential point contributions so numbers ADD UP
  const scoreComponents = useMemo(() => {
    const stats = extractStatsFromProfile(kingdom);
    const breakdown = calculateAtlasScore(stats);
    
    // Calculate sequential point contributions (so users can add them up)
    const base = breakdown.baseScore;
    
    // Step 1: Apply Dom/Inv multiplier
    const afterDomInv = base * breakdown.domInvMultiplier;
    const domInvContribution = afterDomInv - base;
    
    // Step 2: Apply Form multiplier
    const afterForm = afterDomInv * breakdown.recentFormMultiplier;
    const formContribution = afterForm - afterDomInv;
    
    // Step 3: Apply Streak multiplier
    const afterStreaks = afterForm * breakdown.streakMultiplier;
    const streakContribution = afterStreaks - afterForm;
    
    // Step 4: Apply Experience factor
    const afterExp = afterStreaks * breakdown.experienceFactor;
    const expContribution = afterExp - afterStreaks;
    
    // Step 5: History bonus is additive
    // Final = afterExp + historyBonus
    
    // For donut charts, show contributions as points (can be negative)
    // Max values for visualization (approximate ranges based on formula)
    // Scale all point values from internal (0-15) to display (0-100) range
    const sf = DISPLAY_SCALE_FACTOR;
    return {
      baseScore: { value: base * sf, maxPoints: 10 * sf },
      domInv: { value: domInvContribution * sf, maxPoints: 1.5 * sf },
      recentForm: { value: formContribution * sf, maxPoints: 1.5 * sf },
      streaks: { value: streakContribution * sf, maxPoints: 1.5 * sf },
      expFactor: breakdown.experienceFactor,
      expContribution: expContribution * sf,
      historyBonus: breakdown.historyBonus * sf,
      // Verify the math adds up
      calculatedTotal: (base + domInvContribution + formContribution + streakContribution + expContribution + breakdown.historyBonus) * sf,
      finalScore: breakdown.finalScore
    };
  }, [kingdom]);
  
  // Radar data for visual chart
  const radarData = useMemo(() => {
    const totalKvks = kingdom.total_kvks || 1;
    
    // Win Rate composite (0-100%)
    const winRateComposite = Math.round(((kingdom.prep_win_rate * 0.3) + (kingdom.battle_win_rate * 0.7)) * 100);
    
    // Domination rate (0-100%)
    const dominationRate = Math.round(((kingdom.dominations ?? 0) / totalKvks) * 100);
    
    // Recent form (calculate from last 3) - count actual phase wins, not KvKs with any win
    const recentKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number).slice(0, 3);
    let recentPhaseWins = 0;
    recentKvks.forEach(k => {
      if (k.prep_result === 'Win' || k.prep_result === 'W') recentPhaseWins++;
      if (k.battle_result === 'Win' || k.battle_result === 'W') recentPhaseWins++;
    });
    const maxPhaseWins = recentKvks.length * 2;
    const recentFormPct = maxPhaseWins > 0 ? Math.round((recentPhaseWins / maxPhaseWins) * 100) : 50;
    
    // Streak strength - consider both current and best streaks for prep and battle
    const currentPrepStreak = Math.max(0, kingdom.prep_streak ?? 0);
    const currentBattleStreak = Math.max(0, kingdom.battle_streak ?? 0);
    const bestPrepStreak = kingdom.prep_best_streak ?? 0;
    const bestBattleStreak = kingdom.battle_best_streak ?? 0;
    // Weight: current streaks matter more, battle matters more than prep
    const streakScore = (currentBattleStreak * 15) + (currentPrepStreak * 10) + (bestBattleStreak * 8) + (bestPrepStreak * 5);
    const streakStrength = Math.min(100, Math.max(0, Math.round(streakScore / 0.38))); // Normalize: max realistic ~38 points → 100%
    
    // Experience (0-100%)
    const experiencePct = Math.min(100, Math.round((totalKvks / 7) * 100));
    
    // Resilience (inverse of invasion rate)
    const invasionRate = (kingdom.invasions ?? kingdom.defeats ?? 0) / totalKvks;
    const resilience = Math.round((1 - invasionRate) * 100);
    
    return [
      { label: t('radarLabels.winRate', 'Win Rate'), value: winRateComposite },
      { label: t('radarLabels.domination', 'Domination'), value: dominationRate },
      { label: t('radarLabels.form', 'Form'), value: recentFormPct },
      { label: t('radarLabels.streaks', 'Streaks'), value: streakStrength },
      { label: t('radarLabels.experience', 'Experience'), value: experiencePct },
      { label: t('radarLabels.resilience', 'Resilience'), value: resilience },
    ];
  }, [kingdom, t]);

  // Handle edge case: new kingdom with 0 KvKs
  if (kingdom.total_kvks === 0) {
    return (
      <div style={{
        backgroundColor: '#131318',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        border: '1px solid #2a2a2a',
        marginBottom: isMobile ? '1.25rem' : '1.5rem'
      }}>
        <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: '0 0 0.75rem 0', textAlign: 'center' }}>
          {t('scoreBreakdown.title', 'Atlas Score Breakdown')}
        </h4>
        <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          {t('scoreBreakdown.playFirst', 'Play your first KvK to unlock score breakdown!')}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={breakdownRef} 
      id="atlas-breakdown" 
      style={{ 
        backgroundColor: '#131318',
        borderRadius: '12px',
        border: '1px solid #2a2a2a',
        marginBottom: isMobile ? '1.25rem' : '1.5rem',
        overflow: 'hidden'
      }}
    >
      {/* Header - Always visible, clickable to toggle */}
      <div 
        onClick={handleToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
        tabIndex={0}
        role="button"
        aria-expanded={showChart}
        aria-label="Toggle Atlas Score Breakdown"
        style={{
          padding: isMobile ? '1rem' : '1.25rem',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.35rem',
          borderBottom: showChart ? '1px solid #2a2a2a' : 'none',
          position: 'relative'
        }}
      >
        <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: 0, textAlign: 'center' }}>
          {t('scoreBreakdown.title', 'Atlas Score Breakdown')}
        </h4>
        {!showChart && (
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            {t('scoreBreakdown.whyScore', '"Why is my score what it is?"')}
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
            transform: showChart ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      
      {/* Expandable Chart Section */}
      {showChart && (
        <div 
          style={{
            padding: isMobile ? '1rem' : '1.25rem',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          
          {/* Score Components Breakdown */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginBottom: '1.25rem',
            padding: '1rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '10px',
            border: '1px solid #1a1a1a'
          }}>
            {/* Header - Centered title with Atlas Score below */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '0.5rem',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid #2a2a2a'
            }}>
              <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: '600', marginBottom: '0.25rem' }}>
                {t('scoreBreakdown.scoreComponents', 'Score Components')}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>Atlas Score</span>
                <span style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: '700', 
                  color: '#22d3ee',
                  textShadow: '0 0 10px #22d3ee40'
                }}>
                  {kingdom.overall_score?.toFixed(2) || '0.00'}
                </span>
              </div>
              <span style={{ fontSize: '0.5rem', color: '#4a4a4a', marginTop: '0.15rem' }}>
                {t('scoreBreakdown.approximate', '(breakdown is approximate)')}
              </span>
            </div>
            
            {/* Score Component Donut Charts - 6 charts in grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
              gap: isMobile ? '0.5rem' : '0.75rem',
              justifyItems: 'center',
              marginBottom: '0.5rem'
            }}>
              {([
                { 
                  label: 'Base Score', 
                  sublabel: 'win rates',
                  points: scoreComponents.baseScore.value, 
                  maxPoints: scoreComponents.baseScore.maxPoints,
                  tooltipKey: 'Base Score',
                  isFullCredit: false
                },
                { 
                  label: 'Dom/Inv', 
                  sublabel: 'impact',
                  points: scoreComponents.domInv.value, 
                  maxPoints: scoreComponents.domInv.maxPoints,
                  tooltipKey: 'Dom/Inv',
                  isFullCredit: false
                },
                { 
                  label: 'Form', 
                  sublabel: 'last 5',
                  points: scoreComponents.recentForm.value, 
                  maxPoints: scoreComponents.recentForm.maxPoints,
                  tooltipKey: 'Recent Form',
                  isFullCredit: false
                },
                { 
                  label: 'Streaks', 
                  sublabel: 'bonus',
                  points: scoreComponents.streaks.value, 
                  maxPoints: scoreComponents.streaks.maxPoints,
                  tooltipKey: 'Streaks',
                  isFullCredit: false
                },
                { 
                  label: 'History', 
                  sublabel: 'bonus',
                  points: scoreComponents.historyBonus, 
                  maxPoints: 1.5 * DISPLAY_SCALE_FACTOR,
                  tooltipKey: 'History',
                  isFullCredit: false
                },
                { 
                  label: 'Experience', 
                  sublabel: (kingdom.total_kvks || 0) >= 7 ? 'No Penalty' : `${kingdom.total_kvks || 0} KvKs`,
                  points: (kingdom.total_kvks || 0) >= 7 ? 1.0 : scoreComponents.expContribution, 
                  maxPoints: 1.0,
                  tooltipKey: (kingdom.total_kvks || 0) >= 7 ? 'Experience' : 'Experience Penalty',
                  isFullCredit: (kingdom.total_kvks || 0) >= 7
                },
              ] as const).map((item, i) => {
                const tooltipText = SCORE_TOOLTIPS[item.tooltipKey];
                const isNegative = item.points < 0 && !item.isFullCredit;
                const displayColor = isNegative ? '#ef4444' : '#22c55e';
                return (
                  <SmartTooltip
                    key={i}
                    accentColor={displayColor}
                    maxWidth={200}
                    content={
                      tooltipText ? (
                        <div style={{ fontSize: '0.65rem', color: '#d1d5db', lineHeight: 1.4, textAlign: 'center' }}>
                          <div style={{ fontWeight: '600', color: displayColor, marginBottom: '0.25rem' }}>{item.label}</div>
                          {tooltipText}
                        </div>
                      ) : null
                    }
                  >
                    <div>
                      <DonutChart
                        value={item.points}
                        maxValue={item.maxPoints}
                        size={isMobile ? 60 : 70}
                        strokeWidth={isMobile ? 5 : 6}
                        color={displayColor}
                        label={item.label}
                        sublabel={item.sublabel}
                        isNegative={isNegative}
                        showCheckmark={item.isFullCredit}
                      />
                    </div>
                  </SmartTooltip>
                );
              })}
            </div>
            
            {/* Percentile - color matches kingdom tier */}
            {percentile !== null && (
              <div style={{ 
                marginTop: '0.25rem',
                padding: '0.5rem',
                backgroundColor: `${TIER_COLORS[kingdom.power_tier || 'D']}10`,
                borderRadius: '6px',
                textAlign: 'center',
                border: `1px solid ${TIER_COLORS[kingdom.power_tier || 'D']}30`
              }}>
                <span style={{ 
                  fontSize: '0.65rem', 
                  color: TIER_COLORS[kingdom.power_tier || 'D']
                }}>
                  {t('scoreBreakdown.ranksBetter', 'Ranks better than')} <strong>{percentile}%</strong> {t('scoreBreakdown.ofAllKingdoms', 'of all kingdoms')}
                </span>
              </div>
            )}
          </div>
          
          {/* Radar Chart */}
          <div style={{ 
            backgroundColor: '#0a0a0a', 
            borderRadius: '10px', 
            padding: '0.5rem',
            border: '1px solid #1a1a1a'
          }}>
            <Suspense fallback={
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: isMobile ? '220px' : '280px',
                color: '#6b7280',
                fontSize: '0.8rem'
              }}>
                {t('scoreBreakdown.loadingChart', 'Loading chart...')}
              </div>
            }>
              <RadarChart data={radarData} accentColor="#22d3ee" size={isMobile ? 260 : 320} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(AtlasScoreBreakdown);
