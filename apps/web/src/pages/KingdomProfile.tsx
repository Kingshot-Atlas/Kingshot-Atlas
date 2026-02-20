import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { KingdomProfile as KingdomProfileType, getPowerTier } from '../types';
import { incrementStat } from '../components/UserAchievements';
import { getAchievements } from '../components/kingdom-card/AchievementBadges';
// Note: Atlas Score comes from Supabase (kingdom.overall_score) - DO NOT recalculate client-side
import { apiService, dataLoadError } from '../services/api';
import { DataLoadError } from '../components/DataLoadError';
import { KingdomProfileSkeleton } from '../components/Skeleton';
import { statusService } from '../services/statusService';
import { logger } from '../utils/logger';
import { useKingdomsRealtime } from '../hooks/useKingdomsRealtime';
import StatusSubmission from '../components/StatusSubmission';
import ReportDataModal from '../components/ReportDataModal';
import ReportKvKErrorModal from '../components/ReportKvKErrorModal';
// Lazy-load below-fold components for bundle splitting
const KingdomReviews = lazy(() => import('../components/KingdomReviews'));
const TrendChart = lazy(() => import('../components/TrendChart'));
const ScoreHistoryChart = lazy(() => import('../components/ScoreHistoryChart'));
const RankingHistoryChart = lazy(() => import('../components/RankingHistoryChart'));
const SimilarKingdoms = lazy(() => import('../components/SimilarKingdoms'));
const KingdomPlayers = lazy(() => import('../components/KingdomPlayers'));
const AtlasScoreBreakdown = lazy(() => import('../components/AtlasScoreBreakdown'));
const PathToNextTier = lazy(() => import('../components/PathToNextTier'));
const ScoreSimulator = lazy(() => import('../components/ScoreSimulator').then(m => ({ default: m.ScoreSimulator })));
import { KingdomHeader, QuickStats, PhaseCards, KvKHistoryTable, LoginGatedSection } from '../components/kingdom-profile';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuth } from '../contexts/AuthContext';
// FavoritesContext is used by child components directly
import { useToast } from '../components/Toast';
import { isAdminUsername } from '../utils/constants';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, getKingdomMetaTags } from '../hooks/useMetaTags';
import { useStructuredData, getKingdomBreadcrumbs } from '../hooks/useStructuredData';
import { useKingdomFund, useFundTransactions, useKingdomPendingSubmissions, useKingdomEditor, useKingdomAggregateRating, kingdomProfileKeys } from '../hooks/useKingdomProfileQueries';
import { scoreHistoryService } from '../services/scoreHistoryService';
import { analyticsService } from '../services/analyticsService';
import { useScrollDepth } from '../hooks/useScrollDepth';
const KingdomFundContribute = lazy(() => import('../components/KingdomFundContribute'));
import { useTranslation } from 'react-i18next';

