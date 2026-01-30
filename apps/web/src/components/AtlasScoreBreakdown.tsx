import React, { useState, memo, Suspense, lazy, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { KingdomProfile } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';
import DonutChart from './DonutChart';

// Lazy load RadarChart - only loaded when user expands the breakdown
const RadarChart = lazy(() => import('./RadarChart'));

interface AtlasScoreBreakdownProps {
  kingdom: KingdomProfile;
  rank?: number;
  totalKingdoms?: number;
}

// Tooltip descriptions for score components
const SCORE_TOOLTIPS: Record<string, string> = {
  'Win Rate': 'Combined win rate weighted 30% Prep Phase and 70% Battle Phase. Battle wins matter more for competitive ranking.',
  'Performance': 'Bonus for dominations (both phases won) minus penalty for invasions (both phases lost). Rewards decisive victories.',
  'Recent Form': 'Performance in your last 3 KvKs, with more recent matches weighted higher. Shows current momentum.',
  'Streaks': 'Current winning/losing streaks plus historical best streaks. Consistency is rewarded.',
  'Trend': 'Overall trajectory over last 5 KvKs. Are you improving or declining?',
  'Experience Multiplier': 'New kingdoms (fewer KvKs) receive a penalty. Full credit requires 7+ KvKs to prevent lucky streaks inflating scores.'
};

const AtlasScoreBreakdown: React.FC<AtlasScoreBreakdownProps> = ({ kingdom, rank, totalKingdoms }) => {
  const location = useLocation();
  const breakdownRef = useRef<HTMLDivElement>(null);
  
  // Calculate percentile if rank and total are provided
  const percentile = useMemo(() => {
    if (!rank || !totalKingdoms || totalKingdoms === 0) return null;
    return Math.round(((totalKingdoms - rank) / totalKingdoms) * 100);
  }, [rank, totalKingdoms]);
  const [showChart, setShowChart] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const isMobile = useIsMobile();
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
  }, [location.hash]);
  
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
  }, [showChart, trackFeature, kingdom.kingdom_number, kingdom.overall_score, kingdom.power_tier]);
  
  // Calculate score components based on actual Atlas Score formula
  const scoreComponents = useMemo(() => {
    const totalKvks = kingdom.total_kvks || 0;
    const prepWinRate = kingdom.prep_win_rate || 0;
    const battleWinRate = kingdom.battle_win_rate || 0;
    const dominationRate = totalKvks > 0 ? (kingdom.dominations ?? 0) / totalKvks : 0;
    const defeatRate = totalKvks > 0 ? (kingdom.defeats ?? 0) / totalKvks : 0;
    
    // Component 1: Hybrid Win Rate (60% weight) - Prep 30%, Battle 70%
    const baseWinRate = (prepWinRate * 0.3) + (battleWinRate * 0.7);
    const winRateScore = baseWinRate * 10; // Max 10 points
    
    // Component 2: Performance Pattern (25% weight) - Domination bonus, Invasion penalty
    const performanceModifier = (dominationRate * 0.8) - (defeatRate * 0.6);
    const performanceScore = performanceModifier * 6; // Can be negative
    
    // Component 3: Recent Form (10% weight) - Last 3 KvKs
    const recentKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number).slice(0, 3);
    const weights = [1.0, 0.75, 0.5];
    let recentScore = 0;
    let totalWeight = 0;
    recentKvks.forEach((kvk, i) => {
      const prepWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
      const battleWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
      const weight = weights[i] || 0.3;
      if (prepWin && battleWin) recentScore += 1.0 * weight; // Domination
      else if (battleWin) recentScore += 0.5 * weight; // Win
      else if (!prepWin && !battleWin) recentScore -= 0.25 * weight; // Invasion
      totalWeight += weight;
    });
    const recentForm = totalWeight > 0 ? recentScore / totalWeight : 0;
    const formScore = recentForm * 4; // Max ~4 points
    
    // Component 4: Streak Analysis (15% weight)
    const currentPrepStreak = kingdom.prep_streak ?? 0;
    const currentBattleStreak = kingdom.battle_streak ?? 0;
    const bestPrepStreak = kingdom.prep_best_streak ?? 0;
    const bestBattleStreak = kingdom.battle_best_streak ?? 0;
    const getStreakBonus = (streak: number, isCurrent: boolean) => {
      if (streak === 0) return 0;
      if (isCurrent && streak < 0) {
        const loss = Math.abs(streak);
        if (loss >= 5) return -0.8;
        if (loss >= 3) return -0.5;
        if (loss >= 2) return -0.3;
        return -0.1;
      }
      const win = Math.abs(streak);
      if (win >= 8) return 1.0;
      if (win >= 5) return 0.7;
      if (win >= 3) return 0.4;
      if (win >= 2) return 0.2;
      return 0.1;
    };
    const streakBonus = (getStreakBonus(currentPrepStreak, true) * 0.15) +
                        (getStreakBonus(currentBattleStreak, true) * 0.25) +
                        (getStreakBonus(bestPrepStreak, false) * 0.20) +
                        (getStreakBonus(bestBattleStreak, false) * 0.40);
    const streakScore = streakBonus * 3; // Max ~3 points
    
    // Component 5: Recent Trend (10% weight) - Last 5 KvKs performance
    const last5Kvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number).slice(0, 5);
    const recentPrepWins = last5Kvks.filter(k => k.prep_result === 'Win' || k.prep_result === 'W').length;
    const recentBattleWins = last5Kvks.filter(k => k.battle_result === 'Win' || k.battle_result === 'W').length;
    const avgRecentPrep = last5Kvks.length > 0 ? recentPrepWins / last5Kvks.length : 0;
    const avgRecentBattle = last5Kvks.length > 0 ? recentBattleWins / last5Kvks.length : 0;
    const recentPerformance = (avgRecentPrep * 0.3) + (avgRecentBattle * 0.7);
    const trendScaling = last5Kvks.length >= 5 ? 1.0 : last5Kvks.length >= 3 ? 0.8 : last5Kvks.length >= 1 ? 0.5 : 0;
    const trendScore = recentPerformance * trendScaling * 2; // Max 2 points
    
    // Experience Factor (multiplicative)
    const getExpFactor = (kvks: number) => {
      if (kvks === 0) return 0;
      if (kvks === 1) return 0.4;
      if (kvks === 2) return 0.55;
      if (kvks === 3) return 0.7;
      if (kvks === 4) return 0.8;
      if (kvks === 5) return 0.9;
      if (kvks === 6) return 0.95;
      return 1.0;
    };
    const expFactor = getExpFactor(totalKvks);
    
    // Raw score before experience
    const rawScore = winRateScore + performanceScore + formScore + streakScore + trendScore;
    
    return {
      winRate: { value: winRateScore, weight: 60, maxPoints: 10 },
      performance: { value: performanceScore, weight: 25, maxPoints: 6 },
      recentForm: { value: formScore, weight: 10, maxPoints: 4 },
      streaks: { value: streakScore, weight: 15, maxPoints: 3 },
      trend: { value: trendScore, weight: 10, maxPoints: 2 },
      expFactor,
      rawScore,
      finalScore: Math.max(0, Math.min(20, rawScore * expFactor))
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
    
    // Resilience (inverse of defeat rate)
    const defeatRate = (kingdom.defeats ?? 0) / totalKvks;
    const resilience = Math.round((1 - defeatRate) * 100);
    
    return [
      { label: 'Win Rate', value: winRateComposite },
      { label: 'Domination', value: dominationRate },
      { label: 'Form', value: recentFormPct },
      { label: 'Streaks', value: streakStrength },
      { label: 'Experience', value: experiencePct },
      { label: 'Resilience', value: resilience },
    ];
  }, [kingdom]);

  return (
    <div ref={breakdownRef} id="atlas-breakdown" style={{ marginBottom: isMobile ? '1rem' : '1.25rem' }}>
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.6rem 1rem',
          backgroundColor: showChart ? '#22d3ee15' : '#131318',
          border: `1px solid ${showChart ? '#22d3ee40' : '#2a2a2a'}`,
          borderRadius: '8px',
          color: showChart ? '#22d3ee' : '#9ca3af',
          fontSize: '0.8rem',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{
            transform: showChart ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        {showChart ? 'Hide Score Breakdown' : 'Show Score Breakdown'}
        <span style={{ 
          fontSize: '0.65rem', 
          padding: '0.15rem 0.4rem', 
          backgroundColor: '#22d3ee20', 
          borderRadius: '4px',
          color: '#22d3ee'
        }}>
          📊
        </span>
      </button>
      
      {/* Expandable Chart Section */}
      {showChart && (
        <div 
          style={{
            marginTop: '0.75rem',
            padding: isMobile ? '1rem' : '1.25rem',
            backgroundColor: '#131318',
            borderRadius: '12px',
            border: '1px solid #2a2a2a',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <h4 style={{ 
            color: '#fff', 
            fontSize: isMobile ? '0.85rem' : '0.95rem', 
            fontWeight: '600', 
            marginBottom: '0.75rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            📊 Atlas Score Breakdown
          </h4>
          
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.7rem', 
            textAlign: 'center', 
            marginBottom: '1rem',
            lineHeight: 1.4
          }}>
            Visual representation of performance metrics contributing to the Atlas Score
          </p>
          
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
            {/* Header with Final Score */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '0.5rem',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid #2a2a2a'
            }}>
              <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: '600' }}>
                Score Components
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                {/* Experience Multiplier - moved here */}
                <div 
                  style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    position: 'relative',
                    cursor: 'help'
                  }}
                  onMouseEnter={() => !isMobile && setActiveTooltip('Experience Multiplier')}
                  onMouseLeave={() => !isMobile && setActiveTooltip(null)}
                  onClick={() => isMobile && setActiveTooltip(activeTooltip === 'Experience Multiplier' ? null : 'Experience Multiplier')}
                >
                  {/* Tooltip */}
                  {activeTooltip === 'Experience Multiplier' && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      right: 0,
                      marginBottom: '0.5rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${scoreComponents.expFactor >= 1 ? '#22c55e' : '#eab308'}`,
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      zIndex: 1000,
                      width: 'max-content',
                      maxWidth: '250px',
                      fontSize: '0.65rem',
                      color: '#d1d5db',
                      lineHeight: 1.4,
                      textAlign: 'left'
                    }}>
                      <div style={{ fontWeight: '600', color: scoreComponents.expFactor >= 1 ? '#22c55e' : '#eab308', marginBottom: '0.25rem' }}>
                        Experience Multiplier
                      </div>
                      {SCORE_TOOLTIPS['Experience Multiplier']}
                    </div>
                  )}
                  <div style={{ fontSize: '0.5rem', color: '#6b7280' }}>
                    {kingdom.total_kvks || 0} KvKs • {scoreComponents.expFactor < 1 ? 'Penalty' : 'Full credit'}
                  </div>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: '700',
                    color: scoreComponents.expFactor >= 1 ? '#22c55e' : scoreComponents.expFactor >= 0.7 ? '#eab308' : '#ef4444'
                  }}>
                    ×{scoreComponents.expFactor.toFixed(2)}
                  </span>
                </div>
                {/* Atlas Score */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>Atlas Score </span>
                  <span style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: '700', 
                    color: '#22d3ee',
                    textShadow: '0 0 10px #22d3ee40'
                  }}>
                    {kingdom.overall_score?.toFixed(1) || '0.0'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Score Component Donut Charts */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)',
              gap: isMobile ? '0.75rem' : '1rem',
              justifyItems: 'center',
              marginBottom: '0.5rem'
            }}>
              {[
                { 
                  label: 'Win Rate', 
                  sublabel: `${scoreComponents.winRate.weight}%`,
                  points: scoreComponents.winRate.value, 
                  maxPoints: scoreComponents.winRate.maxPoints,
                  color: '#22d3ee' 
                },
                { 
                  label: 'Performance', 
                  sublabel: `${scoreComponents.performance.weight}%`,
                  points: scoreComponents.performance.value, 
                  maxPoints: scoreComponents.performance.maxPoints,
                  color: '#22c55e'
                },
                { 
                  label: 'Form', 
                  sublabel: `${scoreComponents.recentForm.weight}%`,
                  points: scoreComponents.recentForm.value, 
                  maxPoints: scoreComponents.recentForm.maxPoints,
                  color: '#eab308' 
                },
                { 
                  label: 'Streaks', 
                  sublabel: `${scoreComponents.streaks.weight}%`,
                  points: scoreComponents.streaks.value, 
                  maxPoints: scoreComponents.streaks.maxPoints,
                  color: '#a855f7' 
                },
                { 
                  label: 'Trend', 
                  sublabel: `${scoreComponents.trend.weight}%`,
                  points: scoreComponents.trend.value, 
                  maxPoints: scoreComponents.trend.maxPoints,
                  color: '#f97316' 
                },
              ].map((item, i) => {
                const tooltipText = SCORE_TOOLTIPS[item.label === 'Form' ? 'Recent Form' : item.label];
                const isNegative = item.points < 0;
                return (
                  <div 
                    key={i}
                    style={{ position: 'relative', cursor: 'help' }}
                    onMouseEnter={() => !isMobile && setActiveTooltip(item.label)}
                    onMouseLeave={() => !isMobile && setActiveTooltip(null)}
                    onClick={() => isMobile && setActiveTooltip(activeTooltip === item.label ? null : item.label)}
                  >
                    {activeTooltip === item.label && tooltipText && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: '0.5rem',
                        backgroundColor: '#0a0a0a',
                        border: `1px solid ${item.color}`,
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        zIndex: 1000,
                        width: 'max-content',
                        maxWidth: '200px',
                        fontSize: '0.65rem',
                        color: '#d1d5db',
                        lineHeight: 1.4,
                        textAlign: 'center'
                      }}>
                        <div style={{ fontWeight: '600', color: item.color, marginBottom: '0.25rem' }}>
                          {item.label}
                        </div>
                        {tooltipText}
                      </div>
                    )}
                    <DonutChart
                      value={item.points}
                      maxValue={item.maxPoints}
                      size={isMobile ? 70 : 80}
                      strokeWidth={isMobile ? 6 : 8}
                      color={item.color}
                      label={item.label}
                      sublabel={item.sublabel}
                      isNegative={isNegative}
                    />
                  </div>
                );
              })}
            </div>
            
            
            {/* Percentile */}
            {percentile !== null && (
              <div style={{ 
                marginTop: '0.5rem',
                padding: '0.5rem',
                backgroundColor: percentile >= 75 ? '#22c55e10' : percentile >= 50 ? '#eab30810' : '#1a1a1a',
                borderRadius: '6px',
                textAlign: 'center',
                border: `1px solid ${percentile >= 75 ? '#22c55e30' : percentile >= 50 ? '#eab30830' : '#2a2a2a'}`
              }}>
                <span style={{ 
                  fontSize: '0.65rem', 
                  color: percentile >= 75 ? '#22c55e' : percentile >= 50 ? '#eab308' : '#9ca3af'
                }}>
                  {percentile >= 90 ? '🏆 ' : percentile >= 75 ? '⭐ ' : percentile >= 50 ? '📈 ' : ''}
                  Ranks better than <strong>{percentile}%</strong> of all kingdoms
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
                Loading chart...
              </div>
            }>
              <RadarChart data={radarData} accentColor="#22d3ee" size={isMobile ? 260 : 320} />
            </Suspense>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default memo(AtlasScoreBreakdown);
