import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Kingdom, KingdomWithStats } from '../types';
import { apiService, dataLoadError } from '../services/api';
import { incrementStat } from '../components/UserAchievements';
import { DataLoadError } from '../components/DataLoadError';
import { LeaderboardSkeleton } from '../components/Skeleton';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { usePremium } from '../contexts/PremiumContext';
import { neonGlow, FONT_DISPLAY, statTypeStyles } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { scoreHistoryService, RankMover } from '../services/scoreHistoryService';

const Leaderboards: React.FC = () => {
  useDocumentTitle('Kingdom Rankings');
  useMetaTags(PAGE_META_TAGS.leaderboards);
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState<5 | 10 | 25>(5);
  const [kvkFilter, setKvkFilter] = useState<string>('all');
  const [customKvkMin, setCustomKvkMin] = useState<number>(1);
  const [customKvkMax, setCustomKvkMax] = useState<number>(15);
  const [rankMovers, setRankMovers] = useState<{ climbers: RankMover[]; fallers: RankMover[] } | null>(null);
  const isMobile = useIsMobile();
  const { tier, isPro } = usePremium();
  const { trackFeature } = useAnalytics();
  
  // Tier-based leaderboard limits: anonymous=10, free=25, pro=unlimited
  const leaderboardLimit = isPro ? 999 : (tier === 'free' ? 25 : 10);

  const hasTrackedView = useRef(false);
  
  useEffect(() => {
    loadLeaderboard();
    // Track leaderboard view for achievements (only once per session)
    if (!hasTrackedView.current) {
      incrementStat('leaderboardViews');
      hasTrackedView.current = true;
    }
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const [data, movers] = await Promise.all([
        apiService.getKingdoms(),
        scoreHistoryService.getRankMovers()
      ]);
      setKingdoms(data);
      setRankMovers(movers);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Resolve effective KvK min/max from filter mode
  const kvkRange = useMemo(() => {
    if (kvkFilter === 'all') return { min: 0, max: Infinity };
    if (kvkFilter === 'custom') return { min: customKvkMin, max: customKvkMax };
    const [minStr, maxStr] = kvkFilter.split('-');
    return { min: Number(minStr) || 0, max: Number(maxStr) || Infinity };
  }, [kvkFilter, customKvkMin, customKvkMax]);

  // Filter kingdoms by KvK count
  const filteredKingdoms = useMemo(() => {
    if (kvkFilter === 'all') return kingdoms;
    return kingdoms.filter(k => {
      const kvkCount = k.total_kvks || (k.recent_kvks?.length || 0);
      return kvkCount >= kvkRange.min && kvkCount <= kvkRange.max;
    });
  }, [kingdoms, kvkFilter, kvkRange]);

  // Build set of filtered kingdom numbers for rank movers filtering
  const filteredKingdomNumbers = useMemo(() => {
    if (kvkFilter === 'all') return null; // null = no filter
    return new Set(filteredKingdoms.map(k => k.kingdom_number));
  }, [filteredKingdoms, kvkFilter]);

  // Filtered rank movers — respect both kvkFilter and displayCount
  const filteredRankMovers = useMemo(() => {
    if (!rankMovers) return null;
    const filterMovers = (movers: RankMover[]) => {
      const filtered = filteredKingdomNumbers
        ? movers.filter(m => filteredKingdomNumbers.has(m.kingdom_number))
        : movers;
      return filtered.slice(0, displayCount);
    };
    return {
      climbers: filterMovers(rankMovers.climbers),
      fallers: filterMovers(rankMovers.fallers),
    };
  }, [rankMovers, filteredKingdomNumbers, displayCount]);

  // Calculate stats for each kingdom
  const getKingdomStats = (kingdom: Kingdom) => {
    const recentKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number);
    let prepStreak = 0;
    let battleStreak = 0;
    
    // Prep streak (current)
    for (const kvk of recentKvks) {
      const isWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
      if (prepStreak === 0 && !isWin) break;
      if (isWin) prepStreak++;
      else break;
    }
    
    // Battle streak (current)
    for (const kvk of recentKvks) {
      const isWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
      if (battleStreak === 0 && !isWin) break;
      if (isWin) battleStreak++;
      else break;
    }
    
    // Domination streak (current consecutive dominations = both prep & battle wins)
    let dominationStreak = 0;
    for (const kvk of recentKvks) {
      const prepWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
      const battleWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
      if (prepWin && battleWin) dominationStreak++;
      else break;
    }

    // Best domination streak (all-time longest consecutive dominations)
    let bestDominationStreak = 0;
    let currentDomStreak = 0;
    // Sort oldest-first for correct streak calculation
    const chronological = [...(kingdom.recent_kvks || [])].sort((a, b) => a.kvk_number - b.kvk_number);
    for (const kvk of chronological) {
      const prepWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
      const battleWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
      if (prepWin && battleWin) {
        currentDomStreak++;
        if (currentDomStreak > bestDominationStreak) bestDominationStreak = currentDomStreak;
      } else {
        currentDomStreak = 0;
      }
    }

    // Use full history data from kingdom object (not just recent_kvks)
    const dominations = kingdom.dominations ?? 0;
    const invasions = kingdom.invasions ?? kingdom.defeats ?? 0;
    
    // Reversals = prep wins that weren't dominations (won prep but lost battle)
    const reversals = kingdom.prep_wins - dominations;
    
    // Comebacks = battle wins that weren't dominations (lost prep but won battle)
    const comebacks = kingdom.battle_wins - dominations;
    
    return { prepStreak, battleStreak, dominationStreak, bestDominationStreak, dominations, invasions, reversals, comebacks };
  };

  // Rankings with stats (using filtered kingdoms)
  const kingdomsWithStats = useMemo(() => 
    filteredKingdoms.map(k => ({ ...k, ...getKingdomStats(k) })),
    [filteredKingdoms]
  );

  const atlasScoreRanking = useMemo(() => 
    [...kingdomsWithStats].sort((a, b) => b.overall_score - a.overall_score).slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const dominationsRanking = useMemo(() => 
    [...kingdomsWithStats].sort((a, b) => b.dominations - a.dominations).slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const reversalsRanking = useMemo(() => 
    [...kingdomsWithStats].sort((a, b) => b.reversals - a.reversals).slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const comebacksRanking = useMemo(() => 
    [...kingdomsWithStats].sort((a, b) => b.comebacks - a.comebacks).slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const invasionsRanking = useMemo(() => 
    [...kingdomsWithStats].sort((a, b) => b.invasions - a.invasions).slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const prepStreakRanking = useMemo(() => 
    [...kingdomsWithStats].sort((a, b) => b.prepStreak - a.prepStreak).slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const battleStreakRanking = useMemo(() => 
    [...kingdomsWithStats].sort((a, b) => b.battleStreak - a.battleStreak).slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const dominationStreakRanking = useMemo(() => 
    [...kingdomsWithStats]
      .filter(k => k.dominationStreak > 0)
      .sort((a, b) => b.dominationStreak - a.dominationStreak)
      .slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const bestDominationStreakRanking = useMemo(() => 
    [...kingdomsWithStats]
      .filter(k => k.bestDominationStreak > 0)
      .sort((a, b) => b.bestDominationStreak - a.bestDominationStreak)
      .slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  // Highest-ever Win Streak Records (all-time best streaks)
  const prepBestStreakRanking = useMemo(() => 
    [...kingdomsWithStats]
      .filter(k => (k.prep_best_streak ?? 0) > 0)
      .sort((a, b) => (b.prep_best_streak ?? 0) - (a.prep_best_streak ?? 0))
      .slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const battleBestStreakRanking = useMemo(() => 
    [...kingdomsWithStats]
      .filter(k => (k.battle_best_streak ?? 0) > 0)
      .sort((a, b) => (b.battle_best_streak ?? 0) - (a.battle_best_streak ?? 0))
      .slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  // Highest-ever win rates (for kingdoms with 3+ KvKs to be meaningful)
  const prepWinRateRanking = useMemo(() => 
    [...kingdomsWithStats]
      .filter(k => k.total_kvks >= 3)
      .sort((a, b) => b.prep_win_rate - a.prep_win_rate)
      .slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const battleWinRateRanking = useMemo(() => 
    [...kingdomsWithStats]
      .filter(k => k.total_kvks >= 3)
      .sort((a, b) => b.battle_win_rate - a.battle_win_rate)
      .slice(0, displayCount),
    [kingdomsWithStats, displayCount]
  );

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { ...neonGlow('#fbbf24'), fontWeight: 'bold' as const };
    if (rank === 2) return { ...neonGlow('#9ca3af'), fontWeight: 'bold' as const };
    if (rank === 3) return { ...neonGlow('#f97316'), fontWeight: 'bold' as const };
    return { color: '#6b7280' };
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const [hoveredRanking, setHoveredRanking] = useState<string | null>(null);

  const rankingTooltips: Record<string, string> = {
    'Atlas Score': 'Bayesian-adjusted rating combining win rates, dominations, recent form, and streaks. Rewards consistency over luck.',
    'Prep Win Rate': 'Highest Preparation Phase win percentage (3+ KvKs)',
    'Battle Win Rate': 'Highest Battle Phase win percentage (3+ KvKs)',
    'Prep Win Streak': 'Current consecutive Prep Phase wins',
    'Battle Win Streak': 'Current consecutive Battle Phase wins',
    'Domination Streak': 'Current consecutive Dominations (won both Prep and Battle)',
    'Prep Streak Record': 'All-time best Prep Phase win streak',
    'Battle Streak Record': 'All-time best Battle Phase win streak',
    'Domination Streak Record': 'All-time best consecutive Domination streak',
    'Dominations': 'Won both Prep and Battle phases',
    'Comebacks': 'Lost Prep but won Battle',
    'Reversals': 'Won Prep but lost Battle',
    'Invasions': 'Lost both Prep and Battle phases'
  };

  const LeaderboardCard = ({ 
    title, 
    icon, 
    color, 
    data, 
    getValue 
  }: { 
    title: string; 
    icon: string; 
    color: string; 
    data: KingdomWithStats[]; 
    getValue: (k: KingdomWithStats) => string;
  }) => (
    <div style={{ 
      backgroundColor: '#131318', 
      borderRadius: '12px', 
      border: '1px solid #2a2a2a',
      overflow: 'visible'
    }}>
      <div 
        style={{ 
          padding: isMobile ? '0.75rem 1rem' : '0.85rem 1rem', 
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          position: 'relative',
          cursor: 'default'
        }}
        onMouseEnter={() => setHoveredRanking(title)}
        onMouseLeave={() => setHoveredRanking(null)}
      >
        <span style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}>{icon}</span>
        <h3 style={{ 
          color: '#fff', 
          fontSize: isMobile ? '0.85rem' : '0.9rem', 
          fontWeight: '600',
          margin: 0,
          textAlign: 'center'
        }}>{title}</h3>
        <span style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}>{icon}</span>
        {hoveredRanking === title && rankingTooltips[title] && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '4px',
            padding: '0.4rem 0.6rem',
            backgroundColor: '#0a0a0a',
            border: `1px solid ${color}`,
            borderRadius: '6px',
            fontSize: '0.7rem',
            color: '#fff',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}>
            {rankingTooltips[title]}
          </div>
        )}
      </div>
      <div style={{ padding: isMobile ? '0.4rem' : '0.5rem', position: 'relative' }}>
        {data.map((kingdom, index) => {
          const isGated = index >= leaderboardLimit;
          return (
            <Link 
              key={kingdom.kingdom_number}
              to={isGated ? '#' : `/kingdom/${kingdom.kingdom_number}`}
              onClick={(e) => isGated && e.preventDefault()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile ? '0.4rem 0.6rem' : '0.5rem 0.75rem',
                borderRadius: '6px',
                textDecoration: 'none',
                transition: 'background-color 0.2s',
                backgroundColor: index < 3 ? `${color}08` : 'transparent',
                filter: isGated ? 'blur(4px)' : 'none',
                opacity: isGated ? 0.5 : 1,
                pointerEvents: isGated ? 'none' : 'auto'
              }}
              onMouseEnter={(e) => !isGated && (e.currentTarget.style.backgroundColor = '#1a1a1a')}
              onMouseLeave={(e) => !isGated && (e.currentTarget.style.backgroundColor = index < 3 ? `${color}08` : 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.5rem' }}>
                <span style={{ 
                  ...getRankStyle(index + 1), 
                  minWidth: isMobile ? '22px' : '26px',
                  fontSize: isMobile ? '0.75rem' : '0.8rem'
                }}>
                  {getRankBadge(index + 1)}
                </span>
                <span style={{ 
                  color: '#fff', 
                  fontWeight: '500',
                  fontSize: isMobile ? '0.75rem' : '0.8rem'
                }}>
                  Kingdom {kingdom.kingdom_number}
                </span>
              </div>
              <span style={{ 
                ...neonGlow(color), 
                fontWeight: 'bold',
                fontSize: isMobile ? '0.8rem' : '0.85rem'
              }}>
                {getValue(kingdom)}
              </span>
            </Link>
          );
        })}
        {/* Upgrade prompt overlay when content is gated */}
        {data.length > leaderboardLimit && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '80px',
            background: 'linear-gradient(transparent, #131318 70%)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '0.5rem'
          }}>
            <Link
              to={tier === 'anonymous' ? '/profile' : '/upgrade'}
              style={{
                padding: isMobile ? '0.5rem 1rem' : '0.4rem 0.75rem',
                minHeight: isMobile ? '44px' : 'auto',
                backgroundColor: '#22d3ee15',
                border: '1px solid #22d3ee40',
                borderRadius: '6px',
                color: '#22d3ee',
                fontSize: isMobile ? '0.75rem' : '0.7rem',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              {tier === 'anonymous' ? 'Sign in to see more' : 'Upgrade for full rankings'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  // Layout: Organized by category for meaningful groupings
  // Row 1: Atlas Score (Overall), Win Rates (Performance %)
  // Row 2: Win Streaks (Current momentum)
  // Row 3: Match Outcomes (Historical results)
  // Row 4: Invasions (Defeats)
  
  // Performance Rankings (Overall & Win Rates) — uses statTypeStyles for colors/emojis
  const performanceRankings = [
    { title: 'Atlas Score', icon: statTypeStyles.atlasScore.emoji, color: statTypeStyles.atlasScore.color, data: atlasScoreRanking, getValue: (k: KingdomWithStats) => k.overall_score.toFixed(2) },
    { title: 'Prep Win Rate', icon: statTypeStyles.prepPhase.emoji, color: statTypeStyles.prepPhase.color, data: prepWinRateRanking, getValue: (k: KingdomWithStats) => `${(k.prep_win_rate * 100).toFixed(0)}%` },
    { title: 'Battle Win Rate', icon: statTypeStyles.battlePhase.emoji, color: statTypeStyles.battlePhase.color, data: battleWinRateRanking, getValue: (k: KingdomWithStats) => `${(k.battle_win_rate * 100).toFixed(0)}%` },
  ];
  
  // Current Momentum Rankings (Current Streaks)
  const momentumRankings = [
    { title: 'Prep Win Streak', icon: statTypeStyles.prepPhase.emoji, color: statTypeStyles.prepPhase.color, data: prepStreakRanking, getValue: (k: KingdomWithStats) => `${k.prepStreak}W` },
    { title: 'Battle Win Streak', icon: statTypeStyles.battlePhase.emoji, color: statTypeStyles.battlePhase.color, data: battleStreakRanking, getValue: (k: KingdomWithStats) => `${k.battleStreak}W` },
    { title: 'Domination Streak', icon: statTypeStyles.domination.emoji, color: statTypeStyles.domination.color, data: dominationStreakRanking, getValue: (k: KingdomWithStats) => `${k.dominationStreak}W` },
  ];
  
  // Record Rankings (All-Time Best Streaks)
  const recordRankings = [
    { title: 'Prep Streak Record', icon: statTypeStyles.prepPhase.emoji, color: statTypeStyles.prepPhase.color, data: prepBestStreakRanking, getValue: (k: KingdomWithStats) => `${k.prep_best_streak ?? 0}W` },
    { title: 'Battle Streak Record', icon: statTypeStyles.battlePhase.emoji, color: statTypeStyles.battlePhase.color, data: battleBestStreakRanking, getValue: (k: KingdomWithStats) => `${k.battle_best_streak ?? 0}W` },
    { title: 'Domination Streak Record', icon: statTypeStyles.domination.emoji, color: statTypeStyles.domination.color, data: bestDominationStreakRanking, getValue: (k: KingdomWithStats) => `${k.bestDominationStreak}W` },
  ];
  
  // Match Outcome Rankings (Historical)
  const outcomeRankings = [
    { title: 'Dominations', icon: statTypeStyles.domination.emoji, color: statTypeStyles.domination.color, data: dominationsRanking, getValue: (k: KingdomWithStats) => `${k.dominations}` },
    { title: 'Comebacks', icon: statTypeStyles.comeback.emoji, color: statTypeStyles.comeback.color, data: comebacksRanking, getValue: (k: KingdomWithStats) => `${k.comebacks}` },
    { title: 'Reversals', icon: statTypeStyles.reversal.emoji, color: statTypeStyles.reversal.color, data: reversalsRanking, getValue: (k: KingdomWithStats) => `${k.reversals}` },
  ];
  
  const invasionRanking = { title: 'Invasions', icon: statTypeStyles.invasion.emoji, color: statTypeStyles.invasion.color, data: invasionsRanking, getValue: (k: KingdomWithStats) => `${k.invasions}` };

  const kvkPresets = [
    { value: 'all', label: 'All' },
    { value: '1-3', label: 'Rookies', sublabel: '1-3' },
    { value: '4-6', label: 'Veterans', sublabel: '4-6' },
    { value: '7-9', label: 'Elite', sublabel: '7-9' },
    { value: '10-99', label: 'Legends', sublabel: '10+' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section - matching About/Compare pages */}
      <div style={{ 
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: isMobile ? '1.5rem' : '2rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY
          }}>
            <span style={{ color: '#fff' }}>KINGDOM</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>RANKINGS</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            Who&apos;s dominating? The data doesn&apos;t lie.
          </p>
          {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
            <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
          </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem 2rem' }}>
        {loading ? (
          <LeaderboardSkeleton rows={10} />
        ) : dataLoadError ? (
          <DataLoadError onRetry={loadLeaderboard} />
        ) : kingdoms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: '#6b7280' }}>
            <p>No kingdom data available.</p>
          </div>
        ) : (
          <>
            {/* Global Controls — Top of page, affects all ranking cards */}
            <div style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'center', 
              alignItems: 'center',
              gap: isMobile ? '0.75rem' : '1.5rem',
              marginBottom: '1.5rem' 
            }}>
              {/* Top N toggle */}
              <div style={{ 
                display: 'flex', 
                backgroundColor: '#0a0a0a', 
                borderRadius: '8px', 
                border: '1px solid #2a2a2a',
                overflow: 'hidden'
              }}>
                {([5, 10, 25] as const).map((count) => (
                  <button
                    key={count}
                    onClick={() => { trackFeature('Rankings Display Count', { count }); setDisplayCount(count); }}
                    style={{
                      padding: isMobile ? '0.6rem 1rem' : '0.5rem 1.25rem',
                      minHeight: isMobile ? '44px' : 'auto',
                      backgroundColor: displayCount === count ? '#22d3ee' : 'transparent',
                      border: 'none',
                      color: displayCount === count ? '#000' : '#6b7280',
                      cursor: 'pointer',
                      fontWeight: displayCount === count ? '600' : '400',
                      fontSize: isMobile ? '0.8rem' : '0.85rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Top {count}
                  </button>
                ))}
              </div>

              {/* KvK Experience filter — preset chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: isMobile ? '0.72rem' : '0.8rem', marginRight: '0.15rem' }}>Experience:</span>
                <div style={{ 
                  display: 'flex', 
                  backgroundColor: '#0a0a0a', 
                  borderRadius: '8px', 
                  border: '1px solid #2a2a2a',
                  overflow: 'hidden'
                }}>
                  {kvkPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setKvkFilter(preset.value)}
                      style={{
                        padding: isMobile ? '0.5rem 0.55rem' : '0.45rem 0.8rem',
                        minHeight: isMobile ? '44px' : 'auto',
                        backgroundColor: kvkFilter === preset.value ? '#a855f7' : 'transparent',
                        border: 'none',
                        color: kvkFilter === preset.value ? '#fff' : '#6b7280',
                        cursor: 'pointer',
                        fontWeight: kvkFilter === preset.value ? '600' : '400',
                        fontSize: isMobile ? '0.7rem' : '0.78rem',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: '1.2'
                      }}
                    >
                      <span>{preset.label}</span>
                      {preset.sublabel && (
                        <span style={{ 
                          fontSize: isMobile ? '0.58rem' : '0.62rem', 
                          opacity: kvkFilter === preset.value ? 0.9 : 0.6 
                        }}>
                          {preset.sublabel} KvKs
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom KvK Range — only visible when "Custom" is selected */}
            {kvkFilter === 'custom' && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: isMobile ? '0.5rem' : '0.75rem',
                marginBottom: '1.25rem',
                marginTop: '-0.75rem',
                flexWrap: 'wrap'
              }}>
                <span style={{ color: '#9ca3af', fontSize: isMobile ? '0.72rem' : '0.78rem' }}>KvKs from</span>
                {/* Min stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                  <button
                    onClick={() => setCustomKvkMin(Math.max(1, customKvkMin - 1))}
                    style={{
                      width: isMobile ? '36px' : '30px',
                      height: isMobile ? '36px' : '30px',
                      backgroundColor: '#131318',
                      border: '1px solid #2a2a2a',
                      borderRadius: '6px 0 0 6px',
                      color: '#fff',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >−</button>
                  <div style={{
                    width: isMobile ? '36px' : '32px',
                    height: isMobile ? '36px' : '30px',
                    backgroundColor: '#1a1a1a',
                    borderTop: '1px solid #2a2a2a',
                    borderBottom: '1px solid #2a2a2a',
                    color: '#a855f7',
                    fontWeight: '700',
                    fontSize: isMobile ? '0.85rem' : '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>{customKvkMin}</div>
                  <button
                    onClick={() => setCustomKvkMin(Math.min(customKvkMax, customKvkMin + 1))}
                    style={{
                      width: isMobile ? '36px' : '30px',
                      height: isMobile ? '36px' : '30px',
                      backgroundColor: '#131318',
                      border: '1px solid #2a2a2a',
                      borderRadius: '0 6px 6px 0',
                      color: '#fff',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >+</button>
                </div>
                <span style={{ color: '#6b7280', fontSize: isMobile ? '0.75rem' : '0.8rem' }}>to</span>
                {/* Max stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                  <button
                    onClick={() => setCustomKvkMax(Math.max(customKvkMin, customKvkMax - 1))}
                    style={{
                      width: isMobile ? '36px' : '30px',
                      height: isMobile ? '36px' : '30px',
                      backgroundColor: '#131318',
                      border: '1px solid #2a2a2a',
                      borderRadius: '6px 0 0 6px',
                      color: '#fff',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >−</button>
                  <div style={{
                    width: isMobile ? '36px' : '32px',
                    height: isMobile ? '36px' : '30px',
                    backgroundColor: '#1a1a1a',
                    borderTop: '1px solid #2a2a2a',
                    borderBottom: '1px solid #2a2a2a',
                    color: '#a855f7',
                    fontWeight: '700',
                    fontSize: isMobile ? '0.85rem' : '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>{customKvkMax}</div>
                  <button
                    onClick={() => setCustomKvkMax(customKvkMax + 1)}
                    style={{
                      width: isMobile ? '36px' : '30px',
                      height: isMobile ? '36px' : '30px',
                      backgroundColor: '#131318',
                      border: '1px solid #2a2a2a',
                      borderRadius: '0 6px 6px 0',
                      color: '#fff',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >+</button>
                </div>
                {customKvkMin === customKvkMax && (
                  <span style={{ 
                    color: '#a855f7', 
                    fontSize: isMobile ? '0.68rem' : '0.72rem',
                    fontWeight: '500'
                  }}>
                    Exactly {customKvkMin} KvK{customKvkMin !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Biggest Climbers & Fallers — Table Layout */}
            {filteredRankMovers && (filteredRankMovers.climbers.length > 0 || filteredRankMovers.fallers.length > 0) && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ 
                  color: '#fff', 
                  fontSize: isMobile ? '0.9rem' : '1rem', 
                  marginBottom: '0.75rem',
                  paddingLeft: '0.5rem',
                  borderLeft: '3px solid #a855f7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  Rank Movers
                  {filteredRankMovers.climbers[0] && (
                    <span style={{ color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '400' }}>
                      KvK #{filteredRankMovers.climbers[0].prev_kvk} → #{filteredRankMovers.climbers[0].curr_kvk}
                    </span>
                  )}
                </h2>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
                  gap: '1rem'
                }}>
                  {/* Rank Mover Table Component */}
                  {([
                    { title: 'Biggest Climbers', emoji: '🚀', data: filteredRankMovers.climbers, accentColor: '#22c55e', isClimber: true },
                    { title: 'Biggest Fallers', emoji: '📉', data: filteredRankMovers.fallers, accentColor: '#ef4444', isClimber: false },
                  ] as const).map(({ title: tbl, emoji, data, accentColor, isClimber }) => (
                    <div key={tbl} style={{ 
                      backgroundColor: '#131318', 
                      borderRadius: '12px', 
                      border: '1px solid #2a2a2a',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        padding: isMobile ? '0.75rem 1rem' : '0.85rem 1rem', 
                        borderBottom: '1px solid #2a2a2a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}>
                        <span style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}>{emoji}</span>
                        <h3 style={{ color: '#fff', fontSize: isMobile ? '0.85rem' : '0.9rem', fontWeight: '600', margin: 0 }}>{tbl}</h3>
                        <span style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}>{emoji}</span>
                      </div>
                      {/* Table */}
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ 
                          width: '100%', 
                          borderCollapse: 'collapse',
                          fontSize: isMobile ? '0.72rem' : '0.8rem'
                        }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                              {[
                                { label: '#', width: isMobile ? '32px' : '42px' },
                                { label: 'Kingdom', width: 'auto', align: 'left' as const },
                                { label: 'Old Rank', width: isMobile ? '52px' : '70px' },
                                { label: '', width: isMobile ? '22px' : '28px' },
                                { label: 'New Rank', width: isMobile ? '56px' : '70px' },
                                { label: 'Change', width: isMobile ? '52px' : '65px' },
                              ].map((col, ci) => (
                                <th key={ci} style={{ 
                                  padding: isMobile ? '0.5rem 0.25rem' : '0.6rem 0.5rem',
                                  color: '#9ca3af',
                                  fontWeight: '600',
                                  fontSize: isMobile ? '0.65rem' : '0.7rem',
                                  textTransform: 'uppercase' as const,
                                  letterSpacing: '0.03em',
                                  textAlign: col.align || 'center',
                                  width: col.width,
                                  whiteSpace: 'nowrap' as const,
                                }}>
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.map((mover, index) => (
                              <tr
                                key={mover.kingdom_number}
                                onClick={() => window.location.href = `/kingdom/${mover.kingdom_number}`}
                                style={{
                                  cursor: 'pointer',
                                  borderBottom: index < data.length - 1 ? '1px solid #1f1f1f' : 'none',
                                  backgroundColor: index < 3 ? `${accentColor}06` : 'transparent',
                                  transition: 'background-color 0.15s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index < 3 ? `${accentColor}06` : 'transparent'}
                              >
                                {/* Ranking */}
                                <td style={{ 
                                  padding: isMobile ? '0.5rem 0.25rem' : '0.55rem 0.5rem',
                                  textAlign: 'center',
                                  whiteSpace: 'nowrap',
                                }}>
                                  <span style={{ 
                                    ...getRankStyle(index + 1), 
                                    fontSize: isMobile ? '0.72rem' : '0.8rem'
                                  }}>
                                    {getRankBadge(index + 1)}
                                  </span>
                                </td>
                                {/* Kingdom Name — left-aligned, full name */}
                                <td style={{ 
                                  padding: isMobile ? '0.5rem 0.25rem' : '0.55rem 0.5rem',
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap',
                                }}>
                                  <Link 
                                    to={`/kingdom/${mover.kingdom_number}`}
                                    style={{ color: '#fff', fontWeight: '500', textDecoration: 'none', fontSize: isMobile ? '0.72rem' : '0.8rem' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Kingdom {mover.kingdom_number}
                                  </Link>
                                </td>
                                {/* Old Rank */}
                                <td style={{ 
                                  padding: isMobile ? '0.5rem 0.25rem' : '0.55rem 0.5rem',
                                  textAlign: 'center',
                                  color: '#9ca3af',
                                  whiteSpace: 'nowrap',
                                }}>
                                  #{mover.prev_rank}
                                </td>
                                {/* Arrow */}
                                <td style={{ 
                                  padding: isMobile ? '0.5rem 0' : '0.55rem 0',
                                  textAlign: 'center',
                                  color: '#6b7280',
                                  fontSize: isMobile ? '0.65rem' : '0.75rem',
                                }}>
                                  →
                                </td>
                                {/* New Rank */}
                                <td style={{ 
                                  padding: isMobile ? '0.5rem 0.25rem' : '0.55rem 0.5rem',
                                  textAlign: 'center',
                                  color: '#fff',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap',
                                }}>
                                  #{mover.curr_rank}
                                </td>
                                {/* Change */}
                                <td style={{ 
                                  padding: isMobile ? '0.5rem 0.25rem' : '0.55rem 0.5rem',
                                  textAlign: 'center',
                                  whiteSpace: 'nowrap',
                                }}>
                                  <span style={{ 
                                    ...neonGlow(accentColor), 
                                    fontWeight: 'bold',
                                    fontSize: isMobile ? '0.75rem' : '0.82rem'
                                  }}>
                                    {isClimber ? '▲' : '▼'}{Math.abs(mover.rank_delta)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Rankings: Atlas Score + Win Rates */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ 
                color: '#fff', 
                fontSize: isMobile ? '0.9rem' : '1rem', 
                marginBottom: '0.75rem',
                paddingLeft: '0.5rem',
                borderLeft: '3px solid #22d3ee'
              }}>
                📊 Performance Rankings
              </h2>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
                gap: '1rem'
              }}>
                {performanceRankings.map((ranking, idx) => (
                  <LeaderboardCard
                    key={idx}
                    title={ranking.title}
                    icon={ranking.icon}
                    color={ranking.color}
                    data={ranking.data}
                    getValue={ranking.getValue}
                  />
                ))}
              </div>
            </div>

            {/* Current Momentum + All-Time Records */}
            <div style={{ 
              display: 'grid', 
              gap: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              {/* Current Momentum: Win Streaks */}
              <div>
                <h2 style={{ 
                  color: '#fff', 
                  fontSize: isMobile ? '0.9rem' : '1rem', 
                  marginBottom: '0.75rem',
                  paddingLeft: '0.5rem',
                  borderLeft: '3px solid #eab308'
                }}>
                  🔥 Current Momentum
                </h2>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : `repeat(${momentumRankings.length}, 1fr)`,
                  gap: '1rem'
                }}>
                  {momentumRankings.map((ranking, idx) => (
                    <LeaderboardCard
                      key={idx}
                      title={ranking.title}
                      icon={ranking.icon}
                      color={ranking.color}
                      data={ranking.data}
                      getValue={ranking.getValue}
                    />
                  ))}
                </div>
              </div>

              {/* All-Time Records: Best Streaks Ever */}
              <div>
                <h2 style={{ 
                  color: '#fff', 
                  fontSize: isMobile ? '0.9rem' : '1rem', 
                  marginBottom: '0.75rem',
                  paddingLeft: '0.5rem',
                  borderLeft: '3px solid #fbbf24'
                }}>
                  🏅 All-Time Records
                </h2>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : `repeat(${recordRankings.length}, 1fr)`,
                  gap: '1rem'
                }}>
                  {recordRankings.map((ranking, idx) => (
                    <LeaderboardCard
                      key={idx}
                      title={ranking.title}
                      icon={ranking.icon}
                      color={ranking.color}
                      data={ranking.data}
                      getValue={ranking.getValue}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Match Outcomes + Hall of Infamy */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ 
                color: '#fff', 
                fontSize: isMobile ? '0.9rem' : '1rem', 
                marginBottom: '0.75rem',
                paddingLeft: '0.5rem',
                borderLeft: '3px solid #22c55e'
              }}>
                📈 Match Outcomes
              </h2>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', 
                gap: '1rem'
              }}>
                {outcomeRankings.map((ranking, idx) => (
                  <LeaderboardCard
                    key={idx}
                    title={ranking.title}
                    icon={ranking.icon}
                    color={ranking.color}
                    data={ranking.data}
                    getValue={ranking.getValue}
                  />
                ))}
                <LeaderboardCard
                  title={invasionRanking.title}
                  icon={invasionRanking.icon}
                  color={invasionRanking.color}
                  data={invasionRanking.data}
                  getValue={invasionRanking.getValue}
                />
              </div>
            </div>
          </>
        )}

        {/* Back to Home link */}
        <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default Leaderboards;