const KingdomProfile: React.FC = () => {
  const { kingdomNumber } = useParams<{ kingdomNumber: string }>();
  const { t } = useTranslation();
  useDocumentTitle(kingdomNumber ? `${t('common.kingdom', 'Kingdom')} ${kingdomNumber}` : undefined);
  useScrollDepth('Kingdom Profile');
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [kingdom, setKingdom] = useState<KingdomProfileType | null>(null);
  const [allKingdoms, setAllKingdoms] = useState<KingdomProfileType[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const [refreshKey, setRefreshKey] = useState(0);
  const [scoreHistoryRank, setScoreHistoryRank] = useState<number>(0);
  const [totalKingdomsAtKvk, setTotalKingdomsAtKvk] = useState<number>(0);
  const [percentileRank, setPercentileRank] = useState<number>(0);
  const [recentScoreChange, setRecentScoreChange] = useState<number | null>(null);
  const [recentRankChange, setRecentRankChange] = useState<number | null>(null);
  const [visitDelta, setVisitDelta] = useState<number | null>(null);

  // Auto-refresh when KvK history changes for this kingdom via realtime
  const handleKvkHistoryUpdate = useCallback((updatedKingdom: number, kvkNumber: number) => {
    if (kingdomNumber && updatedKingdom === parseInt(kingdomNumber)) {
      logger.log(`Realtime: KvK history updated for K${updatedKingdom} #${kvkNumber}, refreshing...`);
      setRefreshKey(prev => prev + 1);
    }
  }, [kingdomNumber]);

  useKingdomsRealtime({
    onKvkHistoryUpdate: handleKvkHistoryUpdate,
  });

  // Modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showKvKErrorModal, setShowKvKErrorModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);

  // React Query hooks (ADR-022 migration)
  const kNum = kingdomNumber ? parseInt(kingdomNumber) : undefined;
  const { data: fundData = null } = useKingdomFund(kNum);
  const { data: fundTransactions = [] } = useFundTransactions(kNum);
  const { data: hasPendingSubmission = false } = useKingdomPendingSubmissions(kNum);
  const { data: editorData } = useKingdomEditor(kNum, user?.id);
  const managedBy = editorData?.managedBy ?? null;
  const isKingdomEditor = editorData?.isEditor ?? false;
  const { data: aggregateRating = null } = useKingdomAggregateRating(kNum);
  const location = useLocation();
  
  // Auto-open fund modal when visiting /kingdom/{number}/fund
  useEffect(() => {
    if (location.pathname.endsWith('/fund') && kingdom) {
      setShowFundModal(true);
    }
  }, [location.pathname, kingdom]);


  // Expand/collapse all state for collapsible sections
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [scoreHistoryExpanded, setScoreHistoryExpanded] = useState(false);
  const [rankingHistoryExpanded, setRankingHistoryExpanded] = useState(false);
  const [simulatorExpanded, setSimulatorExpanded] = useState(false);
  const [pathExpanded, setPathExpanded] = useState(false);
  const [trendExpanded, setTrendExpanded] = useState(false);
  
  const allExpanded = breakdownExpanded && scoreHistoryExpanded && rankingHistoryExpanded && simulatorExpanded && pathExpanded && trendExpanded;
  const toggleAllSections = () => {
    const newState = !allExpanded;
    setBreakdownExpanded(newState);
    setScoreHistoryExpanded(newState);
    setRankingHistoryExpanded(newState);
    setSimulatorExpanded(newState);
    setPathExpanded(newState);
    setTrendExpanded(newState);
  };




  const handleStatusSubmit = async (newStatus: string, notes: string) => {
    if (!user || !kingdom) return;
    
    const adminUser = isAdminUsername(profile?.linked_username) || isAdminUsername(profile?.username);
    const canAutoApprove = adminUser || isKingdomEditor;
    await statusService.submitStatusUpdate(
      kingdom.kingdom_number,
      kingdom.most_recent_status || 'Unannounced',
      newStatus,
      notes,
      user.id,
      canAutoApprove
    );
    
    showToast(canAutoApprove ? 'Status update auto-approved!' : 'Status update submitted for review!', 'success');
    // Invalidate pending submissions cache so it refetches
    queryClient.invalidateQueries({ queryKey: kingdomProfileKeys.pendingSubmissions(kingdom.kingdom_number) });
  };

  useEffect(() => {
    if (kingdomNumber) {
      loadKingdomProfile(parseInt(kingdomNumber));
    }
  }, [kingdomNumber, refreshKey]);

  const loadKingdomProfile = async (id: number) => {
    setLoading(true);
    try {
      const data = await apiService.getKingdomProfile(id);
      setKingdom(data);
      
      const all = await apiService.getKingdoms();
      setAllKingdoms(all as unknown as KingdomProfileType[]);
      
      // Fetch rank from score_history (single source of truth)
      const [rankData, scoreHistory] = await Promise.all([
        scoreHistoryService.getLatestRank(id),
        scoreHistoryService.getKingdomScoreHistory(id),
      ]);
      if (rankData) {
        setScoreHistoryRank(rankData.rank);
        setTotalKingdomsAtKvk(rankData.totalAtKvk);
        setPercentileRank(rankData.percentileRank);
      }
      // Get last KvK score change for the Score Change Hook nudge
      if (scoreHistory && scoreHistory.history.length >= 2) {
        const h = scoreHistory.history;
        const delta = h[h.length - 1]!.score - h[h.length - 2]!.score;
        setRecentScoreChange(delta);
        // Rank change: positive = climbed (lower rank number is better)
        const prevRank = h[h.length - 2]!.rank_at_time;
        const currRank = h[h.length - 1]!.rank_at_time;
        if (prevRank != null && currRank != null) {
          setRecentRankChange(prevRank - currRank);
        } else {
          setRecentRankChange(null);
        }
      } else {
        setRecentScoreChange(null);
        setRecentRankChange(null);
      }
      
      // Return Visit Delta: compare current score to last-seen score
      if (data) {
        const visitKey = `kingshot_visit_score_${id}`;
        const lastSeenRaw = localStorage.getItem(visitKey);
        if (lastSeenRaw) {
          const lastScore = parseFloat(lastSeenRaw);
          const delta = data.overall_score - lastScore;
          if (Math.abs(delta) >= 0.01) {
            setVisitDelta(delta);
          } else {
            setVisitDelta(null);
          }
        } else {
          setVisitDelta(null);
        }
        localStorage.setItem(visitKey, data.overall_score.toString());
      }

      // Track profile view for onboarding nudge (Stage 1)
      try {
        const countKey = 'atlas_onboarding_profileViewCount';
        const current = parseInt(localStorage.getItem(countKey) || '0', 10);
        localStorage.setItem(countKey, String(current + 1));
      } catch { /* localStorage unavailable */ }

      // Save to recently viewed and track achievement
      const recentKey = 'kingshot_recently_viewed';
      const saved = localStorage.getItem(recentKey);
      let recent: number[] = saved ? JSON.parse(saved) : [];
      if (!recent.includes(id)) {
        incrementStat('kingdomsViewed');
      }
      recent = [id, ...recent.filter(k => k !== id)].slice(0, 10);
      localStorage.setItem(recentKey, JSON.stringify(recent));
    } catch (error) {
      logger.error('Failed to load kingdom profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate derived values (needed for hooks that must be called unconditionally)
  const status = kingdom?.most_recent_status || 'Unannounced';
  
  // Use Atlas Score from Supabase (single source of truth) - DO NOT recalculate client-side
  const atlasScore = kingdom?.overall_score ?? 0;
  const powerTier = kingdom ? getPowerTier(atlasScore) : 'D';
  
  // Rank comes from score_history table (single source of truth)
  // This matches the rank shown in the Kingdom Ranking History chart
  const rank = scoreHistoryRank;
  const rankingList = allKingdoms;
  
  // Update meta tags - must be called before any early returns
  useMetaTags(kingdom ? getKingdomMetaTags(kingdom.kingdom_number, undefined, powerTier, undefined) : {});
  
  // Inject structured data for SEO (with aggregateRating only if 5+ reviews exist)
  useStructuredData({
    type: 'KingdomProfile',
    data: {
      kingdomNumber: kingdom?.kingdom_number || parseInt(kingdomNumber || '0'),
      tier: powerTier,
      atlasScore: atlasScore,
      rank: rank > 0 ? rank : undefined,
      aggregateRating: aggregateRating
    }
  });
  useStructuredData({ type: 'BreadcrumbList', data: getKingdomBreadcrumbs(parseInt(kingdomNumber || '0')) });

  if (loading) {
    return <KingdomProfileSkeleton />;
  }

  if (!kingdom) {
    if (dataLoadError) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <DataLoadError onRetry={() => window.location.reload()} />
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <div style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: '1rem' }}>{t('kingdomProfile.notFoundMessage', "Kingdom not found. Either it doesn't exist, or we haven't tracked it yet.")}</div>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none' }}>{t('common.backToHome')}</Link>
        </div>
      </div>
    );
  }
  
  // Calculate achievements (uses shared getAchievements from kingdom-card/AchievementBadges)
  const achievements = getAchievements(kingdom);

  // Use full history values from kingdom data
  const highKings = kingdom.dominations ?? 0;
  const invaderKings = kingdom.invasions ?? kingdom.defeats ?? 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section */}
      <KingdomHeader
        kingdom={kingdom}
        rank={rank}
        totalKingdomsAtKvk={totalKingdomsAtKvk}
        percentileRank={percentileRank}
        atlasScore={atlasScore}
        powerTier={powerTier}
        achievements={achievements}
        status={status}
        hasPendingSubmission={hasPendingSubmission}
        isMobile={isMobile}
        recentScoreChange={recentScoreChange}
        recentRankChange={recentRankChange}
        isLinked={!!profile?.linked_username}
        managedBy={managedBy}
        isKingdomEditor={isKingdomEditor}
        onStatusModalOpen={() => {
          if (!user) {
            showToast(t('kingdomProfile.signInToSubmit', 'Please sign in to submit status updates'), 'error');
            navigate('/login?redirect=' + window.location.pathname);
            return;
          }
          if (!profile?.linked_username) {
            showToast(t('home.linkToSubmit'), 'error');
            navigate('/profile');
            return;
          }
          setShowStatusModal(true);
        }}
        onReportModalOpen={() => setShowReportModal(true)}
      />

      {/* Main Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem 2rem' }}>
        {/* Quick Stats Grid */}
        <QuickStats
          totalKvks={kingdom.total_kvks}
          dominations={highKings}
          invasions={invaderKings}
          prepWins={kingdom.prep_wins}
          battleWins={kingdom.battle_wins}
          isMobile={isMobile}
        />

        {/* Return Visit Delta - shows score change since last visit */}
        {visitDelta !== null && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            marginBottom: isMobile ? '1rem' : '1.25rem',
            backgroundColor: visitDelta > 0 ? '#22c55e10' : '#ef444410',
            border: `1px solid ${visitDelta > 0 ? '#22c55e30' : '#ef444430'}`,
            borderRadius: '8px',
          }}>
            <span style={{ fontSize: '0.8rem' }}>{visitDelta > 0 ? '📈' : '📉'}</span>
            <span style={{ 
              color: visitDelta > 0 ? '#22c55e' : '#ef4444', 
              fontSize: '0.8rem', 
              fontWeight: '500' 
            }}>
              {t('kingdomProfile.scoreSinceVisit', 'Score {{change}} since your last visit', { change: `${visitDelta > 0 ? '+' : ''}${visitDelta.toFixed(2)}` })}
            </span>
            <button
              onClick={() => setVisitDelta(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '0.75rem',
                padding: '0.5rem',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Phase Performance Cards */}
        <PhaseCards
          prepWins={kingdom.prep_wins}
          prepLosses={kingdom.prep_losses}
          prepWinRate={kingdom.prep_win_rate}
          prepBestStreak={kingdom.prep_best_streak ?? 0}
          battleWins={kingdom.battle_wins}
          battleLosses={kingdom.battle_losses}
          battleWinRate={kingdom.battle_win_rate}
          battleBestStreak={kingdom.battle_best_streak ?? 0}
          recentKvks={kingdom.recent_kvks || []}
          isMobile={isMobile}
        />

        {/* KvK History Section */}
        <KvKHistoryTable
          kingdomNumber={kingdom.kingdom_number}
          kvkRecords={kingdom.recent_kvks || []}
          isMobile={isMobile}
          onReportErrorClick={() => setShowKvKErrorModal(true)}
        />

        {/* Expand/Collapse All Button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          marginBottom: '0.75rem'
        }}>
          <button
            onClick={toggleAllSections}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllSections(); } }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: isMobile ? '0.6rem 1rem' : '0.4rem 0.75rem',
              minHeight: isMobile ? '44px' : 'auto',
              backgroundColor: '#131318',
              border: '1px solid #2a2a2a',
              borderRadius: '6px',
              color: '#6b7280',
              fontSize: isMobile ? '0.8rem' : '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#22d3ee40';
              e.currentTarget.style.color = '#22d3ee';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ 
                transform: allExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {allExpanded ? t('kingdomProfile.collapseAll', 'Collapse All') : t('kingdomProfile.expandAll', 'Expand All')}
          </button>
        </div>

        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading analytics...</div>}>
        {/* Atlas Score Breakdown - Toggleable Radar Chart */}
        {user ? (
          <AtlasScoreBreakdown 
            kingdom={kingdom} 
            rank={rank > 0 ? rank : undefined}
            totalKingdoms={totalKingdomsAtKvk > 0 ? totalKingdomsAtKvk : (rankingList.length || undefined)}
            isExpanded={breakdownExpanded}
            onToggle={setBreakdownExpanded}
          />
        ) : (
          <LoginGatedSection title={t('scoreBreakdown.title', 'Atlas Score Breakdown')} subtitle={t('scoreBreakdown.whyScore', '\u201CWhy is my score what it is?\u201D')} isExpanded={breakdownExpanded} onToggle={setBreakdownExpanded} isMobile={isMobile} />
        )}

        {/* Atlas Score Simulator - Pro Feature */}
        {user ? (
          <ScoreSimulator 
            kingdom={kingdom} 
            isExpanded={simulatorExpanded}
            onToggle={setSimulatorExpanded}
          />
        ) : (
          <LoginGatedSection title={t('simulator.title', 'Atlas Score Simulator')} subtitle={t('simulator.subtitle', '\u201CWhat if I win the next KvK?\u201D')} isExpanded={simulatorExpanded} onToggle={setSimulatorExpanded} isMobile={isMobile} />
        )}

        {/* Atlas Score History Chart */}
        {user ? (
          <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
            <ScoreHistoryChart 
              kingdomNumber={kingdom.kingdom_number} 
              isExpanded={scoreHistoryExpanded}
              onToggle={setScoreHistoryExpanded}
            />
          </div>
        ) : (
          <LoginGatedSection title={t('scoreHistory.title', 'Atlas Score History')} subtitle={t('scoreHistory.subtitle', '\u201CHow has my score evolved?\u201D')} isExpanded={scoreHistoryExpanded} onToggle={setScoreHistoryExpanded} isMobile={isMobile} />
        )}

        {/* Kingdom Ranking History Chart */}
        {user ? (
          <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
            <RankingHistoryChart 
              kingdomNumber={kingdom.kingdom_number} 
              isExpanded={rankingHistoryExpanded}
              onToggle={setRankingHistoryExpanded}
            />
          </div>
        ) : (
          <LoginGatedSection title={t('rankingHistory.title', 'Kingdom Ranking History')} subtitle={t('rankingHistory.subtitle', '\u201CAm I climbing or slipping?\u201D')} isExpanded={rankingHistoryExpanded} onToggle={setRankingHistoryExpanded} isMobile={isMobile} />
        )}

        {/* Path to Next Tier - What-If Scenarios */}
        {user ? (
          <PathToNextTier 
            kingdom={kingdom} 
            isExpanded={pathExpanded}
            onToggle={setPathExpanded}
          />
        ) : (
          <LoginGatedSection title={t('pathToTier.title', 'Path to Next Tier')} subtitle={t('pathToTier.subtitle', '\u201CHow do I reach the next tier?\u201D')} isExpanded={pathExpanded} onToggle={setPathExpanded} isMobile={isMobile} />
        )}

        {/* Performance Trend Chart */}
        {user ? (
          <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
            <TrendChart 
              kvkRecords={kingdom.recent_kvks || []} 
              isExpanded={trendExpanded}
              onToggle={setTrendExpanded}
            />
          </div>
        ) : (
          <LoginGatedSection title={t('performanceTrend.title', 'Performance Trend')} subtitle={t('performanceTrend.subtitle', '\u201CWhat\u2019s my win rate trend?\u201D')} isExpanded={trendExpanded} onToggle={setTrendExpanded} isMobile={isMobile} />
        )}

        {/* Atlas Users from this Kingdom */}
        {user ? (
          <KingdomPlayers kingdomNumber={kingdom.kingdom_number} themeColor="#22d3ee" />
        ) : (
          <div style={{
            backgroundColor: '#131318',
            borderRadius: '12px',
            padding: isMobile ? '1rem' : '1.25rem',
            marginBottom: '1.5rem',
            border: '1px solid #22d3ee30',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
              {t('kingdomProfile.atlasUsersFrom', 'Atlas Users from Kingdom {{num}}', { num: kingdom.kingdom_number })}
            </h3>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔒</div>
            <div style={{ color: '#d1d5db', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.35rem' }}>
              {t('kingdomProfile.signInToSeeUsers', 'Sign in to see Atlas users')}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {t('kingdomProfile.linkToSeePlayers', 'Log in and link your Kingshot account to see players from this kingdom.')}
            </div>
            <Link
              to="/profile"
              onClick={() => analyticsService.trackButtonClick('Gated CTA: Kingdom Players')}
              style={{
                display: 'inline-block',
                padding: '0.5rem 1.25rem',
                background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
                borderRadius: '8px',
                color: '#000',
                fontWeight: '600',
                fontSize: '0.85rem',
                textDecoration: 'none'
              }}
            >
              {t('common.signIn')} / {t('kingdomProfile.register', 'Register')}
            </Link>
          </div>
        )}

        {/* Reviews Section */}
        <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
          <KingdomReviews kingdomNumber={kingdom.kingdom_number} />
        </div>
        </Suspense>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'center', 
          alignItems: 'center',
          gap: '1rem',
          paddingBottom: '2rem' 
        }}>
          {/* Similar Kingdoms */}
          {allKingdoms.length > 0 && (
            <Suspense fallback={null}>
              <div style={{ width: '100%', maxWidth: '400px' }}>
                <SimilarKingdoms currentKingdom={kingdom} allKingdoms={allKingdoms} limit={4} />
              </div>
            </Suspense>
          )}


          <button
            onClick={() => setShowFundModal(true)}
            style={{
              padding: isMobile ? '0.75rem 1.5rem' : '0.75rem 2rem',
              backgroundColor: '#22c55e15',
              border: '1px solid #22c55e30',
              borderRadius: '10px',
              color: '#22c55e',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            💰 {t('kingdomProfile.chipInToFund', 'Chip In to Fund')}
          </button>

          {/* Fund Activity Log — visible when transactions exist or grace period active */}
          {(fundTransactions.length > 0 || (fundData?.gracePeriodUntil && new Date(fundData.gracePeriodUntil) > new Date())) && (
            <div style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#111111',
              border: '1px solid #2a2a2a',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
            }}>
              {/* Grace Period Alert */}
              {fundData?.gracePeriodUntil && new Date(fundData.gracePeriodUntil) > new Date() && (
                <div style={{
                  padding: '0.5rem 0.6rem',
                  backgroundColor: '#f59e0b10',
                  border: '1px solid #f59e0b30',
                  borderRadius: '6px',
                  marginBottom: '0.5rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}>
                  <span style={{ fontSize: '0.8rem' }}>⚠️</span>
                  <span style={{ color: '#f59e0b', fontSize: '0.65rem', lineHeight: 1.3 }}>
                    {t('kingdomProfile.gracePeriodWarning', 'Tier grace period active — contribute to maintain the current tier before {{date}}', {
                      date: new Date(fundData.gracePeriodUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    })}
                  </span>
                </div>
              )}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}>
                <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('kingdomProfile.fundActivity', 'Fund Activity')}
                </span>
                {fundData && (
                  <span style={{
                    color: fundData.tier === 'gold' ? '#ffc30b' : fundData.tier === 'silver' ? '#d1d5db' : fundData.tier === 'bronze' ? '#cd7f32' : '#6b7280',
                    fontSize: '0.7rem', fontWeight: '600', textTransform: 'capitalize',
                  }}>
                    {fundData.tier} · ${fundData.balance.toFixed(2)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {fundTransactions.slice(0, 5).map((tx) => {
                  const isDepletion = tx.type === 'depletion';
                  const isContribution = tx.type === 'contribution';
                  return (
                    <div key={tx.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.35rem 0.5rem',
                      backgroundColor: '#0a0a0a', borderRadius: '6px',
                      border: `1px solid ${isDepletion ? '#ef444415' : '#1a1a1a'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>{isDepletion ? '📉' : isContribution ? '💰' : '🔧'}</span>
                        <span style={{
                          color: isDepletion ? '#ef4444' : '#22c55e',
                          fontWeight: '600', fontSize: '0.8rem',
                        }}>
                          {isDepletion ? '' : '+'}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                        <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                          → ${tx.balance_after.toFixed(2)}
                        </span>
                      </div>
                      <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                        {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
              {fundTransactions.length > 5 && (
                <div style={{ textAlign: 'center', marginTop: '0.35rem' }}>
                  <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                    {t('kingdomProfile.fundMoreTransactions', '+ {{count}} more transactions', { count: fundTransactions.length - 5 })}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => navigate(`/compare?kingdoms=${kingdom.kingdom_number},`)}
            style={{
              padding: isMobile ? '1rem 2rem' : '1rem 2.5rem',
              background: 'linear-gradient(135deg, #22d3ee 0%, #7c3aed 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.25)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              width: isMobile ? '100%' : 'auto'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 25px rgba(168, 85, 247, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.25)';
            }}
          >
            {t('kingdomProfile.compareWith', 'Compare with another Kingdom')}
          </button>
          
          <Link 
            to="/" 
            style={{ 
              color: '#6b7280', 
              textDecoration: 'none', 
              fontSize: '0.85rem',
              padding: '0.75rem 1.5rem',
              border: '1px solid #333',
              borderRadius: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#22d3ee40';
              e.currentTarget.style.color = '#22d3ee';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            {t('common.backToHome')}
          </Link>
        </div>
      </div>

      {/* Status Submission Modal */}
      {showStatusModal && kingdom && (
        <StatusSubmission
          kingdomNumber={kingdom.kingdom_number}
          currentStatus={status}
          onSubmit={handleStatusSubmit}
          onClose={() => setShowStatusModal(false)}
        />
      )}

      {/* Report Data Modal */}
      {kingdom && (
        <ReportDataModal
          kingdom={kingdom}
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
        />
      )}


      {/* Kingdom Fund Contribution Modal */}
      {showFundModal && kingdom && (
        <Suspense fallback={null}>
          <KingdomFundContribute
            kingdomNumber={kingdom.kingdom_number}
            currentBalance={fundData?.balance ?? 0}
            currentTier={fundData?.tier ?? 'standard'}
            onClose={() => {
              setShowFundModal(false);
              // If we came from /fund route, navigate back to the profile
              if (location.pathname.endsWith('/fund')) {
                navigate(`/kingdom/${kingdom.kingdom_number}`, { replace: true });
              }
            }}
          />
        </Suspense>
      )}

      {/* KvK Error Report Modal */}
      {kingdom && (
        <ReportKvKErrorModal
          kingdomNumber={kingdom.kingdom_number}
          kvkRecords={kingdom.recent_kvks || []}
          isOpen={showKvKErrorModal}
          onClose={() => setShowKvKErrorModal(false)}
        />
      )}

      {/* Persistent bottom banner for anonymous users */}
      {!user && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'linear-gradient(180deg, transparent 0%, #0a0a0a 20%)',
          paddingTop: '1.5rem',
          paddingBottom: 'env(safe-area-inset-bottom, 0.75rem)',
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '0.6rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
          }}>
            <span style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem' }}>
              {t('kingdomProfile.signInFree', 'Sign in free to unlock detailed analytics')}
            </span>
            <Link
              to="/profile"
              onClick={() => analyticsService.trackButtonClick('Gated CTA: Sticky Banner')}
              style={{
                padding: '0.4rem 1rem',
                background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
                borderRadius: '6px',
                color: '#000',
                fontWeight: '600',
                fontSize: isMobile ? '0.75rem' : '0.8rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {t('common.signIn')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default KingdomProfile;
