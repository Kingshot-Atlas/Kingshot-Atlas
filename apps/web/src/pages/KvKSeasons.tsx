import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { scoreHistoryService, MatchupWithScores } from '../services/scoreHistoryService';
import { neonGlow, colors } from '../utils/styles';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS, getSeasonBreadcrumbs } from '../hooks/useStructuredData';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { CURRENT_KVK } from '../constants';
import KvKMatchupSubmission from '../components/KvKMatchupSubmission';

interface SeasonStats {
  totalMatchups: number;
  avgCombinedScore: number;
  dominations: number;
  invasions: number;
  comebacks: number;
  reversals: number;
}

const KvKSeasons: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [showMatchupModal, setShowMatchupModal] = useState(false);
  const { seasonNumber } = useParams<{ seasonNumber?: string }>();
  const seasonNum = seasonNumber ? parseInt(seasonNumber) : null;
  useMetaTags(seasonNum ? {
    title: `KvK Season ${seasonNum} Results & Matchups - Kingshot Atlas`,
    description: `KvK Season ${seasonNum} results: all matchups, winners, scores, and kingdom performance. Track how every kingdom performed in Season ${seasonNum}.`,
    url: `https://ks-atlas.com/seasons/${seasonNum}`,
    type: 'article',
  } : PAGE_META_TAGS.kvkSeasons);
  useStructuredData({ type: 'BreadcrumbList', data: seasonNum ? getSeasonBreadcrumbs(seasonNum) : PAGE_BREADCRUMBS.seasons });
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [matchups, setMatchups] = useState<MatchupWithScores[]>([]);
  const [allTimeMatchups, setAllTimeMatchups] = useState<MatchupWithScores[]>([]);
  const [, setSeasonStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'season' | 'all-time'>('season');
  const [displayLimit, setDisplayLimit] = useState(12);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(selectedSeason ? `Season ${selectedSeason} Matchups` : 'KvK Seasons');

  // Infinite scroll observer
  const loadMore = useCallback(() => {
    const source = view === 'all-time' ? allTimeMatchups : matchups;
    if (displayLimit < source.length && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayLimit(prev => prev + 12);
        setIsLoadingMore(false);
      }, 300);
    }
  }, [view, allTimeMatchups, matchups, displayLimit, isLoadingMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loaderRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => observer.disconnect();
  }, [loadMore]);

  // Load available seasons on mount - show KvKs 1 through CURRENT_KVK in ascending order
  useEffect(() => {
    const allSeasons = Array.from({ length: CURRENT_KVK }, (_, i) => i + 1);
    setSeasons(allSeasons);
    
    // Set initial season from URL or default to latest
    if (seasonNumber) {
      setSelectedSeason(parseInt(seasonNumber));
    } else {
      setSelectedSeason(CURRENT_KVK); // Default to latest season
    }
  }, [seasonNumber]);

  // Load matchups when season changes
  useEffect(() => {
    const loadMatchups = async () => {
      if (!selectedSeason) return;
      
      setLoading(true);
      const [seasonMatchups, stats] = await Promise.all([
        scoreHistoryService.getSeasonMatchups(selectedSeason),
        scoreHistoryService.getSeasonStats(selectedSeason)
      ]);
      setMatchups(seasonMatchups);
      setSeasonStats(stats);
      setLoading(false);
    };
    
    if (view === 'season' && selectedSeason) {
      loadMatchups();
    }
  }, [selectedSeason, view]);

  // Load all-time matchups
  useEffect(() => {
    const loadAllTime = async () => {
      if (view !== 'all-time') return;
      
      setLoading(true);
      const allTime = await scoreHistoryService.getAllTimeTopMatchups(100);
      setAllTimeMatchups(allTime);
      setLoading(false);
    };
    loadAllTime();
  }, [view]);

  const handleSeasonChange = (season: number) => {
    setSelectedSeason(season);
    setView('season');
    navigate(`/seasons/${season}`);
  };

  const displayedMatchups = useMemo(() => {
    const source = view === 'all-time' ? allTimeMatchups : matchups;
    return source.slice(0, displayLimit);
  }, [view, matchups, allTimeMatchups, displayLimit]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hover styles for cards and rows */}
      <style>{`
        .kvk-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .kvk-card:nth-child(1):hover {
          box-shadow: 0 0 20px #fbbf2450, 0 4px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .kvk-card:nth-child(2):hover {
          box-shadow: 0 0 16px #9ca3af40, 0 4px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .kvk-card:nth-child(3):hover {
          box-shadow: 0 0 16px ${colors.bronze}40, 0 4px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .kingdom-row:hover {
          background-color: #1a1a1f !important;
        }
        .kingdom-row:active {
          background-color: #222228 !important;
        }
        @media (max-width: 768px) {
          .kvk-card:hover {
            transform: none;
          }
          .kingdom-row:active {
            background-color: #1a1a1f !important;
          }
        }
      `}</style>
      {/* Hero Section - matching site style */}
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
            fontFamily: "'Cinzel', 'Times New Roman', serif"
          }}>
            <span style={{ color: '#fff' }}>KvK</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>SEASONS</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {t('seasons.subtitle', 'Relive the battles. Every matchup ranked by combined Atlas Score—see which kingdoms brought the heat.')}
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

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>

      {/* View Toggle - Centered */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        gap: '0.75rem', 
        marginBottom: '1.25rem'
      }}>
        <button
          onClick={() => setView('season')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: isMobile ? '0.75rem 1.25rem' : '0.6rem 1.25rem',
            minHeight: isMobile ? '44px' : 'auto',
            backgroundColor: view === 'season' ? '#22d3ee' : '#131318',
            border: `1px solid ${view === 'season' ? '#22d3ee' : '#2a2a2a'}`,
            borderRadius: '8px',
            color: view === 'season' ? '#0a0a0a' : '#9ca3af',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          📅 {t('seasons.browseBySeason', 'Browse by Season')}
        </button>
        {user && (
          <button
            onClick={() => setShowMatchupModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: isMobile ? '0.75rem 1.25rem' : '0.6rem 1.25rem',
              minHeight: isMobile ? '44px' : 'auto',
              backgroundColor: '#131318',
              border: '1px solid #22c55e40',
              borderRadius: '8px',
              color: '#22c55e',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            📋 {t('seasons.addMatchup', 'Add Matchup')}
          </button>
        )}
        <button
          onClick={() => setView('all-time')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: isMobile ? '0.75rem 1.25rem' : '0.6rem 1.25rem',
            minHeight: isMobile ? '44px' : 'auto',
            backgroundColor: view === 'all-time' ? '#fbbf24' : '#131318',
            border: `1px solid ${view === 'all-time' ? '#fbbf24' : '#2a2a2a'}`,
            borderRadius: '8px',
            color: view === 'all-time' ? '#0a0a0a' : '#9ca3af',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          🏆 {t('seasons.allTimeGreatest', 'All-Time Greatest')}
        </button>
      </div>

      {/* Season Selector Dropdown (only in season view) */}
      {view === 'season' && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.75rem', 
          marginBottom: '1.5rem'
        }}>
          <span style={{ color: '#9ca3af', fontSize: '0.9rem', fontWeight: '500' }}>
            {t('seasons.selectSeason')}
          </span>
          <select
            value={selectedSeason ?? ''}
            onChange={(e) => handleSeasonChange(Number(e.target.value))}
            style={{
              padding: isMobile ? '0.6rem 2rem 0.6rem 1rem' : '0.5rem 2rem 0.5rem 1rem',
              minHeight: isMobile ? '44px' : 'auto',
              backgroundColor: '#131318',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#22d3ee',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
              fontFamily: "'Orbitron', monospace",
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '12px'
            }}
          >
            {seasons.map(season => (
              <option key={season} value={season} style={{ backgroundColor: '#131318', color: '#fff' }}>
                KvK #{season}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Matchups Display */}
      <div style={{
        backgroundColor: '#111111',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        {loading ? (
          <div style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: '#9ca3af'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚔️</div>
            <div style={{ fontSize: '0.95rem' }}>{t('seasons.loadingData', 'Loading battlefield data...')}</div>
          </div>
        ) : displayedMatchups.length === 0 ? (
          <div style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: '#9ca3af'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
            <div style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{t('seasons.noMatchups', 'No matchup data available yet')}</div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              {t('seasons.checkBackSoon', 'Score history is being calculated. Check back soon.')}
            </div>
          </div>
        ) : (
          /* Card Layout - Both Mobile and Desktop */
          <>
            <div style={{ 
              padding: isMobile ? '0.5rem' : '1rem',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 340px))',
              justifyContent: 'center',
              gap: isMobile ? '0.5rem' : '1rem'
            }}>
              {displayedMatchups.map((matchup, index) => {
                // Kingdom 1's prep/battle results (W, L, or null for partial)
                const k1PrepResult = matchup.prep_result;
                const k1BattleResult = matchup.battle_result;
                // Kingdom 2's results are the opposite (null stays null)
                const k2PrepResult = k1PrepResult === 'W' ? 'L' : k1PrepResult === 'L' ? 'W' : k1PrepResult;
                const k2BattleResult = k1BattleResult === 'W' ? 'L' : k1BattleResult === 'L' ? 'W' : k1BattleResult;
                const isPartial = matchup.is_partial;
                
                // Determine outcome based on prep/battle results for each kingdom
                // W/W = Domination (green 👑), L/W = Comeback (blue 💪), W/L = Reversal (purple 🔄), L/L = Invasion (red 💀)
                const getKingdomOutcome = (prepResult: string | null | undefined, battleResult: string | null | undefined) => {
                  if (prepResult === 'W' && battleResult === 'W') {
                    return { type: 'Domination', emoji: '👑', bg: '#22c55e20', color: '#22c55e' };
                  } else if (prepResult === 'L' && battleResult === 'W') {
                    return { type: 'Comeback', emoji: '💪', bg: '#3b82f620', color: '#3b82f6' };
                  } else if (prepResult === 'W' && battleResult === 'L') {
                    return { type: 'Reversal', emoji: '🔄', bg: '#a855f720', color: '#a855f7' };
                  } else if (prepResult === 'L' && battleResult === 'L') {
                    return { type: 'Invasion', emoji: '💀', bg: '#ef444420', color: '#ef4444' };
                  }
                  return null;
                };
                
                const k1Outcome = getKingdomOutcome(k1PrepResult, k1BattleResult);
                const k2Outcome = getKingdomOutcome(k2PrepResult, k2BattleResult);
                
                // Get rank display with medal emojis for top 3
                const getRankDisplay = (rank: number) => {
                  if (rank === 1) return '🥇 1st';
                  if (rank === 2) return '🥈 2nd';
                  if (rank === 3) return '🥉 3rd';
                  const s = ['th', 'st', 'nd', 'rd'] as const;
                  const v = rank % 100;
                  const idx = (v - 20) % 10;
                  const suffix = (idx >= 0 && idx < s.length ? s[idx] : undefined) ?? (v < s.length ? s[v] : undefined) ?? 'th';
                  return `${rank}${suffix}`;
                };
                
                // Get border color for top 3 cards
                const getCardBorder = (rank: number) => {
                  if (rank === 1) return `2px solid ${colors.gold}`; // Gold
                  if (rank === 2) return '2px solid #9ca3af'; // Silver
                  if (rank === 3) return `2px solid ${colors.bronze}`; // Bronze
                  return `1px solid ${colors.borderStrong}`;
                };
                
                const getCardGlow = (rank: number) => {
                  if (rank === 1) return `0 0 12px ${colors.gold}40, 0 0 4px ${colors.gold}20`;
                  if (rank === 2) return '0 0 10px #9ca3af30';
                  if (rank === 3) return `0 0 10px ${colors.bronze}30`;
                  return 'none';
                };
                
                return (
                  <div
                    key={`${matchup.kvk_number}-${matchup.kingdom1}-${matchup.kingdom2}`}
                    className="kvk-card"
                    style={{
                      backgroundColor: '#131318',
                      borderRadius: '10px',
                      border: isPartial ? '1px dashed #6b728050' : getCardBorder(index + 1),
                      boxShadow: isPartial ? 'none' : getCardGlow(index + 1),
                      overflow: 'hidden',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      opacity: isPartial ? 0.85 : 1
                    }}
                  >
                    {/* Partial badge */}
                    {isPartial && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        padding: '0.3rem', backgroundColor: '#eab30810',
                        borderBottom: '1px solid #eab30820', fontSize: '0.65rem', color: '#eab308'
                      }}>
                        {!k1PrepResult && !k1BattleResult ? '🔗 Matchup Only' : !k1BattleResult ? '🛡️ Prep Done — Awaiting Battle' : '⏳ Pending'}
                      </div>
                    )}
                    {/* Header: Rank + Combined Score */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.6rem 0.75rem',
                      borderBottom: '1px solid #2a2a2a'
                    }}>
                      {/* Left: Rank */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ 
                          color: '#fff',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}>
                          {getRankDisplay(index + 1)}
                        </span>
                        {view === 'all-time' && (
                          <span style={{ 
                            color: '#6b7280', 
                            fontSize: '0.7rem',
                            backgroundColor: '#1a1a1a',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px'
                          }}>
                            KvK #{matchup.kvk_number}
                          </span>
                        )}
                      </div>

                      {/* Right: Combined Score */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ color: '#6b7280', fontSize: isMobile ? '0.55rem' : '0.7rem' }}>
                          {t('seasons.combinedScore', 'Combined Score')}
                        </span>
                        <span style={{ 
                          color: '#22d3ee',
                          fontWeight: '600',
                          fontSize: '0.9rem'
                        }}>
                          {(matchup.combined_score ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Kingdom 1 Row */}
                    <Link 
                      to={`/kingdom/${matchup.kingdom1}`}
                      className="kingdom-row"
                      style={{ 
                        textDecoration: 'none',
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr 55px auto' : '1fr 80px auto',
                        alignItems: 'center',
                        gap: isMobile ? '0.25rem' : '0.5rem',
                        padding: isMobile ? '0.4rem 0.4rem' : '0.5rem 0.75rem',
                        minHeight: isMobile ? '48px' : '52px',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Kingdom Info */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: '600', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
                          {t('common.kingdom')} {matchup.kingdom1}
                        </div>
                        <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', marginTop: '0.1rem' }}>
                          <span style={{ color: '#22d3ee' }}>
                            {matchup.kingdom1_score.toFixed(2)}
                          </span>
                          {matchup.kingdom1_rank && <span style={{ color: '#22d3ee' }}> (#{matchup.kingdom1_rank})</span>}
                          <span style={{ color: '#6b7280' }}> • </span>
                          <span style={{ color: '#fbbf24' }}>{matchup.kingdom1_prep_record || '0-0'}</span>
                          <span style={{ color: '#6b7280' }}> • </span>
                          <span style={{ color: '#f97316' }}>{matchup.kingdom1_battle_record || '0-0'}</span>
                        </div>
                      </div>

                      {/* Prep & Battle Results - Fixed width column, center aligned */}
                      <div style={{ display: 'flex', gap: isMobile ? '0.15rem' : '0.5rem', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', width: isMobile ? '24px' : '32px' }}>
                          <div style={{ color: '#6b7280', fontSize: isMobile ? '0.45rem' : '0.55rem' }}>{t('kingdomCard.prep')}</div>
                          <div style={{ 
                            color: k1PrepResult === 'W' ? '#22c55e' : k1PrepResult === 'L' ? '#ef4444' : '#6b7280',
                            fontWeight: '700',
                            fontSize: isMobile ? '0.75rem' : '0.85rem'
                          }}>
                            {k1PrepResult || '—'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', width: isMobile ? '24px' : '32px' }}>
                          <div style={{ color: '#6b7280', fontSize: isMobile ? '0.45rem' : '0.55rem' }}>{t('kingdomCard.battle')}</div>
                          <div style={{ 
                            color: k1BattleResult === 'W' ? '#22c55e' : k1BattleResult === 'L' ? '#ef4444' : '#6b7280',
                            fontWeight: '700',
                            fontSize: isMobile ? '0.75rem' : '0.85rem'
                          }}>
                            {k1BattleResult || '—'}
                          </div>
                        </div>
                      </div>

                      {/* Outcome Badge */}
                      <div style={{ minWidth: isMobile ? '80px' : '95px', textAlign: 'right' }}>
                        {k1Outcome && (
                          <span style={{
                            backgroundColor: k1Outcome.bg,
                            color: k1Outcome.color,
                            padding: isMobile ? '0.15rem 0.3rem' : '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: isMobile ? '0.5rem' : '0.65rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.15rem'
                          }}>
                            {k1Outcome.emoji} {k1Outcome.type}
                          </span>
                        )}
                      </div>
                    </Link>

                    {/* VS divider */}
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#4a4a4a', 
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      letterSpacing: '0.1em',
                      padding: '0.2rem 0',
                      backgroundColor: '#0a0a0a'
                    }}>
                      vs.
                    </div>

                    {/* Kingdom 2 Row */}
                    <Link 
                      to={`/kingdom/${matchup.kingdom2}`}
                      className="kingdom-row"
                      style={{ 
                        textDecoration: 'none',
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr 55px auto' : '1fr 80px auto',
                        alignItems: 'center',
                        gap: isMobile ? '0.25rem' : '0.5rem',
                        padding: isMobile ? '0.4rem 0.4rem' : '0.5rem 0.75rem',
                        minHeight: isMobile ? '48px' : '52px',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Kingdom Info */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: '600', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
                          {t('common.kingdom')} {matchup.kingdom2}
                        </div>
                        <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', marginTop: '0.1rem' }}>
                          <span style={{ color: '#22d3ee' }}>
                            {matchup.kingdom2_score.toFixed(2)}
                          </span>
                          {matchup.kingdom2_rank && <span style={{ color: '#22d3ee' }}> (#{matchup.kingdom2_rank})</span>}
                          <span style={{ color: '#6b7280' }}> • </span>
                          <span style={{ color: '#fbbf24' }}>{matchup.kingdom2_prep_record || '0-0'}</span>
                          <span style={{ color: '#6b7280' }}> • </span>
                          <span style={{ color: '#f97316' }}>{matchup.kingdom2_battle_record || '0-0'}</span>
                        </div>
                      </div>

                      {/* Prep & Battle Results - Fixed width column, center aligned */}
                      <div style={{ display: 'flex', gap: isMobile ? '0.15rem' : '0.5rem', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', width: isMobile ? '24px' : '32px' }}>
                          <div style={{ color: '#6b7280', fontSize: isMobile ? '0.45rem' : '0.55rem' }}>{t('kingdomCard.prep')}</div>
                          <div style={{ 
                            color: k2PrepResult === 'W' ? '#22c55e' : k2PrepResult === 'L' ? '#ef4444' : '#6b7280',
                            fontWeight: '700',
                            fontSize: isMobile ? '0.75rem' : '0.85rem'
                          }}>
                            {k2PrepResult || '—'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', width: isMobile ? '24px' : '32px' }}>
                          <div style={{ color: '#6b7280', fontSize: isMobile ? '0.45rem' : '0.55rem' }}>{t('kingdomCard.battle')}</div>
                          <div style={{ 
                            color: k2BattleResult === 'W' ? '#22c55e' : k2BattleResult === 'L' ? '#ef4444' : '#6b7280',
                            fontWeight: '700',
                            fontSize: isMobile ? '0.75rem' : '0.85rem'
                          }}>
                            {k2BattleResult || '—'}
                          </div>
                        </div>
                      </div>

                      {/* Outcome Badge */}
                      <div style={{ minWidth: isMobile ? '80px' : '95px', textAlign: 'right' }}>
                        {k2Outcome && (
                          <span style={{
                            backgroundColor: k2Outcome.bg,
                            color: k2Outcome.color,
                            padding: isMobile ? '0.15rem 0.3rem' : '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: isMobile ? '0.5rem' : '0.65rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.15rem'
                          }}>
                            {k2Outcome.emoji} {k2Outcome.type}
                          </span>
                        )}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Infinite Scroll Loader */}
            <div 
              ref={loaderRef}
              style={{ 
                padding: '1.5rem', 
                textAlign: 'center'
              }}
            >
              {isLoadingMore && (
                <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                  {t('seasons.loadingMore', 'Loading more matchups...')}
                </div>
              )}
              {!isLoadingMore && displayLimit >= (view === 'all-time' ? allTimeMatchups : matchups).length && (
                <div style={{ color: '#4a4a4a', fontSize: '0.8rem' }}>
                  {t('seasons.allLoaded', 'All matchups loaded')}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer info */}
      <div style={{
        marginTop: '2rem',
        padding: '1.25rem',
        backgroundColor: '#131318',
        border: '1px solid #2a2a2a',
        borderRadius: '12px'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>💡</span>
          <div>
            <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
              {t('seasons.combinedPowerTitle', 'What is Combined Power Level?')}
            </h4>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
              {t('seasons.combinedPowerDesc', "The sum of both kingdoms' Atlas Scores going into the matchup. Higher scores = more competitive battles between proven kingdoms. This is how legends are made.")}
            </p>
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>🎯</span>
          <div>
            <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
              {t('seasons.scoreTimingTitle', 'Score Timing')}
            </h4>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
              {t('seasons.scoreTimingDesc', "Scores reflect each kingdom's Atlas Score before the battle began—based on their track record up to that point. No hindsight, just raw pre-battle power.")}
            </p>
          </div>
        </div>
      </div>
      </div>

      {/* KvK Matchup Submission Modal */}
      <KvKMatchupSubmission
        isOpen={showMatchupModal}
        onClose={() => setShowMatchupModal(false)}
        defaultKvkNumber={selectedSeason ?? CURRENT_KVK}
        onSuccess={() => {
          // Reload matchups after successful submission
          scoreHistoryService.clearCache();
          if (selectedSeason) {
            scoreHistoryService.getSeasonMatchups(selectedSeason).then(m => setMatchups(m));
          }
        }}
      />
    </div>
  );
};

export default KvKSeasons;
